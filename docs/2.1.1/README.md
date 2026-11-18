# dsh-fish 2.1.1 热修复

> 结论先行：修复 `agent_teams_*` 工具在未 inject 可选 `agentTeams` 服务时全部不可用的问题；其余 2.1.0 内容不变。

## 缺陷

模型步骤准备工具时，`ToolRegistrationOptions.when` 会调用 `nativeTeamMode(ctx)?.isEnabled(agent)`。旧实现直接读取 `ctx.agentTeams`：

```ts
return (ctx as unknown as { agentTeams?: NativeTeamModeService }).agentTeams
```

`agentTeams` 是 0.2.1-rc.3+ 才有的可选服务，不在本插件 `inject` 列表中。Cordis 对未 inject 的服务属性访问会抛：

```text
cannot resolve availability of tool "agent_teams_create":
cannot get property "agentTeams" without inject
```

因此所有 `agent_teams_*` 工具在可用性解析阶段失败。

## 修复

改为 inject-free 的 `ctx.get('agentTeams')`：

```ts
const get = (ctx as unknown as { get?: (name: string) => unknown }).get
return typeof get === 'function'
  ? get.call(ctx, 'agentTeams') as NativeTeamModeService | undefined
  : undefined
```

服务不存在时返回 `undefined`，保持旧宿主始终启用的兼容行为；服务存在时按会话开关判断。

## 回归

`packages/dsh-agent-teams-fish/scripts/agentteam-mode-tdd.mjs`：

- 用 Proxy 模拟 Cordis Context，只允许 `ctx.get`，任何属性读取都抛 `cannot get property ... without inject`；
- 断言 `nativeTeamMode(ctx)` 仍能返回服务，且 `when` 中同样的 `isEnabled` 调用不抛异常；
- 断言无服务时返回 `undefined`，工具判定保持可用。

## 验证

- 新增回归通过。
- AgentTeams 宿主/客户端 `tsc --noEmit` 0 错误。
- 聚合包发布契约测试 7/7、审批说明测试 27/27 通过。
