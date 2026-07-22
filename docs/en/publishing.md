# Packaging & Publishing

Sideloading is enough for development (see [Your First Plugin](quickstart.md)). To make your
plugin visible in the marketplace on every CAW Studio client — one-click install, auto-upgrade —
publish it to the registry. **The recommended path is GitHub Actions, publishing on a git tag.**

> Publishing is currently official-only (tokens with the `publish_plugin` scope). Community
> self-publishing is on the roadmap, see [Overview](overview.md#capability-boundaries-current-version).

## Repo skeleton

The skeleton of a repo that auto-publishes (this page lists every file's contents in full — copy
them to reproduce the official template):

```
manifest.json                     plugin declaration
python/main.py                    Python entry
i18n/                             language packs
scripts/publish.py                publisher (shared by CI and local, zero third-party deps)
.github/workflows/publish.yml     auto-publish on tag
.cawignore                        (optional) packaging exclude rules, fnmatch, one per line
```

## One-time setup

Configure in the plugin repo's **Settings → Secrets and variables → Actions**:

| Type | Name | Value |
|---|---|---|
| Secret | `CAW_TOKEN` | Create in the registry console under "API tokens" with the `publish_plugin` scope |
| Variable | `CAW_SERVER` | Registry address (optional, defaults to `https://api.noxcaw.com`) |

## Publishing

Bump `version` in `manifest.json`, commit, then push a tag to publish:

```bash
# 1. bump manifest.json version (e.g. 0.2.0), commit
# 2. push a tag -- CI auto-packages, uploads, and creates the release
git tag v0.2.0 && git push origin v0.2.0

# beta channel (only visible when the client's "Beta channel" switch is on):
git tag v0.2.0-beta && git push origin v0.2.0-beta
```

- After stripping the leading `v`, the tag must **strictly match** the manifest `version` (three
  numeric segments `X.Y.Z`), or CI fails outright — this prevents publishing the wrong version
  when the tag and repo content drift apart.
- A `-beta` suffix on the tag → publishes to the **beta channel**.

You can also publish manually from your machine:

```bash
CAW_SERVER=https://api.noxcaw.com CAW_TOKEN=xxx python scripts/publish.py --version 0.2.0
```

## What the workflow looks like

`.github/workflows/publish.yml`:

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

## What the publisher does

`scripts/publish.py` (pure stdlib, runs locally too):

1. **Reads the manifest and validates the version**: `--version` (passed from the tag by CI) must
   match `manifest.json`'s `version`, or it fails.
2. **Deterministic packaging**: packs the repo files into a tar.gz with **all tar-entry and gzip
   mtimes zeroed and uid/gid zeroed** — identical content yields an identical hash, so the
   content-addressed registry can **dedupe** by `sha256` (re-publishing the same version does not
   re-upload). It excludes `.git` / `.github` / `scripts` / `__pycache__` / `*.pyc` /
   `node_modules` / `.DS_Store` etc. by default; `.cawignore` can add fnmatch rules (one per
   line, `#` starts a comment).
3. **Content-addressed upload**: `upload_init` (with sha256, deduped if already present) → R2
   presigned PUT → `upload_complete`.
4. **Injects `platforms["*"]`**: writes the packaged package artifact into the manifest's
   `platforms["*"]` (platform-independent, works everywhere); **platform-specific artifacts** the
   author declared in the manifest are **kept as-is**.
5. **Upserts the plugin entry + creates the release** (stable, or beta when the version has a
   `-beta` suffix).

## Why deterministic packaging matters

The same source produces byte-identical tar.gz on any machine at any time → identical `sha256` →
the registry recognizes it as an existing artifact and skips the upload. This means re-publishes,
CI reruns, and multi-person collaboration produce no redundant uploads, and it is what makes the
"content-addressed, download-on-demand" upgrade model work.

## Plugins that carry binary tools

If your plugin is not just Python/declarations but also distributes platform-specific binaries
(e.g. a flash tool for some chip), declare artifacts under the corresponding platform keys in the
manifest:

```jsonc
"platforms": {
  "linux-x86_64":  { "artifacts": [ { "name": "esptool", "version": "4.8.1", "url": "…",
                                      "sha256": "…", "tools": [{ "id": "esptool", "path": "bin/esptool" }] } ] },
  "windows-x86_64": { "artifacts": [ /* … */ ] }
}
```

The publisher only injects the `platforms["*"]` package and **does not touch** these
platform-specific keys. Packaging rules (always tar.gz, no symlinks on Windows,
`strip_components`, mandatory `sha256`) are in
[Manifest Reference · Artifact packaging rules](manifest.md#artifact-packaging-rules).

## Server contract (for reference)

- Publishing uses public APIs (`/console/plugins*`, Bearer token auth): `upload_init` → R2 PUT →
  `upload_complete` → `POST /console/plugins` (upsert entry) → `POST /console/plugins/releases`
  (create release).
- Server-side publish validation: `schemaVersion = 1`, `engines.app` parses as semver, no
  escaping relative paths, in-section id format and dedup, a `python` block requires a `package`
  artifact, an unknown step kind is a warning (not rejected).
- Client fetch: `GET /api/plugins/index?app=<version>&channel=stable|beta`. Per plugin it takes
  the **highest** version where status ∈ the allowed set × `min_app_version ≤ app` × artifact not
  purged (version fallback).

## Related

- [Versioning & Compatibility](versioning.md) — schemaVersion policy, beta channel, compat matrix
- [Manifest Reference](manifest.md)
