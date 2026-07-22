# 概述与能力边界

CAW Studio 的插件系统把编辑器从"内置工具链分发"升级为一个**开发者平台**：插件在一份
`manifest.json` 里**声明式**注册全部能力面（贡献点），社区可以据此扩展芯片支持、命令、
设置、构建/烧录任务、面板与语言包。业务逻辑由每插件独立的 **Python 宿主进程**承载。

本文档面向插件开发者。若你只是想安装、启用插件，请看应用内的"插件"面板。

## 核心理念

- **声明式是唯一注册入口。** 插件的每一个能力面都在 manifest 里静态声明。Python 宿主
  只承载逻辑（命令 handler、任务步骤、烧录后端），**不能在运行时注册 manifest 之外的
  能力**。这让应用无需运行任何插件代码即可枚举其全部贡献，安装/离线/降级路径都可预测。
- **用户级、零管理员权限。** 所有安装物都落在用户主目录下的 `~/.caw-studio/`
  （Windows 为 `C:\Users\<name>\.caw-studio`），不写注册表、不改 `PATH`，工具一律用
  绝对路径调用。
- **内容寻址、确定性打包。** 制品按 `sha256` 内容寻址，发布器打确定性 tar.gz，同内容同
  哈希，注册表秒传命中；升级只下载有变化的制品。

## 一个插件能贡献什么

| 贡献点 | 作用 |
|---|---|
| `chips` | 芯片支持包：芯片匹配规则 → OpenOCD target / SVD / 默认烧录后端 / 所需工具集 |
| `commands` | 命令（进命令面板 `Ctrl/⌘+Shift+P`，点击执行 Python handler） |
| `settings` | 设置项（设置页自动渲染，值可注入任务变量与宿主） |
| `embedded` | 嵌入式任务（build/run/clean/rebuild 等步骤序列：exec / flash / rmdir / python） |
| `i18n` | 语言包（`%key%` 占位符的词典，运行时挂进前端 overlay） |
| `panels` | Webview 面板（沙箱 iframe + postMessage 桥，注册进停靠系统） |

除声明式贡献外，插件还能**携带制品**：进共享池的工具链二进制（`role: "tool"`）与插件自身
的文件包（`role: "package"`，装 Python 代码、SVD、cfg、UI 资产）。

## 能力边界（当前版本）

插件平台自 CAW Studio **v1.6.0** 起落地，manifest 契约基线为 **`schemaVersion: 1`**。

已经可用：

- manifest 契约与全部六个贡献点
- 芯片支持包（可覆盖内置 STM32 定义）
- 每插件独立的 Python 宿主进程（独立 venv、JSON Lines RPC）、`python` 任务步骤 /
  命令 handler / `python:` 烧录后端的真实执行、`caw_plugin` SDK
- webview 面板渲染（沙箱 iframe + postMessage 桥）
- 注册表分发、GitHub Actions 自动发布链、beta 渠道开关

**尚未开放（路线图）：**

- 社区自助发布：当前发布仅限官方（`publish_plugin` scope 的 token）。制品签名、
  `python.permissions` 的强制执行、社区 tier 放开都在路线图上。
- manifest 里 `python.permissions` 字段**当前只存储不强制**——预留给社区发布上线时启用。

## 分发与安装模型

- **注册表安装**：从插件市场一键安装；版本真源是服务器注册表，本地记录已装版本。
- **侧载**：把含 `manifest.json` 的目录放进 `~/.caw-studio/plugins/<任意目录名>/` 即被发现
  （带"本地"徽标）——这是贡献点开发的最短反馈环，见[创建第一个插件](quickstart.md)。
- **自动升级**：对 已装 × 启用 × `auto_update` × 平台受支持 且注册表有更新的插件，启动后
  台逐个升级（语义化比较，只升不降）。

## 下一步

- [开发环境准备](getting-started.md) —— 需要装什么、本地目录长什么样
- [创建第一个插件](quickstart.md) —— 从模板到 hello world 全流程
- [manifest 清单参考](manifest.md) —— 逐字段权威参考
