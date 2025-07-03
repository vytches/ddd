// Core classes - most commonly used
export { AggregateRoot } from './aggregate-root';
export {
  AggregateBuilder,
  AggregateTestBuilder,
  LightweightAggregateBuilder,
  FullFeaturedAggregateBuilder,
  createAggregateWithConfig
} from './aggregate-root.builder';

// Capabilities
export * from './capabilities';

// Interfaces and utilities - explicit exports to reduce bundle size
export type {
  IAggregateRoot,
  IAggregateCapability,
  IAggregateConstructorParams,
  IAggregateEventHandler,
  IAggregateBuilder
} from './aggregate-interfaces';

// Errors
export {
  AggregateError,
  VersionError
} from './aggregate-errors';

// Utilities - type helpers and capability functions
export type {
  AggregateWithSnapshotCapability,
  AggregateWithVersioningCapability,
  AggregateWithAuditCapability,
  AggregateWithEventSourcingCapability
} from './aggregate-utilities';
export {
  asSnapshotAggregate,
  asVersioningAggregate,
  asAuditAggregate,
  asEventSourcingAggregate,
  getAggregateCapabilities,
  hasAllCapabilities
} from './aggregate-utilities';
