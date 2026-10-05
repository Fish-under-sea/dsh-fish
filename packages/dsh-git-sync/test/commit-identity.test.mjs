/**
 * dsh-git-sync 的「本机没有 git 身份」故障路径测试（lib/index.js 的
 * commitAll / resolveCommitIdentity / githubOwner）。
 *
 * 为什么单独测这条：用户实机撞过 —— 全新机器没有 user.name / user.email 时
 * `git commit` 直接拒绝（`Author identity unknown … unable to auto-detect email
 * address`），整次「一键同步」只回报一句「推送不行」。而全新机器恰恰是换机复原
 * 最需要同步成功的一刻，所以这一步必须有回退，且回退要真的能提交进 git。
 *
 * 这里用**真实 git + 真实临时仓库**：断言最终提交的作者（`git log -1 --format`），
 * 而不是断言我们「传了哪些参数」。
 *
 * 运行：node test/commit-identity.test.mjs
 * （不要用 `node --test test/`：测试运行器会派生子进程并捕获管道输出，在受限沙箱
 *   里会以 EPERM 失败；同理，下面所有 git 调用的 stdout 都写普通文件而不是管道。）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as mod from '../lib/index.js';

/** git 的 stdout 接一个普通文件（受限沙箱里子进程不能开管道，接管道会 EPERM）。 */
const OUT_FILE = path.join(os.tmpdir(), `dsh-git-out-${process.pid}.txt`);

function gitOut(dir, args, env = {}) {
  const fd = fs.openSync(OUT_FILE, 'w');
  try {
    execFileSync('git', args, {
      cwd: dir,
      stdio: ['ignore', fd, 'inherit'],
      windowsHide: true,
      env: { ...process.env, ...env },
    });
  } finally {
    fs.closeSync(fd);
  }
  return fs.readFileSync(OUT_FILE, 'utf8').trim();
}

/**
 * 把本进程的 git「全局身份」摘干净：git 读 $HOME/.gitconfig（Windows 上是
 * %USERPROFILE%），另用 GIT_CONFIG_GLOBAL / GIT_CONFIG_SYSTEM 直接指到空文件。
 * 这样无论在谁的机器上跑，「没有身份」这个前提都成立。
 * @returns 还原函数
 */
function withoutGlobalIdentity() {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-no-identity-'));
  const emptyFile = path.join(emptyDir, 'empty.gitconfig');
  fs.writeFileSync(emptyFile, '');
  const saved = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL,
    GIT_CONFIG_SYSTEM: process.env.GIT_CONFIG_SYSTEM,
    GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME,
    GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL,
    GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME,
    GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL,
  };
  process.env.HOME = emptyDir;
  process.env.USERPROFILE = emptyDir;
  process.env.GIT_CONFIG_GLOBAL = emptyFile;
  process.env.GIT_CONFIG_SYSTEM = emptyFile;
  delete process.env.GIT_AUTHOR_NAME;
  delete process.env.GIT_AUTHOR_EMAIL;
  delete process.env.GIT_COMMITTER_NAME;
  delete process.env.GIT_COMMITTER_EMAIL;
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(emptyDir, { recursive: true, force: true });
  };
}

/** 建一个临时仓库；默认给一个 GitHub 形状的 origin（用来验证「取自 origin」）。 */
function makeRepo({ origin = 'https://github.com/Fish-under-sea/DSH.git', identity = null, file = 'a.txt' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-commit-id-'));
  gitOut(dir, ['init', '-q']);
  if (origin) gitOut(dir, ['remote', 'add', 'origin', origin]);
  if (identity) {
    gitOut(dir, ['config', 'user.name', identity.name]);
    gitOut(dir, ['config', 'user.email', identity.email]);
  }
  fs.writeFileSync(path.join(dir, file), 'hello\n');
  return dir;
}

test('githubOwner：只认 github.com，https/ssh 两种写法都行，其它一律 null', () => {
  assert.equal(mod.githubOwner('https://github.com/Fish-under-sea/DSH.git'), 'Fish-under-sea');
  assert.equal(mod.githubOwner('https://github.com/Fish-under-sea/DSH'), 'Fish-under-sea');
  assert.equal(mod.githubOwner('https://token@github.com/Fish-under-sea/DSH.git'), 'Fish-under-sea', 'URL 里带凭据也要能认出来');
  assert.equal(mod.githubOwner('git@github.com:Fish-under-sea/DSH.git'), 'Fish-under-sea');
  assert.equal(mod.githubOwner('ssh://git@github.com/Fish-under-sea/DSH.git'), 'Fish-under-sea');
  assert.equal(mod.githubOwner('https://gitlab.com/Fish-under-sea/DSH.git'), null, '非 github 不猜');
  assert.equal(mod.githubOwner('D:/local/bare.git'), null);
  assert.equal(mod.githubOwner(''), null);
  assert.equal(mod.githubOwner(undefined), null);
});

test('★ 本机没有 git 身份时，提交仍然成功，且作者取自 origin 的 GitHub 主人', async () => {
  const restore = withoutGlobalIdentity();
  try {
    const repo = makeRepo();
    // 前置条件：现在确实没有身份（与用户实机撞到的那句报错同一个前提）
    assert.equal(await mod.resolveCommitIdentity(repo) !== null, true, '前置条件：探针应判定「没有身份」');

    const lines = [];
    const result = await mod.commitAll(repo, 'dsh-sync: 测试提交', { say: (line) => lines.push(line) });

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.committed, true);
    assert.deepEqual(result.identity, {
      name: 'Fish-under-sea',
      email: 'Fish-under-sea@users.noreply.github.com',
      source: 'origin',
    });
    assert.equal(gitOut(repo, ['log', '-1', '--format=%an <%ae>']), 'Fish-under-sea <Fish-under-sea@users.noreply.github.com>');
    assert.equal(gitOut(repo, ['log', '-1', '--format=%s']), 'dsh-sync: 测试提交');
    assert.ok(lines.join('\n').includes('本机没有 git 身份'), `说明里应提到回退身份：${lines.join(' | ')}`);
    assert.ok(lines.join('\n').includes('git config user.name'), '应给出固定身份的方法');
    fs.rmSync(repo, { recursive: true, force: true });
  } finally {
    restore();
  }
});

test('★ 没有 origin（或不是 GitHub）时退到「本机登录名 @ 主机名」，同样提交成功', async () => {
  const restore = withoutGlobalIdentity();
  try {
    for (const origin of [null, 'D:/local/bare.git']) {
      const repo = makeRepo({ origin });
      const result = await mod.commitAll(repo, 'no-origin', {});
      assert.equal(result.ok, true, `${origin}: ${JSON.stringify(result)}`);
      assert.equal(result.identity.source, 'machine');
      assert.equal(result.identity.email, `${result.identity.name}@${os.hostname()}`);
      const author = gitOut(repo, ['log', '-1', '--format=%ae']);
      assert.equal(author, result.identity.email, 'git 里落的作者要和回退身份一致');
      fs.rmSync(repo, { recursive: true, force: true });
    }
  } finally {
    restore();
  }
});

test('配了身份的仓库完全不受影响（不注入 -c，作者就是配置里的那个）', async () => {
  const restore = withoutGlobalIdentity();
  try {
    const repo = makeRepo({ identity: { name: '本人', email: 'me@example.com' }, origin: 'https://github.com/Fish-under-sea/DSH.git' });
    assert.equal(await mod.resolveCommitIdentity(repo), null, '已有身份就该返回 null（表示照原样）');

    const lines = [];
    const result = await mod.commitAll(repo, 'with-identity', { say: (line) => lines.push(line) });
    assert.equal(result.ok, true);
    assert.equal(result.identity, undefined, '不该有回退身份');
    assert.equal(gitOut(repo, ['log', '-1', '--format=%an <%ae>']), '本人 <me@example.com>');
    assert.equal(lines.length, 0, `有身份时不该多嘴：${lines.join(' | ')}`);
    fs.rmSync(repo, { recursive: true, force: true });
  } finally {
    restore();
  }
});

test('没有变更时不产生提交，也不报身份（空跑）', async () => {
  const restore = withoutGlobalIdentity();
  try {
    const repo = makeRepo();
    const first = await mod.commitAll(repo, 'first', {});
    assert.equal(first.committed, true);
    const second = await mod.commitAll(repo, 'second', {});
    assert.equal(second.committed, false, '没有新变更就该如实回报「无需提交」');
    assert.equal(gitOut(repo, ['log', '--oneline']).split('\n').length, 1, '不该多出一个空提交');
    fs.rmSync(repo, { recursive: true, force: true });
  } finally {
    restore();
  }
});

test('提交/暂存失败时回可读的一行日志，而不是抛出去变成 500', async () => {
  const repo = makeRepo({ identity: { name: '本人', email: 'me@example.com' } });
  // 用 index.lock 让 git 拒绝操作（用户实机撞的那次是「提交被拒」，同一条路径）
  fs.writeFileSync(path.join(repo, '.git', 'index.lock'), '');
  const result = await mod.commitAll(repo, 'should-fail', {});
  assert.equal(result.ok, false, `应是「失败但可读」而不是抛异常：${JSON.stringify(result)}`);
  assert.ok(/^(暂存|读取暂存区|提交)失败：/.test(String(result.error)), `错误应以「…失败：」开头：${result.error}`);
  assert.ok(!String(result.error).includes('\n'), `错误应是单行可读：${JSON.stringify(result.error)}`);
  assert.equal(result.staged.length, 0);
  fs.rmSync(repo, { recursive: true, force: true });
});

test('索引被锁不会污染仓库：解锁后同一份改动仍能正常提交', async () => {
  const repo = makeRepo({ identity: { name: '本人', email: 'me@example.com' } });
  const lock = path.join(repo, '.git', 'index.lock');
  fs.writeFileSync(lock, '');
  const failed = await mod.commitAll(repo, 'blocked', {});
  assert.equal(failed.ok, false);

  fs.rmSync(lock, { force: true });
  const ok = await mod.commitAll(repo, 'unblocked', {});
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(gitOut(repo, ['log', '-1', '--format=%s']), 'unblocked');
  assert.equal(gitOut(repo, ['log', '--oneline']).split('\n').length, 1, '失败那次不该留下半个提交');
  fs.rmSync(repo, { recursive: true, force: true });
});