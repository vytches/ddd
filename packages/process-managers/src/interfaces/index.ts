// Process Manager Core Interfaces
export { ProcessManagerStatus } from './process-manager.interface';
export type {
  IProcessManager,
  IProcessManagerEvent,
  ProcessManagerResult,
} from './process-manager.interface';

// State Interfaces
export type {
  IExtendedProcessManagerState,
  IProcessManagerState,
} from './process-manager-state.interface';

// Context Interfaces
export type {
  IProcessManagerContext,
  IProcessManagerServices,
} from './process-manager-context.interface';

// Repository Interfaces
export type {
  IProcessRepository,
  ProcessManagerId,
  CorrelationData,
  ProcessSnapshot,
} from './process-repository.interface';

// Process Timeout Interfaces
export * from './process-timeout.interface';
