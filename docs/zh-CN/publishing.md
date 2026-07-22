# 打包与发布

开发调试用侧载即可（见[创建第一个插件](quickstart.md)）。要让所有 CAW Studio 客户端在插件
市场看到你的插件、一键安装、自动升级，就要发布到注册表。**推荐用 GitHub Actions 打 tag
自动发版。**

> 当前发布仅限官方（`publish_plugin` scope 的 token）。社区自助发布在路线图上，见
> [概述](overview.md#能力边界当前版本)。

## 仓库骨架

一个可自动发布的插件仓库（模板见应用附带的 `examples/plugin-template/`）：

```
manifest.json                     插件声明
python/main.py                    Python 入口
i18n/                             语言包
scripts/publish.py                发布器(CI 与本地共用,零第三方依赖)
.github/workflows/publish.yml     打 tag 自动发布
.cawignore                        (可选)打包排除规则,fnmatch 一行一条
```

## 一次性配置

在插件仓库 **Settings → Secrets and variables → Actions** 配置：

| 类型 | 名 | 值 |
|---|---|---|
| Secret | `CAW_TOKEN` | 注册表 console 后台「API tokens」创建，勾 `publish_plugin` scope |
| Variable | `CAW_SERVER` | 注册表地址（可省，缺省 `https://api.noxcaw.com`） |

## 发布

改 `manifest.json` 的 `version`，提交，打 tag 推送即发版：

```bash
# 1. 改 manifest.json 的 version(如 0.2.0),提交
# 2. 打 tag 推送 —— CI 自动打包上传并创建发布
git tag v0.2.0 && git push origin v0.2.0

# beta 渠道(客户端插件页开 "Beta 渠道" 开关才可见):
git tag v0.2.0-beta && git push origin v0.2.0-beta
```

- tag 去掉前导 `v` 后必须与 manifest 的 `version` **严格一致**（`X.Y.Z` 三段数字），否则 CI
  直接失败——防 tag 与仓库内容漂移发错版。
- tag 带 `-beta` 后缀 → 发进 **beta 渠道**。

也可本地手动发：

```bash
CAW_SERVER=https://api.noxcaw.com CAW_TOKEN=xxx python scripts/publish.py --version 0.2.0
```

## workflow 长什么样

`.github/workflows/publish.yml`：

```yaml
name: publish
on:
  push:
    tags: ["v*"]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Publish to CAW plugin registry
        env:
          CAW_SERVER: ${{ vars.CAW_SERVER || 'https://api.noxcaw.com' }}
          CAW_TOKEN: ${{ secrets.CAW_TOKEN }}
        run: python scripts/publish.py --version "${GITHUB_REF_NAME#v}"
```

## 发布器做了什么

`scripts/publish.py`（纯 stdlib，本地也能跑）：

1. **读 manifest 并校验版本**：`--version`（CI 从 tag 传入）与 `manifest.json` 的 `version`
   必须一致，否则失败。
2. **确定性打包**：把仓库文件打成 tar.gz，**tar 条目与 gzip 头的 mtime 全部归零、uid/gid
   归零**——同内容必同哈希，注册表按 `sha256` 内容寻址即可**秒传**命中（重发同版不重复上传）。
   默认排除 `.git` / `.github` / `scripts` / `__pycache__` / `*.pyc` / `node_modules` /
   `.DS_Store` 等；`.cawignore` 可追加 fnmatch 规则（一行一条，`#` 开头为注释）。
3. **内容寻址上传**：`upload_init`（带 sha256，命中已有则秒传）→ R2 presigned PUT →
   `upload_complete`。
4. **注入 `platforms["*"]`**：把打包好的 package 制品写进 manifest 的 `platforms["*"]`（平台
   无关，全平台通用）；作者在 manifest 里自行声明的**平台专属制品原样保留**。
5. **upsert 插件条目 + 创建发布**（stable，或版本带 `-beta` 走 beta）。

## 确定性打包为什么重要

同一份源码在任何机器、任何时间打出的 tar.gz 字节完全相同 → `sha256` 相同 → 注册表识别为已有
制品，跳过上传。这让重发、CI 重跑、多人协作都不产生冗余上传，也让"内容寻址、按需下载"的升级
模型成立。

## 携带二进制工具的插件

若插件不只是 Python/声明，还要分发平台专属二进制（如某芯片的 flash 工具），在 manifest 里为
对应平台键声明制品：

```jsonc
"platforms": {
  "linux-x86_64":  { "artifacts": [ { "name": "esptool", "version": "4.8.1", "url": "…",
                                      "sha256": "…", "tools": [{ "id": "esptool", "path": "bin/esptool" }] } ] },
  "windows-x86_64": { "artifacts": [ /* … */ ] }
}
```

发布器只注入 `platforms["*"]` 的 package，**不动**这些平台专属键。打包规则（一律 tar.gz、
Windows 无符号链接、`strip_components`、`sha256` 强制）见 [manifest 参考 · 制品打包规则](manifest.md#制品打包规则)。

## 服务端契约（了解即可）

- 发布走公开 API（`/console/plugins*`，Bearer token 鉴权）：`upload_init` → R2 PUT →
  `upload_complete` → `POST /console/plugins`（upsert 条目）→ `POST /console/plugins/releases`
  （建发布）。
- 服务端发布校验：`schemaVersion = 1`、`engines.app` 可解析为 semver、相对路径无逃逸、节内 id
  格式与去重、有 `python` 块时必须有 `package` 制品、未知 step kind 记 warning 不拒绝。
- 客户端拉取：`GET /api/plugins/index?app=<版本>&channel=stable|beta`。每插件按 status ∈ 允许集
  × `min_app_version ≤ app` × 制品未 purge 取**最高**版本（版本回退）。

## 相关

- [版本与兼容性](versioning.md) —— schemaVersion 策略、beta 渠道、兼容矩阵
- [manifest 参考](manifest.md)
