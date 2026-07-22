# caw-studio-plugins

CAW Studio 插件开发文档仓库 —— 官网 [`/docs/plugins`](https://noxcaw.com/docs/plugins) 的内容来源（docs-as-code）。

- `docs/toc.json` 声明目录树，正文按语言放 `docs/zh-CN/`、`docs/en/`，图片放 `docs/images/`。
- push 到 `main` 且改动 `docs/**` 时，GitHub Actions（`.github/workflows/publish-docs.yml`）自动把整棵文档树同步发布到 caw-server 文档站。

目录规范、`toc.json` 字段、本地试跑与接入细节见 caw-server 仓库的
`deploy/docs-sync/README.md`（本仓库的 `scripts/build-sync-json.mjs` 即从那里拷贝）。
