# 创建第一个插件

本页带你从零做一个能进命令面板、点一下就在 Python 宿主里跑起来、弹出 toast 的最小插件，
并在应用里侧载调试它——全程不需要发布。

## 1. 目录结构

一个最小插件长这样：

```
my-plugin/
  manifest.json                 插件声明(贡献点 / python 入口 / 依赖)
  python/main.py                Python 入口(@caw.handler 注册处理器)
  i18n/
    en.json                     语言包(manifest 里 %key% 占位的词典)
    zh-CN.json
```

发布相关的 `scripts/publish.py` 与 `.github/workflows/publish.yml` 见
[打包与发布](publishing.md)；本页只讲开发。

## 2. manifest.json

```jsonc
{
  "schemaVersion": 1,
  "id": "my-plugin",                       // ^[a-z0-9][a-z0-9-]{1,63}$
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "What this plugin does",
  "category": "sample",
  "engines": { "app": "1.6.0", "pluginApi": 1 },
  "platforms": {},                         // 侧载可为空;注册表发布时发布器注入 platforms["*"]
  "python": {
    "entry": "python/main.py",
    "apiVersion": 1,
    "activation": ["onCommand:my.hello"]
  },
  "contributes": {
    "commands": [
      { "id": "my.hello", "title": "%cmd.hello%", "category": "My Plugin", "handler": "hello" }
    ],
    "settings": [
      { "id": "my.name", "title": "%set.name%", "type": "string", "default": "world" }
    ],
    "i18n": { "en": "i18n/en.json", "zh-CN": "i18n/zh-CN.json" }
  }
}
```

逐字段含义见 [manifest 清单参考](manifest.md)。注意：

- `command.title` 用 `%cmd.hello%` 占位符，实际文案在 i18n 语言包里；
- `command.handler` 是 `"hello"`——下一步 Python 入口里注册的处理器名；
- `setting.id` 是 `"my.name"`，Python 里用 `ctx.settings.get("my.name", ...)` 读。

## 3. python/main.py

```python
"""插件入口:import caw_plugin 注册 handler(manifest 里 handler 字段引用)。"""

import caw_plugin as caw


@caw.handler("hello")
def hello(ctx):
    name = ctx.settings.get("my.name", "world")
    print(f"hello, {name}!")          # → 输出流(命令调用进"插件输出";任务时进"构建"tab)
    ctx.notify(f"hello, {name}!")     # → 前端 toast
    return {"ok": True}               # → 返回给调用方(命令面板 / webview 桥)
```

`caw_plugin` 是随应用分发的 SDK，宿主进程会自动注入到 `PYTHONPATH`——你**不需要**、也不应该
把它打进插件包。完整 API 见 [Python 宿主 API](python-host.md)。

## 4. i18n 语言包

`i18n/zh-CN.json`：

```json
{
  "cmd.hello": "打个招呼",
  "set.name": "要问候的名字"
}
```

`i18n/en.json`：

```json
{
  "cmd.hello": "Say Hello",
  "set.name": "Name to greet"
}
```

平面 JSON，键就是 manifest 里 `%…%` 去掉百分号的名字。查找链：当前语言 → `en` → 键名原样。

## 5. 侧载运行

把整个 `my-plugin/` 目录拷贝（或软链）到：

```
~/.caw-studio/plugins/my-plugin/          Windows: C:\Users\<name>\.caw-studio\plugins\my-plugin\
```

在应用"插件"面板点刷新——插件即出现，带"本地"徽标。然后：

1. 按 `Ctrl/⌘+Shift+P` 打开命令面板，搜"打个招呼"（`My Plugin: 打个招呼`），回车；
2. 应用懒启动该插件的 Python 宿主，调用 `hello` handler；
3. 你会看到：`print` 的一行进"插件输出"、右下角一个 toast、返回值 `{"ok": true}`；
4. 打开设置页的"插件"分区，把 `要问候的名字` 改掉，再跑一次命令——问候语立即变化。

恭喜，端到端跑通了。

## 调试与本地开发

侧载 + Python 宿主的懒启动就是插件的调试循环，无需任何发布或打包：

- **改 manifest**：在插件面板点刷新即重新解析生效（命令进/出面板、设置分区变化）。
  manifest 有解析错误时，插件详情页会给出提示——已知贡献点写错（缺必填字段、类型不对）是
  **硬报错**；本版本不认识的贡献点键会被容错收进"含当前版本不支持的能力"提示，不影响其余
  贡献。
- **改 Python 代码**：宿主按调用懒启动、执行完不常驻。改完直接重新调用命令即可拿到新代码；
  若宿主仍在（如面板长开），**停用再启用插件**可强制重启宿主进程。
- **看输出**：handler 里的 `print()` 逐行捕获——命令调用时进"插件输出"，任务步骤时进"构建"
  输出 tab。`ctx.notify(msg, level=...)` 弹前端 toast（`level` 可为 `info`/`warn`/`error`）。
- **看错误**：handler 抛异常时，完整 traceback 会作为错误返回并展示；宿主启动失败（入口
  import 报错、`pluginApi` 高于宿主支持版本）会以 fatal 事件形式暴露。
- **取消**：任务里的 `python` 步骤取消 = 杀宿主进程（进程即隔离边界，下次调用自动重启）。

> 提示：`hello-contribs` 是官方随应用附带的贡献点全覆盖示例（commands + settings + i18n +
> chips + python 入口 + webview 面板）。把它侧载出来对照着改，是最快的上手方式。

## 下一步

- [manifest 清单参考](manifest.md) —— 逐字段
- [贡献点总览](contributes.md) —— 各贡献点专章
- [打包与发布](publishing.md) —— 打 tag 自动发版
