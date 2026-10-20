# @fish-under-sea/dsh-skill-lens-fish

**1.0.0 · 技能中心**

[English](README.en.md)

## 功能

技能清单、概览、文件浏览和编辑、依赖图、新建、导入与删除；识别目录式 SKILL.md、扁平 .md 和共享引用资源，跟随 DSH_HOME。

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-skill-lens-fish@1.0.0
```

也可安装聚合包 `@fish-under-sea/dsh-fish@1.0.0`。聚合与独立安装不要重复展开相同插件行；安装完成后重启 DSH。桌面环境无 CLI 时使用插件管理器。

## 配置与边界

导入、编辑和删除会实际改动技能文件；删除前备份。同一个 skill-lens 行不要同时安装上游版与 Fish 版。

Node 要求: `>=20`. DSH 支持范围以本包声明为准；聚合包不覆盖宿主兼容性检查。

## 维护与来源

1.0.0 统一发布版本，不表示已合并上游所有最新提交。历史说明保留在 Git 历史中；聚合变更见 [聚合变更记录](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.md).

派生自 [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens). 上游 package.json 声明 MIT，但未提供独立 LICENSE 或 NOTICE。本包补充 MIT 标准文本及来源声明，保留原项目署名；Fish 修改包括包名与对应适配。许可证: MIT。
