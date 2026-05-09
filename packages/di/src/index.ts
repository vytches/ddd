/**
 * @vytches/ddd-di
 * Global Service Locator with Optional Context Isolation for Dependency Injection
 *
 * - Framework-agnostic container abstraction
 * - Global service locator with context support
 * - Enterprise-grade configuration
 * - Adapter pattern for external DI frameworks
 *
 * REL-005 (2026-05-08): wildcard `export *` replaced with explicit exports
 * to prevent silent leakage of newly added internal symbols. The
 * `tests/api-surface.test.ts` snapshot locks the public surface.
 */

// Core types and interfaces
export { ServiceLifetime } from './types';
export type {
  Constructor,
  IContainerBuilder,
  IDependencyContainer,
  ResolutionContext,
  ServiceDescriptor,
  ServiceFactory,
  ServiceRegistrationOptions,
  ServiceToken,
} from './types';

// Error classes
export {
  CircularDependencyError,
  ContainerConfigurationError,
  ContainerDisposedError,
  DIError,
  InvalidRegistrationError,
  ServiceAlreadyRegisteredError,
  ServiceNotFoundError,
} from './errors';

// Service locator + main facade
export { ServiceLocator, VytchesDDD } from './service-locator';
export type { IServiceLocator } from './service-locator';

// Containers
export { ContainerBuilder } from './containers/container-builder';
export { SimpleContainer } from './containers/simple-container';

// Adapters
export { BaseContainerAdapter } from './adapters/base-adapter';

// Handler discovery plugin system
export { HandlerDiscoveryRegistry } from './discovery';
export type { HandlerInfo, IHandlerDiscoveryPlugin, IHandlerDiscoveryRegistry } from './discovery';
