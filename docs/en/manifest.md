# Manifest Reference

`manifest.json` is a plugin's single declaration entry, living at the root of the plugin
repo/directory. This page documents every top-level and artifact field, matching the CAW Studio
client's real parsing behavior. Contribution-point fields (`contributes.*`) are covered in
[Contribution Points](contributes.md) and its sub-pages.

## Full skeleton

```jsonc
{
  "schemaVersion": 1,
  "id": "esp32-support",
  "name": "ESP32 Support",
  "version": "1.2.0",
  "description": "…",
  "category": "chip-support",
  "engines": { "app": "1.6.0", "pluginApi": 1 },
  "platforms": {
    "linux-x86_64": { "artifacts": [ /* … */ ] },
    "*":            { "artifacts": [ /* platform-independent package */ ] }
  },
  "python": {
    "entry": "python/main.py",
    "apiVersion": 1,
    "dependencies": "requirements.lock",
    "activation": ["onTask:flash", "onCommand:esp32.eraseFlash", "onChip:ESP32*"],
    "permissions": ["device"]
  },
  "contributes": { /* see the contribution-point chapters */ }
}
```

## Top-level fields

| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | integer | No | Contract baseline; defaults to `1`. The only valid value today is `1`; a breaking upgrade would introduce `2`. |
| `id` | string | Yes | Unique plugin id, regex `^[a-z0-9][a-z0-9-]{1,63}$` (lowercase letters/digits/hyphens). The registry slug matches it. |
| `name` | string | Yes | Display name. |
| `version` | string | Yes | Semantic version `X.Y.Z` (strictly three numeric segments at publish time, see [Packaging & Publishing](publishing.md)). |
| `description` | string | No | One-line summary. |
| `category` | string | No | Category, defaults to `"system"`. Common values: `chip-support` / `system` / `sample` (free string). |
| `engines` | object | No | See below. |
| `platforms` | object | No* | Platform → artifact-bundle map, see below. May be `{}` for sideload; a non-empty value is required for registry publishing. |
| `python` | object | No | Python host declaration, see below. Omitting it = a pure declarative plugin with no host. |
| `contributes` | object | No | Contribution points, see [Contribution Points](contributes.md). |

## `engines`

```jsonc
"engines": { "app": "1.6.0", "pluginApi": 1 }
```

| Field | Type | Description |
|---|---|---|
| `app` | string | Minimum app version (a plain version number, **not** range syntax). Must parse as semver at publish time; the server registry filters on it — when the client version is below this value the release is blocked and it falls back to an older available release. |
| `pluginApi` | integer | Python plugin API major version; checked at host handshake — the host refuses to start when its supported version is below this. Currently `1`. |

## `platforms`

Keys of `platforms` are **`{OS}-{ARCH}`**; each value is a `{ "artifacts": [ … ] }` bundle.

- Platform key examples: `linux-x86_64` / `windows-x86_64` / `macos-aarch64` … (`OS` and `ARCH`
  come from Rust's `std::env::consts`).
- The special key **`"*"` = platform-independent artifacts**: a pure-Python / pure-contribution
  plugin ships one tar for all platforms — this is the standard CI publish form (the publisher
  injects the packaged bundle into `platforms["*"]`).
- Resolution order: **exact platform key first, falling back to `"*"`**; both can coexist (e.g.
  `"*"` holds the Python code bundle while per-platform keys hold binary tools). A platform with
  neither an exact key nor `"*"` shows "not available on this platform".
- Sideload also allows `"platforms": {}` (zero artifacts, pure declaration); registry publishing
  requires a non-empty value, so use `"*"`.

### Artifacts `artifacts[]`

```jsonc
{
  "role": "package",              // "tool" (default) | "package"
  "name": "esp32-files",
  "version": "1.2.0",
  "url": "https://…/esp32-files.tar.gz",
  "sha256": "…",
  "size": 1200000,
  "strip_components": 1,
  "tools": [ { "id": "esptool", "path": "bin/esptool" } ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `role` | enum | No | `tool` (default) goes to the shared pool `tools/<name>/<version>/`, deduplicated by version across plugins; `package` is the plugin's own file bundle (Python code / SVD / cfg / UI assets), extracted to `plugins/<id>/<version>/files/`, GC'd together with the plugin version dir, not shared. |
| `name` | string | Yes | Artifact pool directory name (e.g. `arm-none-eabi-gcc`). |
| `version` | string | Yes | Artifact version (determines side-by-side dirs in the pool). |
| `url` | string | Yes | Download URL (tar.gz). |
| `sha256` | string | No† | Content checksum. **Mandatory in the server registry**; may be omitted for sideload (verification skipped with a warning). |
| `size` | integer | No | Byte count, used for aggregate progress bars and pre-install size display; fill it in when possible. |
| `strip_components` | integer | No | Number of top-level directory levels to strip on extraction. An xPack archive's top level is `xpack-…-<ver>/`, so set `1` to strip it. Defaults to `0`. |
| `tools` | array | No | Executable entries this artifact exposes to toolchain resolution, see below. |

> Naming convention: early fields stay snake_case (`strip_components`); later multi-word fields
> are all camelCase (`displayName` / `requiredTools` / `svdPool` / `defaultFlashBackend`).

### `tools[]`

```jsonc
{ "id": "esptool", "path": "bin/esptool" }
```

| Field | Description |
|---|---|
| `id` | Tool id; the `${tool:ID}` variable and `ctx.tool("id")` resolve against it. |
| `path` | Executable path relative to the artifact pool dir, `/`-separated. On Windows, `.exe` is appended automatically when there is no extension. |

### Artifact packaging rules

1. **Always tar.gz** (including Windows) — the client only ships a gzip+tar extractor.
2. An xPack archive's top level is `xpack-…-<ver>/`; strip it with `strip_components: 1`.
3. **Windows packages must not contain symlinks** (extraction fails under normal user rights):
   repackage from a zip source or materialize with `--dereference`. Linux/macOS keep symlinks and
   the execute bit.
4. `sha256` is a mandatory checksum; recompute and fill it after mirroring.

## `python`

```jsonc
"python": {
  "entry": "python/main.py",
  "apiVersion": 1,
  "dependencies": "requirements.lock",
  "activation": ["onCommand:esp32.eraseFlash", "onChip:ESP32*"],
  "permissions": ["device"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `entry` | string | Yes | Entry module path (relative to the files root). `import caw_plugin` and register processors with `@caw.handler`. |
| `apiVersion` | integer | No | Host handshake check (host refuses to start when its supported version is below this). Currently `1`. |
| `dependencies` | string | No | Lock file path (relative to the files root). **A dedicated venv is created and `pip install`ed only when this field is present**; otherwise the system/artifact `python3` is used. |
| `activation` | string[] | No | Lazy activation events: `onTask:<task>` / `onCommand:<id>` / `onChip:<glob>` / `"*"`. |
| `permissions` | string[] | No | Permission declaration. **Stored but not enforced today** (when the community tier goes live the host will reject out-of-scope RPCs based on it). |

The host execution model, `ctx`, and the SDK are covered in [Python Host API](python-host.md).

## Forward compatibility (unknown-field policy)

- **Contribution points**: known keys are validated strictly (a shape error is a hard error — a
  genuinely malformed manifest must surface immediately); **unknown keys** are collected verbatim
  into an internal `unknown`, the plugin detail page hints "contains capabilities not supported by
  this version", and they are written back verbatim on re-serialization (freezing the
  LocalManifest) with no data loss — this is the downgrade path for an old app installing a new
  plugin.
- **Task step kinds**: an unknown `kind` is collected tolerantly into `unknown_kinds`, other steps
  parse as usual, and only when execution reaches that step does it report "update Caw Studio".

So publishing a plugin with new fields never breaks overall parsing on older clients — the new
capabilities are simply unavailable there.

## Related

- [Contribution Points](contributes.md)
- [Python Host API](python-host.md)
- [Versioning & Compatibility](versioning.md)
