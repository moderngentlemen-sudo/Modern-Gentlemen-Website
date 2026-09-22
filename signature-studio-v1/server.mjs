import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, body, type='text/plain; charset=utf-8', extra={}) {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    ...extra
  });
  res.end(body);
}

function runtimeConfig() {
  return `window.SIGNATURE_STUDIO_CONFIG = ${JSON.stringify({
    supabaseUrl: process.env.PUBLIC_SUPABASE_URL || '',
    supabasePublishableKey: process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || '',
    googleClientId: process.env.PUBLIC_GOOGLE_CLIENT_ID || '',
    enableDirectGmail: String(process.env.ENABLE_DIRECT_GMAIL || '').toLowerCase() === 'true'
  })};\n`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/healthz') return send(res, 200, 'ok');
  if (url.pathname === '/config.js') return send(res, 200, runtimeConfig(), 'application/javascript; charset=utf-8', {'Cache-Control':'no-store'});

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const safe = path.normalize(pathname).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(publicDir, safe);
  if (!filePath.startsWith(publicDir)) return send(res, 403, 'Forbidden');

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return send(res, 404, 'Not found');
    const body = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=86400';
    send(res, 200, body, mime[ext] || 'application/octet-stream', {'Cache-Control': cache});
  } catch {
    send(res, 404, 'Not found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Signature Studio v1 listening on port ${port}`);
});
