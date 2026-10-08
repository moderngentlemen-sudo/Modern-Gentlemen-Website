"""Production controller + asset pipeline integration with simulated auth/storage/clipboard.

These tests use real canvas PNG processing and SHA-256. They do not contact
Supabase, paste into Gmail, exercise real clipboard permissions, or send email.
"""

CONFIG = {'supabaseUrl': 'https://fixture.supabase.co', 'supabasePublishableKey': 'fixture-publishable'}

MOCKS = r'''() => {
 const previous=window.fetch.bind(window);
 const state=window.__emailTest={uploads:[],publicGets:[],copies:[],objects:new Map(),owner:'fixture-owner',failUpload:false,failVerify:false,denyClipboard:false,holdUpload:false,release:null,completedUploads:0};
 window.fetch=async(url,options={})=>{
  const value=String(url),method=options.method||'GET';
  if(!value.startsWith('https://fixture.supabase.co/'))return previous(url,options);
  if(value.includes('/auth/v1/token?grant_type=password'))return new Response(JSON.stringify({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:9999999999,user:{id:state.owner,email:'fixture@example.com'}}),{status:200});
  if(value.endsWith('/auth/v1/logout'))return new Response('{}',{status:200});
  if(value.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:state.owner,email:'fixture@example.com'}),{status:200});
  const publicPrefix='https://fixture.supabase.co/storage/v1/object/public/signature-assets/';
  const uploadPrefix='https://fixture.supabase.co/storage/v1/object/signature-assets/';
  if(value.startsWith(uploadPrefix)&&method==='POST'){
   state.uploads.push({url:value,headers:Object.fromEntries(new Headers(options.headers)),size:options.body.size});
   if(state.holdUpload)await new Promise(resolve=>state.release=()=>{state.holdUpload=false;resolve();});
   state.completedUploads++;
   if(state.failUpload)return new Response(JSON.stringify({message:'Fixture upload rejected'}),{status:403});
   const target=publicPrefix+value.slice(uploadPrefix.length);
   if(state.objects.has(target))return new Response(JSON.stringify({message:'The resource already exists'}),{status:409});
   state.objects.set(target,options.body);return new Response('{}',{status:200});
  }
  if(value.startsWith(publicPrefix)){
   state.publicGets.push({url:value,credentials:options.credentials,redirect:options.redirect,headers:Object.fromEntries(new Headers(options.headers))});
   if(state.failVerify)return new Response('Fixture host unavailable',{status:503});
   const blob=state.objects.get(value);return blob?new Response(blob,{headers:{'content-type':'image/png'}}):new Response('Missing fixture object',{status:404});
  }
  throw new Error('Unexpected fixture request');
 };
 Object.defineProperty(window,'ClipboardItem',{configurable:true,value:class{constructor(data){this.data=data;}}});
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{if(state.denyClipboard)throw new DOMException('Fixture permission denial','NotAllowedError');state.copies.push(await items[0].data['text/html'].text());}}});
}'''

FIXTURE = r'''({variant='full',single=false}={})=>{
 const m=__modules['blocks/model.mjs'],d=m.freshDocument(true);
 const art=color=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const c=canvas.getContext('2d');c.fillStyle=color;c.fillRect(0,0,32,32);return canvas.toDataURL('image/png');};
 const image=(label,color,visibility)=>{const n=m.block('image',{src:art(color),width:64,height:64,alt:label},{},[],label);n.visibility=visibility;return n;};
 const text=(label,visibility)=>{const n=m.block('text',{text:label},{},[],label);n.visibility=visibility;return n;};
 d.name='Email workflow fixture';d.variant=variant;
 d.children=[image('Shared artwork','#236a93','both'),text('Full message only','full'),text('Reply message only','reply')];
 if(!single)d.children.push(image('Full artwork','#ae2539','full'));
 const secret=m.block('group',{}, {},[image('Hidden artwork','#39ae25','both')]);secret.visibility='hidden';d.children.push(secret);
 blocksStudio.load(d);return blocksStudio.ready();
}'''


def run_email_workflows(browser, boot, record, output_dir=None):
    def evidence(page, name):
        if output_dir is None:
            return
        page.evaluate('''()=>{const note=document.createElement('p');note.id='simulatedEvidenceLabel';note.textContent='AUTOMATED TEST FIXTURE · Simulated cloud and clipboard · No real Gmail recipient test';note.style.cssText='padding:12px;margin:12px;border:1px solid #53644c;background:#eaf0e5;color:#252926;font:bold 11px/1.5 Arial';document.getElementById('modal').prepend(note);}''')
        page.locator('#modal').screenshot(path=str(output_dir / ('simulated-email-' + name + '.png')))
        page.evaluate('document.getElementById("simulatedEvidenceLabel").remove()')

    def click(page, action):
        page.locator('[data-action="' + action + '"]:visible').first.click()

    def create(variant='full', single=False, clock=False):
        page = browser.new_page(viewport={'width': 1500, 'height': 1080})
        page.set_default_timeout(12000)
        if clock:
            page.clock.install()
        boot(page, config=CONFIG)
        page.evaluate(MOCKS)
        page.evaluate(FIXTURE, {'variant': variant, 'single': single})
        click(page, 'account')
        page.locator('#authEmail').fill('fixture@example.com')
        page.locator('#authPassword').fill('fixture-password')
        page.locator('#authForm button[type=submit]').click()
        page.wait_for_function('document.getElementById("accountButton").textContent.includes("signed in")')
        return page

    def request_copy(page, action='copy'):
        click(page, 'export')
        if action in ('copy-full', 'copy-reply'):
            click(page, 'gmail-dual')
        click(page, action)
        page.wait_for_function('document.getElementById("modalTitle").textContent==="Publish artwork for email?"')

    def allow(page):
        click(page, 'email-consent')

    def copied(page, count=1):
        page.wait_for_function('(count)=>__emailTest.copies.length===count', arg=count)
        return page.evaluate('__emailTest.copies.at(-1)')

    def safe_html(page, html):
        sources = page.evaluate('(html)=>{const doc=new DOMParser().parseFromString(html,"text/html");return [...doc.images].map(i=>i.getAttribute("src"));}', html)
        assert sources and all(src.startswith('https://fixture.supabase.co/storage/v1/object/public/signature-assets/fixture-owner/') for src in sources), sources
        assert not any(token in html for token in ['data:image/', 'blob:', 'data-bid=', 'data-ss-image=', 'fixture-access', 'fixture-refresh'])
        assert page.evaluate('__emailTest.publicGets.every(r=>r.credentials==="omit"&&r.redirect==="error"&&!r.headers.authorization&&!r.headers.apikey)')
        assert page.evaluate('__emailTest.uploads.every(r=>r.headers["x-upsert"]!=="true"&&r.url.includes("/fixture-owner/"))')

    def scenario(name, fn, **options):
        def execute():
            page = create(**options)
            try:
                fn(page)
            except Exception:
                print('EMAIL FAILURE',name,page.evaluate('({title:document.getElementById("modalTitle")?.textContent,notice:document.getElementById("emailNotice")?.textContent,uploads:__emailTest.uploads.length,copies:__emailTest.copies.length,metadata:Object.keys(blocksStudio.getDocument().publishedAssets).length})'),flush=True)
                raise
            finally:
                page.close()
        record('simulated email: ' + name, execute)

    def consent_and_current(page):
        before = page.evaluate('blocksStudio.getDocument().children[0].props.src')
        request_copy(page)
        assert page.evaluate('__emailTest.uploads.length') == 0
        assert page.evaluate('__emailTest.copies.length') == 0
        assert 'Anyone with those URLs' in page.locator('#modalBody').inner_text()
        evidence(page, 'consent')
        allow(page)
        html = copied(page)
        safe_html(page, html)
        assert 'Full message only' in html and 'Reply message only' not in html
        assert 'Hidden artwork' not in html
        assert page.evaluate('__emailTest.uploads.length') == 2
        assert page.evaluate('blocksStudio.getDocument().children[0].props.src') == before
        assert page.evaluate('Object.keys(blocksStudio.getDocument().emailAssetMetadata).length') == 2
        assert 'Installed in Gmail' not in page.locator('#modalBody').inner_text()
        evidence(page, 'verified-copy')
        click(page, 'close')
        click(page, 'export')
        click(page, 'copy')
        copied(page, 2)
        assert page.evaluate('__emailTest.uploads.length') == 2
    scenario('consent precedes publication; current copy uses fresh verified URLs and reuses immutable objects', consent_and_current)

    def reply_only(page):
        request_copy(page, 'copy-reply')
        allow(page)
        html = copied(page)
        safe_html(page, html)
        assert 'Reply message only' in html and 'Full message only' not in html
        assert 'Full artwork' not in html and 'Hidden artwork' not in html
        assert page.evaluate('__emailTest.uploads.length') == 1
    scenario('Copy Reply excludes Full-only and hidden images', reply_only)

    def full_and_reply(page):
        click(page, 'export')
        click(page, 'gmail-dual')
        click(page, 'email-prepare')
        page.wait_for_function('document.getElementById("modalTitle").textContent==="Publish artwork for email?"')
        allow(page)
        page.wait_for_function('document.getElementById("emailNotice")?.textContent.includes("Images verified")')
        assert page.evaluate('__emailTest.uploads.length') == 2
        assert page.evaluate('__emailTest.copies.length') == 0
        click(page, 'close')
        click(page, 'export')
        click(page, 'gmail-dual')
        click(page, 'copy-full')
        full = copied(page)
        safe_html(page, full)
        click(page, 'copy-reply')
        reply = copied(page, 2)
        safe_html(page, reply)
        assert 'Full message only' in full and 'Reply message only' in reply
        assert page.evaluate('__emailTest.uploads.length') == 2
    scenario('Full + Reply prepares the union once and copies the correct variants', full_and_reply)

    def variant_readiness(page):
        request_copy(page, 'copy-reply')
        allow(page)
        copied(page)
        click(page, 'close')
        click(page, 'export')
        click(page, 'gmail-dual')
        rows = page.locator('#emailReadiness tr').all_inner_texts()
        assert any('Full artwork' in row and '(Full)' in row and 'Needs preparation' in row for row in rows), rows
        assert any('Shared artwork' in row and '(Reply)' in row and 'Ready' in row for row in rows), rows
        assert not any('Hidden artwork' in row for row in rows), rows
        assert page.evaluate('__emailTest.uploads.length') == 1
    scenario('switching from prepared Reply to Full + Reply enumerates missing Full dependencies', variant_readiness)

    def obsolete_consent(page):
        request_copy(page)
        page.evaluate('blocksStudio.set(blocksStudio.getDocument().children[0].id,"props.width",90)')
        page.evaluate('blocksStudio.ready()')
        assert page.locator('[data-action="email-consent"]').count() == 0
        assert 'changed' in page.locator('#emailNotice').inner_text()
        assert page.locator('[data-action="email-copy-prepared"]').is_disabled()
        assert page.evaluate('__emailTest.uploads.length') == 0
        click(page, 'email-prepare')
        page.wait_for_function('document.getElementById("modalTitle").textContent==="Publish artwork for email?"')
        assert page.evaluate('__emailTest.uploads.length') == 0
    scenario('an edit removes obsolete publication consent and requests fresh review', obsolete_consent, single=True)

    def expired_readiness(page):
        request_copy(page)
        allow(page)
        copied(page)
        assert 'Ready' in page.locator('#emailReadiness').inner_text()
        page.clock.fast_forward(120200)
        assert page.locator('[data-action="email-copy-prepared"]').is_disabled()
        assert 'Needs preparation' in page.locator('#emailReadiness').inner_text()
        assert 'fresh check' in page.locator('#emailNotice').inner_text()
        assert page.evaluate('__emailTest.copies.length') == 1
    scenario('expired prepared images lose Ready feedback without an unsafe clipboard retry', expired_readiness, single=True, clock=True)

    def rejected_upload(page):
        page.evaluate('__emailTest.failUpload=true')
        request_copy(page)
        allow(page)
        page.wait_for_function('document.getElementById("modalTitle").textContent==="Email preparation needs attention"')
        assert page.evaluate('__emailTest.copies.length') == 0
        assert page.evaluate('Object.keys(blocksStudio.getDocument().publishedAssets).length') == 0
        assert 'no signature has been copied' in page.locator('#emailNotice').inner_text()
        evidence(page, 'hosting-failure')
        page.evaluate('__emailTest.failUpload=false')
        click(page, 'email-prepare')
        page.wait_for_function('document.getElementById("emailNotice")?.textContent.includes("Images verified")')
        click(page, 'email-copy-prepared')
        safe_html(page, copied(page))
    scenario('upload rejection never copies and retry preserves artwork', rejected_upload, single=True)

    def unavailable_host(page):
        page.evaluate('__emailTest.failVerify=true')
        request_copy(page)
        allow(page)
        page.wait_for_function('document.getElementById("modalTitle").textContent==="Email preparation needs attention"')
        assert page.evaluate('__emailTest.copies.length') == 0
        assert 'verification is unavailable' in page.locator('#emailNotice').inner_text()
        assert page.locator('[data-action="email-copy-prepared"]').is_disabled()
        assert page.evaluate('Object.keys(blocksStudio.getDocument().publishedAssets).length') == 0
    scenario('anonymous public-image failure blocks clipboard success', unavailable_host, single=True)

    def clipboard_denial(page):
        page.evaluate('__emailTest.denyClipboard=true')
        request_copy(page)
        allow(page)
        page.wait_for_function('document.getElementById("emailNotice")?.textContent.includes("clipboard access was blocked")')
        assert page.evaluate('__emailTest.copies.length') == 0
        assert not page.locator('[data-action="email-copy-prepared"]').is_disabled()
        evidence(page, 'fresh-copy-fallback')
        page.evaluate('__emailTest.denyClipboard=false')
        click(page, 'email-copy-prepared')
        safe_html(page, copied(page))
        assert page.evaluate('__emailTest.uploads.length') == 1
    scenario('clipboard denial offers a fresh Copy prepared signature gesture', clipboard_denial, single=True)

    def stale(page, change):
        page.evaluate('__emailTest.holdUpload=true')
        request_copy(page)
        allow(page)
        page.wait_for_function('typeof __emailTest.release==="function"')
        if change == 'edit':
            page.evaluate('blocksStudio.set(blocksStudio.getDocument().children[0].id,"props.width",90)')
            page.evaluate('blocksStudio.ready()')
        elif change == 'project':
            page.evaluate('blocksStudio.load(__modules["blocks/model.mjs"].freshDocument(true))')
            page.evaluate('blocksStudio.ready()')
        else:
            click(page, 'close')
            click(page, 'account')
            click(page, 'signout')
            page.wait_for_function('document.getElementById("accountButton").textContent==="Cloud account"')
        page.evaluate('__emailTest.release()')
        page.wait_for_function('__emailTest.completedUploads===1')
        page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        if page.evaluate('document.getElementById("modal").open'):
            click(page, 'close')
        click(page, 'export')
        assert page.locator('[data-action="email-copy-prepared"]').is_disabled()
        assert page.evaluate('__emailTest.copies.length') == 0
        assert page.evaluate('Object.keys(blocksStudio.getDocument().publishedAssets).length') == 0
        assert page.evaluate('Object.keys(blocksStudio.getDocument().emailAssetMetadata||{}).length') == 0
    for change in ['edit', 'project', 'account']:
        scenario(change + ' change during publication cannot apply stale metadata or copy', lambda page, change=change: stale(page, change), single=True)

    from email_image_browser_cases import run_image_browser_cases
    run_image_browser_cases(browser, boot, record)
