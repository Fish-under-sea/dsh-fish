/**
 * 一次跑完三套测试。
 *
 * 用法（本机 DSH 自带的 node）：
 *   & "C:\Program Files\DeepSeek Harness\resources\runtime\node\node.exe" test/run-all.mjs
 *
 * 也可用系统的 node：node test/run-all.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUITES = ['core.test.mjs', 'host.test.mjs', 'client.test.mjs'];

let failed = 0;
for (const suite of SUITES) {
  console.log(`\n=== ${suite} ===`);
  const result = spawnSync(process.execPath, [path.join(HERE, suite)], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

console.log(failed === 0 ? '\n全部通过。' : `\n有 ${failed} 套失败。`);
process.exit(failed === 0 ? 0 : 1);