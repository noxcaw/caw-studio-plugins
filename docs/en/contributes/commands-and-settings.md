# Commands & Settings

The two most common contribution points: `commands` pushes entries into the Command Palette, and
`settings` auto-renders a form on the Settings page.

## commands

Commands enter the Command Palette (`Ctrl/⌘+Shift+P`) and run a handler in the Python host on
click.

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

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Command id, unique within the section (conventionally camelCase). Frontend global namespace `<plugin_id>:<id>`. |
| `title` | string | Yes | Display name; `%key%` resolves through the plugin [i18n](i18n.md). |
| `category` | string | No | Grouping prefix in the Command Palette. |
| `handler` | string | Yes | Processor name exported by the Python host (`@caw.handler("erase_flash")`). |

Execution semantics:

- Clicking a command → the app calls `plugin_command_invoke` → lazy-starts the plugin host →
  runs `handler`.
- The handler's `print()` output goes to "Plugin output"; `ctx.notify(...)` pops a toast; the
  return value goes back to the caller.
- When the plugin has **no `python` entry**, the command still enters the palette, but execution
  reports "runtime required" (`host_not_ready`).

Handler authoring and `ctx` are covered in [Python Host API](../python-host.md).

## settings

Settings auto-render in the "Plugins" section of the Settings page; the user's edits persist and
can feed task variables and the host.

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

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Setting id, unique within the section. |
| `title` | string | Yes | Display name; supports `%key%`. |
| `type` | enum | Yes | `bool` / `string` / `number` / `enum`. |
| `enum` | string[] | When `type=enum` | Candidate values. |
| `default` | any | No | Default value. |
| `description` | string | No | Description text; supports `%key%`. |

### Storage & consumption of values

- **Storage**: `~/.caw-studio/plugins/<id>/settings.json`, storing **override values only**
  (merged with defaults; orphan keys ignored), a sibling of the version dirs — so **upgrading a
  plugin never loses settings**.
- **A single source of truth** serves three places at once:
  1. Settings page rendering and read/write (`plugin_settings_get` / `plugin_settings_set`,
     validated against the declared type);
  2. the task variable `${setting:esp32.baudRate}` (see [Embedded Tasks](tasks.md));
  3. the Python host's `ctx.settings.get("esp32.baudRate", "921600")`.
- Writes are validated against the declared type; changes broadcast a `plugin:settings-changed`
  event.

> Note: values in `ctx.settings` are **strings** in the host. For example a `bool` setting is
> read in Python as the string `"true"`/`"false"` — test with
> `ctx.settings.get("esp32.loud") == "true"`.

### Example (hello-contribs)

```jsonc
"settings": [
  { "id": "hello.greeting", "title": "%set.greeting%", "type": "enum",
    "enum": ["hi", "hello", "hey"], "default": "hello", "description": "%set.greeting.desc%" },
  { "id": "hello.loud", "title": "%set.loud%", "type": "bool", "default": false }
]
```

Its handler:

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
