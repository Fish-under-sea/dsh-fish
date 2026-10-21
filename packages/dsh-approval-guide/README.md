# @fish-under-sea/dsh-approval-guide

**1.0.1 · 审批说明**

[English](README.en.md)

## 功能

为审批弹窗补充中文动作、风险与依据说明；覆盖文件、命令、网络及权限升级等常见请求。

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-approval-guide@1.0.1
```

也可安装聚合包 `@fish-under-sea/dsh-fish@1.0.1`。聚合与独立安装不要重复展开相同插件行；安装完成后重启 DSH。桌面环境无 CLI 时使用插件管理器。

## 配置与边界

仅补充说明，不代替人工审批，不改变沙箱或自动放行。

Node 要求: `^22.19.0 || >=24.0.0`. DSH 支持范围以本包声明为准；聚合包不覆盖宿主兼容性检查。

## 维护与来源

1.0.1 统一发布版本，不表示已合并上游所有最新提交。历史说明保留在 Git 历史中；聚合变更见 [聚合变更记录](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.md).

Fish 原生插件。 许可证: MIT.
