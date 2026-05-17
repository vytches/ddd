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

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)
- Release/2025 07 28 1 (#24)
  ([4d6f93a](https://github.com/vytches/ddd/commit/4d6f93ac80407ce7cc7106869bb12b756bc0c72c)),
  closes [#24](https://github.com/vytches/ddd/issues/24)

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

# 0.25.0-beta.2 (2026-05-09)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))
- **release:** pattern correctness bugs (REL-009)
  ([e2dd1c6](https://github.com/vytches/ddd/commit/e2dd1c6c871dcc280fffdb6d22d4d072460d3268)),
  closes [#2](https://github.com/vytches/ddd/issues/2)
  [#2](https://github.com/vytches/ddd/issues/2)
  [#3](https://github.com/vytches/ddd/issues/3)
- **release:** resolve lint errors blocking GH Packages release
  ([3618f8c](https://github.com/vytches/ddd/commit/3618f8c4814d9837b7fe6b035c1374f143cb09c3))

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

- **aggregates:** add canonical Entity, PlainDomainService, IDomainFactory
  (VF-CANON-001)
  ([7e54320](https://github.com/vytches/ddd/commit/7e543207ad51264c3c7cb6ebac469c7f2bb65b4c))
- **release:** add IBatchRepository + MemoizedSpecification (VP-002)
  ([3d06546](https://github.com/vytches/ddd/commit/3d06546eedacd0d35f29ce84bcf364f51832625c))

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

## [0.24.5](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.24.0...@vytches/ddd-contracts@0.24.5) (2026-04-16)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.24.5-alpha.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.24.0...@vytches/ddd-contracts@0.24.5-alpha.0) (2026-04-16)

### Features

- add API stability tags and API Extractor monitoring (VF-018)
  ([23a3522](https://github.com/vytches/ddd/commit/23a35228a82b4e4f549a98d87a803607f10f351e))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.24.4](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.24.0...@vytches/ddd-contracts@0.24.4) (2026-02-07)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.24.3](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.24.0...@vytches/ddd-contracts@0.24.3) (2026-02-04)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.24.2](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.24.0...@vytches/ddd-contracts@0.24.2) (2026-02-04)

### Bug Fixes

- fixing unknown type i EventConstructor
  ([6d85ef0](https://github.com/vytches/ddd/commit/6d85ef0e1abf8f92064b61e211ec074f95fcd96b))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.24.1](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.24.0...@vytches/ddd-contracts@0.24.1) (2026-02-04)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.24.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.24.0) (2026-02-02)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.23.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.23.0) (2026-02-02)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))
- **types:** replace any types with unknown for type safety
  ([ca62c05](https://github.com/vytches/ddd/commit/ca62c05facf85f576dec9b65c85c50ee5db3d37c))
- **types:** resolve TypeScript and ESLint errors across packages
  ([a611cfe](https://github.com/vytches/ddd/commit/a611cfe33a111ca21f9e0a20761df4778bf4bfba))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

### Features

- **contracts,value-objects:** standardize factory method naming convention
  ([56e9d32](https://github.com/vytches/ddd/commit/56e9d32ba787b1eb0abd05a5c90cdce48406544e)),
  closes [#5](https://github.com/vytches/ddd/issues/5)

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.22.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.22.0) (2026-01-30)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.21.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.21.0) (2026-01-26)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

### Features

- **events:** migrate eventType to eventName across all event types
  ([718f654](https://github.com/vytches/ddd/commit/718f654c4d1f44283f0399f265e791e22870c9ba))

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.20.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.20.0) (2026-01-26)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

### Features

- **events:** migrate eventType to eventName across all event types
  ([718f654](https://github.com/vytches/ddd/commit/718f654c4d1f44283f0399f265e791e22870c9ba))

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.19.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.19.0) (2025-09-21)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.18.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.18.0) (2025-09-10)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.17.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.17.0) (2025-08-31)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.16.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.16.0) (2025-08-29)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.15.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.15.0) (2025-08-29)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.14.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.14.0) (2025-08-26)

### Bug Fixes

- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.13.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.13.0) (2025-08-23)

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

### BREAKING CHANGES

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.12.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.12.0) (2025-08-20)

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

### BREAKING CHANGES

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.11.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.11.0) (2025-08-19)

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

### BREAKING CHANGES

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.10.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.10.0) (2025-08-19)

### Bug Fixes

- resolve circular dependencies across contracts, policies, testing │
  ([a0ec02c](https://github.com/vytches/ddd/commit/a0ec02cdb0b321cb660df48146c5ce64c0c3653b))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

### Features

- **aggregates:** implement VF-009 generic ID type support for aggregates
  ([078b2fa](https://github.com/vytches/ddd/commit/078b2fad2b260a1c469d20261f74d7d2f073422c))

### BREAKING CHANGES

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.9.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.9.0) (2025-08-12)

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

### BREAKING CHANGES

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.8.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.8.0) (2025-08-12)

### Code Refactoring

- **contracts:** unify domain event interfaces by merging metadata into base
  ([6b2f9ed](https://github.com/vytches/ddd/commit/6b2f9ed55e9be11158287c4203add67da7186efc))

- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)

### BREAKING CHANGES

- **contracts:** IExtendedDomainEvent interface has been removed. All domain
  events now use IDomainEvent with an optional metadata field. This eliminates
  26 dangerous type castings and simplifies the event system architecture.

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

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.7.1](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.7.1) (2025-08-11)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.7.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.7.0) (2025-08-11)

### Features

- **docs:** yaml files updated
  ([abeb16b](https://github.com/vytches/ddd/commit/abeb16bdd4abb9b7991dd9a391bc90ebd4167fed))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.6.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.6.0) (2025-08-07)

### Features

- **validation:** add AsyncCompositeSpecification implementation
  ([397a61d](https://github.com/vytches/ddd/commit/397a61d4eef892d741212f4f805869501be75408))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.5.1](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.5.0...@vytches/ddd-contracts@0.5.1) (2025-08-06)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.5.0](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.4.11...@vytches/ddd-contracts@0.5.0) (2025-07-28)

- Release/2025 07 28 1 (#24)
  ([4d6f93a](https://github.com/vytches/ddd/commit/4d6f93ac80407ce7cc7106869bb12b756bc0c72c)),
  closes [#24](https://github.com/vytches/ddd/issues/24)

### BREAKING CHANGES

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

## [0.4.12](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.4.11...@vytches/ddd-contracts@0.4.12) (2025-07-28)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.4.11](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.4.9...@vytches/ddd-contracts@0.4.11) (2025-07-27)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.4.10](https://github.com/vytches/ddd/compare/@vytches/ddd-contracts@0.4.9...@vytches/ddd-contracts@0.4.10) (2025-07-27)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.4.9 (2025-07-27)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.4.8 (2025-07-27)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.4.7 (2025-07-27)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.4.6 (2025-07-26)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.4.5 (2025-07-26)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.4.4 (2025-07-26)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.4.3 (2025-07-26)

### Bug Fixes

- transfering personal to organisation repository
  ([b0f3a7f](https://github.com/vytches/ddd/commit/b0f3a7ff215955f0721a7665a09f487dc397aade))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.4.2 (2025-07-24)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.4.1 (2025-07-24)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.4.0 (2025-07-23)

### ✨ Features

- **cli:** generating docs from cli
  ([bdb20eb](https://github.com/vytches/ddd/commit/bdb20ebb3d162bd95342491192319f3c2ff6621f))
- **docs:** all docs added
  ([20b4c32](https://github.com/vytches/ddd/commit/20b4c3201f19fdc5734c1171102fd482e82f0038))
- **docs:** linter and formatter run
  ([8f33d3f](https://github.com/vytches/ddd/commit/8f33d3f4d92e18b970c1f8e46d9d62064ec3742a))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.3.0 (2025-07-16)

### ✨ Features

- **docs:** documentationimplemented
  ([55f8ac8](https://github.com/vytches/ddd/commit/55f8ac88e75615a99dd31b7fab65e4eaac2623b4))

### 📚 Documentation

- documentations created
  ([d1c1302](https://github.com/vytches/ddd/commit/d1c13027d3c88fd21e12f3829055216d5138293a))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.2.1 (2025-07-14)

**Note:** Version bump only for package @vytches/ddd-contracts

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.2.0 (2025-07-13)

### ✨ Features

- **policies:** v2 implementation
  ([9b80cf0](https://github.com/vytches/ddd/commit/9b80cf0231369f93f4fbf6a3151ee7b88d2a8312))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.1.1 (2025-07-12)

### 📚 Documentation

- updated adrs and package.json
  ([9757e39](https://github.com/vytches/ddd/commit/9757e393317f592e66af10644268b089fd35756b))
