import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';

/** Serve only browser assets, fixtures and the generated MoonBit module. */
export async function startBrowserServer(port = 0, inputFont?: string) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url!, 'http://localhost').pathname);
      if (path === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<!doctype html><meta charset="utf-8"><title>Font measurement harness</title>');
        return;
      }
      if (path === '/input-font' && inputFont) {
        const body = await readFile(inputFont);
        response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(body);
        return;
      }
      const file = resolve(root, `.${path}`);
      const allowed = ['browser', 'fixtures', '_build/js/release/build/js'].some(
        directory => file.startsWith(resolve(root, directory) + sep),
      );
      if (!allowed) {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile(file);
      const contentTypes: Record<string, string> = {
        '.js': 'text/javascript; charset=utf-8', '.ttf': 'font/ttf',
        '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
      };
      response.writeHead(200, {
        'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No server address');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startBrowserServer(43783);
  console.log(`Font measurement harness: ${server.url}`);
}
