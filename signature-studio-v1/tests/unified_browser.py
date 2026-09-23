"""Offline integration tests of production modules, with documented storage/media shims.
The managed Chromium policy does not permit local HTTP navigation. This harness
therefore does not claim real network/OAuth/clipboard integration coverage.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys,traceback
from unified_harness import boot
OUT=Path(__file__).resolve().parents[1]/'test-results-unified';OUT.mkdir(exist_ok=True)
reports=[]
def run(name,fn):
 try:fn();reports.append({'name':name,'pass':True});print('PASS',name,flush=True)
 except Exception as e:reports.append({'name':name,'pass':False,'error':str(e)});print('FAIL',name,str(e),flush=True);traceback.print_exc(limit=2)
def js(expr):return page.evaluate(expr)
def ready():page.evaluate('blocksStudio.ready()')
def nav(name):page.locator(f'.studio-rail [data-panel="{name}"]').click()
def setvalue(path,value):
 loc=page.locator(f'#unifiedControls [data-u-path="{path}"]').first
 if loc.evaluate('(e)=>e.tagName')=='SELECT':loc.select_option(str(value))
 elif loc.get_attribute('type')=='range':loc.evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}))}',str(value))
 else:loc.fill(str(value))
 ready()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1512,'height':980},device_scale_factor=1);page.set_default_timeout(4000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));boot(page)
 def initial():
  assert page.locator('.u-template').count()==36
  assert js('!!signatureStudio && signatureStudio===blocksStudio')
  assert not js('blocksStudio.html().includes("Preserved")')
 run('One workspace with 36 templates and a shared project API',initial)
 def apply():
  page.locator('#uKeepBrand').uncheck();page.locator('[data-u-action=template][data-id=masthead]').click();ready()
  assert js('blocksStudio.getDocument().designData.templateId')=='masthead'
  assert js('blocksStudio.getDocument().design.nameFont')=='georgia'
  assert js('blocksStudio.history().undo')>0
 run('Apply template as native editable sections without a handoff',apply)
 def fields():
  page.locator('#canvas [data-u-bind=name]').first.click();ready()
  page.locator('#inspector [data-u-path="identity.name"]').fill('Jason Unified Test');ready()
  assert js('blocksStudio.getDocument().identity.name')=='Jason Unified Test'
  assert 'Jason Unified Test' in page.locator('#canvas').inner_text()
  nav('content');assert page.locator('#unifiedControls [data-u-path="identity.name"]').input_value()=='Jason Unified Test'
 run('Selection inspector and shared details edit the same name',fields)
 def inline():
  el=page.locator('#canvas [data-u-bind=name]').first;el.dblclick();el.fill('Inline Connected Name');el.press('Control+Enter');ready()
  assert js('blocksStudio.getDocument().identity.name')=='Inline Connected Name'
  assert page.locator('#unifiedControls [data-u-path="identity.name"]').input_value()=='Inline Connected Name'
 run('Direct template text editing updates the profile controls',inline)
 def style():
  nav('style');setvalue('design.nameSize',33);setvalue('design.nameFont','palatino')
  assert '33px' in js('blocksStudio.html()');assert 'Palatino' in js('blocksStudio.html()')
  page.locator('[data-u-action=style-tab][data-panel=color]').click()
  page.locator('#unifiedControls [data-u-action=palette][data-index="4"]').click();ready()
  assert js('blocksStudio.getDocument().design.primary')=='#173529'
  assert '#173529' in js('blocksStudio.html()')
 run('Typography and all palette settings reach the canvas and export',style)
 def add():
  nav('blocks');page.locator('[data-action=add][data-kind=text]').click();ready()
  assert 'A considered introduction' in js('blocksStudio.html()')
  assert page.locator('#inspector').inner_text().find('Text')>=0
  page.locator('#inspector [data-scope=node][data-path="props.text"]').fill('Independent content survives changes');ready()
 run('Add an independent block into the active template project',add)
 def switching():
  before=js('blocksStudio.getDocument().identity.name');nav('templates')
  page.locator('[data-u-action=template][data-id=atelier]').click();ready()
  assert js('blocksStudio.getDocument().identity.name')==before
  assert 'Independent content survives changes' in js('blocksStudio.html()')
  assert js('blocksStudio.getDocument().designData.templateId')=='atelier'
  page.locator('#undo').click();ready();assert js('blocksStudio.getDocument().designData.templateId')=='masthead'
  page.locator('#redo').click();ready();assert js('blocksStudio.getDocument().designData.templateId')=='atelier'
 run('Template switch preserves added blocks; one history undoes and redoes both',switching)
 def social():
  nav('social');setvalue('socials.0.url','https://instagram.com/example')
  assert 'https://instagram.com/example' in js('blocksStudio.html()')
  nav('blocks');page.locator('[data-action=add][data-kind=social]').click();ready()
  assert js('blocksStudio.html().split("https://instagram.com/example").length')>=3
 run('Social panel and newly added social blocks share connected accounts',social)
 def newimage():
  nav('images');page.locator('#unifiedControls [data-u-action=upload-image][data-slot=portrait]').click()
  page.locator('#studioImageInput').set_input_files(str(Path(__file__).resolve().parents[1]/'public/design/media/mg-logo.png'));ready()
  page.wait_for_function('blocksStudio.getDocument().designData.assets.portrait.src.startsWith("data:")');ready()
  assert js('(()=>{let a=[];__modules["blocks/model.mjs"].walk(blocksStudio.getDocument().children,n=>{if(n.props.part==="portrait")a.push(n)});return a.length})()')>0
  setvalue('assets.portrait.zoom',170);assert js('blocksStudio.getDocument().designData.assets.portrait.zoom')==170
 run('Artwork upload, automatic canvas insertion and crop remain connected',newimage)
 def supplemental_content():
  nav('content');page.locator('[data-u-action=content-tab][data-panel=blocks]').click()
  setvalue('content.ctaLabel','Request our media kit');setvalue('content.ctaUrl','https://example.com/media')
  assert 'Request our media kit' in js('blocksStudio.html()')
  page.locator('#unifiedControls [data-u-action=add-extra]').click();ready()
  assert page.locator('#unifiedControls [data-u-path="extras.0.value"]').is_visible()
  setvalue('extras.0.label','Studio');setvalue('extras.0.value','Connected custom detail');assert 'Connected custom detail' in js('blocksStudio.html()')
  page.locator('#unifiedControls [data-u-action=remove-extra]').first.click();ready();assert 'Connected custom detail' not in js('blocksStudio.html()')
 run('Designer calls to action, custom fields and notes are accessible in the same workspace',supplemental_content)

 def fit():
  nav('style');page.locator('[data-u-action=style-tab][data-panel=layout]').click();setvalue('design.targetWidth',360)
  page.locator('[data-action=fit]').first.click();ready()
  assert js('blocksStudio.measure().width')<=362
  scale=js('blocksStudio.getDocument().design.scale');assert scale<100
  html=js('blocksStudio.html()');page.locator('#zoom').select_option('0.75');ready();assert js('blocksStudio.html()')==html
 run('Auto-fit changes export size; workspace zoom does not',fit)
 def local():
  global page
  js('blocksStudio.save()');assert 'signature-studio.unified.v1' in js('Object.keys(__storage)')
  stored=js('__storage');expected=js('blocksStudio.getDocument()');page.close();page=b.new_page(viewport={'width':1512,'height':980});page.set_default_timeout(4000);page.on('pageerror',lambda e:errors.append(str(e)));boot(page,stored);assert js('blocksStudio.getDocument()')==expected
 run('Single autosave restores template, blocks and customization together',local)
 def filters():
  nav('templates');page.locator('#uCategory').select_option('Luxury');assert page.locator('.u-template').count()==6
  page.locator('[data-u-action=favorite]').first.click();page.locator('#uCategory').select_option('Favorites');assert page.locator('.u-template').count()==1
  page.locator('#uCategory').select_option('All');page.locator('#uSearch').fill('The Masthead');assert page.locator('.u-template').count()==1
 run('Template categories, live search and favorites stay in the workspace',filters)
 def savestyle():
  page.locator('[data-u-action=save-style]').click();page.locator('#uStyleName').fill('Unified bespoke');page.locator('[data-u-action=save-style-confirm]').click();ready()
  assert page.locator('.u-template').count()==1;assert 'Unified bespoke' in page.locator('#unifiedControls').inner_text()
 run('Saved styles share the existing template collection',savestyle)
 def exports():
  assert not any(x in js('blocksStudio.html()') for x in ['data-bid','data-u-bind','data-edit='])
  with page.expect_download() as download:page.locator('[data-action=backup]').click()
  file=Path(download.value.path());data=json.loads(file.read_text());assert data['designData'];assert data['children']
  with page.expect_download() as download:page.locator('[data-action=export-html]').click()
  assert '<table' in Path(download.value.path()).read_text()
 run('One export workflow produces HTML and editable unified projects',exports)
 def selection():
  nav('layers');page.locator('#structure [data-select]').first.click();assert page.locator('#breadcrumbs button').count()>1
  page.locator('[data-u-action=deselect]').click();assert js('blocksStudio.getSelection()') is None
 run('Contextual selection breadcrumbs and deselection work',selection)
 # Reset a clean document for actual drag and responsive screenshots.
 js('blocksStudio.load(__modules["studio/model.mjs"].newSignature())');ready();nav('blocks')
 def drag():
  source=page.locator('[data-drag-kind=button]');target=page.locator('#canvas');sb=source.bounding_box();tb=target.bounding_box();before=js('blocksStudio.getDocument().children.length')
  page.mouse.move(sb['x']+sb['width']/2,sb['y']+sb['height']/2);page.mouse.down();page.mouse.move(tb['x']+tb['width']/2,tb['y']+tb['height']+8,steps=15);page.mouse.up();ready()
  assert js('blocksStudio.html().includes("Book a conversation")')
 run('Actual pointer drag adds a button to the shared canvas',drag)
 def reply():
  page.locator('[data-action=variant-reply]').click();ready();assert 'The Lifestyle Guide' not in js('blocksStudio.html()')
  page.locator('[data-action=variant-full]').click();ready();assert 'The Lifestyle Guide' in js('blocksStudio.html()')
 run('Full and reply variants use the same project',reply)
 def source_resize():
  js('blocksStudio.load(__modules["studio/model.mjs"].newSignature())');ready()
  page.locator('#canvas img[alt="Modern Gentlemen"]').first.click();ready()
  handle=page.locator('#resizeHandle');assert handle.is_visible()
  before=js('blocksStudio.getDocument().design.logoWidth');h=handle.bounding_box()
  page.mouse.move(h['x']+h['width']/2,h['y']+h['height']/2);page.mouse.down();page.mouse.move(h['x']+h['width']/2+22,h['y']+h['height']/2+22,steps=8);page.mouse.up();ready()
  after=js('blocksStudio.getDocument().design.logoWidth');assert after>before
  nav('images');assert float(page.locator('#unifiedControls [data-u-path="design.logoWidth"]').input_value())==after
  page.locator('#undo').click();ready();assert js('blocksStudio.getDocument().design.logoWidth')==before
 run('Template artwork resize handles update shared image settings and undo',source_resize)
 def png_export():
  with page.expect_download() as download:page.locator('[data-action=export-png]').click()
  image=Path(download.value.path()).read_bytes();assert image.startswith(b'\x89PNG\r\n\x1a\n');assert len(image)>2000
 run('PNG export captures the same composed signature without editing chrome',png_export)
 def migrate_browser():
  old=js("()=>{const p=__modules['design/catalog.mjs'].freshProject();p.name='Earlier designer project';p.identity.name='Original designer name';const d=__modules['blocks/model.mjs'].freshDocument();d.name='Earlier block project';return {'signature-studio.design.v2':JSON.stringify({active:'design-1',projects:[{id:'design-1',project:p}]}),'signature-studio.blocks.v3':JSON.stringify({active:'block-1',projects:[{id:'block-1',doc:d}]})}}")
  second=b.new_page(viewport={'width':1512,'height':980});boot(second,old)
  second.locator('[data-action=projects]').first.click()
  text=second.locator('#modalBody').inner_text();assert 'Earlier designer project' in text and 'Earlier block project' in text
  assert second.evaluate('__storage["signature-studio.design.v2"]')==old['signature-studio.design.v2']
  assert second.evaluate('__storage["signature-studio.blocks.v3"]')==old['signature-studio.blocks.v3']
  second.close()
 run('Both old browser libraries appear together without modifying originals',migrate_browser)

 def allfit():
  result=js('''async()=>{const out=[];for(const t of __modules['design/catalog.mjs'].TEMPLATES){const p=__modules['design/catalog.mjs'].applyTemplate(__modules['design/catalog.mjs'].freshProject(),t);const d=__modules['studio/model.mjs'].fromDesign(p);d.design.targetWidth=360;blocksStudio.load(d);await blocksStudio.ready();await blocksStudio.fit();out.push([t.id,blocksStudio.measure().width]);}return out;}''')
  (OUT/'template-widths.json').write_text(json.dumps(result,indent=2));assert all(w<=362 for _,w in result),result
 run('All 36 compositions fit the tested 360px target',allfit)
 # Desktop and mobile screenshots contain no speculative live-cloud state.
 js('blocksStudio.load(__modules["studio/model.mjs"].newSignature())');ready();nav('blocks');page.locator('#canvas [data-u-bind=name]').first.click();ready()
 page.evaluate("document.getElementById('toast').className=''");page.screenshot(path=str(OUT/'unified-workspace.png'),full_page=True)
 def mobile():
  page.set_viewport_size({'width':390,'height':844});ready()
  assert js('document.documentElement.scrollWidth')<=392
  nav('templates');assert page.locator('#uCategory').is_visible();nav('blocks')
 run('Mobile workspace navigation avoids whole-page horizontal overflow',mobile)
 page.screenshot(path=str(OUT/'mobile-workspace.png'),full_page=True)
 run('No unhandled JavaScript errors',lambda: (_ for _ in ()).throw(AssertionError(errors)) if errors else None)
 (OUT/'browser-report.json').write_text(json.dumps({'harness':'Offline production-module DOM/pointer tests; network/storage/media shims','groups':reports,'pageErrors':errors},indent=2))
 b.close()
if any(not r['pass'] for r in reports):sys.exit(1)
