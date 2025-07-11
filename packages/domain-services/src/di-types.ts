/**
 * DI-specific types and interfaces for domain services integration
 *
 * This module provides TypeScript types that enable domain services
 * to integrate with the VytchesDDD dependency injection system.
 */

import type { ServiceLifetime } from '@vytches-ddd/di';

/**
 * Context resolution strategy for domain services.
 * Determines how bounded context should be resolved for service registration.
 */
export type ContextResolutionStrategy =
  | 'auto' // Auto-detect from call stack or class location
  | 'explicit' // Use explicitly provided context
  | 'global' // Always use global container
  | 'inherit'; // Inherit context from parent service

/**
 * Extended DI options for domain service decorators.
 * These options control dependency injection behavior for domain services.
 */
export interface DIDecoratorOptions {
  /**
   * Service lifetime in the DI container.
   * Controls how instances are created and shared.
   *
   * @default 'transient'
   */
  lifetime?: ServiceLifetime;

  /**
   * Bounded context for DI registration.
   * When specified, service is registered in context-specific container.
   */
  context: string;

  /**
   * Whether to automatically register this service with the DI container.
   * If false, service must be manually registered.
   *
   * @default true
   */
  autoRegister?: boolean;

  /**
   * Explicit dependencies for documentation and validation.
   * These dependencies will be validated during container registration.
   */
  dependencies?: string[];

  /**
   * Service tags for organization and discovery.
   * Tags can be used to group related services or apply cross-cutting concerns.
   */
  tags: string[];

  /**
   * Context resolution strategy for this service.
   * Determines how bounded context should be resolved.
   *
   * @default 'auto'
   */
  contextResolver?: ContextResolutionStrategy;

  /**
   * Whether to fallback to global container if service not found in context.
   * Only applies when context is specified.
   *
   * @default true
   */
  fallbackToGlobal?: boolean;
}

/**
 * Enhanced domain service options that include both traditional options and DI integration.
 * Extends the original DomainServiceOptions with DI-specific capabilities.
 */
export interface EnhancedDomainServiceOptions extends DIDecoratorOptions {
  /**
   * Unique identifier for the service.
   * Used for service registration and lookup.
   */
  serviceId: string;

  /**
   * Service dependencies by ID.
   * These services will be injected when creating the service instance.
   */
  dependencies: string[];

  /**
   * Whether this service requires transactional consistency.
   * If true, the service will be configured with a Unit of Work.
   *
   * @default false
   */
  transactional: boolean;

  /**
   * Whether this service has an asynchronous lifecycle.
   * If true, initialize() will be called after creation.
   *
   * @default false
   */
  async: boolean;

  /**
   * Whether this service publishes domain events.
   * If true, an event bus will be provided to the service.
   *
   * @default false
   */
  publishesEvents: boolean;

  /**
   * Configuration for result caching.
   * Enables caching of service operation results.
   */
  caching: {
    enabled: boolean;
    ttl?: number;
  };
}

/**
 * Metadata stored for DI-enhanced domain service handlers.
 * Contains both original domain service metadata and DI-specific information.
 */
export interface DIServiceMetadata extends EnhancedDomainServiceOptions {
  /**
   * The domain service class/constructor.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceType: new (...args: any[]) => any;

  /**
   * Service ID for registration.
   */
  serviceId: string;

  /**
   * Whether this service has been registered with DI container.
   * Used to track registration status during auto-discovery.
   */
  isRegistered?: boolean;

  /**
   * Timestamp when metadata was created.
   * Used for debugging and diagnostics.
   */
  createdAt: Date;
}

/**
 * Registry for DI-enhanced domain service metadata.
 * Maintains metadata for services that have DI integration enabled.
 */
export class DIDomainServiceMetadataRegistry {
  private static services = new Map<string, DIServiceMetadata>();

  /**
   * Register domain service metadata for DI integration.
   */
  static registerService(metadata: DIServiceMetadata): void {
    this.services.set(metadata.serviceId, metadata);
  }

  /**
   * Get domain service metadata by service ID.
   */
  static getService(serviceId: string): DIServiceMetadata | undefined {
    return this.services.get(serviceId);
  }

  /**
   * Get all registered domain services with DI metadata.
   */
  static getAllServices(): DIServiceMetadata[] {
    return Array.from(this.services.values());
  }

  /**
   * Get services by context.
   */
  static getServicesByContext(context: string): DIServiceMetadata[] {
    return this.getAllServices().filter(service => service.context === context);
  }

  /**
   * Get services by tag.
   */
  static getServicesByTag(tag: string): DIServiceMetadata[] {
    return this.getAllServices().filter(service => service.tags?.includes(tag));
  }

  /**
   * Check if a service is registered.
   */
  static hasService(serviceId: string): boolean {
    return this.services.has(serviceId);
  }

  /**
   * Clear all registered services (for testing).
   */
  static clear(): void {
    this.services.clear();
  }
}
