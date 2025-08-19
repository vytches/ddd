// Repository interfaces and implementations
export type {
  IProcessRepository,
  ProcessManagerId,
  CorrelationData,
  ProcessSnapshot,
} from '../interfaces/process-repository.interface';

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
  ValidationError,
  StorageError,
} from './process-repository-errors';
