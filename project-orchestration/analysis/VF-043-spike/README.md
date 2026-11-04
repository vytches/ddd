# VF-043 Phase 0 spike code (reference only)

Throw-away prototypes from the Phase 0 spikes of
[VF-043](../../tasks/VF-043-eslint-plugin-ddd-agent-feedback-lane.md). Not a
package, not built, not linted, not part of any public API. Phase 1 rebuilds
this properly in `packages/eslint-plugin-ddd`. Results and conclusions are in
the task's "Spike log" sections.

| File                         | What it is                                                                                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proto/role-resolver.js`     | `createRoleResolver({cwd, paths, baseUrl, bindings})`: classifies classes into roles by import source (package, relative path, tsconfig `paths`, barrel re-exports up to depth 6) plus `validate()` for missing binding files |
| `proto/plugin.js`            | `roleScoped(baseRule, {roles, resolver})` wrapper (skips files with no class of a role, keeps only reports inside role class ranges) and three sample rules                                                                   |
| `proto/run.js`               | Read-only runner against a consumer checkout: role statistics, timing, hit counts. Usage: `node run.js <consumer-root> [one-file]`. Library bindings are at the top; project bindings are placeholders to adapt               |
| `hook/post-edit-lint.js`     | Agent-hook probe, inert unless `VF043_SPIKE=1`. Modes via `VF043_MODE`: `inject`, `shadow`, `block`, `deny`                                                                                                                   |
| `hook/settings.example.json` | Hook registration for `claude -p --settings <file> --setting-sources user`. Replace `<ABSOLUTE_PATH_TO>`                                                                                                                      |

Caveats: `proto/*.js` resolve ESLint and `@typescript-eslint/parser` from this
repository's `node_modules` via a hard-coded `createRequire` path. The hook
detects one sample rule (`throw new *Error` in `*/domain/*.ts`). Never register
the hook in shared or project settings; use `--settings` only.
