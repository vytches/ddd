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
status: backlog
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

1. [ ] **UX-C11:** IF CoreRules survives VF-031 AC6 — `typeof` guards in
       `minLength`/`maxLength`/`range` (fail on missing/null/NaN, no string/
       number coercion of absent values) + edge-case tests
       (null/undefined/NaN/unicode). IF deleted — mark AC void, reference the
       VF-031 decision.
2. [ ] **UX-C12:** `.and()` preserves sub-validator errors (flatten like
       `Validation.combine()`) OR is renamed/documented as boolean-AND with
       intentional error discard; test asserts error **content** (property +
       message), not just count.
3. [ ] **UX-C17:** short-circuit async AND/OR variants added, or the
       both-branches-always-run behavior documented in the class JSDoc (main API
       doc, not the LLMGUIDE footnote).
4. [ ] `ValidationError` gains optional `code?: string` (BC-safe constructor
       extension); surviving built-in rules emit stable codes (`'required'`,
       `'min_length'`, `'range'`, …).
5. [ ] **UX-T5.7:** a "where do I validate what" decision tree published (VO
       constructor invariant → typed error or Result factory; cross-field rule →
       `BusinessRuleValidator`+Result; reusable predicate → Specification;
       cross-context policy → policies) — one doc, linked from validation,
       value-objects and policies LLMGUIDEs; pairs with VD-005 AC7
       (Specification vs Policy guide) and must align with VF-023 AC1's
       `BaseValueObject.validate` decision.
6. [ ] **UX-T2.7:** testing's local `BusinessRuleValidator` type renamed (e.g.
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
