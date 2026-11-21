import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
const result = spawnSync(process.execPath, ['server/access/build.mjs'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
await build({ entryPoints: ['server/access/worker.mjs'], outfile: 'dist/_worker.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
writeFileSync('dist/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: [] }));
