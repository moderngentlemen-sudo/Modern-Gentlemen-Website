"""Designer controller regression with simulated OAuth and intercepted Gmail API.

No real Google authorization, Gmail account, clipboard or recipient mail is used.
"""
from pathlib import Path
import base64, hashlib, json, posixpath, re
from playwright.sync_api import sync_playwright
from browser_runtime import launch_chromium

ROOT = Path(__file__).resolve().parents[1] / 'public'
MODULES = ['shared/rendered-images.mjs', 'shared/email-assets.mjs', 'shared/gmail-export.mjs',
           'blocks/qr.mjs', 'design/catalog.mjs', 'design/engine.mjs', 'design/media.mjs',
           'design/cloud.mjs', 'design/app.mjs']


def boot(page):
    html = re.sub(r'<script\b[^>]*>.*?</script>|<link\b[^>]*>', '', (ROOT / 'design/index.html').read_text(encoding='utf-8'), flags=re.S)
    assets = {p.name: 'data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode() for p in (ROOT / 'design/media').glob('*.png')}
    html = html.replace('src="/design/media/mg-logo.png"', 'src="' + assets['mg-logo.png'] + '"')
    page.set_content(html)
    page.add_style_tag(content=(ROOT / 'design/design.css').read_text(encoding='utf-8'))
    page.expose_function('__testSha256', lambda values: list(hashlib.sha256(bytes(values)).digest()))
    page.evaluate(r'''assets=>{
      window.__assets=assets;window.__gmailFixture={callbacks:[],patches:[],reads:0};
      Object.defineProperty(window,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
      if(!crypto.subtle)Object.defineProperty(crypto,'subtle',{value:{digest:async(_,bytes)=>new Uint8Array(await __testSha256(Array.from(new Uint8Array(bytes.buffer||bytes)))).buffer}});
      if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{value:()=>Math.random().toString(16).slice(2)});
      window.SIGNATURE_STUDIO_CONFIG={enableDirectGmail:true,googleClientId:'fixture-client'};
      window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>__gmailFixture.callbacks.push(options.callback)})}}};
      const original=window.fetch.bind(window);
      window.fetch=async(url,options={})=>{
        const value=String(url),local=value.match(/\/design\/media\/([^/?]+)$/);
        if(local&&assets[local[1]])return original(assets[local[1]],options);
        if(value.startsWith('https://gmail.googleapis.com/')){
          if(options.method==='PATCH'){__gmailFixture.patches.push(JSON.parse(options.body));return new Response('{}');}
          __gmailFixture.reads++;return new Response(JSON.stringify({sendAs:[{isPrimary:true,sendAsEmail:'fixture@example.com'}]}));
        }
        if(value.startsWith('data:'))return original(value,options);
        throw new Error('Unexpected network request in offline designer test');
      };
    }''', assets)
    assembled = 'const __modules={};\n'
    for name in MODULES:
        code = (ROOT / name).read_text(encoding='utf-8')
        exports = re.findall(r'export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)', code)
        for group in re.findall(r'export\s*\{([^}]+)\};', code):
            exports += [entry.strip() for entry in group.split(',')]
        code = re.sub(r'export\s*\{[^}]+\};', '', code)
        code = re.sub(r'\bexport\s+', '', code)
        def imports(match):
            dest = posixpath.normpath(posixpath.join(posixpath.dirname(name), match[2]))
            return 'const {' + re.sub(r'\s+as\s+', ':', match[1]) + '}=__modules[' + json.dumps(dest) + '];'
        code = re.sub(r"import\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"];", imports, code)
        code = code.replace('location.origin', "'https://signature-studio.test'")
        if name == 'design/app.mjs':
            code += '\nwindow.__designer={load:loadProject,run:name=>actions[name]?.(),ready:()=>renderPromise};'
        assembled += '__modules[' + json.dumps(name) + ']=(function(){\n' + code + '\nreturn {' + ','.join(exports) + '};})();\n'
    page.add_script_tag(content=assembled + 'window.__modules=__modules;')
    page.evaluate('''()=>{const p=__modules['design/catalog.mjs'].freshProject();for(const asset of Object.values(p.assets))asset.src='';p.socials=[];p.identity.name='Original signature';__designer.load(p);return __designer.ready();}''')


with sync_playwright() as playwright:
    browser = launch_chromium(playwright)
    for change in ['project', 'new preparation', 'unchanged']:
        page = browser.new_page(viewport={'width': 1400, 'height': 1000})
        page.set_default_timeout(12000)
        page.route('**/*', lambda route: route.abort())
        page.on('dialog', lambda dialog: dialog.accept())
        boot(page)
        page.evaluate("void __designer.run('direct-gmail')")
        page.wait_for_function('__gmailFixture.callbacks.length===1')
        if change == 'project':
            page.evaluate("()=>{const p=__modules['design/catalog.mjs'].freshProject();for(const asset of Object.values(p.assets))asset.src='';p.socials=[];p.identity.name='Replacement signature';__designer.load(p);return __designer.ready();}")
        if change != 'unchanged':
            page.evaluate("__designer.run('email-prepare')")
        page.evaluate("__gmailFixture.callbacks[0]({access_token:'fixture-google-token'})")
        page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        if change == 'unchanged':
            page.wait_for_function('__gmailFixture.patches.length===1')
            assert 'Original signature' in page.evaluate('__gmailFixture.patches[0].signature')
        else:
            assert page.evaluate('__gmailFixture.patches.length') == 0
            assert page.evaluate('__gmailFixture.reads') == 0
        print('PASS simulated direct Gmail:', change, flush=True)
        page.close()
    browser.close()
