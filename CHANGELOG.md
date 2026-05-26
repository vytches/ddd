# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.30.0](https://github.com/vytches/ddd/compare/v0.27.0...v0.30.0) (2026-05-26)

### Bug Fixes

- **build:** externalize workspace deps to prevent absolute paths in dist
  ([f95d97b](https://github.com/vytches/ddd/commit/f95d97b61d5db4f35016561c6a8e84a60e4b0f37))

### Features

- **messaging:** add OutboxProcessor.registerDefaultHandler + comparePriority
  helper (VP-008)
  ([ac59b0a](https://github.com/vytches/ddd/commit/ac59b0ae4067bb42b4a339fc767be1ffc0d89edc))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.29.3](https://github.com/vytches/ddd/compare/v0.27.0...v0.29.3) (2026-05-25)

**Note:** Version bump only for package @vytches/ddd

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

# [0.28.0](https://github.com/vytches/ddd/compare/v0.27.0...v0.28.0) (2026-05-23)

### Bug Fixes

- **cli:** simplify npx commands and add 'ddd' binary alias for reliable npx
  resolution
  ([26011af](https://github.com/vytches/ddd/commit/26011afcd4291a971e6e93ee9f8719d2d27b4b52))
- **messaging:** add constructor validation to OutboxProcessor (TM-VP-003 D1)
  ([d4757fa](https://github.com/vytches/ddd/commit/d4757faef212aae0d73bb11ab210cbf613d83a4a))
- **messaging:** reset to PENDING before scheduleRetry to prevent PROCESSING
  lock
  ([8ae2fd1](https://github.com/vytches/ddd/commit/8ae2fd15ca1ef11b9e6d75d5157dbfe84ffeee21))
- **messaging:** resolve TS errors in outbox tests (TS4114, TS2379, TS2741)
  ([7ca10c1](https://github.com/vytches/ddd/commit/7ca10c12614539e4867e4a2420de715945f6c68b))
- **messaging:** upgrade vitest to ^4.0.0 to fix Vite 7 SSR transform compat
  ([3e1ce37](https://github.com/vytches/ddd/commit/3e1ce37d52f5ed040e97df939fbb21f6af8b89cb))
- **security:** patch 4 moderate vulnerabilities via pnpm overrides
  ([e466cfa](https://github.com/vytches/ddd/commit/e466cfa8d055ede41b92ed875fcb39eeb65bc670))
- **tests:** resolve Vitest 4 type errors in value-objects and policies
  ([9295171](https://github.com/vytches/ddd/commit/92951711a8fefa385ecb65da0c1146ec8fbef35b))

### Features

- **messaging:** add exponential backoff for outbox retry (VP-003 Part 1)
  ([04613e6](https://github.com/vytches/ddd/commit/04613e6844245e592aaf946ee234be209238876d))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.27.0 (2026-05-17)

### Bug Fixes

- adjusted vars in workflows in release.yaml
  ([#16](https://github.com/vytches/ddd/issues/16))
  ([520361c](https://github.com/vytches/ddd/commit/520361c04bd6de675cdc25a5bb161e58d1127fe1))
- **ci:** add publish-only option to release workflow
  ([#58](https://github.com/vytches/ddd/issues/58))
  ([a9c4f61](https://github.com/vytches/ddd/commit/a9c4f619435789358ce1b5aaecc2d78389e25d9f))
- **deps:** downgrade lerna to 7.4.2 (fixes packDirectory bug)
  ([#64](https://github.com/vytches/ddd/issues/64))
  ([46b46a2](https://github.com/vytches/ddd/commit/46b46a2ac3eed1f47d9b841572a8cc779ec7d740))
- fixing failing release ([#65](https://github.com/vytches/ddd/issues/65))
  ([f9e0cad](https://github.com/vytches/ddd/commit/f9e0cada01f603268fbe13a7b8acd1b886440f4c))
- fixing release.yaml adding no-git-checks flag
  ([#67](https://github.com/vytches/ddd/issues/67))
  ([9bf906f](https://github.com/vytches/ddd/commit/9bf906f522bee59dad02dac05a5c66b1a185032b))
- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))
- **release:** add packages:write permission and use GITHUB_TOKEN for publishing
  ([#66](https://github.com/vytches/ddd/issues/66))
  ([68f1103](https://github.com/vytches/ddd/commit/68f1103fcf46948d5eda7df853dca0b68ff4c209))
- **release:** prevent changelog regeneration and add publish-only mode
  ([#59](https://github.com/vytches/ddd/issues/59))
  ([9b82753](https://github.com/vytches/ddd/commit/9b82753d3be0e225d722d9896845aeb874ad770c))
- rename variable ([#63](https://github.com/vytches/ddd/issues/63))
  ([161bda3](https://github.com/vytches/ddd/commit/161bda317346ed8ae02a4823c4b88b45950fa1dd))
- **scripts:** remove references to non-existent packages
  ([#54](https://github.com/vytches/ddd/issues/54))
  ([251c2d6](https://github.com/vytches/ddd/commit/251c2d6e8759461bbfa1644f71eb00d80f5de6c1))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)
- Release/2025 07 28 1 (#24)
  ([4d6f93a](https://github.com/vytches/ddd/commit/4d6f93ac80407ce7cc7106869bb12b756bc0c72c)),
  closes [#24](https://github.com/vytches/ddd/issues/24)

### Features

- add GitHub App authentication for releases
  ([#15](https://github.com/vytches/ddd/issues/15))
  ([b85df7e](https://github.com/vytches/ddd/commit/b85df7edd75ccdc8ec1588a88a340faf49136a8f))

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

- Enterprise package no longer bundles dependencies. Users must install all
  required @vytches/ddd-\* packages.

This aligns with industry standards (TanStack Query, Zod) where meta-packages
are thin re-export layers, not fat bundles.

- refactor: build refactored

- refactor(contracts): unify domain event interfaces by merging metadata into
  base
- IExtendedDomainEvent interface has been removed. All domain events now use
  IDomainEvent with an optional metadata field. This eliminates 26 dangerous
  type castings and simplifies the event system architecture.

  Migration guide:

  - Replace all imports of IExtendedDomainEvent with IDomainEvent
  - Remove unnecessary type castings to IExtendedDomainEvent
  - The metadata field is now optional on IDomainEvent

  Benefits:

  - Eliminates type casting risks across the codebase
  - Simplifies event interface hierarchy
  - Improves type safety and developer experience
  - Reduces cognitive load when working with events

  Affected packages: contracts, events, aggregates, messaging, projections,
  event-scheduling, event-store, repositories, domain-services

- fix: fix merge conflict issues

- chore: publish releases

* @vytches/ddd-acl@0.6.0
* @vytches/ddd-aggregates@0.6.0
* @vytches/ddd-cli@0.7.0
* @vytches/ddd-contracts@0.8.0
* @vytches/ddd-core@0.6.0
* @vytches/ddd-cqrs@0.6.0
* @vytches/ddd-di@0.6.0
* @vytches/ddd-domain-primitives@0.6.0
* @vytches/ddd-domain-services@0.6.0
* @vytches/ddd@0.7.0
* @vytches/ddd-event-scheduling@0.6.0
* @vytches/ddd-event-store@0.6.0
* @vytches/ddd-events@0.6.0
* @vytches/ddd-logging@0.6.0
* @vytches/ddd-messaging@0.6.0
* @vytches/ddd-policies@0.7.0
* @vytches/ddd-projections@0.6.0
* @vytches/ddd-repositories@0.6.0
* @vytches/ddd-resilience@0.6.0
* @vytches/ddd-testing@0.6.0
* @vytches/ddd-utils@0.6.0
* @vytches/ddd-validation@0.7.0
* @vytches/ddd-value-objects@0.6.0

- None - maintains full API compatibility

  Or if you prefer a shorter version:

  fix(build): bundle types for meta-packages to fix package resolution

  Add bundle-meta-types step to build pipeline to generate inline type
  definitions instead of re-exports. Fixes "Cannot find module '@vytches/ddd'"
  error in published packages on GitHub Packages registry.

  - Modified build script to run bundle-meta-types after fix:dts
  - Generates 292-line index.d.ts with all types bundled inline
  - Fixes @vytches/ddd 0.6.0 package resolution issues

- chore: publish releases

* @vytches/ddd-acl@0.5.1
* @vytches/ddd-aggregates@0.5.1
* @vytches/ddd-cli@0.6.1
* @vytches/ddd-contracts@0.7.1
* @vytches/ddd-core@0.5.1
* @vytches/ddd-cqrs@0.5.1
* @vytches/ddd-di@0.5.1
* @vytches/ddd-domain-primitives@0.5.1
* @vytches/ddd-domain-services@0.5.1
* @vytches/ddd@0.6.1
* @vytches/ddd-event-scheduling@0.5.1
* @vytches/ddd-event-store@0.5.1
* @vytches/ddd-events@0.5.1
* @vytches/ddd-logging@0.5.1
* @vytches/ddd-messaging@0.5.1
* @vytches/ddd-policies@0.6.1
* @vytches/ddd-projections@0.5.1
* @vytches/ddd-repositories@0.5.1
* @vytches/ddd-resilience@0.5.1
* @vytches/ddd-testing@0.5.1
* @vytches/ddd-utils@0.5.1
* @vytches/ddd-validation@0.6.1
* @vytches/ddd-value-objects@0.5.1

- fix: folder removed
- Enterprise package no longer bundles dependencies. Users must install all
  required @vytches/ddd-\* packages.

This aligns with industry standards (TanStack Query, Zod) where meta-packages
are thin re-export layers, not fat bundles.

- refactor: build refactored

- chore: publish releases

* @vytches/ddd-acl@0.3.12
* @vytches/ddd-aggregates@0.3.12
* @vytches/ddd-cli@0.4.12
* @vytches/ddd-contracts@0.4.12
* @vytches/ddd-core@0.3.12
* @vytches/ddd-cqrs@0.3.12
* @vytches/ddd-di@0.3.12
* @vytches/ddd-domain-primitives@0.3.12
* @vytches/ddd-domain-services@0.3.12
* @vytches/ddd@0.4.0
* @vytches/ddd-event-scheduling@0.3.12
* @vytches/ddd-event-store@0.3.12
* @vytches/ddd-events@0.3.12
* @vytches/ddd-logging@0.3.12
* @vytches/ddd-messaging@0.3.12
* @vytches/ddd-policies@0.4.12
* @vytches/ddd-projections@0.3.12
* @vytches/ddd-repositories@0.3.12
* @vytches/ddd-resilience@0.3.12
* @vytches/ddd-testing@0.3.10
* @vytches/ddd-utils@0.3.10
* @vytches/ddd-validation@0.3.12
* @vytches/ddd-value-objects@0.3.12

- refactor: build refactored

- refactor: build refactored

- refactor: build refactored

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.26.0 (2026-05-17)

### Bug Fixes

- **messaging:** repair broken declaration file caused by JSDoc inline block
  comments (`/* ... */`) terminating JSDoc blocks early, causing
  `TS1160: Unterminated template literal` in consumers
  ([#fix-messaging-dts](https://github.com/vytches/ddd/commit/d9638a04))
- **build:** remove deprecated Enhanced Metadata System V2 (YAML JSDoc
  injection) from build pipeline — was the root cause of the `/* ... */`
  injection into `.d.ts` files

### Features

- **aggregates:** add `Entity<TId>` abstract base class — canonical non-root
  domain entity with identity-based equality (Evans/Vernon shape), sibling to
  `AggregateRoot`
- **domain-services:** add `PlainDomainService` abstract class —
  infrastructure-free service base with only `serviceId`, for lightweight domain
  services
- **contracts:** add `IDomainFactory<TAgg, TProps>` and `IAsyncDomainFactory` —
  factory pattern contracts returning `Result<TAgg, Error>`, sibling to
  `IRepository`
- **contracts:** add `IBatchRepository<T>` — N+1 prevention contract, extends
  `IExtendedRepository` with order-preserving `findByIds()` (null for misses)
- **validation:** add `MemoizedSpecification<T>` — per-candidate WeakMap cache
  for repeated `isSatisfiedBy` calls, with `invalidate()` for manual eviction
- **aggregates:** `AggregateRoot.apply()` performance refactor — unified
  one-pass enrichment, eliminates duplicate `Object.create` and double
  `sanitizeMetadata`. Single-event apply +3.9%, 100-event replay +21.7% (~3.9M
  events/s)
- **nestjs:** `AutoDiscoveryService` cold-start optimization — single-pass
  `Reflect.getMetadataKeys` + WeakSet memoization, ~15-30ms savings on
  10-context deployments
- **messaging:** `OutboxProcessor` parallel dispatch documented — contract
  guarantees parallel fan-out on status success vs serial failure-first handling

### Tests

- Global library coverage: 63.98% → **69.29%** (+5.3pp). Foundation tier,
  capabilities, integration layers, DI/CQRS configuration all moved to >80%
  (VT-002..005)

### Chores

- Remove deprecated YAML JSDoc injection system (393 files, 16 scripts, CI
  steps)
- Version unification: all `@vytches/ddd-*` packages aligned via `fixed`
  changeset group

# 0.25.0-beta.2 (2026-05-09)

### Bug Fixes

- adjusted vars in workflows in release.yaml
  ([#16](https://github.com/vytches/ddd/issues/16))
  ([520361c](https://github.com/vytches/ddd/commit/520361c04bd6de675cdc25a5bb161e58d1127fe1))
- **ci:** add publish-only option to release workflow
  ([#58](https://github.com/vytches/ddd/issues/58))
  ([a9c4f61](https://github.com/vytches/ddd/commit/a9c4f619435789358ce1b5aaecc2d78389e25d9f))
- **config:** repair Nx project graph + validate:types script (REL-002)
  ([a10b878](https://github.com/vytches/ddd/commit/a10b87822392a87acf81945f86273c4d461a8f6b))
- **deps:** downgrade lerna to 7.4.2 (fixes packDirectory bug)
  ([#64](https://github.com/vytches/ddd/issues/64))
  ([46b46a2](https://github.com/vytches/ddd/commit/46b46a2ac3eed1f47d9b841572a8cc779ec7d740))
- **enterprise:** unblock verify-llm-context — move inline comments out of
  export block
  ([0bf883d](https://github.com/vytches/ddd/commit/0bf883d353d9cdd6fb6f4f6ca6d8517e2af1b2e1))
- fixing failing release ([#65](https://github.com/vytches/ddd/issues/65))
  ([f9e0cad](https://github.com/vytches/ddd/commit/f9e0cada01f603268fbe13a7b8acd1b886440f4c))
- fixing release.yaml adding no-git-checks flag
  ([#67](https://github.com/vytches/ddd/issues/67))
  ([9bf906f](https://github.com/vytches/ddd/commit/9bf906f522bee59dad02dac05a5c66b1a185032b))
- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))
- **release:** add packages:write permission and use GITHUB_TOKEN for publishing
  ([#66](https://github.com/vytches/ddd/issues/66))
  ([68f1103](https://github.com/vytches/ddd/commit/68f1103fcf46948d5eda7df853dca0b68ff4c209))
- **release:** patch 18 transitive security vulnerabilities pre-release
  ([0d1ad03](https://github.com/vytches/ddd/commit/0d1ad03f53fadd479423d9b10bb69af37aa55ae1))
- **release:** pattern correctness bugs (REL-009)
  ([e2dd1c6](https://github.com/vytches/ddd/commit/e2dd1c6c871dcc280fffdb6d22d4d072460d3268)),
  closes [#2](https://github.com/vytches/ddd/issues/2)
  [#2](https://github.com/vytches/ddd/issues/2)
  [#3](https://github.com/vytches/ddd/issues/3)
- **release:** prevent changelog regeneration and add publish-only mode
  ([#59](https://github.com/vytches/ddd/issues/59))
  ([9b82753](https://github.com/vytches/ddd/commit/9b82753d3be0e225d722d9896845aeb874ad770c))
- **release:** resolve lint errors blocking GH Packages release
  ([3618f8c](https://github.com/vytches/ddd/commit/3618f8c4814d9837b7fe6b035c1374f143cb09c3))
- **release:** security hardening before public publish (REL-007)
  ([7c5d942](https://github.com/vytches/ddd/commit/7c5d942655b70fe7e68a9f406c9dd949d2f12d9b))
- rename variable ([#63](https://github.com/vytches/ddd/issues/63))
  ([161bda3](https://github.com/vytches/ddd/commit/161bda317346ed8ae02a4823c4b88b45950fa1dd))
- **scripts:** remove references to non-existent packages
  ([#54](https://github.com/vytches/ddd/issues/54))
  ([251c2d6](https://github.com/vytches/ddd/commit/251c2d6e8759461bbfa1644f71eb00d80f5de6c1))
- **utils:** mark @vytches/ddd-contracts as external in utils bundle
  ([faf55be](https://github.com/vytches/ddd/commit/faf55be0050e103d52d6ba011899d5c4640af0c7))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)
- Release/2025 07 28 1 (#24)
  ([4d6f93a](https://github.com/vytches/ddd/commit/4d6f93ac80407ce7cc7106869bb12b756bc0c72c)),
  closes [#24](https://github.com/vytches/ddd/issues/24)

### Features

- add GitHub App authentication for releases
  ([#15](https://github.com/vytches/ddd/issues/15))
  ([b85df7e](https://github.com/vytches/ddd/commit/b85df7edd75ccdc8ec1588a88a340faf49136a8f))
- **aggregates:** add canonical Entity, PlainDomainService, IDomainFactory
  (VF-CANON-001)
  ([7e54320](https://github.com/vytches/ddd/commit/7e543207ad51264c3c7cb6ebac469c7f2bb65b4c))
- **release:** add ddd-lint MVP with 3 compliance rules (VF-001)
  ([8ff9a9a](https://github.com/vytches/ddd/commit/8ff9a9a23b58bbbb6835d500a8dfde51e236c8bc))
- **release:** add IBatchRepository + MemoizedSpecification (VP-002)
  ([3d06546](https://github.com/vytches/ddd/commit/3d06546eedacd0d35f29ce84bcf364f51832625c))
- **release:** consumer LLM bundle generator + fix ddd-lint test fixture
  ([7d8cf2e](https://github.com/vytches/ddd/commit/7d8cf2e0d7597eac64a4b95733204e7407350d3c))
- **release:** llm-first bundle pipeline (REL-010)
  ([0c2573d](https://github.com/vytches/ddd/commit/0c2573d767c61f76f59a0d88f8d4899efb7a821a))

### Performance Improvements

- **aggregates:** unify apply() Object.create + fast-path sanitizeMetadata
  (VP-NEW-002)
  ([5415547](https://github.com/vytches/ddd/commit/541554706f1614e759c3d14aa76261e24b53a1e3))
- **nestjs:** single-pass reflection + memoized auto-discovery (VP-006)
  ([0749bb7](https://github.com/vytches/ddd/commit/0749bb7234546d11e8e64d6a9a994a44ae81cc26))
- **release:** cleanup wildcard exports in aggregates + testing seeder (VP-005)
  ([24c300d](https://github.com/vytches/ddd/commit/24c300dd2a230fdfad8ce879ee71eff00de9eae2))
- **release:** perf baselines + 3 zero-risk quick wins (VP-NEW-001)
  ([3cb9eb3](https://github.com/vytches/ddd/commit/3cb9eb3b86015472652adcf290b6818fb3825523))

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

- Enterprise package no longer bundles dependencies. Users must install all
  required @vytches/ddd-\* packages.

This aligns with industry standards (TanStack Query, Zod) where meta-packages
are thin re-export layers, not fat bundles.

- refactor: build refactored

- refactor(contracts): unify domain event interfaces by merging metadata into
  base
- IExtendedDomainEvent interface has been removed. All domain events now use
  IDomainEvent with an optional metadata field. This eliminates 26 dangerous
  type castings and simplifies the event system architecture.

  Migration guide:

  - Replace all imports of IExtendedDomainEvent with IDomainEvent
  - Remove unnecessary type castings to IExtendedDomainEvent
  - The metadata field is now optional on IDomainEvent

  Benefits:

  - Eliminates type casting risks across the codebase
  - Simplifies event interface hierarchy
  - Improves type safety and developer experience
  - Reduces cognitive load when working with events

  Affected packages: contracts, events, aggregates, messaging, projections,
  event-scheduling, event-store, repositories, domain-services

- fix: fix merge conflict issues

- chore: publish releases

* @vytches/ddd-acl@0.6.0
* @vytches/ddd-aggregates@0.6.0
* @vytches/ddd-cli@0.7.0
* @vytches/ddd-contracts@0.8.0
* @vytches/ddd-core@0.6.0
* @vytches/ddd-cqrs@0.6.0
* @vytches/ddd-di@0.6.0
* @vytches/ddd-domain-primitives@0.6.0
* @vytches/ddd-domain-services@0.6.0
* @vytches/ddd@0.7.0
* @vytches/ddd-event-scheduling@0.6.0
* @vytches/ddd-event-store@0.6.0
* @vytches/ddd-events@0.6.0
* @vytches/ddd-logging@0.6.0
* @vytches/ddd-messaging@0.6.0
* @vytches/ddd-policies@0.7.0
* @vytches/ddd-projections@0.6.0
* @vytches/ddd-repositories@0.6.0
* @vytches/ddd-resilience@0.6.0
* @vytches/ddd-testing@0.6.0
* @vytches/ddd-utils@0.6.0
* @vytches/ddd-validation@0.7.0
* @vytches/ddd-value-objects@0.6.0

- None - maintains full API compatibility

  Or if you prefer a shorter version:

  fix(build): bundle types for meta-packages to fix package resolution

  Add bundle-meta-types step to build pipeline to generate inline type
  definitions instead of re-exports. Fixes "Cannot find module '@vytches/ddd'"
  error in published packages on GitHub Packages registry.

  - Modified build script to run bundle-meta-types after fix:dts
  - Generates 292-line index.d.ts with all types bundled inline
  - Fixes @vytches/ddd 0.6.0 package resolution issues

- chore: publish releases

* @vytches/ddd-acl@0.5.1
* @vytches/ddd-aggregates@0.5.1
* @vytches/ddd-cli@0.6.1
* @vytches/ddd-contracts@0.7.1
* @vytches/ddd-core@0.5.1
* @vytches/ddd-cqrs@0.5.1
* @vytches/ddd-di@0.5.1
* @vytches/ddd-domain-primitives@0.5.1
* @vytches/ddd-domain-services@0.5.1
* @vytches/ddd@0.6.1
* @vytches/ddd-event-scheduling@0.5.1
* @vytches/ddd-event-store@0.5.1
* @vytches/ddd-events@0.5.1
* @vytches/ddd-logging@0.5.1
* @vytches/ddd-messaging@0.5.1
* @vytches/ddd-policies@0.6.1
* @vytches/ddd-projections@0.5.1
* @vytches/ddd-repositories@0.5.1
* @vytches/ddd-resilience@0.5.1
* @vytches/ddd-testing@0.5.1
* @vytches/ddd-utils@0.5.1
* @vytches/ddd-validation@0.6.1
* @vytches/ddd-value-objects@0.5.1

- fix: folder removed
- Enterprise package no longer bundles dependencies. Users must install all
  required @vytches/ddd-\* packages.

This aligns with industry standards (TanStack Query, Zod) where meta-packages
are thin re-export layers, not fat bundles.

- refactor: build refactored

- chore: publish releases

* @vytches/ddd-acl@0.3.12
* @vytches/ddd-aggregates@0.3.12
* @vytches/ddd-cli@0.4.12
* @vytches/ddd-contracts@0.4.12
* @vytches/ddd-core@0.3.12
* @vytches/ddd-cqrs@0.3.12
* @vytches/ddd-di@0.3.12
* @vytches/ddd-domain-primitives@0.3.12
* @vytches/ddd-domain-services@0.3.12
* @vytches/ddd@0.4.0
* @vytches/ddd-event-scheduling@0.3.12
* @vytches/ddd-event-store@0.3.12
* @vytches/ddd-events@0.3.12
* @vytches/ddd-logging@0.3.12
* @vytches/ddd-messaging@0.3.12
* @vytches/ddd-policies@0.4.12
* @vytches/ddd-projections@0.3.12
* @vytches/ddd-repositories@0.3.12
* @vytches/ddd-resilience@0.3.12
* @vytches/ddd-testing@0.3.10
* @vytches/ddd-utils@0.3.10
* @vytches/ddd-validation@0.3.12
* @vytches/ddd-value-objects@0.3.12

- refactor: build refactored

- refactor: build refactored

- refactor: build refactored

# Changelog

All notable changes to `@vytches/ddd` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.25.0-beta.1] — 2026-05-09

**First public release on npmjs.org.** Prior versions (0.22.x – 0.24.x and an
internal "3.0" milestone) shipped on GitHub Packages — they remain available
there but are not maintained going forward.

### 🚨 Breaking changes

- **`EnhancedCommandBus` resilience defaults are now opt-in** (REL-009).
  Previously circuit breaker and retry activated unless explicitly disabled
  (`enabled !== false`). Now both require `enabled: true`. Retrying domain
  commands silently caused potential duplicate-execution bugs (orders created
  twice, double charges). Timeout strategy remains default-on as it does not
  affect idempotency. Migration:

  ```ts
  // Before:
  new EnhancedCommandBus(container); // retry was on
  // After (if you actually want retry):
  new EnhancedCommandBus(container, {
    resilience: { retry: { enabled: true, maxAttempts: 3 } },
  });
  ```

- **`IAggregateSnapshot.aggregateId` is now `string`** (was `unknown`, REL-009).
  Implementation already produced strings; type just made consumers cast. A
  divergent dead-duplicate of the interface was removed from
  `packages/aggregates/src/aggregate-interfaces.ts` — the canonical definition
  lives in `@vytches/ddd-contracts`.

- **`Result<T, E>` has moved to `@vytches/ddd-contracts`** (REL-008). Existing
  `import { Result } from '@vytches/ddd-utils'` continues to work via a
  re-export shim. New code should import from `@vytches/ddd-contracts` directly.

- **`@internal` symbols removed from the curated public surface** (REL-005):
  `EVENT_HANDLER_METADATA`, `EVENT_HANDLER_OPTIONS`, `CUSTOM_MIDDLEWARE_SYMBOL`
  are no longer re-exported by the `@vytches/ddd` meta-package. They remain
  accessible via direct sub-package imports (`@vytches/ddd-contracts`,
  `@vytches/ddd-events`) for framework integrations only.

### ⚠️ Deprecations (will be removed in 1.0.0)

- **`EntityIdFactory`** and all its static methods (`createWithRandomUUID`,
  `fromUUID`, `fromInteger`, `fromBigInt`, `fromText`) now emit a one-time
  runtime `console.warn` per call site. Migrate to `EntityId.create()` /
  `EntityId.fromUUID()` etc. directly. Hard removal targeted for `v1.0.0` after
  community feedback (REL-005).

### 🐛 Bug fixes

- **`BaseRepository.save()` now calls `aggregate.commit()`** after dispatch
  (REL-009). Previously the same events would re-dispatch on every subsequent
  `save()`. Silent because most code paths call `save()` once per command.
- **`OrPolicyComposer` now aggregates all sub-violations** instead of returning
  only the first (REL-009). Failure result includes `details.violations[]` with
  `policyId`, `code`, `message`, `field` per failed branch.
- **`CommandBus.getHandlerToken` now throws `CQRSConfigurationError`** (was
  generic `Error`) for missing decorator metadata, matching `QueryBus` behavior
  (REL-009).

### 🔒 Security

- **`deserializeIntegrationEvent` utility now sanitizes** input — was raw
  `JSON.parse` with no size limit, no prototype-pollution protection, no
  recursion-depth limit (REL-007). Now uses the same `safeParseIntegrationJson`
  helper as the class-based `deserialize()`: 1 MB hard cap, 50-level depth
  limit, and `__proto__/constructor/prototype` key stripping.
- **`sanitizeIntegrationPayload` is now bounded** at 50 levels of recursion
  (REL-007). Previously unbounded — adversarial payloads could cause stack
  overflow.
- **1 MB size cap is enforced on actual UTF-8 byte length** (REL-007), not
  UTF-16 code-unit count. Previously a string of 1M code units could contain up
  to 4 MB of multi-byte content.
- **`AggregateRoot.maxEvents` advisory limit** (optional, default undefined for
  backward compat) — guards against runaway loops or malicious replay (REL-007).
- **AI SDK peer dependencies removed** from `@vytches/ddd-testing`
  (`@anthropic-ai/sdk`, `openai`) — they were declared but never imported in
  source. Removes spurious npm install warnings (REL-007).
- **`validation.rules.pattern` JSDoc** now warns explicitly against ReDoS via
  consumer-controlled RegExp construction (REL-007).
- **`.env.development` removed from git tracking** (REL-007). History audited —
  file was always 0 bytes, no secrets ever committed.

### ⚡ Performance

Three zero-risk runtime optimizations (no API changes, VP-NEW-001):

- **`BaseEventBus.publish()` early shortcircuit** — skips middleware pipeline
  entirely when no handlers are registered.
- **`CQRSDiscoveryPlugin.scanModule()` memoized** via WeakMap — repeat scans of
  the same module reference are O(1).
- **`EnhancedQueryBus.getCacheKey()` uses FNV-1a 32-bit hash** instead of
  `JSON.stringify(query)` — ~5-10× faster on the cache lookup hot path.

Baselines published in `benchmarks/baseline.json` (Node 22, dev hardware): 1.58M
`apply()`/sec, 8.35M `EntityId.create()`/sec, 15.7M `isValidUUID()`/sec.

### 📚 Documentation

- **README rewritten** from 1362 lines to 199 lines (REL-006). Removed
  references to non-existent packages (`@vytches/ddd-event-store`,
  `@vytches/ddd-core`, `@vytches/ddd-cli`) and to the deprecated CLI. Added
  explicit "Design Decisions" section explaining no-sagas / no-adapters /
  dependency-free / framework-agnostic stance.
- **QUICK_START.md** cleaned (REL-006): removed `npx @vytches/ddd init-context`
  reference (CLI was deprecated), added required tsconfig flags, AI-Assisted
  Development section.
- **`LLMGUIDE.md` shipped in all 20 packages** (REL-001) — per-package
  AI-assistant onboarding documents.
- **3 example workspaces** (REL-006 / VD-002 / VD-003):
  - `examples/quickstart/` — full Order domain (16 tests)
  - `examples/policies/` — 8 policy patterns (17 tests)
  - `examples/domain-services/` — 7 service patterns (17 tests)
- **Performance benchmarks** in `benchmarks/` with committed baseline
  (`pnpm bench`).

### 🛠️ Tooling

- **LLM-first DX** (REL-010): three new scripts
  - `pnpm llm:bundle` — generate full library context for AI assistants
  - `pnpm llm:verify` — drift detector for `docs/llm-context.md`
  - `pnpm llm:guides:check` — gate ensuring every package ships `LLMGUIDE.md`.
    Added to `prerelease`.
- **20 API surface snapshot tests** added in REL-005
  (`packages/*/tests/api-surface.test.ts`) — locks public API; future changes
  require explicit `vitest -u` acceptance.
- **Test stabilization** (VT-001 subset):
  - 2 flaky timer tests fixed via `vi.useFakeTimers`
  - 5 `describe.skip` blocks converted to `describe.todo`
  - removed flaky `toBeGreaterThan(0.5ms)` assertions
- **`Nx` project graph repaired** (REL-002) — `.claude/worktrees/` exclusion +
  empty `packages/cli/` cleanup. Fixes `MultipleProjectsWithSameNameError`.
- **Foundation purity restored** (REL-008): `@vytches/ddd-contracts` has zero
  workspace dependencies. `Result<T, E>` moved here from `@vytches/ddd-utils`.

### 📦 Distribution

- Published to **public npmjs.org** (was GitHub Packages, REL-003 / REL-011).
  Old versions remain on GH Packages as legacy archive but receive no updates.
  `npm install @vytches/ddd` no longer requires a `$GITHUB_TOKEN`.
- All 20 packages aligned to `0.25.0-beta.1` (REL-004 — were 0.22.x–0.24.5 with
  `@vytches/ddd-nestjs` incorrectly at `12.1.2`).

### 🧹 Removed

- `@vytches/ddd-cli` package (already deleted by VF-013; this release cleans the
  empty skeleton + dead `cli:*`, `docs:*`, `playground*` scripts from root
  `package.json`). Replaced by AI-assisted scaffolding via `LLMGUIDE.md` files.
- 11 dead/redundant `export *` wildcards across `di`, `domain-services`,
  `aggregates`, `testing/seeder` barrels (REL-005 / VP-005). Surface tests now
  lock the public API; remaining wildcards in `enterprise` and a few sub-paths
  are protected by snapshots.

---

## [3.0.0] - 2026-01-25 (internal — pre-public)

### 🚨 BREAKING CHANGES

#### Event Property Rename: `eventType` → `eventName`

**Motivation:** Improved naming consistency and clarity across the entire event
system.

**What Changed:**

- All event interfaces (`IDomainEvent`, `IIntegrationEvent`, `IAuditEvent`) now
  use `eventName` instead of `eventType`
- All event base classes (`DomainEvent`, `IntegrationEvent`) updated to use
  `eventName`
- All internal event handling logic updated to use `eventName`

**Migration Required:** Yes - Simple search & replace in your codebase

**Migration Guide:** See [MIGRATION_GUIDE_v3.md](./MIGRATION_GUIDE_v3.md)

**Affected Packages:**

- `@vytches/ddd-contracts` - Core event interfaces
- `@vytches/ddd-events` - Event implementations and utilities
- `@vytches/ddd-aggregates` - Aggregate event handling
- `@vytches/ddd-cqrs` - Command/Query event integration
- `@vytches/ddd-messaging` - Saga event processing
- `@vytches/ddd-event-store` - Event persistence
- `@vytches/ddd-projections` - Event projections
- All other packages using events

### Changed

- **contracts**: `IDomainEvent.eventType` → `IDomainEvent.eventName`
- **events**: `DomainEvent.eventType` → `DomainEvent.eventName`
- **events**: `IntegrationEvent.eventType` → `IntegrationEvent.eventName`
- **events**: `IAuditEvent.eventType` → `IAuditEvent.eventName`
- **events**: All event handler methods updated to use `eventName`
- **events**: Event serialization now uses `eventName` field
- **events**: Base event bus methods renamed parameter from `eventType` to
  `eventName`

### Fixed

- **events**: Variable shadowing conflicts in `BaseEventBus` methods resolved
- **events**: Consistent naming across all event types (domain, integration,
  audit)

### Documentation

- **Added**: Comprehensive migration guide (MIGRATION_GUIDE_v3.md)
- **Updated**: All README files to use `eventName`
- **Updated**: All code examples to use `eventName`
- **Updated**: HOW-TO guides to use `eventName`

### Tests

- **Updated**: All test files to use `eventName`
- **Verified**: 49/49 tests passing after migration
- **Added**: Test coverage for new `eventName` property

---

## [2.x] - Previous Releases

For changes in v2.x releases, please refer to individual package CHANGELOG files
or git history.

---

## Migration Support

- **v2.x Support Period:** Until 2026-06-30
- **Migration Guide:** [MIGRATION_GUIDE_v3.md](./MIGRATION_GUIDE_v3.md)
- **Issues:** https://github.com/vytches/ddd/issues
- **Documentation:** https://docs.vytches.com/ddd
