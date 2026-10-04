import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

let count = 0;
for (const entry of await readdir('packages', { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  for (const name of await readdir(`packages/${entry.name}`)) {
    if (!name.endsWith('.js')) continue;
    const result = spawnSync(process.execPath, ['--check', `packages/${entry.name}/${name}`], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
    count++;
  }
}
console.log(`${count} JavaScript modules passed syntax checks.`);
