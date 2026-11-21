import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const root = 'server/access/api-site', output = root + '/dist';
mkdirSync(output, { recursive: true });
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
writeFileSync(root + '/wrangler.jsonc', JSON.stringify({ ...config, pages_build_output_dir: './dist' }, null, 2));
await build({ entryPoints: ['server/access/api-overlay-worker.mjs'], outfile: output + '/_worker.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
writeFileSync(output + '/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: [] }));
writeFileSync(output + '/index.html', '<!doctype html><meta charset="utf-8"><title>歪歪机</title>');
