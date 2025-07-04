// Base repository implementation
export { IBaseRepository, VersionError, type IRepositoryAggregate } from './base-repository';

// Repository interfaces
export type {
  IRepository,
  IRepositoryProvider,
  IExtendedRepository
} from './base-repository.interface';

// Unit of work interface
export type { IUnitOfWork } from './unit-of-work.interface';
