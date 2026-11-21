import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--base=/'], { stdio: 'inherit', env: { ...process.env, PHONE_ACCESS_GATE: '1' } });
process.exit(result.status ?? 1);
