# Your First Plugin

This page walks you through a minimal plugin that shows up in the Command Palette, runs inside the
Python host on click, and pops a toast — then how to sideload and debug it in the app. No
publishing required.

## 1. Directory structure

A minimal plugin looks like this:

```
my-plugin/
  manifest.json                 plugin declaration (contributions / python entry / deps)
  python/main.py                Python entry (@caw.handler registers processors)
  i18n/
    en.json                     language pack (dictionary for %key% placeholders in the manifest)
    zh-CN.json
```

The publishing-related `scripts/publish.py` and `.github/workflows/publish.yml` are covered in
[Packaging & Publishing](publishing.md); this page is about development only.

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
  "platforms": {},                         // may be empty for sideload; the publisher injects platforms["*"]
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

See [Manifest Reference](manifest.md) for every field. Note:

- `command.title` uses the `%cmd.hello%` placeholder; the actual text lives in the i18n pack;
- `command.handler` is `"hello"` — the processor name registered in the Python entry next;
- `setting.id` is `"my.name"`, read in Python via `ctx.settings.get("my.name", ...)`.

## 3. python/main.py

```python
"""Plugin entry: import caw_plugin to register handlers (referenced by the manifest handler field)."""

import caw_plugin as caw


@caw.handler("hello")
def hello(ctx):
    name = ctx.settings.get("my.name", "world")
    print(f"hello, {name}!")          # -> output stream (command invoke: "Plugin output"; task: "Build" tab)
    ctx.notify(f"hello, {name}!")     # -> frontend toast
    return {"ok": True}               # -> returned to the caller (Command Palette / webview bridge)
```

`caw_plugin` is an SDK that ships with the app; the host process injects it onto `PYTHONPATH`
automatically — you do **not** need to (and should not) bundle it. Full API in
[Python Host API](python-host.md).

## 4. i18n language packs

`i18n/zh-CN.json`:

```json
{
  "cmd.hello": "打个招呼",
  "set.name": "要问候的名字"
}
```

`i18n/en.json`:

```json
{
  "cmd.hello": "Say Hello",
  "set.name": "Name to greet"
}
```

Flat JSON; keys are the manifest `%…%` names with the percent signs removed. Lookup chain:
current language → `en` → the key name verbatim.

## 5. Run it via sideload

Copy (or symlink) the whole `my-plugin/` directory to:

```
~/.caw-studio/plugins/my-plugin/          Windows: C:\Users\<name>\.caw-studio\plugins\my-plugin\
```

Click refresh in the app's "Plugins" panel — the plugin appears with a "Local" badge. Then:

1. Press `Ctrl/⌘+Shift+P` to open the Command Palette, search for "Say Hello"
   (`My Plugin: Say Hello`), and press Enter;
2. the app lazy-starts the plugin's Python host and invokes the `hello` handler;
3. you will see: the `print` line in "Plugin output", a toast in the bottom-right corner, and the
   return value `{"ok": true}`;
4. open the "Plugins" section of the Settings page, change `Name to greet`, and run the command
   again — the greeting changes immediately.

Congratulations, that is an end-to-end round trip.

## Debugging & local development

Sideload plus the lazy-started Python host **is** the plugin debug loop — no publishing or
packaging needed:

- **Editing the manifest**: click refresh in the Plugins panel to re-parse and apply (commands
  enter/leave the palette, the settings section changes). If the manifest has parse errors, the
  plugin detail page reports them — a malformed **known** contribution point (missing required
  field, wrong type) is a **hard error**; unknown contribution keys are collected tolerantly into
  a "contains capabilities not supported by this version" hint without affecting the rest.
- **Editing Python code**: the host lazy-starts per invocation and does not stay resident. Just
  invoke the command again to pick up new code; if the host is still alive (e.g. a panel is open),
  **disable then re-enable** the plugin to force a host restart.
- **Viewing output**: `print()` in a handler is captured line by line — command invocations go to
  "Plugin output", task steps go to the "Build" output tab. `ctx.notify(msg, level=...)` pops a
  frontend toast (`level` may be `info`/`warn`/`error`).
- **Viewing errors**: when a handler raises, the full traceback is returned as the error and
  displayed; host startup failures (entry import error, `pluginApi` higher than the host
  supports) surface as fatal events.
- **Cancelling**: cancelling a `python` step in a task kills the host process (the process is the
  isolation boundary; the next invocation restarts it automatically).

> Tip: this documentation's per-point chapters (Commands & Settings, Localization, Webview Panels,
> Chip Support Packs) use one small running example throughout (commands + settings + i18n + chips
> + python entry + webview panel); assemble those snippets into a plugin directory and sideload it
> to get a minimal plugin covering every contribution point.

## Next steps

- [Manifest Reference](manifest.md) — field by field
- [Contribution Points](contributes.md) — per-point chapters
- [Packaging & Publishing](publishing.md) — tag to auto-publish
