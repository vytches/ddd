// Core aggregates - most commonly used
export {
  AggregateRoot,
  AggregateBuilder,
  AggregateTestBuilder
} from './aggregates';

// Value objects
export {
  BaseValueObject,
  EntityId
} from './value-objects';

// Errors
export {
  IDomainError,
  BaseError
} from './errors';

// Repositories
export {
  IBaseRepository
} from './repositories';

// For advanced usage - import from specific subpaths
// e.g., import { IAggregateCapability } from '@vytches-ddd/core/aggregates'
export * from './aggregates';
export * from './actor';
export * from './repositories';
export * from './errors';
export * from './value-objects';
