# 芯片支持包（chips）

`contributes.chips` 让插件扩展应用识别的芯片：给定芯片名或项目特征，解析出 OpenOCD target、
SVD 文件、默认烧录后端与所需工具集。应用内置了 STM32 17 个家族的同构声明，插件可覆盖它们，
也可新增（如 ESP32、nRF）。

## 结构

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

## 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 芯片家族标识（如 `stm32f1` / `esp32`），节内唯一；resolve 时也按 id 精确匹配。 |
| `displayName` | string | 否 | 展示名。 |
| `match` | object | 是 | 匹配规则，见下。 |
| `openocd` | object | 否 | `{ "target": … }`。`None` = 该家族不走 OpenOCD（用其它烧录后端）。 |
| `svd` | string | 否 | SVD 文件路径（相对 files 根，插件自带文件直指）。 |
| `svdPool` | string | 否 | SVD 制品池目录名（在 `tools/<名>/<版本>/**` 里按芯片名 stem 匹配）。与 `svd` 二选一，内置 STM32 声明专用；插件一般用 `svd` 直指。 |
| `defaultFlashBackend` | string | 否 | 缺省烧录后端：`openocd` / `probe-rs` / `python:<handler>`。`None` = 沿用内置启发式。 |
| `requiredTools` | string[] | 否 | 该家族构建所需工具 id 集，工具链状态面板据此检查。 |

### `match`

```jsonc
"match": {
  "chip": ["STM32F1*", "STM32F103*"],
  "project": { "files": ["*.ioc", "sdkconfig"], "parser": "cubemx-ioc" }
}
```

| 字段 | 说明 |
|---|---|
| `chip` | 芯片名/家族 glob 数组。**大小写不敏感**，`*` 通配任意序列（含零长）。`?` 不是通配符。例：`STM32F1*` 匹配 `STM32F103C8Tx` 与 `stm32f1`。 |
| `project` | 无芯片名上下文时按项目特征文件识别，见下。 |

### `match.project`

| 字段 | 说明 |
|---|---|
| `files` | 项目根下的特征文件名（支持 `*` 通配，如 `*.ioc` / `sdkconfig`）。命中即认为"这是该家族的项目"。 |
| `parser` | 元数据解析器：`cubemx-ioc`（内置，解析 `.ioc` 取 Mcu 名）或 `python:<handler>`（宿主执行的自定义探测）。 |

### `openocd.target`

字符串，两种解释：

- **含 `/` 或以 `.cfg` 结尾** → 插件自带的 cfg 文件（相对 files 根），如 `cfg/esp32.cfg`；
- 否则 → OpenOCD **内置 target 名**（不含 `target/` 前缀与 `.cfg` 后缀），如 `stm32f1x`。

## 匹配与覆盖顺序

resolve 一颗芯片时的查找顺序：

1. **已启用插件**（按插件 id 字典序）——插件可覆盖内置定义；
2. **内置** STM32 声明。

同一插件内按 `chips` 数组顺序。因此若两个插件都声明了 `STM32F1*`，id 字典序靠前的插件胜出。

## 驱动的运行时行为

- **OpenOCD target 解析**：调试与烧录会话据 `openocd.target` 生成 OpenOCD 配置。
- **SVD 定位**：外设寄存器面板按 `svd` / `svdPool` 找 SVD；项目自带的 `.caw-studio/*.svd`
  仍最优先。
- **工具链状态检查**：工具链面板对匹配芯片的 `requiredTools` 逐项检查是否可解析。
- **烧录后端默认值**：`defaultFlashBackend` 参与烧录后端选择链（见[嵌入式任务](tasks.md)）。
- **非 CubeMX 项目识别**：无 `.ioc` 时按 `match.project.files` 探测，认出该家族的项目。

## 最小示例

`hello-contribs` 示例里的芯片声明——无 SVD、直接复用内置 OpenOCD target：

```jsonc
{
  "id": "demo-chip",
  "displayName": "Demo Chip",
  "match": { "chip": ["DEMO*"] },
  "openocd": { "target": "stm32f4x" },
  "requiredTools": ["arm-none-eabi-gcc", "cmake", "ninja"]
}
```

侧载后，凡芯片名匹配 `DEMO*` 的项目即可解析出 target cfg。
