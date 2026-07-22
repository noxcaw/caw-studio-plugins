# Contribution Points

The `contributes` object is where a plugin registers capabilities with the app. **Declaration is
the only registration path**: the app can enumerate all contributions without running any plugin
code; the Python host carries logic only and cannot register anything beyond the manifest.

## The six contribution points

| Key | Chapter | In one line |
|---|---|---|
| `chips` | [Chip Support Packs](contributes/chips.md) | chip match → OpenOCD target / SVD / default flash backend / required tools |
| `commands` | [Commands & Settings](contributes/commands-and-settings.md) | enters the Command Palette, runs a Python handler on click |
| `settings` | [Commands & Settings](contributes/commands-and-settings.md) | auto-rendered on the Settings page; values feed task variables and the host |
| `embedded` | [Embedded Tasks](contributes/tasks.md) | build/run/… step sequences (exec / flash / rmdir / python) |
| `i18n` | [Localization](contributes/i18n.md) | dictionaries for `%key%` placeholders |
| `panels` | [Webview Panels](contributes/panels.md) | sandboxed iframe + postMessage bridge |

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

## Common rules

- **In-section id**: regex `^[a-zA-Z0-9][a-zA-Z0-9._-]*$` (command ids conventionally use
  camelCase, e.g. `esp32.eraseFlash`), **unique within its section**. The frontend global
  namespace is `<plugin_id>:<id>`.
- **Relative paths**: `i18n` files, `svd`, `openocd.target`, `panel.entry` etc. are all relative
  to the plugin files root; absolute paths and `..` are forbidden (see
  [Getting Started · Path rules](getting-started.md#path-rules-must-follow)).
- **`%key%` placeholders**: display text like `title` / `description` in commands/settings/panels
  may use `%key%`, resolved at display time through the plugin's
  [i18n language pack](contributes/i18n.md).
- **Strict validation + tolerant unknown keys**: a malformed known contribution key is a hard
  error; unknown keys are collected verbatim into `unknown`, hinted on the detail page, and
  written back on serialization with no loss (the downgrade path for an old app installing a new
  plugin).

## What each one drives

- **chips** → OpenOCD target resolution (debug/flash), SVD location (peripheral register panel),
  the toolchain status check set, flash backend defaults, and non-CubeMX project detection.
- **commands** → Command Palette entries; the `handler` runs in the Python host.
- **settings** → the "Plugins" section of the Settings page; values are readable by the task
  variable `${setting:ID}` and by the host's `ctx.settings`.
- **embedded** → the toolbar build/run/clean/rebuild buttons and the "More tasks" menu.
- **i18n** → the frontend overlay, resolving all `%key%`.
- **panels** → webview tabs in the docking system (the Command Palette auto-generates an "Open
  panel" command).

Start reading chapter by chapter from [Chip Support Packs](contributes/chips.md).
