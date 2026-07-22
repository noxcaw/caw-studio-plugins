# Python Host API

Plugins with logic (command handlers, `python` task steps, `python:` flash backends) run in a
**per-plugin Python host subprocess**. This page covers the host execution model and the
`caw_plugin` SDK.

## Execution model

- **One process per plugin**: lazy-started (on first invocation), discarded on crash, and reaped
  when the plugin is disabled/uninstalled.
- **Single-flight protocol**: host↔app talk over **JSON Lines** on stdin/stdout, with at most one
  in-flight request at a time.
- **The process is the isolation boundary**: cancelling a call kills the process; the next
  invocation restarts it automatically.
- **Interpreter selection**: a `python3` declared by the plugin's artifacts → `python3` on the
  system `PATH`; when the plugin declares `python.dependencies` it runs inside a **dedicated
  venv** (see [Getting Started](getting-started.md)).
- **Handshake**: on startup the host emits `{"event": "ready", "apiVersion": 1}`; when a request's
  `pluginApi` exceeds the host's supported version, the host emits a fatal and refuses to start.

## SDK: `caw_plugin`

`caw_plugin` ships with the app and is injected onto `PYTHONPATH` at host startup — do **not**
bundle it into your plugin; just `import` it.

### Registering a handler

```python
import caw_plugin as caw


@caw.handler("erase_flash")
def erase_flash(ctx):
    ...
    return {"ok": True}
```

- `@caw.handler("name")` registers a function as the processor named `name`; this is exactly what
  a manifest `command.handler` / a `python` step's `handler` / a flash backend `python:<name>`
  reference.
- The signature is fixed: `fn(ctx) -> JSON-serializable value`. The return value is validated with
  `json.dumps` and returned to the caller; a non-serializable value follows the unified error
  path.
- Fallback resolution: if a name was not registered with `@caw.handler`, the host falls back to a
  **top-level function of the same name** in the entry module.

### The `ctx` context

The `ctx` object passed to a handler:

| Member | Type | Description |
|---|---|---|
| `ctx.args` | dict | This call's arguments. A `python` task step's `args` (variable-substituted) or the arguments of a command/bridge call. |
| `ctx.settings` | dict | Effective plugin settings (`id → value`, **values are strings**). `ctx.settings.get("id", default)`. |
| `ctx.root` | str \| None | Project root. `None` when a command is invoked with no project context. |
| `ctx.chip` | str \| None | Chip name (same as above, may be `None`). |
| `ctx.plugin_id` | str | The current plugin id. |

### `ctx` methods

```python
ctx.notify(message, level="info")     # frontend toast; level: info | warn | error
path = ctx.tool("esptool")            # resolve a tool's absolute path; None if not found
```

- **`ctx.notify(message, level="info")`**: pops a frontend toast (the `plugin:notify` event).
- **`ctx.tool(tool_id)`**: reverse-RPCs the app to resolve a tool's absolute path, in order
  **plugin artifact pool → system `PATH` → CubeCLT**; returns `None` if not found. `tool_id` is
  the id you declared in an artifact's `tools[].id`.

### Output

`print()` in a handler is captured line by line as output events:

- for a command invocation it goes to "Plugin output" (the `plugin:output` event);
- for a `python` task step it goes to the "Build" output tab (the `embedded:task-output` event).

`print` during the entry module's `import` is captured too.

## Full handler example

```python
import caw_plugin as caw


@caw.handler("erase_flash")
def erase_flash(ctx):
    print("erasing…")                          # -> output stream
    esptool = ctx.tool("esptool")              # tool resolution (pool -> PATH -> CubeCLT)
    if esptool is None:
        ctx.notify("esptool unavailable, install the toolchain first", level="error")
        return {"ok": False, "error": "esptool not found"}
    baud = ctx.settings.get("esp32.baudRate", "921600")
    port = ctx.args.get("port")                # from a python step's args / call arguments
    # … invoke esptool to erase here …
    ctx.notify("erase complete")               # -> toast
    return {"ok": True}                         # -> caller (Command Palette / webview bridge)
```

## Dependency management

When you need third-party packages, declare a lock file in the manifest:

```jsonc
"python": {
  "entry": "python/main.py",
  "apiVersion": 1,
  "dependencies": "requirements.lock"
}
```

With this field the app creates a **dedicated venv** for the plugin and `pip install -r
<lockfile>`, and the host runs inside that venv; without it the system/artifact `python3` is used.
The lock file path is relative to the files root and is packaged and distributed with the
`package` artifact.

## Error handling

- Handler raises: the full traceback is returned as the error and displayed
  (`{"ok": false, "error": traceback}`).
- Entry `import` failure / `pluginApi` too high: the host emits a fatal event and the plugin is
  unusable.
- Non-JSON-serializable return value: follows the unified error path.

## Command surface (client Tauri commands, for understanding the chain)

| Command | Purpose |
|---|---|
| `plugin_command_invoke` | Invoke a command handler (host executes; reports `host_not_ready` without a python entry) |
| `plugin_settings_get` / `plugin_settings_set` | Read/write settings (validated against declared type) |
| `plugin_i18n_read` | Read language-pack JSON |
| `plugin_contributes` | Contribution points of all enabled plugins + unknownKeys + panelEntries |

Events: `plugin:notify` (toast), `plugin:output` (command-invocation output),
`embedded:task-output` (task output), `plugin:settings-changed` (setting change), `plugin:status`
(install/run status snapshot).
