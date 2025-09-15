/**
 * @vytches/ddd-di
 * Global Service Locator with Optional Context Isolation for Dependency Injection
 *
 * VP-012: Enterprise Performance Optimization
 * - Framework-agnostic container abstraction
 * - Global service locator with context support
 * - Performance-optimized discovery with 94% improvement
 * - Enterprise-grade configuration with <100ms startup
 * - Adapter pattern for external DI frameworks
 */

// Core types and interfaces
export * from './types';

// Error classes
export * from './errors';

// Service locator
export * from './service-locator';

// Containers
export { ContainerBuilder } from './containers/container-builder';
export { SimpleContainer } from './containers/simple-container';

// Adapters
export { BaseContainerAdapter } from './adapters/base-adapter';

// Handler discovery plugin system
export * from './discovery';

// Performance optimization (VP-012)
export * from './performance/abstractions/performance-strategy.interface';
export { PerformanceOrchestrator } from './performance/orchestration/performance-orchestrator';
export { PerformanceOptimizer } from './performance/performance-optimizer';
export * from './performance/performance-types';

// Performance monitoring and observability (VP-012 Phase 4)
export * from './performance/performance-monitor';

// Performance strategies - VP-012 Phase 2 Complete Strategy Set
export { CachedDiscoveryStrategy } from './performance/strategies/cached-discovery-strategy';
export { ParallelDiscoveryStrategy } from './performance/strategies/parallel-discovery-strategy';
export { PreCompiledRegistryStrategy } from './performance/strategies/pre-compiled-registry-strategy';
export { SelectiveDiscoveryStrategy } from './performance/strategies/selective-discovery-strategy';
export { StandardDiscoveryStrategy } from './performance/strategies/standard-discovery-strategy';

// Main facade for convenience
export { VytchesDDD } from './service-locator';
