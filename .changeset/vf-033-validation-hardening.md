---
'@vytches/ddd-validation': minor
'@vytches/ddd-contracts': minor
'@vytches/ddd': minor
---

fix(validation): CoreRules coercion bugs, and() error collapsing, async
short-circuit docs, ValidationError.code (VF-033)

**`@vytches/ddd-validation`:**

- `CoreRules.minLength`/`.maxLength`/`.range` no longer coerce absent values.
  Previously `String(undefined).length` (`9`, the literal text `"undefined"`)
  let `minLength` silently pass on a missing field, and `Number(null) === 0` let
  `range` silently accept `null`. Both rules now require the correct `typeof`
  (`string` for length rules, `number` for `range`) and fail on
  missing/null/non-matching/`NaN` values instead of coercing them.
- `BusinessRuleValidator.and()` no longer collapses the composed validator's
  per-field errors into a single generic `''`-property "Failed combined
  validation" error. It now flattens both validators' errors, matching
  `Validation.combine()`'s guarantee that no error detail is lost.
- `ValidationError` gains an optional `code?: string` constructor param /
  property — a stable, machine-readable error identity for i18n/programmatic
  consumers who previously had to string-match `message`. All built-in
  `CoreRules` rules now emit a stable code (`'required'`, `'min_length'`,
  `'max_length'`, `'pattern'`, `'range'`, `'email'`); custom rules can pass
  their own via the new optional 5th `code` argument on
  `BusinessRuleValidator.addRule()`/`addSpecification()`/`mustSatisfy()`/
  `propertyMustSatisfy()`.
- `AndAsyncSpecification`/`OrAsyncSpecification` (and
  `AsyncCompositeSpecification.and()`/`.or()`) gain JSDoc documenting their
  no-short-circuit behavior (both branches always run via `Promise.all`) —
  previously only noted as a footnote in LLMGUIDE.md, not on the API itself. No
  behavior change.
- New guide:
  [`docs/guides/specification-vs-policy.md`](https://github.com/vytches/ddd/blob/develop/docs/guides/specification-vs-policy.md)
  now covers the full "where do I validate what" decision tree (VO constructor
  invariant → `Specification` → `BusinessRuleValidator` → `PolicyBuilder`),
  linked from the validation, value-objects, and policies LLMGUIDEs.

**`@vytches/ddd-contracts`:**

- `IValidationError` gains the matching optional `code?: string` field.

**`@vytches/ddd`:**

- Re-exports pick up the new optional `code` field on `ValidationError` /
  `IValidationError` automatically (no new exports added).

**Usage:**

```ts
import { CoreRules, BusinessRuleValidator, RulesRegistry } from '@vytches/ddd';

const validator = BusinessRuleValidator.create<{ age: number }>().apply(
  RulesRegistry.Rules.range('age', 0, 150)
);

const result = validator.validate({ age: null as unknown as number });
// Before: passed (Number(null) === 0, within range)
// After: fails — result.error.errors[0].code === 'range'
```
