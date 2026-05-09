// Deprecated: Use EntityId instead of IAggregateId
// export { areAggregateIdsEqual, isAggregateId } from './aggregate-id.interface';
// export type { IAggregateId } from './aggregate-id.interface';
export type { IAggregateWithEvents } from './aggregate-interfaces';

// Domain Factory contracts (VF-CANON-001) — first-class tactical pattern
// for complex aggregate creation logic. Sibling to IRepository.
export type { IDomainFactory, IAsyncDomainFactory } from './domain-factory.interface';
