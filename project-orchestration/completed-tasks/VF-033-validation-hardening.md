# Task: Validation hardening & one validation story

## Task Metadata

```yaml
task_id: VF-033
title:
  'validation/testing: CoreRules null/undefined coercion bugs, .and() error
  collapsing, async combinator no-short-circuit, ValidationError.code for i18n,
  ONE documented validation decision tree, BusinessRuleValidator name collision'
type: bug
priority: normal
complexity: medium
estimated_time: 6h
created_by: LIB-UX-AUDIT-2026-07-10
created_at: 2026-07-10
status: done
completed_at: 2026-08-23
release_target:
  post-first-publish OK, except AC2/AC4 shape decisions preferred pre-publish
package: "'@vytches/ddd-validation', '@vytches/ddd-testing'"
findings: [UX-C11, UX-C12, UX-C17, UX-T5.7, UX-T2.7]
depends_on: VF-031 (AC6 — decision whether CoreRules layer is kept at all)
```

## Why

1. **UX-C11 (HIGH, in currently-unused API):** `CoreRules.minLength`
   (`rules-registry.ts:71-78`) does `String(value[property]).length` —
   `String(undefined)` is `"undefined"` (9 chars), so `minLength(prop, 3)`
   **passes on a missing field**. `CoreRules.range` (`:94-104`) does
   `Number(value[property])` — `Number(null) === 0`, so `range('age', 0, 150)`
   **accepts `age: null`**. No `typeof` guards anywhere; nothing enforces
   composing `required()` first. (If VF-031 deletes CoreRules, this AC voids —
   the bugs die with the code.)
2. **UX-C12 (MEDIUM):** `BusinessRuleValidator.and()`
   (`business-rule-validator.ts:242-249`) collapses the composed validator's
   per-field errors into one generic `''`-property / "Failed combined
   validation" error — losing which field failed. `Validation.combine()`
   (`validation-facade.ts:31-52`) flattens correctly; two combinators, opposite
   guarantees. The existing test only asserts `errors.length >= 1`, so the
   regression is invisible.
3. **UX-C17 (MEDIUM):** `AndAsyncSpecification`/`OrAsyncSpecification`
   (`async-composite-specification.ts:100-157`) always `Promise.all` both
   branches — no short-circuit; a side-effecting/metered right branch always
   executes. Documented only as a "hidden feature" footnote in LLMGUIDE, not in
   the API docs.
4. **UX-T5.7:** three parallel validation stories with no decision tree —
   contracts `IValidator` (Result), `BaseValueObject.validate(): boolean`
   (declared, called by nothing until VF-023 F-C1 lands), ad-hoc `LibUtils` +
   throw in `EntityId`. A consumer cannot answer "where do I validate what".
5. **UX-T2.7:** `packages/testing/src/seeder/value-object-builder.ts:13`
   declares a local type literally named `BusinessRuleValidator` that is
   structurally incompatible with validation's class of the same name; the same
   file re-implements `CoreRules`' email regex independently (`:662`).
6. `ValidationError` has no `code` field — i18n consumers must string-match
   `message` or hand-stuff `context`; no machine-readable error identity.

## Acceptance Criteria

1. [x] **UX-C11:** IF CoreRules survives VF-031 AC6 — `typeof` guards in
       `minLength`/`maxLength`/`range` (fail on missing/null/NaN, no string/
       number coercion of absent values) + edge-case tests
       (null/undefined/NaN/unicode). IF deleted — mark AC void, reference the
       VF-031 decision.
2. [x] **UX-C12:** `.and()` preserves sub-validator errors (flatten like
       `Validation.combine()`) OR is renamed/documented as boolean-AND with
       intentional error discard; test asserts error **content** (property +
       message), not just count.
3. [x] **UX-C17:** short-circuit async AND/OR variants added, or the
       both-branches-always-run behavior documented in the class JSDoc (main API
       doc, not the LLMGUIDE footnote).
4. [x] `ValidationError` gains optional `code?: string` (BC-safe constructor
       extension); surviving built-in rules emit stable codes (`'required'`,
       `'min_length'`, `'range'`, …).
5. [x] **UX-T5.7:** a "where do I validate what" decision tree published (VO
       constructor invariant → typed error or Result factory; cross-field rule →
       `BusinessRuleValidator`+Result; reusable predicate → Specification;
       cross-context policy → policies) — one doc, linked from validation,
       value-objects and policies LLMGUIDEs; pairs with VD-005 AC7
       (Specification vs Policy guide) and must align with VF-023 AC1's
       `BaseValueObject.validate` decision.
6. [x] **UX-T2.7:** testing's local `BusinessRuleValidator` type renamed (e.g.
       `SeederRuleFn`); duplicated email regex replaced with a shared util or an
       explicit reference to the same constant.

## Out of scope

- Deleting/deprecating the unused validation layer — VF-031 AC6 (this task
  executes on whatever survives).
- `BaseValueObject` constructor validation itself — VF-023 AC1 (this task only
  aligns the documented story with that decision).
- Internal `export *` barrels in validation submodules — VF-024/VF-031 window.

## References

- Analysis: `project-orchestration/analysis/LIB-UX-AUDIT-2026-07-10.analysis.md`
  (UX-C11, UX-C12, UX-C17, themes T2/T5)
- VF-031 (surface diet — gating decision), VF-023 (VO validate), VD-005 AC7.

## Outcome (2026-08-23)

All six criteria met. VF-031 AC6 confirmed `RulesRegistry`/`CoreRules` as a
permanent, first-class path (not legacy), so AC1 executed rather than voiding.

- **AC1:** `CoreRules.minLength`/`.maxLength` now require
  `typeof value === 'string'`; `.range` requires
  `typeof value === 'number' && !isNaN(value)`. No more `String(undefined)` →
  `"undefined"` or `Number(null)` → `0` coercion. Edge-case tests added for
  null/undefined/NaN, plus a unicode regression test confirming legitimate
  strings still pass.
- **AC2:** `BusinessRuleValidator.and()` rewritten to flatten both validators'
  errors (own rules + `other`'s) instead of collapsing to one generic
  `''`/"Failed combined validation" error — matches `Validation.combine()`'s
  guarantee. Test now asserts error **content** (property + message for both
  sides), not just `errors.length >= 1`.
- **AC3:** Documented (not behavior-changed) — `AndAsyncSpecification`/
  `OrAsyncSpecification` classes and `AsyncCompositeSpecification.and()`/
  `.or()` gained JSDoc explicitly stating both branches always run via
  `Promise.all`, no short-circuit. Chose documentation over adding a
  short-circuit variant: the existing parallel-`Promise.all` behavior is a
  deliberate throughput optimization documented elsewhere as a feature, and
  changing it would be a silent behavior change for existing consumers.
- **AC4:** `ValidationError`/`IValidationError` gained optional `code?: string`
  (BC-safe, additive on both the class and the `@vytches/ddd-contracts`
  interface). `addRule`/`addSpecification`/`mustSatisfy`/`propertyMustSatisfy`
  gained a matching optional trailing `code` param. All six `CoreRules` rules
  emit a stable code (`'required'`, `'min_length'`, `'max_length'`, `'pattern'`,
  `'range'`, `'email'`).
- **AC5:** Extended the existing VD-005 AC7 guide
  (`docs/guides/specification-vs-policy.md`) rather than publishing a duplicate
  doc — added a "Value Object constructor invariants" section (with a
  `compile-check`-verified snippet) and a decision-guide step 0, aligned with
  VF-023 AC1's actual decision (constructor throws synchronously via the
  `getInvalidValueMessage()` hook; no `Result`-returning factory variant on the
  base class). Linked from all three LLMGUIDEs (validation, value-objects,
  policies) — previously zero inbound links existed despite the guide having
  shipped in VD-005.
- **AC6:** `packages/testing/src/seeder/value-object-builder.ts`'s local
  `BusinessRuleValidator` type renamed to `SeederRuleFn` (confirmed never
  re-exported from `seeder/index.ts`, zero external impact); its duplicated
  email regex extracted to a named `EMAIL_FORMAT_REGEX` constant with a comment
  cross-referencing `CoreRules.email` as the source of truth (no new `testing` →
  `validation` package dependency added, per Nx boundary discipline).

**Note on the doc-compile gate:** `docs-compile-gate` only scans
`README.md`/`LLMGUIDE.md` by filename
(`tools/docs-compile-gate/src/ discovery.ts`), so it does not cover
`docs/guides/*.md`. The new `Email extends BaseValueObject` snippet was verified
manually against `packages/value-objects/tsconfig.json` (caught one real defect
this way: the base class's `validate()` is a _public_ abstract member — a
subclass declaring it `protected` doesn't compile — and
`getInvalidValueMessage()` needs an explicit `override` under this repo's
`noImplicitOverride: true`). It is marked `ts compile-check` for whenever the
gate's scope grows to cover `docs/guides/`, but that scope extension is out of
scope here.

Verification: full `nx run-many -t test` (26 projects), `-t type-check` (22
projects), `-t lint` (19 projects, one real `no-this-alias` lint error found and
fixed during `.and()`'s rewrite — arrow function instead of
`const self = this`), and `-t build` (19 projects) all green. `validate:api`/
`validate:api:local` confirm the `@vytches/ddd-contracts` baseline changed by
exactly one additive line (`IValidationError.code`).
