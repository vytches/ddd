/**
 * @vytches/ddd-di
 * Global Service Locator with Optional Context Isolation for Dependency Injection
 *
 * - Framework-agnostic container abstraction
 * - Global service locator with context support
 * - Enterprise-grade configuration
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

// Main facade for convenience
export { VytchesDDD } from './service-locator';
