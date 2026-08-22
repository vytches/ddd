# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.31.0](https://github.com/vytches/ddd/compare/v0.31.0-alpha.0...v0.31.0) (2026-08-22)

### Bug Fixes

- **nestjs:** register the CQRS token bridge in every module factory
  ([1384dce](https://github.com/vytches/ddd/commit/1384dcea2200cf276f6cfcaa655c4a9d6fa9d0e9))
- **nestjs:** report at bootstrap when no handler could be registered
  ([8074352](https://github.com/vytches/ddd/commit/8074352463106888a8da4a48479deaff510b902a))
- **nestjs:** warn when a discovered handler has no bus to register on
  ([b428e34](https://github.com/vytches/ddd/commit/b428e3479ed131beedd60a7c6297b7b1fa28a56c))

### Features

- **nestjs:** add forRootAsync and route forFeature through CQRSConfiguration
  ([abab7ba](https://github.com/vytches/ddd/commit/abab7ba2266d9869ab387cd38e32915c0de1d0ab))
- **nestjs:** re-export COMMAND_BUS_TOKEN and QUERY_BUS_TOKEN
  ([39972c9](https://github.com/vytches/ddd/commit/39972c9169e9a311d96010c59a490644a3138a57))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [Unreleased]

### BREAKING CHANGES

#### Already shipped in 0.31.0-alpha.0 — documented here for the first time

**`VytchesExplorerService` resolves the CQRS buses through Symbol tokens**
(VP-009 Bug #3, commit `02adf265`).

It injects `@Optional() @Inject(COMMAND_BUS_TOKEN)` / `@Inject(QUERY_BUS_TOKEN)`
instead of the `ICommandBus` / `IQueryBus` class references, so that DI keeps
working when the same module is loaded once as ESM and once as CJS and the two
class identities diverge.

The injection is `@Optional()`, so a token mismatch does not fail at boot. It
degrades silently: discovery reports success, nothing is registered, and every
`execute()` throws `No handler registered for ...` at runtime.

_You are affected if_ the buses are provided outside a `VytchesDDDModule`
factory — typically a hand-rolled `@Global()` module doing
`{ provide: ICommandBus, useValue: new EnhancedCommandBus(...) }`.

_Migration._ Wire through `VytchesDDDModule.forRoot()` (or `forContext()` /
`forContexts()` / `forFeature()`), which registers the bridge and provides the
explorer. If that is not possible yet:

```ts
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@vytches/ddd-nestjs';
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';

providers: [
  { provide: ICommandBus, useValue: myCommandBus },
  { provide: IQueryBus, useValue: myQueryBus },
  { provide: COMMAND_BUS_TOKEN, useExisting: ICommandBus },
  { provide: QUERY_BUS_TOKEN, useExisting: IQueryBus },
];
```

`useExisting` only where the class-token provider is guaranteed present; NestJS
raises a DI error against an absent token even under `@Optional()`. Otherwise
use `useFactory` with `inject: [{ token: ICommandBus, optional: true }]`.

_Self-audit._ `grep -rn "provide: ICommandBus\|provide: IQueryBus" src/` and
confirm each hit is inside a factory call or carries a Symbol alias.

### Added

- `COMMAND_BUS_TOKEN` and `QUERY_BUS_TOKEN` are re-exported from this package,
  so the aliases above no longer need an import from `@vytches/ddd-cqrs`.

### Fixed

- The Symbol→class token bridge is registered by every module factory.
  Previously only `forRoot()` and `forTesting()` had it, so an explorer created
  by `forContext()` or `forContexts()` received no bus and registered nothing.
  `forFeature()` now aliases the tokens onto its own per-context buses so
  `@Inject(COMMAND_BUS_TOKEN)` and `@Inject(ICommandBus)` agree inside a feature
  module; `GLOBAL_COMMAND_BUS` / `GLOBAL_QUERY_BUS` stay out of `forFeature()`
  on purpose, since reaching the root bus is their job. ADR-0034 claimed
  `forRoot()` and `forFeature()` both carried the bridge — corrected.

- A discovered handler with no bus to register on is reported at `warn` level,
  naming the handler, its type and its message type. It used to be skipped
  silently.

- When handlers are discovered and none could be registered, bootstrap emits one
  summary warning with discovered/registered counts, which buses resolved, and
  the tokens to check.

### Changed

- README and LLMGUIDE state up front that handler auto-discovery exists only
  inside `VytchesDDDModule`, and carry a "Manual wiring" section for
  applications that provide the buses themselves. The stale claim that
  `forRoot()` is the only factory method is gone — there are five.

# [0.31.0-alpha.0](https://github.com/vytches/ddd/compare/v0.27.0...v0.31.0-alpha.0) (2026-07-19)

### Bug Fixes

- **config:** include benchmarks/ in nestjs and di tsconfig for type-check
  coverage
  ([b0d6884](https://github.com/vytches/ddd/commit/b0d6884e24947c6d83fcc40fdf61879c03cdf4e5))
- **di:** key DI tokens by reference identity, fix adapter lifetime and errors
  (VF-030)
  ([3f7fcff](https://github.com/vytches/ddd/commit/3f7fcff28162db78b4e70334e0079549f751b476))
- **nestjs:** repair forFeature() DI wiring so bounded-context handlers stay
  local (VB-003)
  ([ddbedb6](https://github.com/vytches/ddd/commit/ddbedb6c17e60f8266bf561011df245454db77af))
- **nestjs:** resolve importing consumer module in feature handler registrar
  ([efda71f](https://github.com/vytches/ddd/commit/efda71f44c3f056fe06080c0895aa321d6d6af38)),
  closes [#1](https://github.com/vytches/ddd/issues/1)
- **nestjs:** surface failed handler registrations and reset buses on destroy
  (VS-003)
  ([7460d72](https://github.com/vytches/ddd/commit/7460d729eb1be7d0ceb831bee60dc00cdf56dc06))
- **nestjs:** switch VytchesExplorerService injection to Symbol.for DI tokens
  (VP-009 Bug [#3](https://github.com/vytches/ddd/issues/3))
  ([02adf26](https://github.com/vytches/ddd/commit/02adf2653c19cedba7d3963bd38901381e3c5c57))
- **release:** repair broken npm publish artifacts across all packages (VB-002)
  ([82d92fd](https://github.com/vytches/ddd/commit/82d92fdc39194d2e5398593dde27f9d9c126a527))

### Code Refactoring

- **config:** curate public API surface ahead of first publish (VF-024)
  ([3f8758d](https://github.com/vytches/ddd/commit/3f8758d0d0e07b73bace4ed9609e3f60b6bd8eea))

### Features

- **config:** add ddd-005 deep-import-instead-of-barrel lint rule
  ([ee6c817](https://github.com/vytches/ddd/commit/ee6c8170e4700351e9d2ae4b4ccbb36af054c454))
- **nestjs:** add GLOBAL_COMMAND_BUS / GLOBAL_QUERY_BUS tokens for cross-context
  ACL (VP-009 Bug [#2](https://github.com/vytches/ddd/issues/2))
  ([0b47e4d](https://github.com/vytches/ddd/commit/0b47e4d16b54dc696194a25860d81d9c1f02070f))
- **nestjs:** opt-in strict handler registration (fail-fast on bootstrap)
  ([bd320b5](https://github.com/vytches/ddd/commit/bd320b57b7641a82755d714bea0f6399e50026f3))
- **nestjs:** warn when injected bus does not implement reset()
  ([747c87b](https://github.com/vytches/ddd/commit/747c87b510b5f03e453b75dafb328e36a0efdc7a)),
  closes [#3](https://github.com/vytches/ddd/issues/3)

### Performance Improvements

- **nestjs:** registry-first resolve, lazy paramtypes cache, COW scopes
  (VP-006b)
  ([9b56a71](https://github.com/vytches/ddd/commit/9b56a71ad7779f6626c35192d60c4eea3a51b8c3))

### BREAKING CHANGES

- **config:** ServiceNotFoundError, EntityIdFactory, internalLogger barrel
  export, BaseEntityId, and globalPolicyEventBus all removed/renamed — see
  CHANGELOG.md for migration notes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.30.0](https://github.com/vytches/ddd/compare/v0.27.0...v0.30.0) (2026-05-26)

**Note:** Version bump only for package @vytches/ddd-nestjs

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.29.3](https://github.com/vytches/ddd/compare/v0.27.0...v0.29.3) (2026-05-25)

**Note:** Version bump only for package @vytches/ddd-nestjs

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.29.2](https://github.com/vytches/ddd/compare/v0.27.0...v0.29.2) (2026-05-25)

### Bug Fixes

- **nestjs:** add .js extension to modules-container import for vite-node ESM
  compat
  ([674eba5](https://github.com/vytches/ddd/commit/674eba5c43cbbdffce460a9dce206612e893004c))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.29.1](https://github.com/vytches/ddd/compare/v0.27.0...v0.29.1) (2026-05-24)

### Bug Fixes

- **nestjs:** replace @nestjs/core/injector directory import with
  modules-container
  ([4132a28](https://github.com/vytches/ddd/commit/4132a28feb83d586e012a334709d94905cc291ba))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.29.1](https://github.com/vytches/ddd/compare/v0.29.0...v0.29.1) (2026-05-24)

### Bug Fixes

- **nestjs:** replace directory import `@nestjs/core/injector` with
  `@nestjs/core/injector/modules-container` to fix `ERR_UNSUPPORTED_DIR_IMPORT`
  in ESM environments

# [0.29.0](https://github.com/vytches/ddd/compare/v0.28.0...v0.29.0) (2026-05-23)

### Features

- **nestjs:** add `VytchesDDDModule.forFeature()` with per-context
  `ICommandBus`, `IQueryBus`, `LOCAL_EVENT_BUS` isolation (VP-007 Phase 3)
  ([514a49b](https://github.com/vytches/ddd/commit/514a49b7))
- **nestjs:** add `ContextAwareEventDispatcher` routing `IntegrationEvent` →
  global bus, domain events → `LOCAL_EVENT_BUS` (VP-007 Phase 4)
  ([62e1566](https://github.com/vytches/ddd/commit/62e1566c))
- **nestjs:** add `FeatureHandlerRegistrar.onModuleDestroy()` calling
  `dispose()` on per-context buses (VP-007 Phase 4)
  ([62e1566](https://github.com/vytches/ddd/commit/62e1566c))

# [0.28.0](https://github.com/vytches/ddd/compare/v0.27.0...v0.28.0) (2026-05-23)

**Note:** Version bump only for package @vytches/ddd-nestjs

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.27.0 (2026-05-17)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))
- **release:** prevent changelog regeneration and add publish-only mode
  ([#59](https://github.com/vytches/ddd/issues/59))
  ([9b82753](https://github.com/vytches/ddd/commit/9b82753d3be0e225d722d9896845aeb874ad770c))
- rename variable ([#63](https://github.com/vytches/ddd/issues/63))
  ([161bda3](https://github.com/vytches/ddd/commit/161bda317346ed8ae02a4823c4b88b45950fa1dd))

### BREAKING CHANGES

- **nestjs:** None - all changes maintain backward compatibility

- chore: publish releases

* @vytches/ddd-acl@0.11.0
* @vytches/ddd-aggregates@0.11.0
* @vytches/ddd-cli@0.12.0
* @vytches/ddd-contracts@0.13.0
* @vytches/ddd-core@0.11.0
* @vytches/ddd-cqrs@0.11.0
* @vytches/ddd-di@0.11.0
* @vytches/ddd-domain-primitives@0.11.0
* @vytches/ddd-domain-services@0.11.0
* @vytches/ddd@0.12.0
* @vytches/ddd-event-scheduling@0.11.0
* @vytches/ddd-event-store@0.11.0
* @vytches/ddd-events@0.11.0
* @vytches/ddd-logging@0.11.0
* @vytches/ddd-messaging@0.11.0
* @vytches/ddd-nestjs@2.0.0
* @vytches/ddd-policies@0.12.0
* @vytches/ddd-process-managers@0.9.0
* @vytches/ddd-projections@0.11.0
* @vytches/ddd-repositories@0.11.0
* @vytches/ddd-resilience@0.11.0
* @vytches/ddd-testing@0.11.0
* @vytches/ddd-utils@0.11.0
* @vytches/ddd-validation@0.12.0
* @vytches/ddd-value-objects@0.11.0

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.25.0-beta.2 (2026-05-09)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))
- **release:** prevent changelog regeneration and add publish-only mode
  ([#59](https://github.com/vytches/ddd/issues/59))
  ([9b82753](https://github.com/vytches/ddd/commit/9b82753d3be0e225d722d9896845aeb874ad770c))
- rename variable ([#63](https://github.com/vytches/ddd/issues/63))
  ([161bda3](https://github.com/vytches/ddd/commit/161bda317346ed8ae02a4823c4b88b45950fa1dd))

### Performance Improvements

- **nestjs:** single-pass reflection + memoized auto-discovery (VP-006)
  ([0749bb7](https://github.com/vytches/ddd/commit/0749bb7234546d11e8e64d6a9a994a44ae81cc26))

### BREAKING CHANGES

- **nestjs:** None - all changes maintain backward compatibility

- chore: publish releases

* @vytches/ddd-acl@0.11.0
* @vytches/ddd-aggregates@0.11.0
* @vytches/ddd-cli@0.12.0
* @vytches/ddd-contracts@0.13.0
* @vytches/ddd-core@0.11.0
* @vytches/ddd-cqrs@0.11.0
* @vytches/ddd-di@0.11.0
* @vytches/ddd-domain-primitives@0.11.0
* @vytches/ddd-domain-services@0.11.0
* @vytches/ddd@0.12.0
* @vytches/ddd-event-scheduling@0.11.0
* @vytches/ddd-event-store@0.11.0
* @vytches/ddd-events@0.11.0
* @vytches/ddd-logging@0.11.0
* @vytches/ddd-messaging@0.11.0
* @vytches/ddd-nestjs@2.0.0
* @vytches/ddd-policies@0.12.0
* @vytches/ddd-process-managers@0.9.0
* @vytches/ddd-projections@0.11.0
* @vytches/ddd-repositories@0.11.0
* @vytches/ddd-resilience@0.11.0
* @vytches/ddd-testing@0.11.0
* @vytches/ddd-utils@0.11.0
* @vytches/ddd-validation@0.12.0
* @vytches/ddd-value-objects@0.11.0

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [12.1.2](https://github.com/vytches/ddd/compare/@vytches/ddd-nestjs@12.0.4...@vytches/ddd-nestjs@12.1.2) (2026-04-16)

**Note:** Version bump only for package @vytches/ddd-nestjs

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [12.1.2-alpha.0](https://github.com/vytches/ddd/compare/@vytches/ddd-nestjs@12.0.4...@vytches/ddd-nestjs@12.1.2-alpha.0) (2026-04-16)

### Bug Fixes

- critical quality and foundation fixes from comprehensive audit (VF-021,
  VF-022)
  ([5f00816](https://github.com/vytches/ddd/commit/5f00816e82502e080ab008cdeec92ee6fdc12e2f))
- stabilize flaky perf test, replace hardcoded paths, fix lint-staged
  ([d615d41](https://github.com/vytches/ddd/commit/d615d41fffd8c0dd0b0d6724110be3d8f417cb45))

### Features

- **enterprise:** add LLM context distribution and verification system
  ([713ab80](https://github.com/vytches/ddd/commit/713ab80c91367b32b2c2c08ead82cc8e91b18fb5))
- **nestjs:** add @ACLAdapterFor decorator for ACL auto-discovery
  ([63d06bd](https://github.com/vytches/ddd/commit/63d06bd82db7ed9df6fddbb9cfe012f38a38fd6d))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [12.1.1](https://github.com/vytches/ddd/compare/@vytches/ddd-nestjs@12.0.4...@vytches/ddd-nestjs@12.1.1) (2026-02-07)

### Bug Fixes

- security, performance & type safety hardening across 9 packages
  ([68a481d](https://github.com/vytches/ddd/commit/68a481d82e1698dcc31040547ba3c38f614b0ae8))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [12.1.0](https://github.com/vytches/ddd/compare/@vytches/ddd-nestjs@12.0.4...@vytches/ddd-nestjs@12.1.0) (2026-02-04)

### Features

- **nestjs:** add event handler auto-discovery and fix DI type errors
  ([7f9ec11](https://github.com/vytches/ddd/commit/7f9ec11816da1c49b5e30d34520f0de58c9f528b))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [12.0.6](https://github.com/vytches/ddd/compare/@vytches/ddd-nestjs@12.0.4...@vytches/ddd-nestjs@12.0.6) (2026-02-04)

**Note:** Version bump only for package @vytches/ddd-nestjs

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [12.0.5](https://github.com/vytches/ddd/compare/@vytches/ddd-nestjs@12.0.4...@vytches/ddd-nestjs@12.0.5) (2026-02-04)

**Note:** Version bump only for package @vytches/ddd-nestjs

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [12.0.4](https://github.com/vytches/ddd/compare/@vytches/ddd-nestjs@12.0.2...@vytches/ddd-nestjs@12.0.4) (2026-02-03)

### Bug Fixes

- rename variable ([#63](https://github.com/vytches/ddd/issues/63))
  ([161bda3](https://github.com/vytches/ddd/commit/161bda317346ed8ae02a4823c4b88b45950fa1dd))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [12.0.3](https://github.com/vytches/ddd/compare/@vytches/ddd-nestjs@12.0.2...@vytches/ddd-nestjs@12.0.3) (2026-02-02)

### Bug Fixes

- rename variable
  ([89fd4b7](https://github.com/vytches/ddd/commit/89fd4b710e30132eb55567a9260099b67fc23526))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [12.0.2](https://github.com/vytches/ddd/compare/@vytches/ddd-nestjs@12.0.0...@vytches/ddd-nestjs@12.0.2) (2026-02-02)

### Bug Fixes

- **release:** prevent changelog regeneration and add publish-only mode
  ([#59](https://github.com/vytches/ddd/issues/59))
  ([9b82753](https://github.com/vytches/ddd/commit/9b82753d3be0e225d722d9896845aeb874ad770c))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [12.0.1](https://github.com/vytches/ddd/compare/@vytches/ddd-nestjs@12.0.0...@vytches/ddd-nestjs@12.0.1) (2026-02-02)

### Bug Fixes

- **release:** prevent changelog regeneration and add publish-only mode
  ([#59](https://github.com/vytches/ddd/issues/59))
  ([9b82753](https://github.com/vytches/ddd/commit/9b82753d3be0e225d722d9896845aeb874ad770c))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 12.0.0 (2026-02-02)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))

## Previous Versions

- 11.1.0, 11.0.0, 10.0.0, 9.0.0, 8.0.0 - Version bumps due to historical commit
  issue
- 1.1.2 (2025-08-20) - Version bump only
- 1.1.1 (2025-08-19) - Fixed NestJS import issues
- 1.1.0 (2025-08-19) - Initial NestJS adapter for VytchesDDD integration
