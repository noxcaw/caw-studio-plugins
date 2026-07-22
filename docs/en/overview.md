# Overview & Capabilities

CAW Studio's plugin system turns the editor from a "bundled toolchain distributor" into a
**developer platform**: a plugin declaratively registers all of its capabilities (contribution
points) in a single `manifest.json`, and the community can extend chip support, commands,
settings, build/flash tasks, panels and language packs. Business logic runs in a per-plugin
**Python host process**.

This documentation targets plugin developers. If you only want to install and enable plugins,
use the in-app "Plugins" panel.

## Core principles

- **Declaration is the only registration path.** Every capability a plugin exposes is declared
  statically in the manifest. The Python host carries logic only (command handlers, task steps,
  flash backends); it **cannot register capabilities that are not in the manifest**. This lets
  the app enumerate all of a plugin's contributions without running any plugin code, keeping the
  install / offline / downgrade paths predictable.
- **User-level, zero admin rights.** Everything is installed under the user's home directory at
  `~/.caw-studio/` (`C:\Users\<name>\.caw-studio` on Windows). Nothing touches the registry or
  `PATH`; tools are always invoked by absolute path.
- **Content-addressed, deterministic packaging.** Artifacts are content-addressed by `sha256`;
  the publisher builds deterministic tar.gz archives, so identical content yields an identical
  hash and the registry deduplicates uploads. Upgrades only download changed artifacts.

## What a plugin can contribute

| Contribution point | Purpose |
|---|---|
| `chips` | Chip support pack: match rules → OpenOCD target / SVD / default flash backend / required tools |
| `commands` | Commands (in the Command Palette `Ctrl/⌘+Shift+P`, run a Python handler on click) |
| `settings` | Settings (auto-rendered on the Settings page; values feed task variables and the host) |
| `embedded` | Embedded tasks (build/run/clean/rebuild step sequences: exec / flash / rmdir / python) |
| `i18n` | Language packs (dictionaries for `%key%` placeholders, mounted into the frontend overlay) |
| `panels` | Webview panels (sandboxed iframe + postMessage bridge, registered into the docking system) |

Beyond declarative contributions, a plugin can also **carry artifacts**: shared-pool toolchain
binaries (`role: "tool"`) and the plugin's own file bundle (`role: "package"`, holding Python
code, SVDs, cfgs, UI assets).

## Capability boundaries (current version)

The plugin platform ships as of CAW Studio **v1.6.0**; the manifest contract baseline is
**`schemaVersion: 1`**.

Available today:

- The manifest contract and all six contribution points
- Chip support packs (can override built-in STM32 definitions)
- A per-plugin isolated Python host process (dedicated venv, JSON Lines RPC), real execution of
  `python` task steps / command handlers / `python:` flash backends, and the `caw_plugin` SDK
- Webview panel rendering (sandboxed iframe + postMessage bridge)
- Registry distribution, the GitHub Actions auto-publish chain, and the beta channel switch

**Not yet open (roadmap):**

- Community self-publishing: publishing is currently official-only (tokens with the
  `publish_plugin` scope). Artifact signing, enforcement of `python.permissions`, and opening up
  the community tier are all on the roadmap.
- The manifest `python.permissions` field is **stored but not enforced** in the current
  version — reserved for when community publishing goes live.

## Distribution & installation model

- **Registry install**: one-click install from the plugin marketplace; the source of truth for
  versions is the server registry, with the installed version recorded locally.
- **Sideload**: drop a directory containing `manifest.json` into
  `~/.caw-studio/plugins/<any-dir-name>/` and it is discovered (with a "Local" badge) — the
  shortest feedback loop for contribution-point development. See [Your First Plugin](quickstart.md).
- **Auto-update**: for plugins that are installed × enabled × `auto_update` × platform-supported
  and have a newer registry version, the app upgrades them one by one in the background after
  startup (semantic comparison, upgrade-only).

## Next steps

- [Getting Started](getting-started.md) — what to install and what the local layout looks like
- [Your First Plugin](quickstart.md) — from template to hello world, end to end
- [Manifest Reference](manifest.md) — authoritative field-by-field reference
