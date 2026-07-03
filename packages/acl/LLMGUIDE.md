# @vytches/ddd-acl - LLM Guide

## Purpose

Anti-Corruption Layer infrastructure for integrating external systems into a
bounded context. Provides adapters, translators, and a registry that keep
external concepts from leaking into the domain model.

## Quick Start

```typescript
import {
  SimpleACLAdapter,
  BaseModelTranslator,
  ACLRegistry,
} from '@vytches/ddd-acl';
import type { IExternalAPI } from '@vytches/ddd-acl';

// 1. Translator: domain <-> external
class UserTranslator extends BaseModelTranslator<DomainUser, ExternalUser> {
  constructor() {
    super('UserContext');
  }

  protected performToExternalTranslation(domain: DomainUser): ExternalUser {
    return { user_id: domain.id.getValue(), email: domain.email.value };
  }

  protected performFromExternalTranslation(ext: ExternalUser): DomainUser {
    return DomainUser.reconstitute(ext.user_id, ext.email);
  }
}

// 2. Adapter: wraps the external HTTP/RPC/SDK call
const adapter = SimpleACLAdapter.create(
  'UserContext', // context name
  'LegacyUserService', // external system name
  new UserTranslator(),
  new LegacyUserAPI(), // implements IExternalAPI
  ['create', 'update']
);

// 3. Registry: shared lookup
const registry = new ACLRegistry();
registry.registerDirect('UserContext', adapter);

// 4. Use
const result = await registry
  .getRequired<DomainUser, ExternalUser>('UserContext')
  .execute('create', domainUser);
```

## Key API

| Export                                      | Description                                                                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ACLRegistry`                               | Global registry; `registerDirect`, `registerEnhanced`, `importFromContext`                                                                                                                |
| `ACLRegistry.registerDirect(name, adapter)` | Register an adapter by context name                                                                                                                                                       |
| `ACLRegistry.getRequired<D, E>(name)`       | Get adapter or throw if absent                                                                                                                                                            |
| `ACLRegistry.get<D, E>(name)`               | Get adapter or `undefined`                                                                                                                                                                |
| `ImportOptions`                             | Options for `ACLRegistry.importFromContext(ctx, options)`: `overwriteConflicts`, `validateAdapters`                                                                                       |
| `BaseACLRegistry`                           | Abstract base extended by `ACLRegistry`, `ContextACLRegistry`, `VersionedACLRegistry`; provides `register`, `get`, `getRequired`, `hasContext`, `getRegisteredContexts`, `exportAdapters` |
| `ACLRegistrationMetadata`                   | Metadata recorded per registration (used by `BaseACLRegistry.register`): `contextName`, `registeredAt`, `registeredBy`, optional `description`/`version`/`source`                         |
| `AdapterDefinition<D, E>`                   | Declarative adapter definition produced by `defineACLAdapter` and consumed by `ACLRegistry.fromDefinitions` — see Declarative Registration below                                          |
| `BaseACLAdapter<D, E, R>`                   | Abstract base; implement `registerSupportedOperations()`                                                                                                                                  |
| `SimpleACLAdapter<D, E, R>`                 | Concrete adapter for simple cases; `SimpleACLAdapter.create(...)` factory                                                                                                                 |
| `EnhancedACLAdapter`                        | Adds `executeTyped` for operation-level type safety                                                                                                                                       |
| `IEnhancedACLAdapter<D, E, R>`              | Interface implemented by `EnhancedACLAdapter`: extends `IACLAdapter` with `use(middleware)` and `executeTyped(operation, model, opts)`                                                    |
| `TypedOperation<TInput, TOutput>`           | Abstract operation descriptor passed to `executeTyped`; extend it, implement `name`, optionally `validateBusinessRules` — see Pattern 4                                                   |
| `BaseModelTranslator<D, E>`                 | Abstract translator; implement `performToExternalTranslation` and `performFromExternalTranslation`                                                                                        |
| `BaseACLMiddleware`                         | Abstract middleware; implement `execute(op, model, opts, next)`                                                                                                                           |
| `ContextACLRegistry`                        | Per-bounded-context registry; export to `ACLRegistry` via `importFromContext`                                                                                                             |
| `VersionedACLRegistry`                      | Registry with versioned adapter support                                                                                                                                                   |
| `VersionedACLAdapter<D, E, R>`              | Thin wrapper around a `VersionedACLRegistry` context; constructor takes `(registry, defaultContextName)`, resolves the right version and forwards `execute` — see Pattern 5               |
| `ACLError`                                  | Error type for ACL failures; `ACLError.operationFailed(context, op, cause)`                                                                                                               |
| `AdapterNotFoundError`                      | `ACLError` subtype thrown when no adapter is registered for a context; `AdapterNotFoundError.forContext(contextName, adapterName)` factory                                                |
| `TranslationError`                          | `ACLError` subtype for translation failures; carries `sourceModel` and `direction`; factories `TranslationError.forToExternal(...)` / `.forFromExternal(...)`                             |
| `IACLAdapter<D, E, R>`                      | Core adapter interface: `execute`, `fetch`, `supportsOperation`, `getContextInfo`                                                                                                         |
| `IModelTranslator<D, E>`                    | Translator interface: `toExternal`, `fromExternal`, optional `validateDomain`, `validateExternal`                                                                                         |
| `IExternalAPI<E, R>`                        | External system interface: `execute`, `fetch`, `healthCheck`                                                                                                                              |
| `BaseApplicationService`                    | Abstract base for application-layer services; provides `validateRequest(request, validator)` and `handleDomainError(error)` helpers — see Pattern 6                                       |
| `IApplicationService`                       | Interface implemented by `BaseApplicationService`: exposes readonly `serviceName`                                                                                                         |
| `ApplicationError`                          | Generic application-layer error wrapping an inner/domain error; returned by `BaseApplicationService.handleDomainError`                                                                    |

## Patterns

### Pattern 1: Custom adapter with middleware pipeline

Extend `BaseACLAdapter` when you need per-operation logic, circuit breakers, or
logging middleware.

```typescript
import { BaseACLAdapter, BaseACLMiddleware } from '@vytches/ddd-acl';
import type { ExecuteOptions, ACLContextInfo } from '@vytches/ddd-acl';
import { Result } from '@vytches/ddd-utils';

class AuditMiddleware extends BaseACLMiddleware {
  async execute<T>(
    op: string,
    model: unknown,
    opts: ExecuteOptions,
    next: () => Promise<Result<T>>
  ) {
    const start = Date.now();
    const result = await next();
    this.logger.info('ACL operation', {
      op,
      ms: Date.now() - start,
      success: result.isSuccess,
    });
    return result;
  }
}

class PaymentAdapter extends BaseACLAdapter<
  DomainPayment,
  ExternalPayment,
  PaymentReceipt
> {
  constructor(
    ctx: ACLContextInfo,
    translator: PaymentTranslator,
    api: PaymentGatewayAPI
  ) {
    super(ctx, translator, api);
    this.registerSupportedOperations();
  }

  protected registerSupportedOperations(): void {
    this.registerOperation('charge');
    this.registerOperation('refund');
  }
}

const adapter = new PaymentAdapter(ctx, translator, api);
adapter.use(new AuditMiddleware());
const result = await adapter.execute('charge', domainPayment, {
  timeout: 5000,
});
```

### Pattern 2: Context registry per bounded context

Each bounded context maintains its own `ContextACLRegistry` and exports to the
global `ACLRegistry` at startup.

```typescript
import { ContextACLRegistry, ACLRegistry } from '@vytches/ddd-acl';

// payments-context/infrastructure/acl-registrations.ts
export function registerPaymentsACL(global: ACLRegistry): void {
  const ctx = new ContextACLRegistry('payments');
  ctx.register('StripeContext', stripeAdapter);
  ctx.register('TaxContext', taxAdapter);

  global.importFromContext(ctx, { overwriteConflicts: false });
}
```

### Pattern 3: Fetch and translate from external system

Use `adapter.fetch(id)` to pull a record from the external system and get it
back as a domain model without calling `execute`.

```typescript
const adapter = registry.getRequired<DomainProduct, ExternalProduct>(
  'CatalogContext'
);

const result = await adapter.fetch(productId);
if (result.isSuccess) {
  const domainProduct = result.value; // already translated via BaseModelTranslator
  return domainProduct;
}
```

### Pattern 4: Typed operations with `executeTyped`

Extend `TypedOperation` to describe a single operation (name + optional
business-rule validation) instead of passing a raw operation string. Pass the
instance to `EnhancedACLAdapter.executeTyped`, which runs
`validateBusinessRules` (if present) before delegating to `execute`.

```typescript
import { TypedOperation, EnhancedACLAdapter } from '@vytches/ddd-acl';
import { Result } from '@vytches/ddd-utils';

class ChargeCard extends TypedOperation<DomainPayment, PaymentReceipt> {
  readonly name = 'charge';
  readonly description = 'Charge a card via the payment gateway';

  validateBusinessRules(input: DomainPayment) {
    if (input.amount.isNegative()) {
      return Result.fail(new Error('Amount must be positive'));
    }
    return Result.ok(undefined);
  }
}

const adapter: EnhancedACLAdapter<
  DomainPayment,
  ExternalPayment,
  PaymentReceipt
> = EnhancedACLAdapter.create(
  'PaymentsContext',
  'StripeGateway',
  translator,
  externalAPI,
  ['charge']
);

const result = await adapter.executeTyped(new ChargeCard(), domainPayment);
```

### Pattern 5: Resolving adapters by version

Use `VersionedACLRegistry` to register multiple versions of the same context's
adapter, then wrap it in a `VersionedACLAdapter` so callers don't need to pass a
version on every call — it resolves the latest (or an explicitly requested)
version internally.

```typescript
import { VersionedACLRegistry, VersionedACLAdapter } from '@vytches/ddd-acl';

const registry = new VersionedACLRegistry();
registry.registerVersioned('PaymentsContext', '1.0.0', adapterV1);
registry.registerVersioned('PaymentsContext', '2.0.0', adapterV2);

const payments = new VersionedACLAdapter<DomainPayment, ExternalPayment>(
  registry,
  'PaymentsContext'
);

// Resolves the latest registered version (2.0.0) unless `options.version` is set
const result = await payments.execute('charge', domainPayment);
payments.getAvailableVersions(); // ['1.0.0', '2.0.0']
```

### Pattern 6: Application service base class

`BaseApplicationService` is a small abstract base for application-layer services
that orchestrate calls into ACL adapters/translators. It centralizes request
validation (via a `BusinessRuleValidator`) and converts unexpected errors into a
consistent `ApplicationError`.

```typescript
import { BaseApplicationService, ApplicationError } from '@vytches/ddd-acl';

class SyncUserService extends BaseApplicationService {
  constructor(private readonly registry: ACLRegistry) {
    super('SyncUserService');
  }

  async sync(request: SyncUserRequest) {
    const validation = this.validateRequest(request, syncUserValidator);
    if (validation.isFailure) {
      return Result.fail(validation.error);
    }

    try {
      const adapter = this.registry.getRequired<DomainUser, ExternalUser>(
        'UserContext'
      );
      return await adapter.execute('sync', request.user);
    } catch (error) {
      throw this.handleDomainError(error); // wraps into ApplicationError
    }
  }
}
```

## Anti-Patterns

**Leaking external types into domain code.** External DTOs (`ExternalUser`,
`StripeCharge`, etc.) must never appear in domain entities, value objects, or
services. All translation must happen inside the `BaseModelTranslator`.

```typescript
// Wrong: domain service accepts external type
class OrderService {
  placeOrder(stripeCharge: StripeCharge) { ... }
}

// Correct: adapter translates before domain service is called
const domainCharge = (await adapter.fetch(chargeId)).value;
orderService.placeOrder(domainCharge);
```

**Skipping `BaseModelTranslator` and doing inline translation.** Inline
translation in the adapter `executeCore` makes testing and domain isolation
impossible. Always implement a named translator class.

**Registering adapters in application services.** Adapter registration belongs
in infrastructure setup (e.g., module init, DI container). Application services
should only call `registry.getRequired(...)`.

**Calling `execute()` with an unsupported operation string.** `BaseACLAdapter`
returns `Result.fail(ACLError.unsupportedOperation(...))` for unregistered
operations. Always call `supportsOperation(op)` or rely on a typed wrapper to
avoid runtime failures.

**Creating a new `ACLRegistry` per request.** `ACLRegistry` should be a
singleton (application-level). Creating instances per request discards all
registrations.

## Hidden Features

**`BaseModelTranslator` calls optional `validateDomain` / `validateExternal`
hooks.** Override these to add pre-translation validation without changing the
translation logic itself.

**`ACLRegistry.importFromContext` returns a conflict report.** The
`ImportResult` object lists `imported`, `skipped`, and `conflicts` arrays —
useful for startup diagnostics.

**`VersionedACLRegistry` supports adapter versioning.** When an external API has
multiple versions (v1, v2), use `VersionedACLRegistry` to register
version-tagged adapters and resolve them by version at runtime.

**Middleware is a pipeline, not a list of interceptors.** Each
`ACLMiddleware.execute` receives a `next` function; call it to proceed.
Returning early without calling `next` short-circuits the chain, which is useful
for caching or stubbing in tests.

## Declarative Registration (since 0.24.0)

Replace manual `register()` calls with declarative adapter definitions:

```typescript
import { ACLRegistry, defineACLAdapter } from '@vytches/ddd-acl';

const paymentAdapter = defineACLAdapter({
  context: 'payments',
  adapter: new PaymentACLAdapter(translator, api),
  description: 'Stripe integration',
});

const shippingAdapter = defineACLAdapter({
  context: 'shipping',
  adapter: new ShippingACLAdapter(translator, api),
});

// One-liner registry creation instead of manual register() calls
const registry = ACLRegistry.fromDefinitions([paymentAdapter, shippingAdapter]);
```

Definitions are frozen (immutable) and can be exported from modules for
centralized registration.

## Package Dependencies

`@vytches/ddd-acl` depends on:

- `@vytches/ddd-contracts` — core interfaces
- `@vytches/ddd-utils` — `Result<T, E>`
- `@vytches/ddd-logging` — structured logger

Packages that depend on `@vytches/ddd-acl`:

- `@vytches/ddd-enterprise` — re-exports everything
- Bounded context infrastructure layers (external system adapters)
