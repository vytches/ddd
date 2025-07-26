/**
 * @vytches/ddd-di
 * Global Service Locator with Optional Context Isolation for Dependency Injection
 *
 * Phase 1: Core Infrastructure
 * - Framework-agnostic container abstraction
 * - Global service locator with context support
 * - Simple built-in container implementation
 * - Adapter pattern for external DI frameworks
 */

// Core types and interfaces
export * from './types';

// Error classes
export * from './errors';

// Service locator
export * from './service-locator';

// Containers
export { SimpleContainer } from './containers/simple-container';
export { ContainerBuilder } from './containers/container-builder';

// Adapters
export { BaseContainerAdapter } from './adapters/base-adapter';

// Handler discovery plugin system
export * from './discovery';

// Main facade for convenience
export { VytchesDDD } from './service-locator';
