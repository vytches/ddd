// Repository interfaces and implementations
export type {
  IProcessRepository,
  ProcessManagerId,
  CorrelationData,
} from '../interfaces/process-repository.interface';

// Note: ProcessSnapshot class is exported from ../core/process-snapshot

export { InMemoryProcessRepository } from './in-memory-process-repository';
export type {
  InMemoryRepositoryOptions,
  ProcessStorageEntry,
  RepositoryStatistics,
  QueryOptions,
} from './in-memory-process-repository';

export {
  ProcessRepositoryError,
  ConcurrencyError,
  ProcessValidationError,
  StorageError,
} from './process-repository-errors';
