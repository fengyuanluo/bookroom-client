// Serves the static web export (`out/`, from `pnpm build-web`) the way the
// BookRoom server's WEB_DIR handler does: a route resolves to the file itself,
// then `<route>.html`, then `<route>/index.html`; any other extensionless path
// falls back to `index.html`, and a missing file with an extension is a 404.
// Every file is cross-origin isolated (COOP + COEP): the Turso WASM search
// index needs SharedArrayBuffer, so without them in-book search finds nothing.
// Used by `pnpm start-web` and the Playwright web e2e lane.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../out', import.meta.url));
const port = Number(process.env.PORT) || 3000;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
};

const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

const resolve = (urlPath) => {
  const clean = join(root, normalize(`/${decodeURIComponent(urlPath)}`));
  if (clean !== root && !clean.startsWith(root + sep)) return null;
  for (const candidate of [clean, `${clean}.html`, join(clean, 'index.html')]) {
    if (isFile(candidate)) return candidate;
  }
  return extname(urlPath) ? null : join(root, 'index.html');
};

createServer((req, res) => {
  let file = null;
  try {
    file = resolve(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    // Malformed percent-encoding.
  }
  if (!file || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
