# 命令与设置

两个最常用的贡献点：`commands` 把条目送进命令面板，`settings` 在设置页自动渲染表单。

## commands —— 命令

命令进命令面板（`Ctrl/⌘+Shift+P`），点击即执行 Python 宿主里的 handler。

```jsonc
"commands": [
  {
    "id": "esp32.eraseFlash",
    "title": "%cmd.eraseFlash%",
    "category": "ESP32",
    "handler": "erase_flash"
  }
]
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 命令 id，节内唯一（惯用 camelCase）。前端全局命名空间 `<plugin_id>:<id>`。 |
| `title` | string | 是 | 展示名；`%key%` 走插件 [i18n](i18n.md) 解析。 |
| `category` | string | 否 | 命令面板里的分组前缀。 |
| `handler` | string | 是 | Python 宿主导出的处理器名（`@caw.handler("erase_flash")`）。 |

执行语义：

- 点击命令 → 应用调用 `plugin_command_invoke` → 懒启动该插件宿主 → 执行 `handler`。
- handler 的 `print()` 输出进"插件输出"；`ctx.notify(...)` 弹 toast；返回值回给调用方。
- 插件**没有 `python` 入口**时，命令仍进面板，但执行会提示"需要运行时"（`host_not_ready`）。

handler 写法与 `ctx` 见 [Python 宿主 API](../python-host.md)。

## settings —— 设置项

设置项在设置页"插件"分区自动渲染，用户改的值持久化，并可注入任务变量与宿主。

```jsonc
"settings": [
  {
    "id": "esp32.baudRate",
    "title": "%set.baud%",
    "type": "enum",
    "enum": ["115200", "921600"],
    "default": "921600",
    "description": "%set.baud.desc%"
  }
]
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 设置 id，节内唯一。 |
| `title` | string | 是 | 展示名；支持 `%key%`。 |
| `type` | enum | 是 | `bool` / `string` / `number` / `enum`。 |
| `enum` | string[] | 当 `type=enum` | 候选值。 |
| `default` | any | 否 | 默认值。 |
| `description` | string | 否 | 说明文案；支持 `%key%`。 |

### 值的存储与消费

- **存储**：`~/.caw-studio/plugins/<id>/settings.json`，只存**覆盖值**（与默认值合并；孤儿键
  忽略），与版本目录平级——**升级插件不丢设置**。
- **单一真源**同时服务三处：
  1. 设置页渲染与读写（`plugin_settings_get` / `plugin_settings_set`，按声明类型校验）；
  2. 任务变量 `${setting:esp32.baudRate}`（见[嵌入式任务](tasks.md)）；
  3. Python 宿主 `ctx.settings.get("esp32.baudRate", "921600")`。
- 写入按声明类型校验；变更广播 `plugin:settings-changed` 事件。

> 注意：宿主里 `ctx.settings` 的值是**字符串**。例如 `bool` 型设置在 Python 中读到的是
> `"true"`/`"false"` 字符串——判断时写 `ctx.settings.get("esp32.loud") == "true"`。

### 示例（hello-contribs）

```jsonc
"settings": [
  { "id": "hello.greeting", "title": "%set.greeting%", "type": "enum",
    "enum": ["hi", "hello", "hey"], "default": "hello", "description": "%set.greeting.desc%" },
  { "id": "hello.loud", "title": "%set.loud%", "type": "bool", "default": false }
]
```

对应 handler：

```python
@caw.handler("say_hello")
def say_hello(ctx):
    word = ctx.settings.get("hello.greeting", "hello")
    if ctx.settings.get("hello.loud") == "true":
        word = word.upper() + "!!!"
    print(f"[hello-contribs] {word} from the plugin python host")
    ctx.notify(f"{word} 👋")
    return {"greeting": word}
```
