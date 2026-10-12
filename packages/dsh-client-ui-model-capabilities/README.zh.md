# dsh-model-capabilities · DeepSeek Harness (DSH) 自定义模型能力与 Vision 多模态声明插件

[English](README.md) | 中文

<p align="center">
  <img src="https://img.shields.io/npm/v/@fish-under-sea/dsh-client-ui-model-capabilities?style=flat-square" alt="Version">
  &nbsp;
  <img src="https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4c6ef5?style=flat-square&amp;labelColor=454a54" alt="DSH">
  &nbsp;
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" alt="License">
</p>

<p align="center">
  <strong>DeepSeek Harness（DSH）官方 Web GUI 与桌面客户端自定义模型属性与推理思考档位配置中心</strong><br>
  <em>逐模型推理思考档位 · Vision 多模态声明 · 提供方一键禁用/恢复 · Models 设置页无缝扩展 · 零重启热生效</em>
</p>

为 DeepSeek Harness (DSH) Web GUI 与官方桌面客户端的自定义提供方声明逐模型推理档位：为自定义模型目录里的每个模型声明它支持哪些思考档位、每档实际发送的取值，直接在 Models 设置页上可视化编辑。官方 pi-ai 设置命名空间一直就承载这个字段，而 0.1.7-alpha.1 的 Models 页已自带模型输入类型编辑——本插件负责的是设置页仍未提供的推理档位编辑与提供方快速启闭入口。

## 功能

- **占位官方扩展区**:注册 Models 页的 `settings.models.provider-card` 插槽(key 为 `llm-pi-ai` 适配器家族),该家族的每张提供方卡片(手填的网关、OpenAI 兼容端点、命名厂商)都会获得一个可折叠的「模型能力」扩展区。该插槽每张提供方卡片只渲染一个扩展区,因此当另一个插件先认领同一适配器家族时,本面板会报告这次冲突(浏览器控制台,外加 Models 页上点名占用者的提示),并在那个插件卸载后自行接管回来。
- **提供方禁用/启用**:一键把该提供方的 profile 存档到插件自己的设置命名空间,再通过官方「移除提供方」同款操作(`unset` `llm-pi-ai.providers.<route>`)下线路由——该提供方随即离开模型目录,输入框模型选择器与子代理可选列表同时消失,所有已打开的界面即时生效,无需重启。启用则原样恢复存档的 profile(API 密钥存放在凭据服务中,禁用/启用完全不触及)。已禁用的提供方列在 Models 页底部的存档区,可从那里恢复。
- **逐模型推理档位**:每个模型三态编辑——不声明(继承)、声明无推理(`reasoningEfforts: false`,模型选择器不再提供思考档位)、或显式档位字典。档位从 `off` 到 `max`;每个启用的档位带一个发送值输入框(请求实际发送的取值,默认与档位同名),另有一键填入常用的 low/medium/high。`off` 的发送值可留空,含义是「支持,但发送时不带参数」。
- **走官方线路写入**:保存是一次路径操作,整体替换 `llm-pi-ai` 设置命名空间里该提供方的整个 `models` 数组——与官方卡片首次编辑时相同的整数组覆盖。本插件不编辑的字段(模型 ID、显示名称、输入模态声明、上下文窗口、compat 开关)在每次保存后原样保留;写入即时生效,无需重启。
- **写入前先校验**:编辑器执行与适配器一致的接受规则(档位字典必须含 off 以外的档位;off 以外档位必须有非空发送值),并直接说明草稿会被拒绝的原因,而不是让 host 事后拒绝。
- **冲突安全**:每次保存都携带面板读取时的 revision;配置在其他界面被改动时,面板重新读取并提示重试,绝不盲写覆盖。

## 安装

### 通过家族聚合包

`dsh-web-all` 聚合 bundle 已包含本插件,挂载聚合包即可。

### 独立挂载(开发)

```sh
git clone https://github.com/zhu1090093659/dsh-web.git
cd dsh-web
pnpm install
pnpm -r build
dsh plugin --profile web add link:$(pwd)/packages/dsh-model-capabilities
```

重启 `dsh web`。打开 Web 设置的 Models 页,每张自定义提供方卡片在目录编辑器下方都会出现模型能力扩展区。

## 配置

插件自己的设置项里只存放已禁用提供方的存档(即插件配置 schema 的 `disabled` 字段,设置页由宿主按该 schema 生成),没有需要手工配置的项。能力声明与禁用/启用状态分别保存在官方 `llm-pi-ai` 设置项和这个存档里,全部在 Models 页上编辑。

## 语义须知

- **声明是断言,不是探测**:任何环节都不会去询问网关它接受什么。发送值端点不认识时,会在请求时失败——这个字段存在的意义正是「没有任何途径可以推断它」。
- **面板只编辑已声明的模型**:路线还在直接服务内置 pi-ai 目录(没有 `models` 数组)时,面板显示指引而非编辑器,因为浏览器侧无法枚举该目录。请先在卡片的模型目录里添加模型行(id 与目录模型相同的条目会逐字段覆盖它),再回到这里声明能力。
- **推理档位即选择器词汇**:声明的档位就是输入区模型选择器为该模型提供的选项;发送值是随请求发送的内容。`off` 留空发送值表示选中该档位时不发送参数。
- **禁用 = 先存档、后下线**:profile 先写入存档、路由后下线,即使某一步失败,最坏也只是留下一条无害的重复存档,绝不会丢配置。启用时若该路线已出现新的配置,恢复会被拒绝,存档绝不会覆盖更新的配置。提供方禁用期间,对它的委派在 host 侧直接失败(`NO_ADAPTER`),不只是 UI 上不显示。

## 已知限制

- 不编辑输入类型:Models 页自带的模型编辑器负责写 `input` 模态声明(alpha.2),本插件只原样保留该字段——声明图片输入请在上方的目录编辑器里操作。
- 不覆盖 DeepSeek 直连适配器(`llm-deepseek`):它的目录固定,推理强度控制已存在于 Models 页。
- 仍未保存的草稿提供方卡片不会分发扩展区;请先保存提供方。
- 同一时刻只能有一个插件扩展 `llm-pi-ai` 提供方卡片。冲突方不会静默消失:Models 页 footer 会说明扩展席位被另一个插件占用并点名它,那个插件停止加载后面板自动恢复。
- 禁用只作用于用户设置层的 profile——即 Models 页写出的手填提供方。声明在组合(composition base)层的 profile 无法从客户端下线:设置合并机制保证用户写入删不掉它,因此这类卡片不提供禁用开关。
