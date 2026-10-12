/**
 * @fish-under-sea/dsh-skill-lens-fish 的宿主半边（lib/index.js）测试。
 *
 * 宿主半边负责：按「项目级 <会话工作区>/.dsh/skills + 全局级 $DSH_HOME/skills」
 * 两个根扫描技能、读写技能文件、把技能对共享资源（skill-refs/）的引用解析成
 * 真实路径、新建/导入/删除。这里不起真服务器，而是把 ctx.webServer 注册的路由
 * 抓下来，用假的 req / res 直接调处理函数；DSH_HOME 指到临时目录，不碰真实 home。
 *
 * 运行：node test/host.test.mjs
 * （不要用 `node --test test/`：测试运行器会派生子进程并捕获管道输出，在受限沙箱
 *   里会以 EPERM 失败。）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { crc32 } from 'node:zlib';

import * as host from '../lib/index.js';

/** 新建一个临时目录；每个用例一个，互不干扰。 */
function mk() {
  return mkdtempSync(path.join(tmpdir(), 'dsh-skill-lens-'));
}

/** 会话工作区可切换：项目级技能根 = <会话工作区>/.dsh/skills。 */
let sessionCwd = mk();

const routes = [];
host.apply({
  webServer: {
    register: (route) => {
      routes.push(route);
      return () => {};
    },
  },
  sessions: {
    get: (id) => (id === 'smoke' ? { header: { cwd: sessionCwd } } : undefined),
  },
});
const route = routes[0];

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    write(chunk) {
      this.body += String(chunk);
    },
    end(payload) {
      if (payload) this.body += String(payload);
    },
  };
}

/** 调一个 JSON 动作，返回 { body, status }。 */
async function call(action, body = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.url = `/skill-lens/api/${action}`;
  req.method = 'POST';
  const res = makeRes();
  await route.handler(req, res);
  return { body: res.body ? JSON.parse(res.body) : {}, status: res.statusCode };
}

/** 调 batch-export：响应是二进制 ZIP，不能当 JSON 解析。 */
async function callRaw(action, body = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.url = `/skill-lens/api/${action}`;
  req.method = 'POST';
  const chunks = [];
  const res = {
    statusCode: 200,
    headers: {},
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    write(chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    },
    end(payload) {
      if (payload) chunks.push(Buffer.isBuffer(payload) ? payload : Buffer.from(payload));
    },
  };
  await route.handler(req, res);
  return { status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) };
}

/** 调 scan-stream（SSE）：把事件流解析成数组。 */
async function callStream(action, body = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.url = `/skill-lens/api/${action}`;
  req.method = 'POST';
  const res = makeRes();
  await route.handler(req, res);
  const events = [];
  for (const block of res.body.split('\n\n')) {
    const ev = /^event: (.+)$/m.exec(block);
    const da = /^data: (.+)$/m.exec(block);
    if (ev && da) events.push({ event: ev[1], data: JSON.parse(da[1]) });
  }
  return { events, status: res.statusCode };
}

/** 在 `root` 下写一个技能目录（<名称>/SKILL.md + 可选附带文件）。 */
function writeDirSkill(root, name, extra = {}) {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} 的说明\n---\n\n# ${name}\n`,
  );
  for (const [rel, content] of Object.entries(extra)) {
    const target = path.join(dir, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return dir;
}

/** 在 `root` 下写一个扁平技能（<名称>.md）。 */
function writeFlatSkill(root, name, description = `${name} 的说明`) {
  mkdirSync(root, { recursive: true });
  const file = path.join(root, `${name}.md`);
  writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
  return file;
}

// ---------------------------------------------------------------------------
// 目录式技能：上游既有能力，作为回归基线
// ---------------------------------------------------------------------------

test('目录式技能：扫描、文件清单、读取、删除', async () => {
  const root = mk();
  const dir = writeDirSkill(root, 'my-skill', { 'scripts/run.py': 'print(1)\n' });
  // 排除目录里的 SKILL.md 不算技能
  mkdirSync(path.join(root, 'node_modules', 'x'), { recursive: true });
  writeFileSync(path.join(root, 'node_modules', 'x', 'SKILL.md'), 'noise\n');

  const scan = await call('scan', { root });
  assert.equal(scan.status, 200);
  assert.equal(scan.body.skills.length, 1);
  assert.equal(scan.body.skills[0].rel, 'my-skill');
  assert.equal(scan.body.skills[0].kind, 'dir');
  assert.equal(scan.body.skills[0].root, scan.body.roots[0]);

  const files = await call('files', { dir });
  assert.equal(files.status, 200);
  assert.deepEqual(files.body.files, ['SKILL.md', 'scripts/run.py']);

  const read = await call('read', { path: path.join(dir, 'SKILL.md') });
  assert.equal(read.status, 200);
  assert.match(read.body.content, /my-skill/);

  const deleted = await call('delete', { dir });
  assert.equal(deleted.status, 200);
  assert.equal(existsSync(dir), false);
});

test('目录式技能：越界读取与非技能目录删除都被拒绝', async () => {
  const outside = mk();
  const outsideFile = path.join(outside, 'secret.txt');
  writeFileSync(outsideFile, 'secret\n');
  const read = await call('read', { path: outsideFile });
  assert.equal(read.status, 400, read.body.error);

  const root = mk();
  const plainDir = path.join(root, 'not-a-skill');
  mkdirSync(plainDir, { recursive: true });
  const scanned = await call('scan', { root });
  assert.equal(scanned.status, 200);
  const refused = await call('delete', { dir: plainDir });
  assert.equal(refused.status, 400, refused.body.error);

  const missing = await call('delete', { dir: path.join(root, 'nope') });
  assert.equal(missing.status, 404);
});

test('未知动作返回 404', async () => {
  const res = await call('no-such-action', {});
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------------------
// 扁平技能：<root>/<名称>.md —— 本 Fork 新增
// ---------------------------------------------------------------------------

test('扁平技能：扫描识别 <名称>.md，且不误报说明文件与技能包内部文档', async () => {
  const root = mk();
  writeFlatSkill(root, 'alpha');
  writeFlatSkill(root, 'beta');
  // 不应被当作独立技能的：说明性文件名、非 md、技能包内部文档、技能目录本身
  writeFileSync(path.join(root, 'README.md'), '# readme\n');
  writeFileSync(path.join(root, 'notes.txt'), 'notes\n');
  writeDirSkill(root, 'pkg', { 'references.md': '# 包内文档\n' });

  const scan = await call('scan', { root });
  assert.equal(scan.status, 200);

  const flat = scan.body.skills.filter((s) => s.kind === 'file').map((s) => s.rel).sort();
  assert.deepEqual(flat, ['alpha.md', 'beta.md'], JSON.stringify(scan.body.skills));

  const dirs = scan.body.skills.filter((s) => s.kind === 'dir').map((s) => s.rel);
  assert.ok(dirs.includes('pkg'), JSON.stringify(dirs));

  const rels = scan.body.skills.map((s) => s.rel);
  assert.ok(!rels.includes('README.md'), 'README.md 不应被当作技能');
  assert.ok(!rels.includes('notes.txt'), 'notes.txt 不应被当作技能');
  assert.ok(!rels.some((r) => r.endsWith('references.md')), '技能包内部的 md 不应被当作独立技能');
});

test('扁平技能：标识指向技能文件本身（同目录多技能不串）', async () => {
  const root = mk();
  const alpha = writeFlatSkill(root, 'alpha');
  writeFlatSkill(root, 'beta');

  const scan = await call('scan', { root });
  const skills = scan.body.skills;
  // 若标识取所在目录，12 个扁平技能会指向同一个目录，选择/删除/元数据全会串
  assert.equal(new Set(skills.map((s) => s.dir)).size, skills.length);
  const entry = skills.find((s) => s.rel === 'alpha.md');
  assert.equal(entry.dir, alpha);
});

test('扁平技能：文件清单只列自身、可读、可取元数据', async () => {
  const root = mk();
  const alpha = writeFlatSkill(root, 'alpha', '阿尔法的说明');
  // files / read / delete / batch-export 都受「已扫描根」围栏约束；真实使用也必先扫描
  await call('scan', { root });

  const files = await call('files', { dir: alpha });
  assert.equal(files.status, 200);
  assert.deepEqual(files.body.files, ['alpha.md']);

  const read = await call('read', { path: alpha });
  assert.equal(read.status, 200);
  assert.match(read.body.content, /alpha/);

  const meta = await call('skill-meta', { dirs: [alpha] });
  assert.equal(meta.status, 200);
  assert.equal(meta.body.results[0].description, '阿尔法的说明');
});

test('扁平技能：删除只删该文件，不动同目录其他技能', async () => {
  const root = mk();
  const alpha = writeFlatSkill(root, 'alpha');
  const beta = writeFlatSkill(root, 'beta');
  await call('scan', { root });

  const deleted = await call('delete', { dir: alpha });
  assert.equal(deleted.status, 200);
  assert.equal(existsSync(alpha), false);
  assert.equal(existsSync(beta), true, '同目录的 beta 不应被删掉');

  const batch = await call('batch-delete', { dirs: [beta] });
  assert.equal(batch.status, 200);
  assert.equal(batch.body.results[0].ok, true);
  assert.equal(existsSync(beta), false);
});

// ---------------------------------------------------------------------------
// 引用解析：技能目录之外的共享资源 —— 本 Fork 新增
// ---------------------------------------------------------------------------

test('resolve-refs：解析 ../skill-refs 引用与裸文件名，跳过解析不到的与外部链接', async () => {
  const root = mk();
  const skillDir = writeDirSkill(path.join(root, 'skills'), 'demo', { 'local.md': '# local\n' });
  const shared = path.join(root, 'skill-refs', 'demo');
  mkdirSync(shared, { recursive: true });
  writeFileSync(path.join(shared, 'protocol.md'), '# protocol\n');
  writeFileSync(path.join(shared, 'helpers.mjs'), 'export const x = 1;\n');

  const scan = await call('scan', { root: path.join(root, 'skills') });
  assert.equal(scan.status, 200);
  const demo = scan.body.skills.find((s) => s.rel === 'demo');
  assert.ok(demo, JSON.stringify(scan.body.skills));

  const res = await call('resolve-refs', {
    dir: demo.dir,
    refs: [
      { kind: 'relative-path', target: '../skill-refs/demo/protocol.md' },
      { kind: 'relative-path', target: 'helpers.mjs' },
      { kind: 'relative-path', target: 'missing-file.md' },
      { kind: 'url', target: 'https://example.com/doc' },
      { kind: 'env-var', target: 'DSH_HOME' },
    ],
  });
  assert.equal(res.status, 200);

  const targets = res.body.resolved.map((r) => r.target).sort();
  assert.deepEqual(targets, ['../skill-refs/demo/protocol.md', 'helpers.mjs'], JSON.stringify(res.body.resolved));
  for (const r of res.body.resolved) {
    assert.equal(existsSync(r.path), true, `${r.target} 应解析到真实文件`);
    assert.ok(r.label.includes('skill-refs'), `label 应可读：${r.label}`);
  }

  // 解析到的资源随后可读（其所在目录被加入放行根）
  const protocol = res.body.resolved.find((r) => r.target.endsWith('protocol.md'));
  const read = await call('read', { path: protocol.path });
  assert.equal(read.status, 200);
  assert.match(read.body.content, /protocol/);

  // 技能目录内的文件由技能自身的文件清单负责，不该在这里重复返回
  const localRes = await call('resolve-refs', {
    dir: demo.dir,
    refs: [{ kind: 'relative-path', target: 'local.md' }],
  });
  assert.equal(localRes.status, 200);
  assert.deepEqual(localRes.body.resolved, [], '技能目录内的文件不该被当作共享资源');
});

test('resolve-refs：不存在的技能路径返回 404', async () => {
  const res = await call('resolve-refs', { dir: path.join(mk(), 'nope'), refs: [] });
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------------------
// 全局根跟随 DSH_HOME —— 本 Fork 新增（上游硬编码 ~/.dsh）
// ---------------------------------------------------------------------------

test('全局技能根跟随 $DSH_HOME，而非硬编码 ~/.dsh', async () => {
  const home = mk();
  const globalSkills = path.join(home, 'skills');
  writeFlatSkill(globalSkills, 'global-flat');

  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  try {
    const projectCwd = mk();
    sessionCwd = projectCwd;

    const scan = await call('scan', { sessionId: 'smoke' });
    assert.equal(scan.status, 200);
    // 全局根应解析到 $DSH_HOME/skills
    assert.ok(
      scan.body.globalRoot.endsWith(path.join('skills')),
      `globalRoot 应指向 $DSH_HOME/skills，实际 ${scan.body.globalRoot}`,
    );
    assert.ok(
      path.resolve(scan.body.globalRoot).startsWith(path.resolve(home)),
      `globalRoot 应位于 DSH_HOME 之下，实际 ${scan.body.globalRoot}`,
    );
    const found = scan.body.skills.map((s) => s.rel);
    assert.ok(found.includes('global-flat.md'), `应扫到全局扁平技能，实际 ${JSON.stringify(found)}`);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
  }
});

test('scan-stream（SSE）返回 roots、globalRoot 与技能列表', async () => {
  const root = mk();
  writeFlatSkill(root, 'streamed');
  writeDirSkill(root, 'streamed-dir');

  const stream = await callStream('scan-stream', { root });
  assert.equal(stream.status, 200);
  const done = stream.events.find((e) => e.event === 'done');
  assert.ok(done, JSON.stringify(stream.events));
  assert.equal(done.data.ok, true);
  const rels = done.data.skills.map((s) => s.rel).sort();
  assert.deepEqual(rels, ['streamed-dir', 'streamed.md']);
  assert.ok(Array.isArray(done.data.roots));
});

// ---------------------------------------------------------------------------
// 项目级技能根与新建 / 导入 / 导出
// ---------------------------------------------------------------------------

test('项目级技能根：新建与导入写入 <会话工作区>/.dsh/skills 并被扫到', async () => {
  const projCwd = mk();
  sessionCwd = projCwd;
  const projRoot = path.join(projCwd, '.dsh', 'skills');

  const created = await call('create-skill', { name: 'proj-created', location: 'project', sessionId: 'smoke' });
  assert.equal(created.status, 200, created.body.error);
  assert.equal(created.body.dir, path.join(projRoot, 'proj-created'));
  assert.equal(existsSync(path.join(projRoot, 'proj-created', 'SKILL.md')), true);

  const imported = await call('import-skill', {
    name: 'proj-imported',
    location: 'project',
    sessionId: 'smoke',
    files: [{ path: 'SKILL.md', content: '---\nname: proj-imported\ndescription: p\n---\n' }],
  });
  assert.equal(imported.status, 200, imported.body.error);

  const scan = await call('scan', { sessionId: 'smoke' });
  const rels = scan.body.skills.filter((s) => s.root === projRoot).map((s) => s.rel);
  assert.ok(rels.includes('proj-created'), JSON.stringify(rels));
  assert.ok(rels.includes('proj-imported'), JSON.stringify(rels));
});

test('create-skill：同名冲突 409、非法名 400', async () => {
  const root = mk();
  const first = await call('create-skill', { name: 'dup-skill', location: 'global', root });
  assert.equal(first.status, 200, first.body.error);
  const again = await call('create-skill', { name: 'dup-skill', location: 'global', root });
  assert.equal(again.status, 409);
  for (const bad of ['../escape', 'a/b', '']) {
    const res = await call('create-skill', { name: bad, location: 'global', root });
    assert.equal(res.status, 400, `非法名 ${JSON.stringify(bad)} 应被拒绝`);
  }
});

test('import-skill：缺少 SKILL.md 与路径穿越都被拒绝', async () => {
  const root = mk();
  const noSkill = await call('import-skill', {
    name: 'no-skill-md',
    location: 'global',
    root,
    files: [{ path: 'notes.md', content: 'x' }],
  });
  assert.equal(noSkill.status, 400);

  const traversal = await call('import-skill', {
    name: 'traversal',
    location: 'global',
    root,
    files: [
      { path: 'SKILL.md', content: '---\nname: traversal\n---\n' },
      { path: '../escaped.txt', content: 'x' },
    ],
  });
  assert.equal(traversal.status, 400);
});

test('batch-export：导出 ZIP 且条目 CRC 有效', async () => {
  const root = mk();
  const dir = writeDirSkill(root, 'exportable', {
    'scripts/run.py': 'print(1)\n',
    'assets/checklist.md': '# 清单\n',
  });
  await call('scan', { root });

  const res = await callRaw('batch-export', { dirs: [dir] });
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'application/zip');

  // 极简 ZIP 解析：逐个本地文件头校验 CRC 与文件名
  const buf = res.body;
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= buf.length && buf.readUInt32LE(offset) === 0x04034b50) {
    const crc = buf.readUInt32LE(offset + 14);
    const size = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data) >>> 0, crc, `${name} 的 CRC 应匹配`);
    entries.set(name, data.toString('utf8'));
    offset = dataStart + size;
  }
  assert.equal(entries.size, 3, JSON.stringify([...entries.keys()]));
  assert.match(entries.get('exportable/SKILL.md'), /exportable/);
  assert.equal(entries.get('exportable/scripts/run.py'), 'print(1)\n');
});

test('batch-export：单文件（扁平）技能也能导出', async () => {
  const root = mk();
  const flat = writeFlatSkill(root, 'flat-export');
  await call('scan', { root });
  const res = await callRaw('batch-export', { dirs: [flat] });
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 0);
  const name = res.body.subarray(30, 30 + res.body.readUInt16LE(26)).toString('utf8');
  assert.equal(name, 'flat-export.md');
});
