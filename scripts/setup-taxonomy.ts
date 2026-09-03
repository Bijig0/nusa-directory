/// <reference types="node" />
/**
 * Seeds the production taxonomy (cities, areas, categories, services, products) once, without touching other data.
 * Usage: BASE_URL=https://your-domain SEED_TOKEN=… bun run setup:taxonomy
 */
const base = process.env.BASE_URL ?? 'http://localhost:4321';
const token = process.env.SEED_TOKEN ?? 'dev-seed-token';
const res = await fetch(`${base}/api/setup/taxonomy`, { method: 'POST', headers: { 'x-setup-token': token, 'content-type': 'application/json', origin: base }, body: '{}' });
console.log(res.status, await res.text());
if (!res.ok) process.exit(1);
export {};
