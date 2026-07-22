# 开发环境准备

## 你需要什么

| 用途 | 要求 |
|---|---|
| 运行插件 | CAW Studio **v1.6.0 或更高** |
| 写带逻辑的插件 | 本机可用的 **Python 3**（宿主解释器；宿主脚本随应用分发） |
| 发布到注册表 | **Git** + 一个 **GitHub 仓库**；发布器脚本用 **Python 3.12**（CI 中） |
| 制品打包 | 无额外依赖——发布器纯 stdlib |

只写声明式贡献（芯片包 / 命令 / 设置 / i18n）而不写 Python handler 的插件，运行时不需要
Python。只有当插件声明了 `python` 入口且你去调用它时才会启动宿主进程。

## Python 解释器如何选取

Python 宿主进程使用的解释器按此顺序解析：

1. 插件制品声明的 `python3`（如果插件自带 Python 制品）；
2. 系统 `PATH` 上的 `python3`；
3. 若插件在 `python.dependencies` 里声明了锁文件，则为该插件建**独立 venv** 并在其中
   `pip install`，宿主运行在这个 venv 里。

## 本地目录布局

所有安装物落在用户主目录（零管理员权限）：

```
~/.caw-studio/                     Windows: C:\Users\<name>\.caw-studio
  plugins/
    installed.json                 已装登记 { id → { version, enabled, auto_update } }
    <id>/settings.json             插件设置覆盖值(与版本目录同级,升级不丢)
    <id>/<version>/manifest.json   安装时固化的完整清单
    <id>/<version>/files/          package 制品解压根(manifest 相对路径的基准)
  tools/<name>/<version>/          tool 制品共享池,插件间按版本并排复用
  host/<hash>/                     宿主脚本 plugin_host.py + caw_plugin.py
                                   (随应用分发,首次使用物化;升级换 hash 目录)
  envs/plugins/<id>/               声明了 python.dependencies 的插件的独立 venv
  tmp/                             下载/解压中转(与池同文件系统 ⇒ rename 原子)
```

要点：

- 应用只用**绝对路径**调用工具，不写注册表、不改 `PATH`。
- **停用**只翻登记位，制品保留；**卸载**删登记并做池"标记-清扫"GC：被其它已装插件引用的
  制品保留；不足 1 小时的新鲜目录豁免（防误删并发安装）。
- 插件设置存 `plugins/<id>/settings.json`，与版本目录**平级**，因此升级插件不丢用户设置。

## 侧载：最短反馈环

开发期不需要发布。把含 `manifest.json` 的插件目录**直接拷贝或软链**到
`~/.caw-studio/plugins/<目录名>/`，在应用"插件"面板点刷新即被发现，带"本地"徽标：

- manifest 所在目录即 **files 根**，`svd` / `openocd.target` / `i18n` / `python.entry` 等相对
  路径直接可用；
- 侧载清单的制品**允许省略 `sha256`**（跳过校验并记一条警告）；
- 与注册表安装的**同 id** 冲突时，注册表优先。

改完 manifest 后在插件面板刷新即生效；改完 Python 代码重新调用命令即可（宿主按调用懒启动，
停用再启用插件可强制重启宿主）。详见[创建第一个插件](quickstart.md)与[调试](quickstart.md#调试与本地开发)。

## 路径规则（务必遵守）

manifest 里的相对路径**永远以插件 files 根为基准**：

- 注册表安装时 = `plugins/<id>/<version>/files/`；
- 侧载时 = manifest 所在目录。

**禁止绝对路径与 `..`**。客户端会 canonicalize 并校验解析结果仍落在 files 根内，越界即拒
（同时消解符号链接逃逸）；服务端发布时也会拒绝逃逸路径。

## 下一步

- [创建第一个插件](quickstart.md)
- [manifest 清单参考](manifest.md)
