// Most commonly used - prioritized exports
export {
  AsyncDomainService,
  EventAwareDomainService,
  IBaseDomainService,
  UnitOfWorkAwareDomainService,
} from './base-domain-service';

export {
  DomainService,
  getDIDomainServiceMetadata,
  getDomainServiceMetadata,
  isDomainServicePendingDIRegistration,
} from './domain-service.decorator';

// Legacy registries and builders removed - use VytchesDDD DI system instead

// Types commonly used
export type {
  IAsyncDomainService,
  IDomainService,
  IEventBusAware,
  IUnitOfWorkAware,
} from './domain-service.interface';

export type { DIServiceMetadata, EnhancedDomainServiceOptions } from './di-types';
export type { DomainServiceOptions } from './domain-service.decorator';

// IDomainServiceRegistry interface removed - use VytchesDDD DI system instead

// Errors
export {
  ServiceCircularError,
  ServiceDuplicateError,
  ServiceNotFoundError,
} from './service.errors';

// For advanced usage - full exports
export * from './base-domain-service';
export * from './domain-service.decorator';
export * from './domain-service.interface';
// Legacy implementations removed - use VytchesDDD DI system instead
export * from './service.errors';
