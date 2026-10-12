// dsh-git-sync 私钥配置导出测试。
//
// 先写测试（红）→ 实现（绿）。这里守的是三条底线：
//   1. 导出必须**保留相对目录结构**（否则新机器不知道往哪拷）。
//   2. 导出必须**不把凭据内容写进日志**（内容进日志就等于外泄）。
//   3. 导出**绝不能**把凭据带进同步白名单（否则会随 git 推到远端）。
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const PLUGIN = fileURLToPath(new URL('../lib/index.js', import.meta.url));
const TMP = path.join(os.tmpdir(), 'dsh-private-export-tmp');

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  [ok]   ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label} ${extra}`); }
};

rmSync(TMP, { recursive: true, force: true });
const home = path.join(TMP, 'home');
const target = path.join(TMP, 'desktop');

const mod = await import(`file:///${PLUGIN.replace(/\\/g, '/')}`);
const { PRIVATE_EXPORT_FILES, PRIVATE_EXPORT_DIR_NAME, resolveExportDir, exportPrivateConfig, WHITE_LIST } = mod;

// 造出「本机」侧的凭据文件（内容用可识别的哨兵，便于断言不泄漏）
const SECRET_SENTINEL = 'SENTINEL-TOKEN-DO-NOT-LOG-abc123';
const fixtures = {
  'channel-pack/state.json': JSON.stringify({ accounts: [{ id: 'codearts-1', credentialRef: 'REF_X' }] }),
  'channel-pack/auto-checkin.json': JSON.stringify({ last: '2026-10-12' }),
  'channel-pack/token-ledger.json': JSON.stringify({ total: 1234 }),
  '.credentials.yaml': `DEEPSEEK_API_KEY: ${SECRET_SENTINEL}\n`,
  'our-free-model/eac-user.json': JSON.stringify({ token: SECRET_SENTINEL, login: 'someone' }),
};
for (const [rel, body] of Object.entries(fixtures)) {
  const abs = path.join(home, ...rel.split('/'));
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

console.log('=== 1. 清单与同步白名单必须互斥（凭据永不随 git 走）===');
check('清单非空', PRIVATE_EXPORT_FILES.length > 0);
const whiteCovers = (rel) => WHITE_LIST.some((w) => rel === w || rel.startsWith(w + '/'));
for (const item of PRIVATE_EXPORT_FILES) {
  check(`★ ${item.rel} 不在同步白名单里`, !whiteCovers(item.rel));
}
check('★ .credentials.yaml 不在白名单', !whiteCovers('.credentials.yaml'));
check('★ eac-user.json 不在白名单', !whiteCovers('our-free-model/eac-user.json'));

console.log('\n=== 2. 导出目录解析 ===');
check('未设置时默认落到桌面', resolveExportDir({}) === path.join(os.homedir(), 'Desktop')
  || resolveExportDir({}) === os.homedir(), `实际=${resolveExportDir({})}`);
check('设置里给了值就用它', resolveExportDir({ exportDir: target }) === path.resolve(target));

console.log('\n=== 3. 执行导出 ===');
const result = exportPrivateConfig(home, { exportDir: target });
const outDir = path.join(target, PRIVATE_EXPORT_DIR_NAME);
check('返回 ok', result.ok === true, JSON.stringify(result.log));
check('目录名正确', path.basename(result.outDir) === PRIVATE_EXPORT_DIR_NAME);
check('导出目录已创建', existsSync(outDir));

console.log('\n=== 4. 文件与目录结构 ===');
for (const item of PRIVATE_EXPORT_FILES) {
  const abs = path.join(outDir, ...item.rel.split('/'));
  check(`结构保留：${item.rel}`, existsSync(abs));
  if (item.rel === 'channel-pack/state.json') {
    check('content 一致（state.json）', readFileSync(abs, 'utf8') === fixtures[item.rel]);
  }
}
check('导出了全部 5 份', result.exported.length === 5, `实际=${result.exported.length}`);

console.log('\n=== 5. README 必须写入且含警示 ===');
const readme = path.join(outDir, 'README.md');
check('README.md 存在', existsSync(readme));
if (existsSync(readme)) {
  const text = readFileSync(readme, 'utf8');
  check('README 含「不要上传」警示', /不要.*上传|绝.*不要/.test(text));
  check('README 含放回位置表', text.includes('channel-pack') && text.includes('.credentials.yaml'));
  check('README 标注「必需」', text.includes('必需'));
}

console.log('\n=== 6. ★ 日志不得包含凭据内容（外泄防线）===');
const logText = result.log.join('\n');
check('日志不含哨兵 token', !logText.includes(SECRET_SENTINEL));
check('日志不含 eac-user 的 token 字段值', !logText.includes('DO-NOT-LOG'));
check('日志确实提到了各文件（证明跑过）', logText.includes('channel-pack/state.json'));

console.log('\n=== 7. README 也不得包含凭据内容 ===');
if (existsSync(readme)) {
  const text = readFileSync(readme, 'utf8');
  check('★ README 不含哨兵 token', !text.includes(SECRET_SENTINEL));
}

console.log('\n=== 8. 缺文件时优雅跳过（不致命）===');
const home2 = path.join(TMP, 'home2');
mkdirSync(path.join(home2, 'channel-pack'), { recursive: true });
writeFileSync(path.join(home2, 'channel-pack', 'state.json'), '{}', 'utf8');
const r2 = exportPrivateConfig(home2, { exportDir: path.join(TMP, 'desktop2') });
check('只有 1 份时仍 ok', r2.ok === true, JSON.stringify(r2.log));
check('记录缺失项', r2.missing.length === 4, `实际=${r2.missing.length}`);
check('日志说明缺失原因', r2.log.join('\n').includes('本机不存在'));

console.log('\n=== 9. 目标目录不可写时报错而非静默成功 ===');
const bad = exportPrivateConfig(home, { exportDir: path.join(TMP, 'home', 'channel-pack', 'state.json', 'x', 'y') });
check('不可写时 ok=false 或明确报错', bad.ok === false || bad.log.join('\n').includes('[x]'), JSON.stringify(bad.log));

rmSync(TMP, { recursive: true, force: true });

console.log(`\n——— 通过 ${pass} / 失败 ${fail} ———`);
if (fail > 0) process.exit(1);
