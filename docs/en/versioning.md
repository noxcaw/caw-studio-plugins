# Versioning & Compatibility

This covers three layers of versioning: the manifest **contract** version (`schemaVersion`), the
Python **host API** version (`pluginApi`), and the plugin's **own** version (`version`), plus the
beta channel and the compatibility matrix.

## Three version numbers

| Version | Field | Meaning |
|---|---|---|
| Contract version | `schemaVersion` | The manifest structure contract. Current baseline **`1`**. |
| Host API | `engines.pluginApi` / `python.apiVersion` | Python host handshake major version. Current **`1`**. |
| Plugin version | `version` | Your plugin's iteration version, semver `X.Y.Z`. |
| Minimum app | `engines.app` | The minimum CAW Studio version required to run the plugin. |

## `schemaVersion` policy

- Defaults to `1`; the only valid value today is `1`. The plugin system has **never shipped a
  historical version**, so there is no pre-`2` compatibility baggage.
- Only a **breaking** structural change would introduce `schemaVersion: 2`. Non-breaking added
  fields / new contribution points are handled by the "unknown-field tolerance" mechanism for
  forward compatibility (below) and do **not** bump `schemaVersion`.

## Forward compatibility (old app installing a new plugin)

The contract is designed so that "adding capabilities never breaks old clients":

- **Unknown contribution keys**: collected verbatim into `unknown`, the rest of the contributions
  work as usual, the detail page hints "contains capabilities not supported by this version"; they
  are written back verbatim on freeze with no loss.
- **Unknown task step kinds**: collected into `unknown_kinds`, other steps work as usual, and only
  when execution reaches that step does it report "update Caw Studio".
- **Malformed known keys**: a hard error (a genuinely broken manifest must surface immediately,
  not silently).

So you can safely use new fields — older clients simply cannot use the new capabilities; they do
not fail parsing outright.

## `engines.app` and version fallback

`engines.app` is the minimum app version required to run the plugin. The server registry filters
on it and performs **version fallback**:

- the client fetches `GET /api/plugins/index?app=<version>&channel=…`;
- for each plugin only releases with `min_app_version ≤ app` are surfaced, taking the **highest**
  qualifying version;
- if the highest version is blocked by the app version, it falls back to an older version the
  current app can run;
- when an old client sends no `app` parameter, only releases with an empty `min_app_version` (no
  version constraint) are surfaced.

So set a sensible `engines.app`: if you use a capability that only exists from some version,
declare it, and old clients automatically get a runnable older version instead of an error.

## Beta channel

- Adding a `-beta` suffix when tagging (`v0.2.0-beta`) → publishes to the **beta channel**.
- The client's Plugins page has a **"Beta channel" switch**; by default only stable is shown. When
  on, `channel=beta` and the registry surfaces both stable + beta (taking the highest of the two).
- A `yanked` release **never** appears in any channel.

Use the beta channel for staged rollout: publish `-beta` first for early adopters to validate,
then publish the same version as stable once it is solid.

## Auto-update

- The source of truth for versions is the **server registry**; the local `installed.json` records
  the installed version, and the Plugins panel offers an "Update" button based on the diff.
- After startup permission, the background `plugin_auto_update` upgrades, one by one, plugins that
  are installed × enabled × `auto_update` × platform-supported and have a newer registry version:
  - semantic comparison, **upgrade-only**; malformed versions degrade to "different means update";
  - silently skipped when the registry is unreachable.
- Upgrade cost is naturally minimal: the artifact pool is content-addressed by `name/version`, so
  only changed artifacts are downloaded; old version dirs are cleaned as the ledger switches, and
  the pool GCs unreferenced artifacts.
- The user's enable/disable, `auto_update` choice, and `settings.json` are **preserved** across
  upgrades.

## Compatibility matrix

| Scenario | Behavior |
|---|---|
| Minimal manifest (artifact fields only) × new app | All extended fields have defaults, zero migration |
| Future new fields × old app | Unknown contributions → `unknown`, unknown steps → `unknown_kinds`, the rest as usual; detail page hint |
| Old app × registry | index without an `app` parameter → only releases with no `min_app_version` constraint |
| New app × registry | `?app=<version>&channel=stable` → server filter + version fallback (highest qualifying version) |

## Recommendations

- Each release: **bump `manifest.json`'s `version` first, then tag with the same number** (a
  mismatch fails CI outright).
- If you use a capability that only exists from some app version, set `engines.app` to that
  version.
- Roll out big changes via `-beta` first, then publish stable.
