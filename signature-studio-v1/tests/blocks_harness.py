"""Offline Chromium harness: production modules execute in scoped IIFEs.
Only asset URLs, storage and secure-context crypto are substituted.
Live navigation, OAuth, clipboard permissions and Supabase are not exercised.
"""
from pathlib import Path
import re, json, base64, posixpath
ROOT=Path(__file__).resolve().parents[1]/'public'
MODULES=['design/catalog.mjs','design/engine.mjs','design/media.mjs','design/cloud.mjs','blocks/model.mjs','blocks/render.mjs','blocks/qr.mjs','blocks/media.mjs','blocks/inspector.mjs','blocks/alignment.mjs','blocks/canvas-tools.mjs','blocks/app.mjs']
def boot(page,stored=None):
    assets={p.name:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (ROOT/'design/media').glob('*.png')}
    html=(ROOT/'blocks/index.html').read_text()
    html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
    html=re.sub(r'<link\b[^>]*>','',html)
    html=html.replace('src="/design/media/mg-logo.png"','src="'+assets['mg-logo.png']+'"')
    page.set_content(html)
    page.add_style_tag(content=(ROOT/'blocks/blocks.css').read_text()+'\n'+(ROOT/'blocks/canvas-tools.css').read_text())
    page.evaluate('''({stored,assets})=>{
      const data={...stored};Object.defineProperty(window,'localStorage',{value:{getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],clear:()=>Object.keys(data).forEach(k=>delete data[k])}});
      window.__storage=data;window.__assets=assets;window.SIGNATURE_STUDIO_CONFIG={};
      if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{value:()=>('10000000-1000-4000-8000-'+Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12))});
    }''', {'stored':stored or {},'assets':assets})
    assembled='const __modules={};\n'
    for name in MODULES:
        code=(ROOT/name).read_text()
        exports=re.findall(r'export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)',code)
        for ex in re.findall(r'export\s*\{([^}]+)\};',code):
            exports+= [x.strip() for x in ex.split(',')]
        code=re.sub(r'export\s*\{[^}]+\};','',code)
        code=re.sub(r'\bexport\s+','',code)
        def imports(m):
            dest=posixpath.normpath(posixpath.join(posixpath.dirname(name),m[2]))
            return 'const {'+re.sub(r'\s+as\s+', ':', m[1])+'}=__modules['+json.dumps(dest)+'];'
        code=re.sub(r"import\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"];",imports,code)
        code=code.replace("location.origin","'https://signature-studio.test'")
        if name=='design/engine.mjs':
            code=code.replace("if(s.startsWith('/design/media/'))return new URL(s,origin).href;", "if(s.startsWith('/design/media/'))return window.__assets[s.split('/').pop()]||'';")
        if name=='design/media.mjs':
            start=code.index('async function digest(text)')
            end=code.index('\nfunction loadImage',start)
            code=code[:start]+"async function digest(text){let hash=2166136261;for(let j=0;j<text.length;j++)hash=Math.imul(hash^text.charCodeAt(j),16777619);return (hash>>>0).toString(16).padStart(8,'0').repeat(8);}"+code[end:]
        assembled+='__modules['+json.dumps(name)+']=(function(){\n'+code+'\nreturn {'+','.join(exports)+'};})();\n'
    assembled+='window.__modules=__modules;'
    page.add_script_tag(content=assembled)
    page.wait_for_function('!!window.blocksStudio',timeout=10000)
    page.evaluate('blocksStudio.ready()')
