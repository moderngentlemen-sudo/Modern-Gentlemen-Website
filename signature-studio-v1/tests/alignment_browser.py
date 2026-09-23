"""Offline production-module browser tests for handles, snapping and click-away selection.
Uses the same documented asset/storage/crypto shims as unified_harness.py.
No Gmail, OAuth, real cloud sessions, or recipient email-client rendering is exercised.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from unified_harness import boot
import json,traceback,sys
OUT=Path(__file__).resolve().parents[1]/'test-results-alignment';OUT.mkdir(exist_ok=True)
reports=[];errors=[]
def js(expr):return page.evaluate(expr)
def ready():js('blocksStudio.ready()')
def run(name,fn):
 try:fn();reports.append({'name':name,'pass':True});print('PASS',name,flush=True)
 except Exception as e:
  reports.append({'name':name,'pass':False,'error':str(e)});print('FAIL',name,str(e),flush=True);traceback.print_exc(limit=3)
  page.screenshot(path=str(OUT/('failure-'+str(len(reports))+'.png')))
def fixture(kind='image',scale=100):
 page.locator('#zoom').select_option('1')
 page.evaluate('''({kind,scale})=>{
 const M=__modules['blocks/model.mjs'];let d;
 if(kind==='template')d=__modules['studio/model.mjs'].newSignature();
 else {d=M.freshDocument(true);d.design.padding=12;d.design.baseWidth=480;d.design.nowrap=false;
  if(kind==='columns'||kind==='three'||kind==='nested'){
   const c=M.makeBlock('columns',d);c.props.ratios=kind==='three'?[30,30,40]:[40,60];
   if(kind==='three')c.children.push(M.block('column',{}, {},[],'Third column'));
   c.children.forEach((cell,i)=>cell.children=[M.block('text',{text:'Column '+(i+1)})]);
   if(kind==='nested'){const inner=M.makeBlock('columns',d);inner.children.forEach((cell,i)=>cell.children=[M.block('text',{text:'Inner '+i})]);c.children[1].children=[inner];}
   d.children=[c];
  }else if(kind==='text')d.children=[M.block('text',{text:'Selectable text'},{},[],'Text'),M.block('text',{text:'Second text'},{},[],'Second')];
  else d.children=[M.makeBlock('image',d),M.block('text',{text:'A second block'})];
 }
 d.design.scale=scale;blocksStudio.load(d);blocksStudio.setCanvasPreferences({grid:true,snap:true,step:8,handles:'size'});
 }''',{'kind':kind,'scale':scale});ready()
 page.locator('#stage').evaluate('(e)=>{e.scrollLeft=0;e.scrollTop=0}')
 return js('blocksStudio.getDocument()')
def select_image():
 page.locator('#canvas img').first.click();ready();return js('blocksStudio.getSelection()')
def selected_node():return js('(()=>{let found=null;__modules["blocks/model.mjs"].walk(blocksStudio.getDocument().children,n=>{if(n.id===blocksStudio.id())found=n;});return found})()')
def drag_handle(selector,dx,dy,mods=(),cancel=False):
 loc=page.locator(selector);assert loc.is_visible(),selector+' hidden';r=loc.bounding_box();x=r['x']+r['width']/2;y=r['y']+r['height']/2
 for k in mods:page.keyboard.down(k)
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=9)
 if cancel:page.keyboard.press('Escape')
 page.mouse.up()
 for k in reversed(mods):page.keyboard.up(k)
 ready()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1512,'height':1100},device_scale_factor=1)
 page.set_default_timeout(3500);page.on('pageerror',lambda e:errors.append(str(e)));boot(page)
 def handles():
  fixture();select_image();assert page.locator('[data-canvas-resize^="size:"]:visible').count()==8;assert page.locator('#canvasMoveHandle').is_visible()
 run('Image selection exposes eight resize handles and a canvas move grip',handles)
 def snapping():
  fixture();select_image();before=js('blocksStudio.history().undo');drag_handle('#resizeHandle',19,19)
  n=selected_node();assert n['props']['width']==112,n;assert n['props']['height']==112
  assert js('blocksStudio.history().undo')==before+1
  assert 'width="112"' in js('blocksStudio.html()')
  page.locator('#undo').click();ready();assert selected_node()['props']['width']==92
  page.locator('#redo').click();ready();assert selected_node()['props']['width']==112
 run('One snapped resize updates actual HTML, with one undo/redo transaction',snapping)
 def alt_free():
  fixture();select_image();drag_handle('#resizeHandle',19,19,['Alt']);assert abs(selected_node()['props']['width']-111)<.1
 run('Alt temporarily bypasses the grid without changing the saved snap preference',alt_free)
 def shift_free():
  fixture();select_image();drag_handle('#resizeHandle',19,3,['Shift']);n=selected_node();assert n['props']['width']==112;assert n['props']['height']==96
 run('Shift resizes independent image dimensions while retaining grid increments',shift_free)
 def escape_cancel():
  fixture();select_image();before=js('blocksStudio.getDocument()');count=js('blocksStudio.history().undo');drag_handle('#resizeHandle',30,30,cancel=True)
  assert js('blocksStudio.getDocument()')==before;assert js('blocksStudio.history().undo')==count;assert page.locator('#snapReadout').is_hidden()
 run('Escape cancels a resize completely without adding history',escape_cancel)
 def pointer_cancel():
  fixture();select_image();before=js('blocksStudio.getDocument()');r=page.locator('#resizeHandle').bounding_box();x=r['x']+12;y=r['y']+12
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+25,y+25,steps=5)
  page.locator('#resizeHandle').dispatch_event('pointercancel',{'pointerId':1,'bubbles':True});page.mouse.up();ready();assert js('blocksStudio.getDocument()')==before
 run('Pointer cancellation restores pre-drag state and removes guides',pointer_cancel)
 for zoom in [.75,1,1.25]:
  for scale in [60,100]:
   def zoomed(zoom=zoom,scale=scale):
    fixture(scale=scale);page.locator('#zoom').select_option(str(zoom));select_image();factor=zoom*scale/100
    drag_handle('#resizeHandle',20*factor,20*factor);assert abs(selected_node()['props']['width']-112)<.1
   run(f'Grid snapping uses design pixels at {zoom*100:g}% workspace zoom and {scale}% export scale',zoomed)
 def modes():
  fixture();select_image();original=js('blocksStudio.html()');page.locator('#gridToggle').click();assert page.locator('#canvasGrid').is_hidden()
  page.locator('#snapToggle').uncheck();page.locator('#gridStep').select_option('16');assert js('blocksStudio.html()')==original
  assert js('blocksStudio.canvasPreferences()')=={'grid':False,'snap':False,'step':16,'handles':'size'}
 run('Grid visibility and snap preferences are independent of exported HTML',modes)
 def preferences_restore():
  stored=js('__storage');other=browser.new_page(viewport={'width':1512,'height':1100});boot(other,stored)
  assert other.evaluate('blocksStudio.canvasPreferences()')=={'grid':False,'snap':False,'step':16,'handles':'size'};other.close()
 run('Canvas preferences persist separately in browser storage',preferences_restore)
 def real_spacing():
  fixture('text');page.locator('#canvas [data-edit]').first.click();page.locator('#handleMode').select_option('spacing')
  assert page.locator('[data-canvas-resize^="padding:"]:visible').count()==4
  drag_handle('[data-canvas-resize="padding:Left"]',19,0);n=selected_node();assert n['style']['paddingLeft']==16
  assert 'padding-left:16px' in js('blocksStudio.html()');assert page.locator('#inspector [data-path="style.paddingLeft"]').input_value()=='16'
 run('Spacing handles snap insets and synchronize the inspector and export',real_spacing)
 def generic_width():
  fixture('text');page.locator('#canvas [data-edit]').first.click();before=js('blocksStudio.html()')
  drag_handle('[data-canvas-resize="width:e"]',-71,0);n=selected_node();assert n['style']['width']%8==0;assert n['style']['width']<456
  assert 'data-width-box' not in js('blocksStudio.html()');assert js('blocksStudio.html()')!=before
  page.locator('[data-canvas-align=right]').click();ready();assert selected_node()['style']['align']=='right';assert 'align="right"' in js('blocksStudio.html()')
 run('Text width handles and quick alignment change the email layout, not preview transforms',generic_width)
 def column_resize(kind='columns',index=0):
  fixture(kind);ids=js('(()=>{const a=[];__modules["blocks/model.mjs"].walk(blocksStudio.getDocument().children,n=>{if(n.type==="columns")a.push(n.id)});return a})()');page.evaluate('(id)=>blocksStudio.select(id)',ids[-1]);ready()
  before=selected_node()['props']['ratios'];drag_handle(f'[data-canvas-resize="column:{index}"]:visible',19,0)
  after=selected_node()['props']['ratios'];assert after[index]>before[index];assert abs(sum(after)-100)<.0001
  if index:assert after[0]==before[0]
 run('Two-column splitter resizes adjacent columns',column_resize)
 run('Three-column layouts expose and operate the second splitter',lambda:column_resize('three',1))
 run('Nested column splitter uses its own available width',lambda:column_resize('nested',0))
 def outside():
  fixture('template');select_image();page.locator('.email-copy').click();assert js('blocksStudio.id()') is None
  assert page.locator('#canvas [data-selected]').count()==0;assert page.locator('[data-canvas-resize]:visible').count()==0;assert page.locator('#selectionBar').is_hidden()
 run('Clicking the surrounding email body clears selection, outlines, handles and toolbar',outside)
 def blank_stage():
  fixture('template');select_image();r=page.locator('#stage').bounding_box();page.mouse.click(r['x']+8,r['y']+10)
  assert js('blocksStudio.id()') is None;assert page.locator('#structure .active').count()==0
 run('Clicking empty stage background deselects the block and its layer',blank_stage)
 def whitespace():
  fixture('text');page.locator('#canvas [data-edit]').first.click();cell=page.locator('#canvas [data-bid]').first.bounding_box();page.mouse.click(cell['x']+cell['width']-20,cell['y']+cell['height']/2)
  assert js('blocksStudio.id()') is None
 run('Empty space inside a full-width text row deselects instead of reselecting it',whitespace)
 def gap():
  fixture('text');page.locator('#canvas [data-edit]').first.click();a=page.locator('#canvas [data-bid]').first.bounding_box();b=page.locator('#canvas [data-bid]').nth(1).bounding_box()
  page.mouse.click(a['x']+30,(a['y']+a['height']+b['y'])/2);assert js('blocksStudio.id()') is None
 run('Clicking inter-block whitespace does not select an ancestor container',gap)
 def inspector():
  fixture();id=select_image();page.locator('#inspector input[data-path=label]').fill('Renamed logo');ready();assert js('blocksStudio.id()')==id
  page.locator('#gridStep').select_option('12');assert js('blocksStudio.id()')==id
  page.locator('[data-canvas-align=center]').click();ready();assert js('blocksStudio.id()')==id
 run('Inspector fields, grid settings and alignment tools keep selection usable',inspector)
 def select_other():
  fixture('text');a=page.locator('#canvas [data-edit]').first;b=page.locator('#canvas [data-edit]').nth(1);a.click();first=js('blocksStudio.id()');b.click();assert js('blocksStudio.id()')!=first;assert js('blocksStudio.id()') is not None
 run('Clicking another content element transfers selection cleanly',select_other)
 def edit_blur():
  fixture('text');el=page.locator('#canvas [data-edit]').first;el.dblclick();el.fill('Saved after click away');page.locator('.email-copy').click();ready()
  assert 'Saved after click away' in js('blocksStudio.html()');assert js('blocksStudio.id()') is None
 run('Click-away commits active text editing before deselecting',edit_blur)
 def keyboard_handle():
  fixture();select_image();page.locator('#resizeHandle').focus();page.keyboard.press('ArrowRight');ready();assert selected_node()['props']['width']==104
  page.keyboard.press('Alt+ArrowRight');ready();assert selected_node()['props']['width']==105
  order=js('blocksStudio.getDocument().children.map(n=>n.id)');page.keyboard.press('Alt+ArrowDown');ready()
  assert selected_node()['props']['height']==106;assert js('blocksStudio.getDocument().children.map(n=>n.id)')==order
 run('Focused resize handles support keyboard grid steps and Alt fine adjustment',keyboard_handle)
 def drag_move():
  fixture('text');page.locator('#canvas [data-edit]').first.click();id=js('blocksStudio.id()');loc=page.locator('#canvasMoveHandle');r=loc.bounding_box();dest=page.locator('#canvas').bounding_box()
  page.mouse.move(r['x']+12,r['y']+12);page.mouse.down();page.mouse.move(dest['x']+dest['width']/2,dest['y']+dest['height']+5,steps=15);page.mouse.up();ready()
  assert js('blocksStudio.getDocument().children[1].id')==id;assert js('blocksStudio.id()')==id
  page.locator('#undo').click();ready();assert js('blocksStudio.getDocument().children[0].id')==id
 run('Canvas move grip snaps the block into structural rows with undo',drag_move)
 def preview_clean():
  fixture();select_image();page.locator('[data-action=preview]').click();ready();assert page.locator('#canvasGrid').is_hidden();assert page.locator('#canvasTools').is_hidden()
  html=js('blocksStudio.html()');assert all(x not in html for x in ['data-canvas','data-selected','canvasGrid','canvas-hover','data-width-box'])
  page.locator('[data-action=preview]').click();ready()
 run('Preview-only mode and exported HTML exclude all alignment aids',preview_clean)
 def lost_capture():
  fixture();select_image();before=js('blocksStudio.getDocument()');r=page.locator('#resizeHandle').bounding_box();page.mouse.move(r['x']+12,r['y']+12);page.mouse.down();page.mouse.move(r['x']+35,r['y']+35,steps=5)
  page.locator('#resizeHandle').dispatch_event('lostpointercapture',{'pointerId':1,'bubbles':True});page.mouse.up();ready();assert js('blocksStudio.getDocument()')==before
 run('Unexpected lost pointer capture rolls back the resize',lost_capture)
 def touch_resize():
  fixture();select_image();r=page.locator('#resizeHandle').bounding_box();x=r['x']+12;y=r['y']+12;cdp=page.context.new_cdp_session(page)
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
  for i in range(1,9):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+20*i/8,'y':y+20*i/8}]})
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});ready();assert selected_node()['props']['width']==112;cdp.detach()
 run('Touch-pointer dragging uses the same snapping and commit behavior',touch_resize)
 def mobile_controls():
  fixture('template');page.set_viewport_size({'width':390,'height':844});page.locator('#gridToggle').scroll_into_view_if_needed();assert page.locator('#gridToggle').is_visible();assert js('document.documentElement.scrollWidth')<=392
  select_image();assert page.locator('#canvasMoveHandle').is_visible();page.locator('.email-copy').click();assert js('blocksStudio.id()') is None
  page.set_viewport_size({'width':1512,'height':1100})
 run('Grid tools and click-away selection remain usable at a 390px viewport',mobile_controls)
 def live_measure():
  fixture('template');select_image();r=page.locator('#resizeHandle').bounding_box();page.mouse.move(r['x']+12,r['y']+12);page.mouse.down();page.mouse.move(r['x']+40,r['y']+40,steps=8)
  assert page.locator('#snapReadout').is_visible();assert 'grid' in page.locator('#snapReadout').inner_text()
  page.screenshot(path=str(OUT/'alignment-guides.png'));page.mouse.up();ready();page.screenshot(path=str(OUT/'alignment-workspace.png'))
 run('Live size readout and alignment guides display during a handle drag',live_measure)
 run('No unhandled JavaScript errors',lambda: (_ for _ in ()).throw(AssertionError(errors)) if errors else None)
 browser.close()
(OUT/'alignment-browser-report.json').write_text(json.dumps({'tests':reports,'errors':errors},indent=2))
sys.exit(0 if all(x['pass'] for x in reports) else 1)
