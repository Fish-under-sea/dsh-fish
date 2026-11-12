# @fish-under-sea/dsh-approval-guide

**2.0.0 · 审批说明**

为审批弹窗补充中文动作、风险与依据说明。

[English](README.en.md)

## 功能

为审批弹窗补充中文动作、风险与依据说明；覆盖文件、命令、网络及权限升级等常见请求。

### 空输入发送

输入框为空时，点击发送按钮会自动填入并发送「继续任务，并梳理进度」，省去先打字的步骤。非空输入、停止按钮、附件、上传中与输入法组合态都不接管；重复点击有重入保护，按钮未及时可用时最多等待约 816ms 后放弃并只记录一次警告。

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-approval-guide@2.0.0
```

也可安装聚合包 `@fish-under-sea/dsh-fish@2.0.0`。聚合与独立安装不要重复展开相同插件行；安装完成后重启 DSH。桌面环境无 CLI 时使用插件管理器。

## 配置与边界

仅补充说明，不代替人工审批，不改变沙箱或自动放行。

Node 要求: `>=24.9`. DSH 支持范围以本包声明为准；聚合包不覆盖宿主兼容性检查。

## 维护与来源

2.0.0 统一发布版本，不表示已合并上游所有最新提交。历史说明保留在 Git 历史中；聚合变更见 [聚合变更记录](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.md).

Fish 原生插件。 许可证: MIT.
