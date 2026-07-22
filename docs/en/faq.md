# FAQ

## Do I have to write Python?

No. A plugin that only writes declarative contributions (chip support packs / command menu text /
settings / i18n) without handlers needs no Python at all. The host process only starts when the
plugin declares a `python` entry and the user triggers a command/task/flash. Of course, a
command's `handler` with no Python entry will report "runtime required" when clicked.

## Do I have to publish every time during development?

No. Use **sideload**: copy a directory containing `manifest.json` into
`~/.caw-studio/plugins/<dir-name>/` and refresh the Plugins panel. Edit the manifest and refresh,
edit Python and invoke the command again. See [Your First Plugin](quickstart.md).

## My sideloaded plugin doesn't show up?

- Make sure the directory has a `manifest.json` with a valid `id` (`^[a-z0-9][a-z0-9-]{1,63}$`).
- Click refresh in the Plugins panel.
- If the manifest has parse errors, the plugin detail page reports them — a malformed known
  contribution (missing required field, wrong type) is a hard error.
- On a **same-id** clash with a registry install, the registry install wins; use a different id or
  uninstall the registry version first.

## `${chip}` / `${tool:ID}` errors?

- `${chip}`: unavailable when the project has no `.ioc` (no Mcu name). Use a chip support pack's
  `match.project` to detect non-CubeMX projects, or avoid depending on `${chip}` in the step.
- `${tool:ID}`: `ID` must be an id declared in some artifact's `tools[].id`, and that tool artifact
  must be installed. A pure-declaration sideloaded plugin that ships no tools naturally cannot
  resolve `${tool:...}` — it relies on a separate toolchain plugin to provide it.

## Why doesn't my edited Python code take effect?

The host lazy-starts per invocation and does not stay resident, so usually re-invoking the command
runs the new code. If the host is still alive (e.g. a webview panel is open holding the process),
**disable then re-enable** the plugin to force a host restart.

## A bool setting reads as a string in `ctx.settings`?

Yes, values in `ctx.settings` are all **strings**. A `bool` setting reads as `"true"`/`"false"`;
test with `ctx.settings.get("my.loud") == "true"`.

## CI says the version mismatches on publish?

The publisher requires the tag (with the leading `v` stripped) to **strictly match**
`manifest.json`'s `version` (`X.Y.Z`). Bump the manifest `version` and commit first, then tag with
the same number. This is a deliberate guard against "publishing the wrong version when tag and
content drift".

## How do I publish a beta?

Tag with a `-beta` suffix (`v0.2.0-beta`). Only users with the "Beta channel" switch on in the
Plugins page can see it. Publish the same version as a stable tag once it is solid. See
[Versioning & Compatibility](versioning.md#beta-channel).

## Does re-publishing the same version re-upload artifacts?

No. The publisher builds a **deterministic tar.gz**; identical content yields the same `sha256`,
and the content-addressed registry recognizes it as an existing artifact and skips the upload.

## Can I self-publish a community plugin?

Not yet. Publishing is official-only (tokens with the `publish_plugin` scope). Artifact signing,
enforcement of `python.permissions`, and opening the community tier are all on the roadmap. You can
always sideload for development/personal use.

## Can a plugin access devices or the filesystem?

The Python host process itself can (it is an ordinary Python process), but the
`python.permissions` field is currently stored, not enforced — reserved for when community
publishing goes live. Webview panels are sandboxed and **cannot** touch devices/filesystem
directly; all side effects must go through a declared command into the host.

## Does uninstalling a plugin delete shared tools?

Only what the plugin exclusively owns. Tool artifacts live in a content-addressed shared pool;
those referenced by other installed plugins are kept, and fresh dirs younger than 1 hour are
exempt (to avoid deleting a concurrent install). Disabling only flips the ledger bit and keeps all
artifacts.

## Will upgrading a plugin lose my settings?

No. Plugin settings live in `plugins/<id>/settings.json`, a sibling of the version dirs; an
upgrade only swaps the version dir, and settings, enable/disable, and the `auto_update` choice are
all preserved.
