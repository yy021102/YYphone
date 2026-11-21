import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = 'server/access/admin-site/dist';
mkdirSync(output, { recursive: true });
await build({ entryPoints: ['server/access/admin-worker.mjs'], outfile: output + '/_worker.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
writeFileSync(output + '/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: [] }));
writeFileSync(output + '/index.html', '<!doctype html><meta charset="utf-8"><title>小手机发码管理</title>请打开 /admin');
