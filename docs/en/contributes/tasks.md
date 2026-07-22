# Embedded Tasks (embedded)

`contributes.embedded` is an object **keyed by task id**, where each task is a sequence of steps.
It drives the toolbar build/run/clean buttons and the "More tasks" menu.

```jsonc
"embedded": {
  "build":   { "steps": [ /* … */ ] },
  "run":     { "steps": [ /* … */ ] },
  "clean":   { "steps": [ /* … */ ] },
  "rebuild": { "steps": [ /* … */ ] }
}
```

## Task ids

- `build` / `run` / `clean` / `rebuild` / `debug` are editor-known ids (dedicated toolbar buttons,
  sorted first in this order);
- any other id is accepted too and grouped lexicographically into the "More tasks" menu. **Adding
  a task only changes the manifest — no frontend changes.**

## Step kinds

Each step has a `kind` field. Four known kinds:

### `exec` — subprocess

```jsonc
{ "kind": "exec", "program": "${tool:cmake}", "args": ["--build", "--preset", "${profile_preset}"],
  "cwd": "…", "when": "cmake", "when_profile": "Debug" }
```

| Field | Required | Description |
|---|---|---|
| `program` | Yes | Executable (often `${tool:ID}` to resolve a plugin tool's absolute path). |
| `args` | No | Argument array, each element variable-substituted. |
| `cwd` | No | Working directory. |
| `when` | No | Build-system condition, see below. |
| `when_profile` | No | Build-profile condition, see below. |

Output is batched back to the "Build" output tab; at execution the plugin's declared tool
directories are prepended to `PATH`.

### `flash` — flash an ELF

```jsonc
{ "kind": "flash", "file": "${dir}/${profile_build_dir}/${name}.elf", "backend": "auto" }
```

| Field | Required | Description |
|---|---|---|
| `file` | Yes | Path of the ELF to flash. |
| `chip` | No | Specify the chip (overrides project inference). |
| `backend` | No | `openocd` / `probe-rs` / `auto` (defaults to `auto`). |
| `when` / `when_profile` | No | Same as exec. |

**Backend selection order** (earlier wins):

1. Toolbar project-level selection (persisted per workspace root);
2. the step's `backend` field;
3. the matched chip's `defaultFlashBackend` (see [Chip Support Packs](chips.md));
4. the `auto` heuristic: openocd installed and the chip has a target cfg → OpenOCD, otherwise
   probe-rs.

### `rmdir` — delete a directory

```jsonc
{ "kind": "rmdir", "path": "${dir}/${profile_build_dir}" }
```

Built-in directory deletion (clean build artifacts), **independent of the toolchain** (so clean
can run without a toolchain installed). The normalized path must land strictly inside the project
root; an escape is rejected.

### `python` — invoke a host handler

```jsonc
{ "kind": "python", "handler": "flash_esp", "args": { "port": "${setting:esp32.port}" } }
```

| Field | Required | Description |
|---|---|---|
| `handler` | Yes | Processor name exported by the plugin's Python entry. |
| `args` | No | Key/value pairs; each value is variable-substituted and passed in as `ctx.args`. |
| `when` / `when_profile` | No | Same as exec. |

`print` output streams line by line to the "Build" tab; cancelling kills the host process (the
process is the isolation boundary; the next invocation restarts it). See
[Python Host API](../python-host.md).

> An unknown `kind` does not invalidate the whole `contributes` — it is collected tolerantly into
> `unknown_kinds`, other steps run as usual, and only when execution reaches that step does it
> report "update Caw Studio".

## Condition fields

- **`when`**: build-system condition, valued `cmake` / `makefile`. `None` = run for any project;
  when `Some`, the step runs only if the project's **detected** build system matches — CubeMX's
  CMake and Makefile outputs can share one manifest.
- **`when_profile`**: build-profile condition (e.g. `Debug` / `Release`, case-insensitive).
  `None` = run for any profile. Build systems without a preset concept (like Makefile) use it to
  write per-profile command lines; CMake usually does not need it (`--preset ${profile}` handles
  both).

## Variables

Inside a step's `program` / `args` / `cwd` / `path` / `file` and `python.args` values, `${…}` is
available:

| Variable | Meaning |
|---|---|
| `${dir}` | Project root directory |
| `${name}` | Project name |
| `${chip}` | Chip name (unavailable when there is no `.ioc` Mcu name; using it then errors) |
| `${profile}` | Current build profile name |
| `${profile_preset}` | The profile's CMake preset |
| `${profile_build_dir}` | The profile's build directory |
| `${tool:ID}` | Absolute path of tool `ID` (errors if unresolved, hinting to install the toolchain plugin) |
| `${setting:ID}` | Effective value of setting `ID` declared by this plugin |

An unterminated `${` or an unknown variable name makes the step fail at parse/execution.

## Full example (stm32-toolchain build)

```jsonc
"embedded": {
  "build": {
    "steps": [
      { "kind": "exec", "when": "cmake", "program": "${tool:cmake}",
        "args": ["--preset", "${profile_preset}"] },
      { "kind": "exec", "when": "cmake", "program": "${tool:cmake}",
        "args": ["--build", "--preset", "${profile_preset}"] }
    ]
  },
  "clean": {
    "steps": [ { "kind": "rmdir", "path": "${dir}/build" } ]
  }
}
```

`run` appends a `flash` step after the build steps; `rebuild` runs `rmdir` first and then
re-runs build. The example shows the `when: "cmake"` branch; for a Makefile project, add another
`exec` step with `when: "makefile"`.
