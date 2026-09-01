# Where to validate what: VO invariants, Specification, BusinessRuleValidator, Policy

`@vytches/ddd` ships several related-but-distinct tools for expressing
correctness rules: `BaseValueObject`'s constructor invariant (from
`@vytches/ddd-value-objects`), `Specification` / `BusinessRuleValidator` (from
`@vytches/ddd-validation`), and `PolicyBuilder` (from `@vytches/ddd-policies`).
They compose with each other, but they solve different problems — using the
wrong one leads to either an over-engineered one-off rule, a Value Object that
can construct in an invalid state, or a policy that can't express the context it
needs.

## TL;DR

| Question                                                                         | Answer                                    |
| -------------------------------------------------------------------------------- | ----------------------------------------- |
| Is this an invariant a Value Object must _always_ hold, with no valid exception? | **`BaseValueObject.validate()`** (throws) |
| Is this a pure predicate over an object's own state?                             | **Specification**                         |
| Do you need to know _which_ field(s) failed and why (not just true/false)?       | **`BusinessRuleValidator`**               |
| Does it need `userId`, tenant, IP, session, or other request context?            | **Policy**                                |
| Do you need structured violation info (code, message, severity)?                 | **Policy**                                |
| Is it a one-off / module-local rule?                                             | **Specification** (inline)                |
| Is it named, reusable, or registered centrally?                                  | Either — see below                        |

## Value Object constructor invariants — the first line of defense

`BaseValueObject<T>`'s constructor calls the subclass's `validate(value)` hook
and **throws synchronously** on failure (VF-023 AC1) — there is no
`Result`-returning factory variant; a VO either constructs successfully or the
constructor throws. This is deliberately not configurable per-instance:
"always-valid domain model" means an invalid VO can never exist, not even
transiently.

```ts compile-check
import { BaseValueObject } from '@vytches/ddd-value-objects';

class Email extends BaseValueObject<string> {
  validate(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  protected override getInvalidValueMessage(value: string): string {
    return `Invalid email: "${value}"`;
  }
}

new Email('not-an-email'); // throws synchronously
```

Use this for invariants that are true of the type itself, independent of any
particular aggregate or use case — the kind of rule that, if violated, means the
value was never a valid instance of that VO to begin with. If constructing the
value can legitimately fail for reasons the caller should handle instead of
catching an exception (e.g. building a VO from untrusted external input), wrap
construction in a `Result`-returning factory function at the call site — the
VO's own constructor still throws; the factory is what turns that throw into a
`Result` for its caller. See the value-objects LLMGUIDE's "Result-Returning
Factories" pattern.

## Specification — pure, composable predicates

`Specification<T>` answers a single yes/no question about a value: _"does this
object satisfy this rule?"_ It never touches ambient context (no `userId`, no
request, no I/O). This makes it the default choice for anything expressible as
`(value: T) => boolean`.

### Inline specs (preferred for one-off rules)

```typescript
import { Specification } from '@vytches/ddd';

interface Order {
  total: number;
  status: 'draft' | 'paid' | 'cancelled';
}

const isPositive = Specification.create<Order>(o => o.total > 0);
const isDraft = Specification.create<Order>(o => o.status === 'draft');

// Compose with static combinators
const canBePlaced = Specification.and(isPositive, isDraft);

canBePlaced.isSatisfiedBy({ total: 100, status: 'draft' }); // true
```

Other combinators: `Specification.or`, `Specification.not`,
`Specification.propertyEquals/In/Between`.

### Class-based specs (named, reusable, or with injected dependencies)

Reach for `CompositeSpecification` only when the inline form isn't enough — the
spec is complex, takes constructor dependencies, or is exported and reused
across modules:

```typescript
import { CompositeSpecification } from '@vytches/ddd';

class MinimumOrderSpec extends CompositeSpecification<Order> {
  constructor(private readonly minimum: number) {
    super();
  }

  isSatisfiedBy(order: Order): boolean {
    return order.total >= this.minimum;
  }
}

const meetsMinimum = new MinimumOrderSpec(50).and(isDraft);
```

For async predicates (e.g. a uniqueness check backed by a repository), use
`AsyncCompositeSpecification<T>`.

### Fluent validation with error detail

When you need _why_ something failed (not just true/false), use
`BusinessRuleValidator` — still pure, still no ambient context, but returns
`Result<T, ValidationErrors>` instead of a boolean:

```typescript
import { BusinessRuleValidator } from '@vytches/ddd';

const validator = BusinessRuleValidator.create<Order>()
  .addRule('total', o => o.total > 0, 'Total must be positive')
  .addRule(
    'status',
    o => o.status !== 'cancelled',
    'Cannot place cancelled order'
  );

const result = validator.validate(order);
if (result.isFailure) {
  result.error.errors.forEach(e => console.error(e.property, e.message));
}
```

## Policy — context-aware rules with structured violations

`PolicyBuilder` (from `@vytches/ddd-policies`) is for rules that need more than
the value being checked — `userId`, tenant, request metadata — and that should
report a structured violation (`code`, `message`, `severity`) rather than a bare
boolean. Internally a policy composes `Specification`s; it adds the
request/context layer and the violation-reporting layer on top.

```typescript
import {
  PolicyBuilder,
  PolicyRequestFactory,
  PolicyViolation,
} from '@vytches/ddd';
import { Specification } from '@vytches/ddd';

const orderPolicy = PolicyBuilder.create<Order>()
  .withId('order-placement')
  .withDomain('ordering')
  .withName('Order Placement Policy')
  .must(Specification.create<Order>(o => o.total > 0))
  .withErrorCode('INVALID_TOTAL')
  .withMessage('Order total must be positive')
  .must(Specification.create<Order>(o => o.status === 'draft'))
  .withErrorCode('WRONG_STATUS')
  .withMessage('Only draft orders can be placed')
  .build();

const request = PolicyRequestFactory.minimal(order, userId);
const result = await orderPolicy.check(request);

if (result.isFailure) {
  const violation: PolicyViolation = result.error;
  // violation.code, violation.message, violation.severity, violation.policyId
}
```

Use `.must(spec)` for rules that fail the policy (ERROR severity) and
`.should(spec)` for advisory rules that report a warning without failing it.

For policies used across a bounded context, register them once and resolve by
id/tags instead of rebuilding on every call:

```typescript
import { PolicyRegistry } from '@vytches/ddd';

registry.register(orderPolicy);
const resolved = registry.resolve('order-placement');
```

## Decision guide

0. **Is it a Value Object's own invariant?** Put it in that VO's `validate()`
   override — `BaseValueObject`'s constructor enforces it automatically, on
   every construction path, with no way to forget it. Don't duplicate it as a
   `Specification`/policy check elsewhere.
1. **Start with an inline `Specification`.** It's the cheapest tool and covers
   most business rules — pure predicates over the aggregate/entity's own state.
2. **Promote to `CompositeSpecification`** only when the rule needs to be named,
   exported, reused across files, or takes constructor dependencies.
3. **Reach for `BusinessRuleValidator`** when you need per-field failure detail
   (validating a DTO or command payload) but still no ambient context.
4. **Reach for `PolicyBuilder`** when the rule needs request/user/tenant
   context, or when callers need structured violation info
   (`code`/`message`/`severity`) rather than a boolean. Build policies out of
   the specifications you already have via `.must()`/`.should()`.

## See also

- [`docs/llm-context.md`](../llm-context.md) — full API tables for
  `@vytches/ddd-validation` and `@vytches/ddd-policies`
- [`QUICK_START.md`](../../QUICK_START.md) — inline specification example in
  context (Order aggregate)
- `packages/value-objects/LLMGUIDE.md`'s "Result-Returning Factories" pattern —
  turning a throwing VO constructor into a `Result<VO, Error>` at the call site
