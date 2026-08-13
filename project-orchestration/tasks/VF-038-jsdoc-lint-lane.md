# Task: Give docstring quality its own lint lane (and stop pretending we have one)

## Task Metadata

```yaml
task_id: VF-038
title:
  'docs: wire up or delete .eslintrc-jsdoc.json, and clear the 61 TSDoc warnings
  that VF-037 had to silence in the api-surface gate'
type: chore
priority: medium
complexity: low
estimated_time: 4h
created_by: VF-037
created_at: 2026-08-12
status: backlog
updated_at: 2026-08-12
release_target: before first non-alpha tag
package:
  "'@vytches/ddd-contracts', '@vytches/ddd-events', '@vytches/ddd-value-objects'"
findings: [VF-037 AC-GATES]
```

## Why

VF-037 revived the api-surface drift gate. Doing so surfaced two facts that are
each other's mirror image:

**1. `.eslintrc-jsdoc.json` exists and is wired to nothing.** It declares a
`jsdoc` plugin and a rule set (`jsdoc/require-jsdoc`, `jsdoc/check-tag-names`,
…), but `grep` finds no reference to it from any ESLint config, any Nx target or
any CI step, and `eslint-plugin-jsdoc` is not in `package.json` at all. It
cannot have run since it was written. This is the same failure mode VF-037 spent
its whole budget on: a control that reports nothing because it was never
invoked, and that reads to a newcomer as "we check this".

**2. There are 61 TSDoc warnings that VF-037 had to silence.** In comparison
mode api-extractor exits non-zero on _any_ warning, not just on report drift —
measured on `value-objects` against a byte-identical baseline: exit 1 from
docstring warnings alone. Counts at the time of measurement: contracts 35,
events 16, value-objects 10, enterprise 0.

Most of them are one shape. TSDoc, unlike JSDoc, treats `{` as the start of an
inline tag, so the ordinary `@throws {SomeError} if …` form produces two
warnings (`tsdoc-malformed-inline-tag`, `tsdoc-escape-right-brace`):

```ts
/**
 * @returns EntityId instance
 * @throws {MissingValueError} if value is empty     // ← two warnings
 */
static fromUUID(value: string): EntityId<string>;
```

The rest are `tsdoc-param-tag-missing-hyphen` and `ae-unresolved-link` (a
`{@link X}` naming a symbol the target package does not export).

VF-037 silenced `tsdocMessageReporting` and `ae-unresolved-link` in the new
`api-extractor.base.json` — deliberately, and documented there. The gate must
have exactly one failure mode (the public API shape drifted), because a gate
that fires for things the reader cannot act on is a gate that gets `|| true`-ed
back to death, which is literally how the previous generation of it died. But
silencing is not the same as fixing, and the signal should live _somewhere_.

## Acceptance Criteria

1. [ ] **AC-LANE — decide and act on `.eslintrc-jsdoc.json`.** Either wire it
       into the real lint pipeline (install `eslint-plugin-jsdoc` and/or
       `eslint-plugin-tsdoc`, reference it from the ESLint config used by the
       `lint` target, land it as **non-blocking** first) or delete it. A dead
       config is worse than no config. If wiring it up: TSDoc syntax rules must
       be enforced by `eslint-plugin-tsdoc`, since `eslint-plugin-jsdoc` accepts
       the `@throws {Type}` form that api-extractor rejects — otherwise the lint
       lane and the extractor disagree and neither is trustworthy.
2. [ ] **AC-CLEAR — clear the warnings at source.** Convert `@throws {X} desc`
       to `@throws X - desc` (or escape the braces), add the missing hyphens
       after `@param` names, and fix or remove the unresolved `{@link}` targets.
       Docstrings are part of the DX surface a consumer sees in their IDE, so
       prefer rewriting to a form that reads well, not the minimal escape.
3. [ ] **AC-VERIFY — prove it with the tool, not by eye.** Temporarily restore
       `tsdocMessageReporting.default.logLevel` to `warning` and
       `ae-unresolved-link` to `warning` in `api-extractor.base.json`, run
       `pnpm validate:api`, and confirm it exits zero. Record the before/after
       warning counts in the outcome.
4. [ ] **AC-DECIDE — then choose, explicitly, whether the silencing stays.**
       Once the warnings are gone, leaving the levels at `none` still protects
       the gate's single-failure-mode property against the 62nd warning arriving
       next week; raising them makes the gate enforce docstring quality too, at
       the cost of re-coupling two signals. State the choice and the reason in
       `api-extractor.base.json`, replacing the current comment that points
       here.

## Non-goals

- Writing new documentation. This is about the syntax of docstrings that already
  exist, not about coverage.
- Re-opening the api-surface gate design. VF-037 settled that; this task either
  feeds it clean input or leaves it alone.

## Links & References

- `api-extractor.base.json` — the two silenced message families and why
  (VF-037).
- `project-orchestration/tasks/VF-037-cross-context-isolation-regression-suite.md`
  — AC-GATES, where this was found.
- `project-orchestration/release-process.md` — "API surface baselines — the two
  commands", which documents the gate this task must not break.
- `.eslintrc-jsdoc.json` — the dead config.
