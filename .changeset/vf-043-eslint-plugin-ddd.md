---
'@vytches/eslint-plugin-ddd': minor
---

feat(eslint-plugin-ddd): new flat-config ESLint plugin with a DDD role model and
an agent feedback lane (VF-043)

Published as a normal release; the API is `@beta` (names and options may still
change in a minor until two consumers have built on it). Known limitation shared
with the other packages: declaration files use extension-less relative imports,
so strict `node16`/`nodenext` type resolution with `skipLibCheck: false` reports
errors; runtime is unaffected.

**Main entry (`@vytches/eslint-plugin-ddd`):** named exports only: `plugin`,
`rules`, `configs` (`recommended`), `meta`, plus the `@beta` helpers
`resolveRole`, `roleScoped` and `validateRoleConfig`. No default export, no
eslintrc preset (flat config only; peer `eslint` `^9.39.0 || ^10.0.0`).

**Subpath `@vytches/eslint-plugin-ddd/agent`:** `createAgentLinter` with
`lintText(text, filePath)` and `newFindings(before, after)` for project hooks.
The library only returns findings; deciding whether to deny or block stays with
the consumer's hook.

The package has no runtime `dependencies`; `@typescript-eslint/parser` is an
optional peer.
