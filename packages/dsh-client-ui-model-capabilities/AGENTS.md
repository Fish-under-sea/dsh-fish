# AGENTS.md — dsh-model-capabilities

DSH web GUI plugin dsh-model-capabilities. 包级规则:只写本包特有约定,不重复根 AGENTS.md 与
packages/AGENTS.md 的全局/包级规则。

## 本包要点

- 本包是官方 Models 设置页 `settings.models.provider-card` keyed 插槽(key `llm-pi-ai`)
  的占位者:为该适配器家族的每张提供方卡片渲染「模型能力」扩展区,逐模型声明
  图片输入(`models[].input`)与推理档位(`models[].reasoningEfforts`);
  另占位 `settings.models.footer` 列出路由仍未下线的存档提供方(手填路线禁用后
  卡片会从 Models 页消失,页脚是唯一恢复入口)。
- host 半区不再注册任何服务:0.1.7 起插件自身的 Cordis `Config` 就是它的设置项,
  Host 由该 schema 生成设置页并伺服可写表单(只有 volatile 字段可写,故 `disabled`
  标注 volatile);host 半区只剩 schema 与一个空 apply(仍经 `src/mount-once.ts`
  sync-shared 生成副本防双源重复挂载)。能力读写全部走
  `remote.settings.describe/mutate` 官方线路,目标是 `llm-pi-ai` 条目。
- 设置线路以「profile entry id」寻址且不携带包身份,因此本包自己的存档条目在
  浏览器半区按条目 id 解析(独立安装 `ui-model-capabilities`、聚合包
  `web-ui-model-capabilities`),两者都未命中时按表单 schema 形状兜底(仅含一个
  `disabled` any 字段;见 `src/core/provider-toggle.ts` 的 `resolveArchiveEntry`);
  解析不到时隐藏禁用/启用入口并报 unavailable,绝不猜写。
- **provider-card 席位冲突必须可见且可自愈**:该插槽是 keyed 单元格,同一 key
  同一 priority 只渲染一个扩展区,所以两个插件都扩展 pi-ai 提供方卡片时后者必然被注册表
  拒绝。`src/client/provider-card-seat.ts` 独占这个结果:拒绝时 `console.error` 点名占用者
  (registrant),并把 `conflict` 状态交给 `settings.models.footer` 渲染可见提示;单元格被
  释放后(对方插件卸载)在 `slots` 订阅上重试认领,无需重启 DSH 即恢复。重试必须带
  `claiming` 闩锁——注册表在 `register` 内同步发通知,没有闩锁会自撞自己刚写的条目。
  **不要**改用不同 priority 绕开冲突:那样两条目虽共存于账本但只渲染最低优先级,等于把
  响亮的冲突换成对另一个插件的静默遮蔽。footer 列表(`ui-model-capabilities`)的注册
  失败同样要报错,不得静默返回空 disposer。
- **写入粒度是整数组**:`src/core/capabilities.ts` 的 `buildModelsOp` 用一次 set 操作替换
  `providers.<route>.models` 整个数组(settings mutate 的 path op 不支持下标进数组);
  条目是结构开放对象,非本包编辑的字段(id/name/contextWindow/compat 等)原样保留。
- **禁用/启用的唯一官方缝是「存档 + unset」**:本包自己的设置条目(本包 Config 的
  `disabled.<route>`)存放被禁用提供方的 profile;禁用 =
  先存档再 `unset llm-pi-ai.providers.<route>`(官方 Remove 按钮同款),路由注销后
  provider 从 modelCatalog 消失,输入框选择器与子代理同时清空;启用反向恢复。
  顺序保证最坏情况是重复存档,绝不丢 profile;启用遇路线已有新配置必须拒绝。
  pi-ai schema 无原生 enabled/disabled 字段,勿寻找/伪造;组合(base)层声明的
  profile 用户层删不掉,因此这类卡片不提供禁用开关(面板隐藏开关,编排层再以
  `base-profile` 拒绝,避免「禁用成功但路由仍在」)。存档条目只在路由仍下线时
  列出:路由回来(重新添加,或部分启用只恢复了 profile)后条目自动隐藏,存档本身
  仍保留可恢复。
- **校验在写入前**:levels 模式必须含 off 以外档位、非 off 档位必须有非空发送值,
  与 `dsh-llm-pi-ai` 适配器 `assertServiceable` 的拒绝规则一致(编辑器先拒绝,
  host 免得写后被拒)。若上游词表变化(off/minimal/low/medium/high/xhigh/max),
  以 `@earendil-works/pi-ai` 的 `ModelThinkingLevel` 为准同步 `THINKING_LEVELS`。
- 冲突姿态与官方卡片一致:携带读取时的 revision 作为 `expectedRevision`,
  收到 `settings/conflict` 后重新 describe 并提示用户重试,绝不盲写。
- **刷新只跟两个条目**:`settings/document-updated` 仅当 `llm-pi-ai` 或本包条目
  (两种可能行 id 拼写)变化时刷新;并发 `describe` 合并为一次 wire 调用;后台刷新保留
  未保存草稿,并把写入围栏钉在草稿读取时的 revision(文档已变则保存冲突重读),
  不得静默丢弃编辑。

## 提交前检查

```sh
pnpm --filter @fish-under-sea/dsh-client-ui-model-capabilities typecheck
pnpm --filter @fish-under-sea/dsh-client-ui-model-capabilities test
pnpm --filter @fish-under-sea/dsh-client-ui-model-capabilities build
```
