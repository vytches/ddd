// Most commonly used - prioritized exports
export {
  IBaseDomainService,
  EventAwareDomainService,
  UnitOfWorkAwareDomainService,
  AsyncDomainService,
} from './base-domain-service';

export {
  DomainService,
  getDomainServiceMetadata,
  getDIDomainServiceMetadata,
  isDomainServicePendingDIRegistration,
} from './domain-service.decorator';

// Legacy registries and builders removed - use VytchesDDD DI system instead

// Types commonly used
export type {
  IDomainService,
  IEventBusAware,
  IUnitOfWorkAware,
  IAsyncDomainService,
} from './domain-service.interface';

export type { DomainServiceOptions } from './domain-service.decorator';
export type { EnhancedDomainServiceOptions, DIServiceMetadata } from './di-types';

// IDomainServiceRegistry interface removed - use VytchesDDD DI system instead

// Errors
export {
  ServiceDuplicateError,
  ServiceNotFoundError,
  ServiceCircularError,
} from './service.errors';

// For advanced usage - full exports
export * from './domain-service.interface';
export * from './base-domain-service';
export * from './domain-service.decorator';
// Legacy implementations removed - use VytchesDDD DI system instead
export * from './service.errors';
