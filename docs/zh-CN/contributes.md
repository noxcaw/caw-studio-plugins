# 贡献点总览

`contributes` 对象是插件向应用注册能力的地方。**声明式是唯一注册入口**：应用不运行任何插件
代码即可枚举全部贡献；Python 宿主只承载逻辑，不能在运行时注册 manifest 之外的能力。

## 六个贡献点

| 键 | 专章 | 一句话 |
|---|---|---|
| `chips` | [芯片支持包](contributes/chips.md) | 芯片匹配 → OpenOCD target / SVD / 默认烧录后端 / 所需工具 |
| `commands` | [命令与设置](contributes/commands-and-settings.md) | 进命令面板，点击执行 Python handler |
| `settings` | [命令与设置](contributes/commands-and-settings.md) | 设置页自动渲染，值注入任务变量与宿主 |
| `embedded` | [嵌入式任务](contributes/tasks.md) | build/run/… 步骤序列（exec / flash / rmdir / python） |
| `i18n` | [语言包](contributes/i18n.md) | `%key%` 占位符的词典 |
| `panels` | [Webview 面板](contributes/panels.md) | 沙箱 iframe + postMessage 桥 |

```jsonc
"contributes": {
  "chips":    [ /* … */ ],
  "commands": [ /* … */ ],
  "settings": [ /* … */ ],
  "embedded": { "build": { "steps": [ /* … */ ] } },
  "i18n":     { "en": "i18n/en.json", "zh-CN": "i18n/zh-CN.json" },
  "panels":   [ /* … */ ]
}
```

## 通用规则

- **节内 id**：正则 `^[a-zA-Z0-9][a-zA-Z0-9._-]*$`（命令 id 惯用 camelCase，如 `esp32.eraseFlash`），
  **节内唯一**。前端全局命名空间是 `<plugin_id>:<id>`。
- **相对路径**：`i18n` 文件、`svd`、`openocd.target`、`panel.entry` 等全部相对插件 files 根，
  禁止绝对路径与 `..`（见[开发环境准备 · 路径规则](getting-started.md#路径规则务必遵守)）。
- **`%key%` 占位符**：命令/设置/面板的 `title`、`description` 等展示文案可用 `%key%`，展示时
  经该插件的 [i18n 语言包](contributes/i18n.md)解析。
- **强校验 + 未知键容错**：已知贡献点键形状写错 = 硬报错；未知键原样收进 `unknown` 并在详情页
  提示，序列化写回不丢（旧 App 装新插件的降级路径）。

## 各自驱动什么

- **chips** → OpenOCD target 解析（调试/烧录）、SVD 定位（外设寄存器面板）、工具链状态检查集、
  烧录后端默认值、非 CubeMX 项目识别。
- **commands** → 命令面板条目；`handler` 由 Python 宿主执行。
- **settings** → 设置页"插件"分区渲染；值可被任务变量 `${setting:ID}` 与宿主 `ctx.settings`
  读取。
- **embedded** → 工具栏 build/run/clean/rebuild 按钮与"更多任务"菜单。
- **i18n** → 前端 overlay，解析所有 `%key%`。
- **panels** → 停靠系统里的 webview tab（命令面板自动生成"打开面板"命令）。

从[芯片支持包](contributes/chips.md)开始逐章阅读。
