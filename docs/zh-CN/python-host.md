# Python 宿主 API

带逻辑的插件（命令 handler、`python` 任务步骤、`python:` 烧录后端）由每插件一个 **Python 宿主
子进程**承载。本页讲宿主的执行模型与 `caw_plugin` SDK。

## 执行模型

- **每插件一进程**：懒启动（首次调用时）、崩溃即弃、插件停用/卸载即收。
- **单飞协议**：宿主与应用之间走 stdin/stdout 的 **JSON Lines**，同一时刻至多一个在途请求。
- **进程即隔离边界**：取消一次调用 = 杀进程，下次调用自动重启。
- **解释器选取**：插件制品声明的 `python3` → 系统 `PATH` 的 `python3`；插件声明了
  `python.dependencies` 时在**独立 venv** 里跑（见[开发环境准备](getting-started.md)）。
- **握手**：启动时宿主发 `{"event": "ready", "apiVersion": 1}`；请求的 `pluginApi` 高于宿主
  支持版本时，宿主发 fatal 拒启。

## SDK：`caw_plugin`

`caw_plugin` 随应用分发，宿主启动时注入到 `PYTHONPATH`——**不要**把它打进插件包，直接
`import` 即可。

### 注册 handler

```python
import caw_plugin as caw


@caw.handler("erase_flash")
def erase_flash(ctx):
    ...
    return {"ok": True}
```

- `@caw.handler("name")` 把函数注册为名为 `name` 的处理器；manifest 里 `command.handler` /
  `python` 步骤的 `handler` / 烧录后端 `python:<name>` 引用的就是这个名字。
- 签名固定为 `fn(ctx) -> JSON 可序列化值`。返回值经 `json.dumps` 校验后回给调用方；不可
  序列化会走统一错误路径。
- 备用解析：若某名字没被 `@caw.handler` 注册，宿主会回退去找入口模块里的**同名顶层函数**。

### `ctx` 上下文

传入 handler 的 `ctx` 对象：

| 成员 | 类型 | 说明 |
|---|---|---|
| `ctx.args` | dict | 本次调用参数。`python` 任务步骤的 `args`（变量已替换）或命令/桥调用的参数。 |
| `ctx.settings` | dict | 插件生效设置（`id → 值`，**值为字符串**）。`ctx.settings.get("id", 默认)`。 |
| `ctx.root` | str \| None | 项目根。命令调用无项目上下文时为 `None`。 |
| `ctx.chip` | str \| None | 芯片名（同上，可能为 `None`）。 |
| `ctx.plugin_id` | str | 当前插件 id。 |

### `ctx` 方法

```python
ctx.notify(message, level="info")     # 前端 toast;level: info | warn | error
path = ctx.tool("esptool")            # 解析工具绝对路径;找不到返回 None
```

- **`ctx.notify(message, level="info")`**：弹前端 toast（`plugin:notify` 事件）。
- **`ctx.tool(tool_id)`**：向应用反向 RPC 解析工具绝对路径，解析顺序 **插件制品池 → 系统
  `PATH` → CubeCLT**；找不到返回 `None`。`tool_id` 是你在制品 `tools[].id` 里声明的 id。

### 输出

handler 里的 `print()` 被逐行捕获为输出事件：

- 命令调用时进"插件输出"（`plugin:output` 事件）；
- `python` 任务步骤时进"构建"输出 tab（`embedded:task-output` 事件）。

入口模块 `import` 期间的 `print` 也会被捕获。

## 完整 handler 示例

```python
import caw_plugin as caw


@caw.handler("erase_flash")
def erase_flash(ctx):
    print("erasing…")                          # → 输出流
    esptool = ctx.tool("esptool")              # 工具解析(池 → PATH → CubeCLT)
    if esptool is None:
        ctx.notify("esptool 不可用,请先安装工具链", level="error")
        return {"ok": False, "error": "esptool not found"}
    baud = ctx.settings.get("esp32.baudRate", "921600")
    port = ctx.args.get("port")                # 来自 python 步骤的 args / 调用参数
    # …在此调用 esptool 擦除…
    ctx.notify("擦除完成")                      # → toast
    return {"ok": True}                         # → 调用方(命令面板 / webview 桥)
```

## 依赖管理

需要第三方包时，在 manifest 声明锁文件：

```jsonc
"python": {
  "entry": "python/main.py",
  "apiVersion": 1,
  "dependencies": "requirements.lock"
}
```

有此字段时应用为该插件建**独立 venv** 并 `pip install -r <锁文件>`，宿主运行在该 venv 里；无则
用系统/制品 `python3`。锁文件路径相对 files 根，随 `package` 制品一起打包分发。

## 错误处理

- handler 抛异常：完整 traceback 作为错误返回并展示（`{"ok": false, "error": traceback}`）。
- 入口 `import` 失败 / `pluginApi` 过高:宿主发 fatal 事件,插件不可用。
- 返回值不可 JSON 序列化：走统一错误路径。

## 命令面（客户端 Tauri 命令,供理解链路）

| 命令 | 用途 |
|---|---|
| `plugin_command_invoke` | 调用命令 handler(宿主执行;无 python 入口报 `host_not_ready`) |
| `plugin_settings_get` / `plugin_settings_set` | 设置读写(按声明类型校验) |
| `plugin_i18n_read` | 读语言包 JSON |
| `plugin_contributes` | 全部已启用插件的贡献点 + unknownKeys + panelEntries |

事件：`plugin:notify`（toast）、`plugin:output`（命令调用输出）、`embedded:task-output`（任务
输出）、`plugin:settings-changed`（设置变更）、`plugin:status`（安装/运行状态快照）。
