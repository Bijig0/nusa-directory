/// <reference types="node" />
/**
 * Seeds the local D1 database through the running dev/preview server.
 * Usage: bun run seed   (dev server must be running on BASE_URL, default http://localhost:4321)
 */
// bun loads .env automatically, so SEED_TOKEN/BASE_URL come from there or the shell.
const base = process.env.BASE_URL ?? 'http://localhost:4321';
const token = process.env.SEED_TOKEN ?? 'dev-seed-token';

const res = await fetch(`${base}/api/dev/seed`, { method: 'POST', headers: { 'x-seed-token': token, 'content-type': 'application/json', origin: base }, body: '{}' });
const body = await res.text();
console.log(res.status, body);
if (!res.ok) process.exit(1);

export {};
