# @fish-under-sea/dsh-settings-nav-order

**1.0.0 · 设置导航排序**

[English](README.en.md)

## 功能

重排设置侧栏、隐藏不常用设置项，并持久化显示偏好；不修改其他插件源码。

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-settings-nav-order@1.0.0
```

也可安装聚合包 `@fish-under-sea/dsh-fish@1.0.0`。聚合与独立安装不要重复展开相同插件行；安装完成后重启 DSH。桌面环境无 CLI 时使用插件管理器。

## 配置与边界

状态存 $DSH_HOME/dsh-settings-nav-order/state.json，并配合浏览器本地状态；隐藏不等于禁用插件。

Node 要求: `>=20`. DSH 支持范围以本包声明为准；聚合包不覆盖宿主兼容性检查。

## 维护与来源

1.0.0 统一发布版本，不表示已合并上游所有最新提交。历史说明保留在 Git 历史中；聚合变更见 [聚合变更记录](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.md).

Fish 原生插件。 许可证: MIT.
