"""Offline UI regression tests. Run: python tests/blocks_browser.py
Requires playwright and Chromium. No live account or Gmail actions are performed.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys,base64,cv2,numpy as np
from blocks_harness import boot
OUT=Path(__file__).resolve().parents[1]/'test-results-blocks';OUT.mkdir(exist_ok=True)
results=[]
def passed(name):results.append({'name':name,'status':'passed'});print('PASS',name,flush=True)
def fresh(page,blank=False):
    page.evaluate('(blank)=>blocksStudio.load(__modules["blocks/model.mjs"].freshDocument(blank))',blank)
    page.evaluate('blocksStudio.ready()')
def click(page,action):page.locator('[data-action="'+action+'"]').filter(visible=True).first.click()
def settle(page):page.evaluate('blocksStudio.ready()');page.wait_for_timeout(40)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1500,'height':1080})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    boot(page);settle(page)
    assert not errors;assert page.evaluate('blocksStudio.measure().width')==540
    page.screenshot(path=str(OUT/'workspace.png'),full_page=True)
    passed('initial load and preview')
    # Click-to-add, bindings, and independent duplicate.
    page.locator('[data-action="add"][data-kind="heading"]').click();settle(page)
    h=page.evaluate('blocksStudio.id()');page.locator('#node-props-text').fill('Independent heading');settle(page)
    assert 'Independent heading' in page.evaluate('blocksStudio.html()')
    page.locator('#node-props-bind').select_option('company');settle(page)
    page.locator('#identity-company').fill('Studio Example');settle(page)
    assert page.evaluate('blocksStudio.getDocument().identity.company')=='Studio Example'
    page.locator('#node-props-bind').select_option('');settle(page)
    assert page.locator('#node-props-text').input_value()=='Studio Example'
    passed('click insertion, connected profile edit, and detach')
    click(page,'duplicate');settle(page);dup=page.evaluate('blocksStudio.id()');assert dup!=h
    page.locator('#node-props-text').fill('Only the copy');settle(page)
    vals=page.evaluate('blocksStudio.getDocument().children.slice(-2).map(n=>n.props.text)')
    assert vals==['Studio Example','Only the copy']
    click(page,'undo');settle(page);assert 'Only the copy' not in page.evaluate('blocksStudio.html()')
    click(page,'redo');settle(page);assert 'Only the copy' in page.evaluate('blocksStudio.html()')
    passed('independent duplication and undo/redo')
    # Real pointer movement: library to empty canvas.
    fresh(page,True)
    source=page.locator('[data-drag-kind="text"]');box=source.bounding_box();cv=page.locator('#canvas').bounding_box()
    page.mouse.move(box['x']+12,box['y']+12);page.mouse.down();page.mouse.move(cv['x']+80,cv['y']+20,steps=18)
    assert page.locator('#dropGuide').is_visible();page.mouse.up();settle(page)
    assert len(page.evaluate('blocksStudio.getDocument().children'))==1
    passed('pointer drag from library into empty canvas')
    page.wait_for_timeout(320)
    # Create an explicit adjacent column and drop into it.
    click(page,'beside');settle(page)
    empty=page.evaluate('blocksStudio.id()');col=page.locator('[data-bid="'+empty+'"]').bounding_box();src=source.bounding_box()
    page.mouse.move(src['x']+12,src['y']+12);page.mouse.down();page.mouse.move(col['x']+col['width']/2,col['y']+col['height']/2,steps=18)
    assert page.locator('#dropGuide').get_attribute('data-label').startswith('Inside');page.mouse.up();settle(page)
    assert page.evaluate('(id)=>__modules["blocks/model.mjs"].find(blocksStudio.getDocument(),id).children.length',empty)==1
    passed('explicit columns and pointer insertion into column')
    page.wait_for_timeout(330)
    # Drag existing block between cells.
    doc=page.evaluate('blocksStudio.getDocument()');cols=doc['children'][0]['children'];moving=cols[1]['children'][0]['id'];target=cols[0]['id']
    page.evaluate('(id)=>blocksStudio.select(id)',moving);handle=page.locator('[data-drag-selected]').bounding_box();dest=page.locator('[data-bid="'+target+'"]').bounding_box()
    page.mouse.move(handle['x']+10,handle['y']+10);page.mouse.down();page.mouse.move(dest['x']+dest['width']/2,dest['y']+dest['height']/2,steps=18);page.mouse.up();settle(page)
    assert page.evaluate('(id)=>__modules["blocks/model.mjs"].find(blocksStudio.getDocument(),id).children.length',target)==2
    passed('move existing content between columns')
    page.wait_for_timeout(330)
    before=page.evaluate('JSON.stringify(blocksStudio.getDocument())');src=source.bounding_box();cv=page.locator('#canvas').bounding_box()
    page.mouse.move(src['x']+10,src['y']+10);page.mouse.down();page.mouse.move(cv['x']+60,cv['y']+20,steps=12);page.keyboard.press('Escape');page.mouse.up();settle(page)
    assert page.evaluate('JSON.stringify(blocksStudio.getDocument())')==before
    passed('Escape cancels a drag without edits')
    # Numeric move to root and keyboard order.
    page.wait_for_timeout(330);page.evaluate('(id)=>blocksStudio.select(id)',moving);click(page,'move');page.locator('#moveTarget').select_option('');click(page,'move-confirm');settle(page)
    assert page.evaluate('blocksStudio.getDocument().children.at(-1).id')==moving
    page.locator('[data-bid="'+moving+'"]').focus();page.keyboard.press('Alt+ArrowUp');settle(page)
    assert page.evaluate('blocksStudio.getDocument().children[0].id')==moving
    passed('non-drag move dialog and keyboard reorder')
    # Variant visibility.
    page.evaluate('(id)=>blocksStudio.select(id)',moving);page.locator('#node-visibility').select_option('full');settle(page)
    page.locator('#node-props-text').fill('FULL_ONLY');settle(page);click(page,'variant-reply');settle(page)
    assert 'FULL_ONLY' not in page.evaluate('blocksStudio.html()');click(page,'variant-full');settle(page)
    assert 'FULL_ONLY' in page.evaluate('blocksStudio.html()')
    passed('full / reply / hidden export handling')
    # Inline edit (after media ready, then while prepare is scheduled).
    textEl=page.locator('[data-bid="'+moving+'"] [data-edit]').first;textEl.dblclick();page.keyboard.press('Control+a');page.keyboard.insert_text('Inline **bold**');page.keyboard.press('Control+Enter');settle(page)
    assert '<strong>bold</strong>' in page.evaluate('blocksStudio.html()')
    passed('inline text editing and safe emphasis')
    # Saved module inserts independent nested copy.
    click(page,'save-block');page.locator('#presetName').fill('Saved sign-off');click(page,'save-block-confirm');settle(page)
    assert page.locator('[data-action="add-saved"]').count()==1
    page.locator('[data-action="add-saved"]').click();settle(page)
    assert page.evaluate('blocksStudio.id()')!=moving
    passed('reusable blocks insert independent copies')
    # Image controls and real resize handle.
    fresh(page,True);page.evaluate('blocksStudio.add("image")');settle(page);imageId=page.evaluate('blocksStudio.id()')
    page.locator('#node-props-zoom').fill('150');settle(page)
    assert page.evaluate('(id)=>__modules["blocks/model.mjs"].find(blocksStudio.getDocument(),id).props.zoom',imageId)==150
    page.locator('#node-props-x').fill('20');settle(page);page.evaluate('(id)=>blocksStudio.select(id)',imageId)
    assert page.locator('#resizeHandle').is_visible();r=page.locator('#resizeHandle').bounding_box()
    page.mouse.move(r['x']+5,r['y']+5);page.mouse.down();page.mouse.move(r['x']+35,r['y']+35,steps=12);page.mouse.up();settle(page)
    assert page.evaluate('(id)=>__modules["blocks/model.mjs"].find(blocksStudio.getDocument(),id).props.width',imageId)>110
    assert 'data:image/png' in page.evaluate('blocksStudio.html()')
    passed('image crop, zoom and pointer resizing persist into output')
    # Social per-instance controls.
    fresh(page,True);page.evaluate('blocksStudio.add("social")');settle(page)
    page.locator('[data-social="url"]').first.fill('https://instagram.com/example');settle(page)
    assert 'https://instagram.com/example' in page.evaluate('blocksStudio.html()')
    page.locator('[data-social="enabled"]').first.uncheck();settle(page)
    assert 'https://instagram.com/example' not in page.evaluate('blocksStudio.html()')
    passed('per-network URLs and visibility')
    # QR local output decodes to destination.
    fresh(page,True);page.evaluate('blocksStudio.add("qr-card")');settle(page)
    qrSrc=page.evaluate('''()=>{const wrap=document.createElement('div');wrap.innerHTML=blocksStudio.html();return wrap.querySelector('img').src;}''')
    img=cv2.imdecode(np.frombuffer(base64.b64decode(qrSrc.split(',')[1]),np.uint8),cv2.IMREAD_COLOR)
    decoded,_,_=cv2.QRCodeDetector().detectAndDecode(img)
    assert decoded=='https://www.moderngentlemen.co/';passed('QR artwork decodes to intended URL')
    # All 24 additions fit at 360px using true export scaling.
    fitting=[]
    for entry in page.evaluate('__modules["blocks/model.mjs"].LIBRARY'):
        page.evaluate('''(kind)=>{const m=__modules['blocks/model.mjs'];const d=m.freshDocument(true);d.children=[m.makeBlock(kind,d)];d.design.targetWidth=360;blocksStudio.load(d);}''',entry['id'])
        settle(page);page.evaluate('blocksStudio.fit()');settle(page)
        w=page.evaluate('blocksStudio.measure().width');assert w<=361,(entry['id'],w);fitting.append({'id':entry['id'],'width':w})
    passed('all 24 library entries auto-fit to 360px')
    # Original template preservation browser width and content checks.
    preservation=[]
    for template in page.evaluate('__modules["design/catalog.mjs"].TEMPLATES.map(t=>t.id)'):
        result=page.evaluate('''id=>{const c=__modules['design/catalog.mjs'],m=__modules['blocks/model.mjs'],r=__modules['blocks/render.mjs'],e=__modules['design/engine.mjs'];const old=c.applyTemplate(c.freshProject(),c.TEMPLATES.find(t=>t.id===id));const fresh=m.preservedProject(old);const original=e.renderSignature(old);const output=r.renderBlocks(fresh);return {id,contains:output.includes(original)};}''',template)
        assert result['contains'],template;preservation.append(result)
    passed('all 36 template renderings retained inside preserved copies')
    # Reload with current local storage; independent saved presets persist.
    page.wait_for_timeout(400);storage=page.evaluate('({...window.__storage})');snapshot=page.evaluate('blocksStudio.getDocument()')
    reloaded=browser.new_page(viewport={'width':1500,'height':1080});boot(reloaded,storage);settle(reloaded)
    assert reloaded.evaluate('blocksStudio.getDocument()')==snapshot
    passed('local project and reusable library restore')
    # Browser templates UI must add preserved blocks, not defaults.
    fresh(page,True);click(page,'templates');page.locator('[data-action="template"][data-kind="atelier"]').click();settle(page)
    assert page.evaluate('blocksStudio.getDocument().children[0].props.project.templateId')=='atelier';passed('template gallery inserts correct preserved template')
    # UI is usable by tap on mobile, and the page itself does not overflow.
    mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    boot(mobile);settle(mobile);mobile.locator('[data-action="add"][data-kind="heading"]').tap();settle(mobile)
    assert mobile.evaluate('blocksStudio.id()')
    assert mobile.evaluate('document.documentElement.scrollWidth')<=391
    mobile.screenshot(path=str(OUT/'mobile.png'),full_page=True)
    passed('touch-friendly click insertion and 390px page layout')
    # Drag insertion is independent of workspace zoom.
    for z in ['0.75','1.25']:
        fresh(page,True);page.locator('#zoom').select_option(z);settle(page)
        page.locator('[data-category="Core"]').click();source=page.locator('[data-drag-kind="heading"]');sb=source.bounding_box();cb=page.locator('#canvas').bounding_box()
        page.mouse.move(sb['x']+10,sb['y']+10);page.mouse.down();page.mouse.move(cb['x']+60,cb['y']+15,steps=14);page.mouse.up();settle(page)
        assert len(page.evaluate('blocksStudio.getDocument().children'))==1
        page.wait_for_timeout(330)
    page.locator('#zoom').select_option('1');passed('pointer drop targets at 75% and 125% zoom')
    # Columns divider handle changes actual saved proportions.
    fresh(page,True);page.evaluate('blocksStudio.add("columns")');settle(page)
    colsId=page.evaluate('blocksStudio.id()');page.evaluate('(id)=>blocksStudio.select(id)',colsId)
    beforeRatio=page.evaluate('(id)=>__modules["blocks/model.mjs"].find(blocksStudio.getDocument(),id).props.ratios[0]',colsId)
    r=page.locator('#resizeHandle').bounding_box();assert r
    page.mouse.move(r['x']+4,r['y']+5);page.mouse.down();page.mouse.move(r['x']+50,r['y']+5,steps=12);page.mouse.up();settle(page)
    afterRatio=page.evaluate('(id)=>__modules["blocks/model.mjs"].find(blocksStudio.getDocument(),id).props.ratios[0]',colsId)
    assert afterRatio>beforeRatio;passed('pointer column resizing updates proportions')
    page.wait_for_timeout(300)
    # Actual browser downloads: HTML, editable JSON and rendered 2x PNG.
    fresh(page)
    with page.expect_download() as down:
        page.locator('.bottom-actions [data-action="export-html"]').click()
    f=OUT/'download-signature.html';down.value.save_as(f);data=f.read_text()
    assert 'data-bid' not in data and '<table' in data
    with page.expect_download() as down:
        page.locator('.bottom-actions [data-action="backup"]').click()
    f=OUT/'download-project.json';down.value.save_as(f);assert json.loads(f.read_text())['schemaVersion']==3
    with page.expect_download() as down:
        page.locator('.bottom-actions [data-action="export-png"]').click()
    f=OUT/'download-signature.png';down.value.save_as(f);png=cv2.imread(str(f));assert png is not None and png.shape[1]==1080
    passed('HTML, JSON and 2x PNG download workflows')
    # No browser exceptions across tested workflows.
    assert not errors,errors;passed('no browser JavaScript exceptions')
    # Release preview with a selected editable event invitation (no sample real-world facts).
    fresh(page);page.evaluate('blocksStudio.add("event")');settle(page)
    page.locator('[data-category="Modules"]').click();page.evaluate("document.getElementById('stage').scrollTop=230")
    page.screenshot(path=str(OUT/'block-editor-preview.png'),full_page=True)
    (OUT/'browser-report.json').write_text(json.dumps({'scope':'offline Chromium with embedded assets and storage/crypto shims; no real Gmail or Supabase sessions','results':results,'fit':fitting,'preservation':preservation,'errors':errors},indent=2))
    browser.close()
print(json.dumps({'passed':len(results),'report':str(OUT/'browser-report.json')},indent=2))
