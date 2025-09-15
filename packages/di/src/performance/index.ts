/**
 * VP-012: Performance optimization exports with SOLID architecture
 */

// Main optimizer facade
export { PerformanceOptimizer } from './performance-optimizer';

// Strategy abstractions
export type {
  IPerformanceStrategy,
  IPerformanceContext,
  IPerformanceMetrics,
  IPerformanceStrategyFactory,
} from './abstractions/performance-strategy.interface';

// Orchestration
export { PerformanceOrchestrator } from './orchestration/performance-orchestrator';

// Strategies
export { StandardDiscoveryStrategy } from './strategies/standard-discovery-strategy';

// Legacy types for backward compatibility
export type {
  PerformanceConfigurationOptions,
  PerformanceMetrics,
  PerformanceMode,
  HandlerRegistry,
  HandlerRegistryEntry,
} from './performance-types';
