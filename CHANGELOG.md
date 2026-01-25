# Changelog

All notable changes to VytchesDDD will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] - 2026-01-25

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
