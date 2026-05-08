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

// REL-005 (2026-05-08): Removed redundant `export *` from base-domain-service,
// domain-service.decorator, domain-service.interface, service.errors —
// every symbol they exposed is already named explicitly above. The
// `tests/api-surface.test.ts` snapshot guards against silent additions.
