/**
 * Seeds the local D1 database through the running dev/preview server.
 * Usage: bun run seed   (server must be running on BASE_URL, default http://localhost:4321)
 */
const base = process.env.BASE_URL ?? 'http://localhost:4321';
const token = process.env.SEED_TOKEN ?? readDevVar('SEED_TOKEN') ?? 'dev-seed-token';

function readDevVar(name: string): string | undefined {
  try {
    const text = require('node:fs').readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8') as string;
    const line = text.split('\n').find((l) => l.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim();
  } catch {
    return undefined;
  }
}

const res = await fetch(`${base}/api/dev/seed`, { method: 'POST', headers: { 'x-seed-token': token, 'content-type': 'application/json', origin: base }, body: '{}' });
const body = await res.text();
console.log(res.status, body);
if (!res.ok) process.exit(1);
