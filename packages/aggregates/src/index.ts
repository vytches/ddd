// Core classes - most commonly used
export { AggregateRoot } from './core/aggregate-root';
export { AggregateBuilder, aggregateBuilder } from './core/aggregate-root.builder';

// Capabilities
export * from './capabilities';

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
  asVersioningAggregate,
  asAuditAggregate,
  asEventSourcingAggregate,
  getAggregateCapabilities,
  hasAllCapabilities,
} from './core/aggregate-utilities';
