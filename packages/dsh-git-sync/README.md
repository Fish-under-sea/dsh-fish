# @fish-under-sea/dsh-git-sync

**1.0.2 · Git 同步**

[English](README.en.md)

## 功能

将选定的 DSH 配置同步到私有 Git 仓库，支持预览、提交、拉取和换机还原。凭据导出与普通同步分开：只把 `$DSH_HOME/.credentials.yaml` 复制到用户指定目录；留空时使用桌面，并在其中创建 `DSH凭据导出` 文件夹。导出目录仅包含该凭据文件，不生成 README。

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-git-sync@1.0.2
```

也可安装聚合包 `@fish-under-sea/dsh-fish@1.0.2`。聚合与独立安装不要重复展开相同插件行；安装完成后重启 DSH。桌面环境无 CLI 时使用插件管理器。

## 配置与边界

配置目录为 `$DSH_HOME/dsh-git-sync/`。同步不是完整备份；密钥、令牌、会话记录和 SSH 密码不能当作普通配置提交。导出只复制 `$DSH_HOME/.credentials.yaml` 到用户自选目录；未指定时使用桌面（桌面不可用时退回用户目录）。导出不会连接网络、写入 Git 或生成 README，也不会把凭据内容写进日志。不要把导出文件上传到云盘或聊天软件；覆盖前请先备份。

Node 要求: `>=20`. DSH 支持范围以本包声明为准；聚合包不覆盖宿主兼容性检查。

## 维护与来源

1.0.2 统一发布版本，不表示已合并上游所有最新提交。历史说明保留在 Git 历史中；聚合变更见 [聚合变更记录](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.md).

Fish 原生插件。 许可证: MIT.
