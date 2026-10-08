"""Actual Chromium image decoders and canvas; network responses are simulated locally."""

def run_image_browser_cases(browser, boot, record):
    def scenario(name, expression):
        def execute():
            page=browser.new_page(viewport={'width':1500,'height':1080})
            try:
                boot(page)
                result=page.evaluate(expression)
                assert result is True, result
            finally:
                page.close()
        record('browser image: '+name, execute)

    scenario('safe SVG becomes PNG while its editable source is retained', r'''async()=>{
      const media=__modules['design/media.mjs'],blocks=__modules['blocks/model.mjs'],assets=__modules['shared/email-assets.mjs'];
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#1875a0"/></svg>';
      const source=await media.readImage(new File([svg],'logo.svg',{type:'image/svg+xml'}));
      if(!source.startsWith('data:image/svg+xml;'))throw new Error('Original SVG source was replaced');
      const document=blocks.freshDocument(true),image=blocks.block('image',{src:source,width:64,height:64,alt:'Safe SVG'});document.children=[image];
      const before=JSON.stringify(document),result=await __modules['blocks/media.mjs'].prepareBlocks(document,'https://signature-studio.test');
      if(result.errors.length)throw new Error(result.errors.join('; '));
      const output=result.images[image.id];if(!output.startsWith('data:image/png;'))throw new Error('SVG was not rasterized');
      const blob=await(await fetch(output)).blob(),details=await assets.validateImageBlob(blob);
      return details.width===128&&details.height===128&&before===JSON.stringify(document)&&result.keys[image.id]===await assets.digestImageBytes(blob);
    }''')

    scenario('active imported SVG and external SVG resources fail before publication', r'''async()=>{
      const blocks=__modules['blocks/model.mjs'],prepare=__modules['blocks/media.mjs'].prepareBlocks;
      const unsafe=[
       '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><script>alert(1)</script></svg>',
       '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><image href="https://private.example/track.png" width="32" height="32"/></svg>',
       '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" onload="alert(1)"/></svg>'
      ];
      for(const svg of unsafe){const document=blocks.freshDocument(true),source='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);document.children=[blocks.block('image',{src:source,width:32,height:32})];const result=await prepare(document,'https://signature-studio.test');if(result.errors.length!==1||Object.keys(result.images).length)throw new Error('Unsafe imported SVG passed preparation');if(document.children[0].props.src!==source)throw new Error('Original source lost');}
      return true;
    }''')

    scenario('real decoder rejects truncated PNG despite matching header and MIME', r'''async()=>{
      const assets=__modules['shared/email-assets.mjs'],canvas=document.createElement('canvas');canvas.width=canvas.height=32;canvas.getContext('2d').fillRect(0,0,32,32);
      const blob=await(await fetch(canvas.toDataURL('image/png'))).blob(),bytes=await blob.arrayBuffer(),broken=new Blob([bytes.slice(0,33)],{type:'image/png'});
      const hash=await assets.digestImageBytes(broken),url='https://fixture.supabase.co/storage/v1/object/public/signature-assets/fixture-owner/'+hash+'.png';
      try{await assets.verifyPublicImage(url,{policy:{storageOrigin:'https://fixture.supabase.co'},fetch:async()=>new Response(broken,{headers:{'content-type':'image/png'}})});}catch(error){return error.code==='IMAGE_INVALID'&&/decoded/.test(error.message);}
      throw new Error('Malformed PNG passed actual browser decoder');
    }''')

    scenario('same remote URL with changed pixels produces a changed final-byte hash', r'''async()=>{
      const originalFetch=window.fetch.bind(window),blocks=__modules['blocks/model.mjs'],prepare=__modules['blocks/media.mjs'].prepareBlocks;
      const output=async color=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const context=canvas.getContext('2d');context.fillStyle=color;context.fillRect(0,0,32,32);return(await originalFetch(canvas.toDataURL('image/png'))).blob();};
      const red=await output('#a12939'),blue=await output('#236d92');let current=red,requests=0;
      const source='https://images.example.test/changing.png';
      window.fetch=async(url,options={})=>{if(String(url)!==source)return originalFetch(url,options);requests++;if(options.credentials!=='omit'||options.redirect!=='error'||options.cache!=='no-store')throw new Error('Source request is not anonymous and fresh');return new Response(current,{headers:{'content-type':'image/png'}});};
      try{const document=blocks.freshDocument(true),image=blocks.block('image',{src:source,width:64,height:64,zoom:125,x:10,y:-10,fit:'cover',shape:'circle'});document.children=[image];
       const first=await prepare(document,'https://signature-studio.test');current=blue;const second=await prepare(document,'https://signature-studio.test');
       if(first.errors.length||second.errors.length)throw new Error('Valid remote image failed processing');
       return requests===2&&first.keys[image.id]!==second.keys[image.id]&&document.children[0].props.src===source&&first.images[image.id]!==second.images[image.id];
      }finally{window.fetch=originalFetch;}
    }''')

    scenario('social labels containing src text cannot bypass verified image replacement', r'''async()=>{
      const assets=__modules['shared/email-assets.mjs'],blocks=__modules['blocks/model.mjs'],prepare=__modules['blocks/media.mjs'].prepareBlocks,render=__modules['blocks/render.mjs'].renderBlocks;
      const canvas=document.createElement('canvas');canvas.width=canvas.height=24;canvas.getContext('2d').fillRect(0,0,24,24);const original=canvas.toDataURL('image/png');
      const doc=blocks.freshDocument(true);doc.children=[blocks.block('social',{appearance:'bare',size:24,items:[{id:'custom',label:'Social src=word',url:'https://example.com/',enabled:true,customIcon:original}]})];
      const objects=new Map(),base='https://fixture.supabase.co',nativeFetch=window.fetch.bind(window),cloud={base,configured:true,user:{id:'fixture-owner'},uploadBlob:async(blob,{hash})=>{const url=base+'/storage/v1/object/public/signature-assets/fixture-owner/'+hash+'.png';objects.set(url,blob);return url;}};
      const result=await assets.prepareEmailAssets(doc,['full'],{origin:'https://signature-studio.test',cloud,prepare,render,isCurrent:()=>true,consent:true,fetch:async(url,options)=>objects.has(String(url))?new Response(objects.get(String(url)),{headers:{'content-type':'image/png'}}):nativeFetch(url,options)});
      const parsed=new DOMParser().parseFromString(result.htmlByVariant.full,'text/html'),image=parsed.images[0];
      if(parsed.images.length!==1||!image.getAttribute('src').startsWith(base+'/storage/v1/object/public/signature-assets/fixture-owner/')||image.alt!=='Social src=word')throw new Error('Source replacement modified the label or retained an unsafe source');
      let rejected=false;try{assets.assertEmailSafeMarkup('<img alt="Photo src="'+image.src+'" src="'+original+'">',{storageOrigin:base,verifiedUrls:new Set([image.src])});}catch(error){rejected=error.code==='IMAGE_INVALID';}
      return rejected;
    }''')
