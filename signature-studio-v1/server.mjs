import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const port=Number(process.env.PORT||3000);
const mime={'.html':'text/html; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
function config(){return 'window.SIGNATURE_STUDIO_CONFIG = '+JSON.stringify({supabaseUrl:process.env.PUBLIC_SUPABASE_URL||'',supabasePublishableKey:process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.PUBLIC_SUPABASE_ANON_KEY||'',googleClientId:process.env.PUBLIC_GOOGLE_CLIENT_ID||'',enableDirectGmail:String(process.env.ENABLE_DIRECT_GMAIL||'').toLowerCase()==='true'})+';\n';}
const server=http.createServer(async(req,res)=>{
 const send=(status,body,type='text/plain; charset=utf-8',cache='no-store')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':cache,'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Cross-Origin-Opener-Policy':'same-origin-allow-popups'});res.end(req.method==='HEAD'?undefined:body);};
 try{
  if(!['GET','HEAD'].includes(req.method))return send(405,'Method not allowed');
  const url=new URL(req.url||'/','http://localhost');let pathname;
  try{pathname=decodeURIComponent(url.pathname);}catch{return send(400,'Malformed path');}
  if(pathname==='/healthz')return send(200,'ok');
  if(pathname==='/config.js')return send(200,config(),mime['.js']);
  if(pathname==='/'||pathname==='/index.html')pathname='/design/index.html';
  if(pathname==='/legacy')pathname='/index.html';
  const filePath=path.resolve(publicDir,'.'+pathname);
  if(!filePath.startsWith(publicDir+path.sep))return send(403,'Forbidden');
  const info=await stat(filePath);if(!info.isFile())return send(404,'Not found');
  const ext=path.extname(filePath).toLowerCase();
  return send(200,await readFile(filePath),mime[ext]||'application/octet-stream',['.png','.jpg','.jpeg','.svg','.webp'].includes(ext)?'public, max-age=86400':'no-cache');
 }catch(error){return send(error.code==='ENOENT'?404:500,error.code==='ENOENT'?'Not found':'Unable to serve this request');}
});
server.listen(port,'0.0.0.0',()=>console.log(`Signature Studio Design Edition listening on ${port}`));
