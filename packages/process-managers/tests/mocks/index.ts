/**
 * Mock implementations for Process Manager testing
 *
 * This module provides enterprise-grade mock implementations for testing
 * Process Manager workflows in isolation:
 *
 * - MockProcessManager: Controllable process manager implementation for unit tests
 * - MockProcessManagerOrchestrator: Event handling and process lifecycle
 * - MockProcessManagerRepository: Persistence simulation with optimistic locking
 * - MockUnifiedEventBus: Event publishing and subscription simulation
 * - MockProcessManagerServices: External service dependency mocking
 */

export { MockProcessManager } from './mock-process-manager';

export { MockProcessManagerOrchestrator } from './mock-process-manager-orchestrator';
export type {
  EventProcessingHistory,
  MockOrchestratorOptions,
  ProcessManagerRegistration,
} from './mock-process-manager-orchestrator';

export { MockProcessManagerRepository } from './mock-process-manager-repository';
export type {
  AuditLogEntry,
  MockRepositoryOptions,
  QueryCriteria,
  RepositoryStatistics,
} from './mock-process-manager-repository';

export { MockUnifiedEventBus } from './mock-unified-event-bus';
export type {
  EventPublishHistory,
  EventSubscription,
  MockEventBusOptions,
} from './mock-unified-event-bus';

export { MockProcessManagerServices } from './mock-process-manager-services';
export type {
  CommandDispatchHistory,
  LogEntry,
  MockServicesOptions,
  EventPublishHistory as ServiceEventPublishHistory,
} from './mock-process-manager-services';
