// Guard interfaces and types
export type {
  IProcessGuard,
  ProcessGuardContext,
  GuardResult,
  GuardConfiguration,
  GuardEvaluationResult,
} from './guard.interface';

export { GuardOperation, GuardSeverity } from './guard.interface';

// Base guard implementation
export { BaseProcessGuard } from './base-guard';

// Concrete guard implementations
export { StateGuard } from './state-guard';
export type { StateGuardConfiguration } from './state-guard';

export { TimeoutGuard } from './timeout-guard';
export type { TimeoutGuardConfiguration } from './timeout-guard';

export { ResourceGuard, InMemoryResourceMonitor } from './resource-guard';
export type {
  ResourceGuardConfiguration,
  ResourceLimit,
  ResourceUsage,
  IResourceMonitor,
} from './resource-guard';

// Composite guard for orchestrating multiple guards
export { CompositeGuard, GuardExecutionStrategy } from './composite-guard';
export type { CompositeGuardConfiguration } from './composite-guard';

// Guard manager for centralized guard management
export { GuardManager } from './guard-manager';
export type { GuardManagerConfiguration, GuardPerformanceMetrics } from './guard-manager';
