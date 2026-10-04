/** Zero-dependency HTML/ES-module host. The hosted edition adds the cloud disk API. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PLATINUM_PORT || 8080);
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ttf':'font/ttf' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/api/disk') {
      response.writeHead(503, { 'content-type':'application/json' });
      response.end(JSON.stringify({ error:'Standalone mode saves on this device.' }));
      return;
    }
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    let relative;
    if (pathname === '/') relative = 'standalone/index.html';
    else if (pathname.startsWith('/packages/') && !pathname.includes('/node_modules/')) relative = pathname.slice(1);
    else if (pathname === '/app/globals.css') relative = 'app/globals.css';
    else if (/^\/(assets|fonts)\//.test(pathname) || ['/favicon.svg','/version.json'].includes(pathname)) relative = `public${pathname}`;
    else { response.writeHead(404).end('Not found'); return; }
    const file = resolve(root, relative);
    const scope = resolve(root, relative.split('/')[0]);
    if (!file.startsWith(scope+sep)) { response.writeHead(403).end(); return; }
    if (!file.startsWith(root.endsWith(sep) ? root : root+sep)) { response.writeHead(403).end(); return; }
    const bytes = await readFile(file);
    response.writeHead(200, { 'content-type':types[extname(file)] || 'application/octet-stream', 'cache-control':'no-store', 'x-content-type-options':'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Mac OS 9 is ready at http://localhost:${port}`));
