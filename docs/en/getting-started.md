# Getting Started

## What you need

| Purpose | Requirement |
|---|---|
| Running plugins | CAW Studio **v1.6.0 or newer** |
| Writing plugins with logic | A working **Python 3** on the machine (host interpreter; the host script ships with the app) |
| Publishing to the registry | **Git** + a **GitHub repo**; the publisher script uses **Python 3.12** (in CI) |
| Artifact packaging | No extra deps — the publisher is pure stdlib |

A plugin that only writes declarative contributions (chip packs / commands / settings / i18n)
without Python handlers needs no Python at runtime. The host process only starts when a plugin
declares a `python` entry and you actually invoke it.

## How the Python interpreter is chosen

The interpreter used by the Python host process is resolved in this order:

1. A `python3` declared by the plugin's artifacts (if the plugin ships its own Python artifact);
2. `python3` on the system `PATH`;
3. If the plugin declares a lock file in `python.dependencies`, a **dedicated venv** is created
   for that plugin and populated via `pip install`; the host runs inside that venv.

## Local directory layout

Everything is installed under the user's home directory (zero admin rights):

```
~/.caw-studio/                     Windows: C:\Users\<name>\.caw-studio
  plugins/
    installed.json                 install ledger { id -> { version, enabled, auto_update } }
    <id>/settings.json             plugin setting overrides (sibling to version dirs; survives upgrade)
    <id>/<version>/manifest.json   the full manifest frozen at install time
    <id>/<version>/files/          package artifact extraction root (base for relative paths)
  tools/<name>/<version>/          shared pool of tool artifacts, reused across plugins by version
  host/<hash>/                     host scripts plugin_host.py + caw_plugin.py
                                   (ship with the app, materialized on first use; new hash dir on upgrade)
  envs/plugins/<id>/               dedicated venv for plugins that declare python.dependencies
  tmp/                             download/extract staging (same filesystem as pools => atomic rename)
```

Key points:

- The app invokes tools by **absolute path** only; it never writes the registry or edits `PATH`.
- **Disabling** only flips the ledger bit and keeps artifacts; **uninstalling** removes the
  ledger entry and runs a mark-and-sweep GC on the pool: artifacts referenced by other installed
  plugins are kept, and fresh dirs younger than 1 hour are exempt (to avoid deleting a concurrent
  install).
- Plugin settings live in `plugins/<id>/settings.json`, **a sibling of** the version dirs, so
  upgrading a plugin never loses the user's settings.

## Sideloading: the shortest feedback loop

You do not need to publish during development. **Copy or symlink** a plugin directory containing
`manifest.json` directly into `~/.caw-studio/plugins/<dir-name>/`; click refresh in the app's
"Plugins" panel and it is discovered with a "Local" badge:

- the directory holding the manifest **is** the files root, so relative paths in `svd` /
  `openocd.target` / `i18n` / `python.entry` work directly;
- artifacts in a sideloaded manifest **may omit `sha256`** (verification is skipped with a
  warning logged);
- on a **same-id** clash with a registry install, the registry install wins.

After editing the manifest, refresh in the Plugins panel to apply; after editing Python code,
just invoke the command again (the host lazy-starts per invocation; disabling then re-enabling
the plugin forces a host restart). See [Your First Plugin](quickstart.md) and
[Debugging](quickstart.md#debugging--local-development).

## Path rules (must follow)

Relative paths in the manifest are **always resolved against the plugin files root**:

- for a registry install = `plugins/<id>/<version>/files/`;
- for a sideload = the directory holding the manifest.

**Absolute paths and `..` are forbidden.** The client canonicalizes and verifies the resolved
path still lands inside the files root, rejecting any escape (this also resolves symlink
escapes); the server rejects escaping paths at publish time too.

## Next steps

- [Your First Plugin](quickstart.md)
- [Manifest Reference](manifest.md)
