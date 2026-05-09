# @vytches/ddd-policies — Examples

Eight focused examples covering every major pattern in `@vytches/ddd-policies`.
Each file is standalone, has a real-world use case, and is verified by tests in
`tests/policies-examples.test.ts`.

## Examples

| #   | File                                                               | Pattern                              | Use case                       |
| --- | ------------------------------------------------------------------ | ------------------------------------ | ------------------------------ |
| 1   | [`01-basic-specification.ts`](src/01-basic-specification.ts)       | Inline `mustSatisfy` predicate       | Minimum-age check              |
| 2   | [`02-reusable-specification.ts`](src/02-reusable-specification.ts) | `CompositeSpecification` subclass    | Shared age-gating              |
| 3   | [`03-policy-group-and-or.ts`](src/03-policy-group-and-or.ts)       | `.and()` / `.or()` composition       | Shipping eligibility           |
| 4   | [`04-conditional-policy.ts`](src/04-conditional-policy.ts)         | `.when().thenMust().otherwisePass()` | EU VAT requirement             |
| 5   | [`05-event-driven-policy.ts`](src/05-event-driven-policy.ts)       | `EventDrivenPolicy` wrapping         | Audited credit check           |
| 6   | [`06-retry-policy.ts`](src/06-retry-policy.ts)                     | `PolicyRetryBehavior.withDefaults`   | Transient risk-check failures  |
| 7   | [`07-cached-policy.ts`](src/07-cached-policy.ts)                   | `PolicyCachingBehavior.create`       | Feature-flag memoization       |
| 8   | [`08-temporal-policy.ts`](src/08-temporal-policy.ts)               | `PolicyTemporalBehaviorBuilder`      | Strict after-hours fraud rules |

## Run the tests

```bash
cd examples/policies
pnpm test
```

## Use in your project

These examples are NOT a published package — copy the file you want into your
codebase and adapt the domain types to your bounded context. The imports they
use are all from published packages:

```typescript
import { PolicyBuilder, type IBusinessPolicy } from '@vytches/ddd-policies';
import { CompositeSpecification } from '@vytches/ddd-validation';
```

These examples reflect the real public API as of
`@vytches/ddd-policies@0.25.0-beta.1`. The full behavior reference lives in
`packages/policies/LLMGUIDE.md` — this folder shows you how to apply each
pattern end-to-end with a domain story attached.
