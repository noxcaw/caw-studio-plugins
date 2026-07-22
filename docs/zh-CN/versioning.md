# 版本与兼容性

这里讲三层版本：manifest **契约**版本（`schemaVersion`）、Python **宿主 API** 版本
（`pluginApi`）、插件**自身**版本（`version`），以及 beta 渠道与兼容矩阵。

## 三个版本号

| 版本 | 字段 | 含义 |
|---|---|---|
| 契约版本 | `schemaVersion` | manifest 结构契约。当前基线 **`1`**。 |
| 宿主 API | `engines.pluginApi` / `python.apiVersion` | Python 宿主握手大版本。当前 **`1`**。 |
| 插件版本 | `version` | 你的插件迭代版本，semver `X.Y.Z`。 |
| 最低 App | `engines.app` | 运行该插件所需的最低 CAW Studio 版本。 |

## `schemaVersion` 策略

- 缺省按 `1` 解；当前唯一有效值就是 `1`。插件系统**未上架过历史版本**，所以没有 `2` 之前的
  兼容包袱。
- 只有**破坏性**结构变更才会引入 `schemaVersion: 2`。非破坏的新增字段/新贡献点走"未知字段
  容错"机制向前兼容（见下），**不**升 `schemaVersion`。

## 向前兼容（旧 App 装新插件）

契约设计成"新增能力不砸旧端":

- **未知贡献点键**:原样收进 `unknown`,其余贡献照常生效,详情页提示"含当前版本不支持的
  能力";固化时原文写回不丢。
- **未知任务步骤 kind**:收进 `unknown_kinds`,别的步骤照常,执行到该步骤才报"需要新版本
  Caw Studio"。
- **已知键写错**:硬报错(清单真错了要立刻暴露,不静默)。

因此你可以放心用新字段——旧客户端只是用不到新能力,不会整体解析失败。

## `engines.app` 与版本回退

`engines.app` 是运行该插件所需的最低 App 版本。服务端注册表据此过滤,并做**版本回退**:

- 客户端拉 `GET /api/plugins/index?app=<版本>&channel=…`;
- 每个插件只出 `min_app_version ≤ app` 的发布,取满足条件的**最高**版本;
- 若最高版本被 App 版本挡住,回退到更旧的、当前 App 能跑的版本;
- 旧客户端不带 `app` 参数时,只出 `min_app_version` 为空(无版本限制)的发布。

所以给插件设合理的 `engines.app`:用到了某版本才有的能力,就把它标上,老客户端会自动拿到能
跑的旧版而不是报错。

## beta 渠道

- 打 tag 时加 `-beta` 后缀(`v0.2.0-beta`)→ 发布进 **beta 渠道**。
- 客户端插件页有 **"Beta 渠道"开关**;默认只看 stable。开关打开后 `channel=beta`,注册表同时
  出 stable + beta(取两者里的最高版本)。
- `yanked`(下架)状态的发布**永不**出现在任何渠道。

用 beta 渠道做灰度:先发 `-beta` 让愿意尝鲜的用户验证,稳了再发同版号的 stable。

## 自动升级

- 版本真源是**服务器注册表**;本地 `installed.json` 记已装版本,插件面板据差值给"更新"按钮。
- 启动放行后,后台 `plugin_auto_update` 对 已装 × 启用 × `auto_update` × 平台受支持 且注册表
  版本更新的插件逐个触发安装:
  - 语义化比较,**只升不降**;不合式版本退化为"不同即更新";
  - 注册表不可达时静默跳过。
- 升级成本天然最小:制品池按 `名称/版本` 内容寻址,只下载有变化的制品;旧版本目录随登记切换
  清理,池由 GC 回收失引用制品。
- 用户的启用/停用、`auto_update` 选择与 `settings.json` 在升级后**保留**。

## 兼容矩阵

| 场景 | 行为 |
|---|---|
| 精简 manifest(仅制品字段)× 新 App | 全部扩展字段有默认值,零迁移 |
| 未来新字段 × 旧 App | 未知贡献点进 `unknown`、未知 step 进 `unknown_kinds`,其余照常;详情页提示 |
| 旧 App × 注册表 | index 无 `app` 参数 → 只发无 `min_app_version` 限制的版本 |
| 新 App × 注册表 | `?app=<版本>&channel=stable` → 服务端过滤 + 版本回退(取满足条件的最高版本) |

## 建议

- 每次发版**先改 `manifest.json` 的 `version` 再打同号 tag**(不一致 CI 直接失败)。
- 用到某 App 版本才有的能力,就把 `engines.app` 标到那个版本。
- 大改先走 `-beta` 灰度,再发 stable。
