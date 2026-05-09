// Core classes - most commonly used
export { AggregateRoot } from './core/aggregate-root';
export { AggregateBuilder, aggregateBuilder } from './core/aggregate-root.builder';

// Capabilities (VP-005: explicit exports lock public surface against
// silent additions from new files in capabilities/)
export { AuditCapability } from './capabilities/audit-capability';
export { EventSourcingCapability } from './capabilities/event-sourcing-capability';
export { SnapshotCapability } from './capabilities/snapshot-capability';
export { VersioningCapability } from './capabilities/versioning-capability';

// Interfaces and utilities - explicit exports to reduce bundle size
export type {
  IAggregateRoot,
  IAggregateCapability,
  IAggregateConstructorParams,
  IAggregateEventHandler,
  IAggregateBuilder,
} from './aggregate-interfaces';

// Errors
export { AggregateError } from './aggregate-errors';

// Utilities - type helpers and capability functions
export type {
  AggregateWithSnapshotCapability,
  AggregateWithVersioningCapability,
  AggregateWithAuditCapability,
  AggregateWithEventSourcingCapability,
} from './core/aggregate-utilities';
export {
  asSnapshotAggregate,
  tryAsSnapshotAggregate,
  asVersioningAggregate,
  tryAsVersioningAggregate,
  asAuditAggregate,
  tryAsAuditAggregate,
  asEventSourcingAggregate,
  tryAsEventSourcingAggregate,
  getAggregateCapabilities,
  hasAllCapabilities,
} from './core/aggregate-utilities';
