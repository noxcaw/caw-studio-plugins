# manifest 清单参考

`manifest.json` 是插件的唯一声明入口，位于插件仓库/目录根。本页逐字段说明顶层与制品字段，
以客户端真实解析（`src-tauri/src/plugin/`）为准。贡献点（`contributes.*`）各字段见
[贡献点总览](contributes.md)及其子页。

## 全量骨架

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
    "*":            { "artifacts": [ /* 平台无关 package */ ] }
  },
  "python": {
    "entry": "python/main.py",
    "apiVersion": 1,
    "dependencies": "requirements.lock",
    "activation": ["onTask:flash", "onCommand:esp32.eraseFlash", "onChip:ESP32*"],
    "permissions": ["device"]
  },
  "contributes": { /* 见贡献点专章 */ }
}
```

## 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `schemaVersion` | integer | 否 | 契约基线，缺省按 `1` 解。当前唯一有效值是 `1`；破坏性升级才会引入 `2`。 |
| `id` | string | 是 | 插件唯一 id，正则 `^[a-z0-9][a-z0-9-]{1,63}$`（小写字母/数字/连字符）。注册表 slug 与它一致。 |
| `name` | string | 是 | 展示名。 |
| `version` | string | 是 | 语义版本 `X.Y.Z`（发布时严格三段数字，见[打包与发布](publishing.md)）。 |
| `description` | string | 否 | 一句话说明。 |
| `category` | string | 否 | 分类，缺省 `"system"`。惯用值：`chip-support` / `system` / `sample` 等（自由字符串）。 |
| `engines` | object | 否 | 见下。 |
| `platforms` | object | 否* | 平台 → 制品包映射，见下。侧载可为 `{}`；注册表发布要求非空。 |
| `python` | object | 否 | Python 宿主声明，见下。无此块 = 纯声明式插件，不启动宿主。 |
| `contributes` | object | 否 | 贡献点，见[贡献点总览](contributes.md)。 |

## `engines`

```jsonc
"engines": { "app": "1.6.0", "pluginApi": 1 }
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `app` | string | 最低 App 版本（纯版本号，**非** range 语法）。发布时必须能解析为 semver；服务端注册表按它过滤——客户端版本低于此值时该发布被挡住并回退到更旧的可用版本。 |
| `pluginApi` | integer | Python 插件 API 大版本；宿主启动时握手校验，宿主支持版本低于此值时拒启。当前为 `1`。 |

## `platforms`

`platforms` 的键 = **`{OS}-{ARCH}`**，值是一个 `{ "artifacts": [ … ] }` 包。

- 平台键示例：`linux-x86_64` / `windows-x86_64` / `macos-aarch64` …（`OS` 与 `ARCH` 取自
  Rust 的 `std::env::consts`）。
- 特殊键 **`"*"` = 平台无关制品**：纯 Python / 纯贡献插件一个 tar 全平台通用，这是 CI 发布的
  标准形态（发布器把打包好的 package 注入 `platforms["*"]`）。
- 解析顺序：**精确平台键优先，缺则回退 `"*"`**；两者可并存（如 `"*"` 放 Python 代码包、各
  平台键放二进制工具）。既无精确键也无 `"*"` 的平台显示"当前平台不可用"。
- 侧载还允许 `"platforms": {}`（零制品纯声明）；注册表发布因服务端要求非空，用 `"*"`。

### 制品 `artifacts[]`

```jsonc
{
  "role": "package",              // "tool"(缺省) | "package"
  "name": "esp32-files",
  "version": "1.2.0",
  "url": "https://…/esp32-files.tar.gz",
  "sha256": "…",
  "size": 1200000,
  "strip_components": 1,
  "tools": [ { "id": "esptool", "path": "bin/esptool" } ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `role` | enum | 否 | `tool`（缺省）进共享池 `tools/<name>/<version>/`，跨插件按版本去重复用；`package` 是插件自身文件包（Python 代码 / SVD / cfg / UI 资产），解压到 `plugins/<id>/<version>/files/`，随插件版本目录一起 GC，不共享。 |
| `name` | string | 是 | 制品池目录名（如 `arm-none-eabi-gcc`）。 |
| `version` | string | 是 | 制品版本（决定池中并排目录）。 |
| `url` | string | 是 | 下载地址（tar.gz）。 |
| `sha256` | string | 否† | 内容校验。**服务端注册表强制**；侧载可省略（跳过校验并记警告）。 |
| `size` | integer | 否 | 字节数，用于聚合进度条与安装前体积展示，尽量填。 |
| `strip_components` | integer | 否 | 解压时剥离的顶层目录层数。xPack 原包顶层是 `xpack-…-<ver>/`，标 `1` 剥掉。缺省 `0`。 |
| `tools` | array | 否 | 该制品向工具链解析暴露的可执行入口，见下。 |

> 命名约定：早期字段保持 snake_case（`strip_components`）；后加的多词字段一律 camelCase
> （`displayName` / `requiredTools` / `svdPool` / `defaultFlashBackend`）。

### `tools[]`

```jsonc
{ "id": "esptool", "path": "bin/esptool" }
```

| 字段 | 说明 |
|---|---|
| `id` | 工具 id，`${tool:ID}` 变量与 `ctx.tool("id")` 按它解析。 |
| `path` | 相对制品池目录的可执行文件路径，`/` 分隔。Windows 上无扩展名时自动补 `.exe`。 |

### 制品打包规则

1. **一律 tar.gz**（含 Windows）——客户端只带 gzip+tar 解压器。
2. xPack 原包顶层是 `xpack-…-<ver>/`，用 `strip_components: 1` 剥掉。
3. **Windows 包不得含符号链接**（普通用户权限解压会失败）：从 zip 源转打包或用
   `--dereference` 物化。Linux/macOS 保留符号链接与执行位。
4. `sha256` 为强制校验，镜像后重算填入。

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

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `entry` | string | 是 | 入口模块路径（相对 files 根）。`import caw_plugin` 并用 `@caw.handler` 注册处理器。 |
| `apiVersion` | integer | 否 | 宿主握手校验（宿主支持版本低于此值时拒启）。当前 `1`。 |
| `dependencies` | string | 否 | 锁文件路径（相对 files 根）。**有此字段才为插件建独立 venv 并 `pip install`**；无则用系统/制品 `python3`。 |
| `activation` | string[] | 否 | 懒激活事件：`onTask:<task>` / `onCommand:<id>` / `onChip:<glob>` / `"*"`。 |
| `permissions` | string[] | 否 | 权限声明。**当前只存储不强制**（社区 tier 上线时宿主按此拒绝越权 RPC）。 |

宿主的执行模型、`ctx` 与 SDK 见 [Python 宿主 API](python-host.md)。

## 前向兼容（未知字段策略）

- **贡献点**：已知键强校验（形状错 = 硬报错，清单真写错要立刻暴露）；**未知键**原样收进
  内部 `unknown`，插件详情页提示"含当前版本不支持的能力"，重新序列化（固化 LocalManifest）
  时原文写回不丢——这是旧 App 装新插件的降级路径。
- **任务步骤 kind**：未知 `kind` 容错收进 `unknown_kinds`，其余步骤照常解析，执行到该步骤
  时才报"需要新版本 Caw Studio"。

因此发布带新字段的插件不会让旧客户端整体解析失败——只是新能力在旧端不可用。

## 相关

- [贡献点总览](contributes.md)
- [Python 宿主 API](python-host.md)
- [版本与兼容性](versioning.md)
