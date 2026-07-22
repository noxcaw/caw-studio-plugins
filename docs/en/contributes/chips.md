# Chip Support Packs (chips)

`contributes.chips` lets a plugin extend the chips the app recognizes: given a chip name or
project signature, it resolves an OpenOCD target, an SVD file, a default flash backend, and a
required-tool set. The app ships isomorphic declarations for 17 STM32 families built in; plugins
can override them or add new ones (e.g. ESP32, nRF).

## Structure

```jsonc
"chips": [
  {
    "id": "esp32",
    "displayName": "ESP32",
    "match": {
      "chip": ["ESP32*"],
      "project": { "files": ["sdkconfig"], "parser": "python:detect" }
    },
    "openocd": { "target": "cfg/esp32.cfg" },
    "svd": "svd/esp32.svd",
    "svdPool": "stm32-svd",
    "defaultFlashBackend": "openocd",
    "requiredTools": ["cmake", "ninja", "esptool"]
  }
]
```

## Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Chip family identifier (e.g. `stm32f1` / `esp32`), unique within the section; also matched exactly by id on resolve. |
| `displayName` | string | No | Display name. |
| `match` | object | Yes | Match rules, see below. |
| `openocd` | object | No | `{ "target": … }`. `None` = this family does not use OpenOCD (uses another flash backend). |
| `svd` | string | No | SVD file path (relative to files root; points directly at a bundled file). |
| `svdPool` | string | No | SVD artifact-pool directory name (matched by chip-name stem inside `tools/<name>/<version>/**`). Mutually exclusive with `svd`; used by the built-in STM32 declarations — plugins usually point directly with `svd`. |
| `defaultFlashBackend` | string | No | Default flash backend: `openocd` / `probe-rs` / `python:<handler>`. `None` = follow the built-in heuristic. |
| `requiredTools` | string[] | No | Tool ids this family needs to build; the toolchain status panel checks against it. |

### `match`

```jsonc
"match": {
  "chip": ["STM32F1*", "STM32F103*"],
  "project": { "files": ["*.ioc", "sdkconfig"], "parser": "cubemx-ioc" }
}
```

| Field | Description |
|---|---|
| `chip` | Array of chip-name/family globs. **Case-insensitive**, `*` matches any sequence (including empty). `?` is not a wildcard. Example: `STM32F1*` matches both `STM32F103C8Tx` and `stm32f1`. |
| `project` | Identify by project signature files when there is no chip-name context, see below. |

### `match.project`

| Field | Description |
|---|---|
| `files` | Signature file names under the project root (support `*` globs, e.g. `*.ioc` / `sdkconfig`). A hit means "this is a project of that family". |
| `parser` | Metadata parser: `cubemx-ioc` (built in, parses `.ioc` for the Mcu name) or `python:<handler>` (custom host-executed detection). |

### `openocd.target`

A string with two interpretations:

- **contains `/` or ends with `.cfg`** → a cfg file bundled by the plugin (relative to files
  root), e.g. `cfg/esp32.cfg`;
- otherwise → an OpenOCD **built-in target name** (without the `target/` prefix and `.cfg`
  suffix), e.g. `stm32f1x`.

## Match & override order

When resolving a chip, lookup order is:

1. **Enabled plugins** (by plugin id, lexicographic order) — plugins can override built-in
   definitions;
2. **Built-in** STM32 declarations.

Within one plugin, the `chips` array order applies. So if two plugins both declare `STM32F1*`,
the plugin earlier in id lexicographic order wins.

## What it drives at runtime

- **OpenOCD target resolution**: debug and flash sessions generate the OpenOCD config from
  `openocd.target`.
- **SVD location**: the peripheral register panel finds the SVD via `svd` / `svdPool`; a
  project's own `.caw-studio/*.svd` still takes top priority.
- **Toolchain status checks**: the toolchain panel checks each `requiredTools` entry of the
  matched chip for resolvability.
- **Flash backend default**: `defaultFlashBackend` participates in the flash-backend selection
  chain (see [Embedded Tasks](tasks.md)).
- **Non-CubeMX project detection**: without a `.ioc`, `match.project.files` is probed to recognize
  a project of that family.

## Minimal example

The chip declaration from the `hello-contribs` sample — no SVD, reusing a built-in OpenOCD
target directly:

```jsonc
{
  "id": "demo-chip",
  "displayName": "Demo Chip",
  "match": { "chip": ["DEMO*"] },
  "openocd": { "target": "stm32f4x" },
  "requiredTools": ["arm-none-eabi-gcc", "cmake", "ninja"]
}
```

Once sideloaded, any project whose chip name matches `DEMO*` resolves a target cfg.
