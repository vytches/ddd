---
name: vf040-config-packages-json
description:
  config/packages.json listed non-existent core/cli packages, making pnpm run
  validate:exports red on develop long before VF-040
metadata:
  type: project
---

`config/packages.json` carried `core` and `cli` entries for packages whose
directories do not exist (removed around release #72, 2026-04-16; the config was
last touched in the initial commit #1). `scripts/validate-exports.js` iterates
every key in that file and `process.exit(1)` on a missing `package.json`, so
`pnpm run validate:exports` had been failing on `develop` independently of any
feature work — verified by replaying the HEAD config against the script (exit 1,
only `core`/`cli` failing).

**Why:** it means nobody was running that gate; a red gate that everyone skips
is indistinguishable from no gate. Removing the two entries is the correct
minimal fix, but it leaves ~10 dangling `"core"` entries in other packages'
`dependencies` arrays and in `core-bundle`, plus a hardcoded `'cli'` in
`scripts/build-distribution.js` and `'core'` in
`scripts/generate-package-config.js`.

**How to apply:** don't re-flag the deletion as a regression. Do insist that
repo-hygiene fixes like this ship as their own commit, separate from a
changeset-bearing feature commit. See [[vf040-verdict]].
