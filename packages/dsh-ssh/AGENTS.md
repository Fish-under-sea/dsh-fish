# AGENTS.md — dsh-ssh

dsh Web GUI 的远程 SSH 运维插件：Host 进程内的持久 ssh2 连接池 + Web GUI 主机
管理面板 / Web 终端 / 文件传输 / 端口转发 / 集群执行，外加 Agent 工具。

## 安全模型（本包最重的纪律）

- 主机配置存 `~/.dsh/dsh-ssh.json`（目录 0700、文件 0600，原子写入）；密码 /
  passphrase 密钥口令以**明文**存在该文件——按 ssh-skill 同一信任模型，别为
  "脱敏"而加密，也别把该路径暴露给模型或日志。
- 连接池空闲 30 分钟自动断开、断线自动重连（最多 3 次）——重连可能**重放非幂等
  命令**，长命令注意副作用（README「已知限制」）。
- exec / cluster 输出**原样返回**（不脱敏），如 `env` 可能把远端环境密钥带回
  对话记录；传输 / 执行消耗**真实远程资源**，Agent 使用前先确认。
- `ssh_upload` / `ssh_download` 以宿主进程权限直接读写本机任意路径（不经
  bash 沙箱）；所有 `/api/dsh-ssh/*` 路由仅限 loopback，隧道只监听 `127.0.0.1`。
- `proxyCommand` 是由宿主进程以其权限执行的 shell 命令（与 `ssh(1)` 执行同一行的
  信任模型）：只来自用户 0600 配置文件；agent 工具只暴露是否配置、不暴露命令原文，
  agent 也不能创建 / 修改主机；POSIX 按进程组回收子进程，Windows 只杀 shell
  （已知限制）。

## Agent 工具面

- 六个工具 `ssh_list` / `ssh_exec` / `ssh_upload` / `ssh_download` /
  `ssh_tunnel` / `ssh_cluster`，GUI 与 Agent 共享同一份主机配置。
- Agent 只能用**用户在 GUI 配置过**（或从 `~/.ssh/config` 导入）的主机；别名
  未配置时先告知用户去 GUI 配置，不得臆造。

## 面板与终端会话

- client 半区经官方槽位注册**原生中栏面板**：`native-panel.tsx` 往 shell 自己的
  面板列表（`sidebar.panellist`）贡献一行、往布局的 keyed `main` 槽贡献页面，
  并驱动 `ctx.layout.selectPanel`——与任务看板、技能中心同形，行盒 / 标签 /
  高亮 / 折叠轨道归 shell，本包不再 DOM 接管中栏。
- 页签、hosts 页的「连接」请求与**终端会话 id** 存在 `panel/controller.ts`：
  布局只在面板被选中时挂载页面，组件本地 state 会在切面板时丢失。
- **PTY 会话归 Host**（`src/engine/terminal-sessions.ts`）：会话按 id 存活，
  视图卸载只 detach、重新挂载按 id reattach 并回放滚动缓冲；只有显式
  `close` 帧、远端退出后的宽限期到期或空闲回收才结束会话。路由层只做
  loopback 围栏与 socket 接线，会话表随路由注销一并 dispose。
- **终端 socket 走外壳公布的 Host**（`src/client/api.ts` 的 `terminalSocketUrl`）：
  应用交付的页面（桌面版 `dsh-app://app/`）不能在自己的 scheme 上升级 socket，
  但外壳已经通过官方钩子 `__DSH_TRANSPORT__.streamBaseUrl` 公布它拥有的 Host
  authority 并改写该 Host 的握手，因此在这种页面上改拨该地址（仅当它是可解析、
  无 userinfo、authority 非空的 http(s) origin）。网页始终按自身 origin 解析——
  远程通道会把 `ownsHost` 授予已配对的局域网页面，那类页面必须继续留在门控通道里。
  宿主侧围栏不变，socket 仍走 loopback。决策与被取代的旧方案见
  `.agents/notes/implemented/bug-fix/2026-10-02-ssh-terminal-dials-shell-owned-host.md`。

## 提交前检查

```sh
pnpm --filter @fish-under-sea/dsh-ssh test   # store + 引擎单测（内嵌 ssh2 Server + 真实 sshd）
pnpm run typecheck
pnpm run build
```
