# ADR-0038. DI Token Identity by Reference

Date: 2026-07-11

## Status

2026-07-11 accepted — implemented in VF-030

## Context

### The Same Bug Class, One Layer Down

ADR-0034 fixed a production bug class in `@vytches/ddd-cqrs`: `CommandBus` and
`QueryBus` keyed their internal handler maps by `commandType.name` (a string),
so two bounded contexts defining identically named command classes silently
overwrote each other's registrations. The fix was to key the maps by constructor
reference.

The DI layer (`@vytches/ddd-di` and the `@vytches/ddd-nestjs` container adapter)
had the exact same defect one layer down. `BaseContainerAdapter` exposed a
`getTokenKey(token)` helper that collapsed every `ServiceToken` into a string:

- **Class/function tokens** were reduced to `token.name`. Two distinct classes
  named `UserRepository` — a natural consequence of per-context Ubiquitous
  Language — collided into one map slot; the later registration silently won.
- **Symbol tokens** were reduced to `token.toString()`. Two distinct
  `Symbol('CACHE')` calls — which are _never_ equal as values — produced the
  identical string `"Symbol(CACHE)"` and collided.
- Adapters then used that lossy string as the key of their internal
  `Map<string, ServiceDescriptor>`, so resolution routed to whichever
  registration wrote the key last.

The threat model for this task
([TM-VF-030](../security/threat-models/TM-VF-030.md)) rates the
cross-bounded-context descriptor overwrite as the top risk (silent wrong-
service resolution, no exception thrown — the same "completed successfully
against the wrong target" failure signature as the ADR-0034 bug), and identifies
compounding defects in `NestJSContainerAdapter` that amplify the blast radius
(threat TM-VF-030-007): `Scoped` lifetime silently treated as `Transient`, and a
silent zero-arg `new paramType()` fallback when a constructor dependency failed
to resolve.

## Decision

### D1 — Token identity is the token reference itself

Container adapters key every internal map by the `ServiceToken` directly —
`Map<ServiceToken, ServiceDescriptor>`, `Map<ServiceToken, unknown>` for
instance caches — never by a derived string:

- **Function/class tokens** key by object reference. Two classes sharing a
  `.name` are distinct keys.
- **Symbol tokens** key by symbol identity. `Symbol('X')` and `Symbol('X')` are
  distinct keys; `Symbol.for('X')` is one key everywhere.
- **String tokens** key by value, as JavaScript `Map` string semantics already
  provide. String-token behavior is unchanged.

This is the mirror of, and extension to, ADR-0034 Decision 1: the same
reference-identity rule that fixed the CQRS bus maps now governs the DI
container maps.

### D2 — No `.name` fallback

There is deliberately **no** fallback lookup by `token.name` or any other
derived string. A fallback would reintroduce the collision it exists to paper
over: after a dual-package double-load (see below), a `.name` fallback would
_sometimes_ resolve to the copy from the other module graph — masking the
misconfiguration nondeterministically instead of failing loudly. The threat
model's mitigation M1 (name fallback) was evaluated and REJECTED in favor of
pure reference identity plus explicit `Symbol.for()` guidance. A token that is
not registered under its own identity throws `ContainerServiceNotFoundError`; it
never "almost" matches.

### Supporting decisions (same task)

- `BaseContainerAdapter.getTokenKey()` is retained but **deprecated as a
  display-only helper** (it delegates to the internal `describeToken()`, which
  is documented as intentionally lossy and never-throwing). It must not be used
  as a lookup key. See `packages/di/FRAMEWORK-ADAPTERS.md` for migration
  guidance.
- `NestJSContainerAdapter` fixes the amplifying defects flagged by
  TM-VF-030-007: `ServiceLifetime.Scoped` is now honored (per-scope instance
  cache; `createScope()` copies registrations and materialized singletons but
  starts with a fresh scoped cache), and failed constructor- dependency
  resolution throws `ContainerServiceNotFoundError` (with the owning service
  named) via the inherited `resolveDependency()` helper — the silent zero-arg
  construction fallback is removed. Resolution cycles throw
  `CircularDependencyError` with the full chain.

## Guidance: `Symbol.for()` for Cross-Context and Dual-Format Tokens

Reference identity places one obligation on token authors: **the same token
object must be visible to both the registering and the resolving side.** Two
situations break that assumption, and both have the same answer:

1. **Dual ESM/CJS double-load.** In mixed module graphs (Vitest, Node.js
   applications importing a dual-format package through both `import` and
   `require` paths), the same package can be instantiated twice. A token
   declared as `export const CACHE = Symbol('CACHE')` — or a class used as its
   own token — then exists as **two distinct references**, one per module-graph
   copy. Registration through one copy and resolution through the other misses.
   This is the same failure mode ADR-0034's Bug #3 fix addressed for the CQRS
   bus tokens.
2. **Cross-context shared tokens.** A token intentionally shared by several
   bounded contexts (e.g. a platform-wide clock or ID generator) must resolve to
   the same registration from every context, regardless of how each context's
   module graph loaded the token's declaring module.

For both, declare the token with `Symbol.for()`:

```typescript
// One symbol per key in the process-wide global symbol registry —
// identical across ESM/CJS copies, hot reloads, and module graphs.
export const CLOCK_TOKEN = Symbol.for('myapp:platform:clock');
```

Namespace the key (`'org:context:service'`) — the `Symbol.for` registry is
process-global, so an un-namespaced key like `'clock'` can collide with
unrelated libraries.

Conversely, use plain `Symbol('X')` (or the class itself) when you _want_
private, unshareable identity — e.g. per-feature anchor tokens where accidental
sharing would be the bug (cf. ADR-0034's non-interned feature anchor symbols).

### Honest caveat: where reference identity ends

Reference identity holds **within one JavaScript realm in one process**. It does
not survive:

- **Process boundaries** — workers, clusters, microservices. A token cannot be
  sent to another process; only a serialized _description_ of it can, and
  descriptions are exactly the lossy strings this ADR removes from the identity
  path.
- **Realm boundaries** — `vm` contexts, some test isolation modes. Function and
  non-registry symbol references differ per realm. (`Symbol.for()` _does_
  survive realm boundaries within one process — the global symbol registry is
  shared across realms — which is one more reason it is the recommended shape
  for shared tokens.)
- **Serialization** — persisting or transmitting container configuration.

Cross-process/cross-service composition needs an explicit string-based contract
at the boundary (string tokens, which key by value, are the honest choice
there); this library does not pretend reference identity reaches across the
wire.

## Considered Alternatives

### A. Keep string keys, disambiguate with a registration-time collision error

**Rejected.** Detecting `.name` collisions at registration turns a valid DDD
pattern (same class name in two bounded contexts) into an error, forcing shared
naming across contexts — the same anti-pattern ADR-0034 Alternative A rejected.
It also does nothing for `Symbol('X')` pairs.

### B. Reference identity with `.name` fallback on lookup miss (TM mitigation M1)

**Rejected** — see D2. Nondeterministically masks dual-package misconfiguration
and reintroduces cross-context collision through the back door.

### C. Namespaced string keys (`'orders:UserRepository'`)

**Rejected.** Mirrors ADR-0034 Alternative C: requires changing every
registration call site, remains collision-prone by convention rather than by
construction, and cannot represent symbol tokens faithfully.

## Consequences

### Positive

- Cross-bounded-context DI collisions (identical class names, identical symbol
  descriptions) are structurally impossible — the top threats in TM-VF-030 are
  closed by construction, not by convention.
- CQRS buses (ADR-0034) and DI containers now share one identity rule; there is
  no layer where a lossy string key can silently reroute resolution.
- Failures are loud: unregistered dependency → `ContainerServiceNotFoundError`
  naming the owning service; cycle → `CircularDependencyError` with the chain.
  No silent zero-arg construction, no silent Scoped→Transient downgrade.

### Negative

- Consumers who (incorrectly) relied on two same-named classes resolving
  interchangeably, or on `Symbol('X')` re-created per call site acting as one
  token, will now get `ContainerServiceNotFoundError`. The fix is to share the
  actual token reference or adopt `Symbol.for()`.
- Dual-package double-load misconfigurations that used to be masked by string
  keys now surface as resolution failures. This is intentional (fail loudly),
  but it moves the pain earlier; the `Symbol.for()` recipe is the supported
  remedy.
- Adapters for frameworks whose native registries are string-keyed (e.g. Awilix)
  must maintain their own reference-keyed descriptor map alongside the
  framework's string namespace, and should prefer explicit string tokens at that
  boundary.

### Neutral

- No public signature change: `ServiceToken`, `IDependencyContainer`, and
  `BaseContainerAdapter`'s abstract surface are unchanged. The key-shape change
  is internal to adapter maps.
- `getTokenKey()` remains available (deprecated) so existing subclass
  error-message/logging call sites keep compiling.

## Related Decisions

- ADR-0034: Per-context CQRS Bus Isolation — established reference-keyed maps
  for CQRS buses (Decision 1) and `Symbol.for()` DI tokens for the dual-package
  problem (Bug #3 fix); this ADR applies the same identity rule to the DI
  container layer.
- ADR-0014: DI Integration Bridge Pattern — the `IDependencyContainer`
  abstraction whose adapter implementations this ADR constrains.
- [TM-VF-030](../security/threat-models/TM-VF-030.md): threat model for this
  task — STRIDE/DREAD analysis of token-identity collisions and the amplifying
  adapter defects (M1 rejection, M6 adapter fixes).
- Task VF-030: implementation details.
