# @fish-under-sea/dsh-ssh-fish

**1.0.0 · SSH 运维**

[English](README.en.md)

## 功能

主机管理、持久连接池、Web PTY 终端、SFTP、回环端口转发与集群执行；六个 Agent 工具与 GUI 共享主机配置。

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-ssh-fish@1.0.0
```

也可安装聚合包 `@fish-under-sea/dsh-fish@1.0.0`。聚合与独立安装不要重复展开相同插件行；安装完成后重启 DSH。桌面环境无 CLI 时使用插件管理器。

## 配置与边界

配置为 $DSH_HOME/dsh-ssh.json，密码与口令可能明文保存，必须按敏感文件保护。执行和输出不脱敏；重连可能重放非幂等命令。本机上传下载按宿主权限读写；proxyCommand 是高信任 shell 命令。Agent 只能使用用户已配置主机。

Node 要求: `^22.19.0 || >=24.0.0`. DSH 支持范围以本包声明为准；聚合包不覆盖宿主兼容性检查。

## 维护与来源

1.0.0 统一发布版本，不表示已合并上游所有最新提交。历史说明保留在 Git 历史中；聚合变更见 [聚合变更记录](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.md).

派生自 [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web). 保留原作者署名、LICENSE 与 NOTICE；Fish 修改包括包名与对应适配。 许可证: Apache-2.0.
