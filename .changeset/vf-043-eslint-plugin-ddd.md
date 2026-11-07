---
'@vytches/eslint-plugin-ddd': minor
---

feat(eslint-plugin-ddd): new flat-config ESLint plugin with a DDD role model and
an agent feedback lane (VF-043)

The package is `private: true` during Phase 1, so nothing is published to npm
until the flag is removed as a separate, deliberate step (after dogfooding and
after CI runs `publint` and `attw`). Its API is `@beta`.

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
