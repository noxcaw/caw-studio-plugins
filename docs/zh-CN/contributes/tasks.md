# 嵌入式任务（embedded）

`contributes.embedded` 是一个**以任务 id 为键**的对象，每个任务是一串步骤。它驱动工具栏的
构建/运行/清理按钮，以及"更多任务"菜单。

```jsonc
"embedded": {
  "build":   { "steps": [ /* … */ ] },
  "run":     { "steps": [ /* … */ ] },
  "clean":   { "steps": [ /* … */ ] },
  "rebuild": { "steps": [ /* … */ ] }
}
```

## 任务 id

- `build` / `run` / `clean` / `rebuild` / `debug` 是编辑器已知 id（工具栏有专属按钮，按此顺序
  排前）；
- 其余任意 id 一样接受，按字典序归入"更多任务"菜单。**加任务只改 manifest，前端零适配。**

## 步骤 kind

每个步骤有 `kind` 字段。四种已知 kind：

### `exec` —— 子进程

```jsonc
{ "kind": "exec", "program": "${tool:cmake}", "args": ["--build", "--preset", "${profile_preset}"],
  "cwd": "…", "when": "cmake", "when_profile": "Debug" }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `program` | 是 | 可执行程序（常用 `${tool:ID}` 解析插件工具的绝对路径）。 |
| `args` | 否 | 参数数组，逐个做变量替换。 |
| `cwd` | 否 | 工作目录。 |
| `when` | 否 | 构建系统条件，见下。 |
| `when_profile` | 否 | 构建配置条件，见下。 |

输出攒批流回"构建"输出 tab；执行时把插件声明的全部工具目录前插进 `PATH`。

### `flash` —— 烧录 ELF

```jsonc
{ "kind": "flash", "file": "${dir}/${profile_build_dir}/${name}.elf", "backend": "auto" }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `file` | 是 | 要烧录的 ELF 路径。 |
| `chip` | 否 | 指定芯片（覆盖项目推断）。 |
| `backend` | 否 | `openocd` / `probe-rs` / `auto`（缺省 `auto`）。 |
| `when` / `when_profile` | 否 | 同 exec。 |

**后端选择顺序**（前者胜出）：

1. 工具栏项目级选择（按工作区根持久化）；
2. step 的 `backend` 字段；
3. 匹配芯片的 `defaultFlashBackend`（见[芯片支持包](chips.md)）；
4. `auto` 启发式：装了 openocd 且芯片有 target cfg → OpenOCD，否则 probe-rs。

### `rmdir` —— 删目录

```jsonc
{ "kind": "rmdir", "path": "${dir}/${profile_build_dir}" }
```

内置删目录（清理构建产物），**不依赖工具链**（故 clean 可在未装工具链时执行）。路径规范化后
必须严格落在项目根内，越界拒绝。

### `python` —— 调用宿主 handler

```jsonc
{ "kind": "python", "handler": "flash_esp", "args": { "port": "${setting:esp32.port}" } }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `handler` | 是 | 插件 Python 入口导出的处理器名。 |
| `args` | 否 | 键值对，值逐个做变量替换后作为 `ctx.args` 传入。 |
| `when` / `when_profile` | 否 | 同 exec。 |

`print` 输出逐行流回"构建"tab；取消 = 杀宿主进程（进程即隔离边界，下次调用自动重启）。见
[Python 宿主 API](../python-host.md)。

> 未知 `kind` 不会让整个 `contributes` 失效——它被容错收进 `unknown_kinds`，其余步骤照常，
> 只有执行到该步骤时才报"需要新版本 Caw Studio"。

## 条件字段

- **`when`**：构建系统条件，取值 `cmake` / `makefile`。`None` = 任何项目都执行；`Some` 时仅当
  项目**实测**构建系统匹配才执行——CubeMX 的 CMake 与 Makefile 两种生成物可共用一份清单。
- **`when_profile`**：构建配置条件（如 `Debug` / `Release`，大小写不敏感）。`None` = 任何配置
  都执行。Makefile 等无 preset 概念的构建系统靠它给两种配置写各自命令行；CMake 一般不需要
  （`--preset ${profile}` 一条通吃）。

## 变量

步骤的 `program` / `args` / `cwd` / `path` / `file` 及 `python.args` 的值里可用 `${…}`：

| 变量 | 含义 |
|---|---|
| `${dir}` | 项目根目录 |
| `${name}` | 项目/工程名 |
| `${chip}` | 芯片名（无 `.ioc` Mcu 名时该变量不可用，用到会报错） |
| `${profile}` | 当前构建配置名 |
| `${profile_preset}` | 该配置的 CMake preset |
| `${profile_build_dir}` | 该配置的构建目录 |
| `${tool:ID}` | 工具 `ID` 的绝对路径（解析不到报错，提示装工具链插件） |
| `${setting:ID}` | 本插件声明的设置项 `ID` 的生效值 |

未终止的 `${` 或未知变量名会让该步骤解析/执行报错。

## 完整示例（stm32-toolchain build）

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

`run` 在 build 步骤后追加一个 `flash` 步骤；`rebuild` 先 `rmdir` 再重跑 build。上例演示了
`when: "cmake"` 分流；若项目用 Makefile，再加一条 `when: "makefile"` 的 `exec` 步骤即可。
