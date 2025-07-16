import 'reflect-metadata';
import { ServiceLifetime } from '@vytches-ddd/di';
import type { EnhancedDomainServiceOptions, DIServiceMetadata } from './di-types';
import { DIDomainServiceMetadataRegistry } from './di-types';

/**
 * Metadata key for storing domain service information.
 * Used internally by the decorator system to associate metadata with decorated classes.
 *
 * @const {Symbol}
 * @private
 */
const DOMAIN_SERVICE_METADATA_KEY = Symbol('DomainService');

/**
 * Metadata key for storing DI-enhanced domain service information.
 * Used for DI integration and auto-discovery.
 *
 * @const {Symbol}
 * @private
 */
const DI_DOMAIN_SERVICE_METADATA_KEY = Symbol('DIDomainService');

/**
 * @llm-summary Contract for domain service options functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * DomainServiceOptions interface implementing domain pattern implementation for domain service options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDomainServiceOptions implements DomainServiceOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface DomainServiceOptions {
  /**
   * Unique identifier for the service.
   * Used for service registration and lookup.
   *
   * @type {string}
   * @memberof DomainServiceOptions
   */
  serviceId: string;

  /**
   * Service dependencies by ID.
   * These services will be injected when creating the service instance.
   *
   * @type {string[]}
   * @memberof DomainServiceOptions
   * @optional
   */
  dependencies?: string[];

  /**
   * Whether this service requires transactional consistency.
   * If true, the service will be configured with a Unit of Work.
   *
   * @type {boolean}
   * @memberof DomainServiceOptions
   * @optional
   * @default false
   */
  transactional?: boolean;

  /**
   * Whether this service has an asynchronous lifecycle.
   * If true, initialize() will be called after creation.
   *
   * @type {boolean}
   * @memberof DomainServiceOptions
   * @optional
   * @default false
   */
  async?: boolean;

  /**
   * Whether this service publishes domain events.
   * If true, an event bus will be provided to the service.
   *
   * @type {boolean}
   * @memberof DomainServiceOptions
   * @optional
   * @default false
   */
  publishesEvents?: boolean;

  /**
   * Configuration for result caching.
   * Enables caching of service operation results.
   *
   * @type {object}
   * @property {boolean} enabled - Whether caching is enabled
   * @property {number} [ttl] - Time-to-live in seconds for cached results
   * @memberof DomainServiceOptions
   * @optional
   */
  caching?: {
    enabled: boolean;
    ttl?: number;
  };
}

/**
 * @llm-summary domain service function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * DomainService function implementing domain pattern implementation for domain service operations.
 *
 *
 * @param {string | DomainServiceOptions | EnhancedDomainServiceOptions} options - options parameter
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = DomainService(options);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => DomainService(options));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function DomainService(
  options: string | DomainServiceOptions | EnhancedDomainServiceOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends new (...args: any[]) => any>(target: T): T {
    // Convert string service ID to full options object
    const metadata: DomainServiceOptions =
      typeof options === 'string' ? { serviceId: options } : options;

    // Store legacy metadata on the class (backward compatibility)
    Reflect.defineMetadata(DOMAIN_SERVICE_METADATA_KEY, metadata, target);

    // Check if this is DI-enhanced options (has DI-specific properties)
    const isDIEnhanced =
      typeof options === 'object' &&
      options !== null &&
      ('lifetime' in options ||
        'context' in options ||
        'autoRegister' in options ||
        'tags' in options);

    if (isDIEnhanced) {
      const enhancedOptions = options as EnhancedDomainServiceOptions;

      // Create DI metadata
      const diMetadata: DIServiceMetadata = {
        serviceType: target,
        serviceId: enhancedOptions.serviceId,
        lifetime: enhancedOptions.lifetime || ServiceLifetime.Transient,
        context: enhancedOptions.context || '',
        autoRegister: enhancedOptions.autoRegister !== false, // default true
        dependencies: enhancedOptions.dependencies || [],
        tags: enhancedOptions.tags || [],
        contextResolver: enhancedOptions.contextResolver || 'auto',
        fallbackToGlobal: enhancedOptions.fallbackToGlobal !== false, // default true
        transactional: enhancedOptions.transactional || false,
        async: enhancedOptions.async || false,
        publishesEvents: enhancedOptions.publishesEvents || false,
        caching: enhancedOptions.caching || { enabled: false },
        createdAt: new Date(),
      };

      // Store DI metadata on the class
      Reflect.defineMetadata(DI_DOMAIN_SERVICE_METADATA_KEY, diMetadata, target);

      // Register with DI metadata registry for auto-discovery
      DIDomainServiceMetadataRegistry.registerService(diMetadata);

      // Mark as pending DI registration
      Reflect.defineMetadata('di:registration-pending', true, target);
    }

    return target;
  };
}

/**
 * Retrieves domain service metadata from a class.
 * Used by frameworks and containers to discover and configure services.
 *
 * @param {unknown} target - The service class to inspect
 * @returns {DomainServiceOptions | undefined} The service metadata, or undefined if none exists
 * @example
 * const ServiceClass = require('./order-service');
 * const metadata = getDomainServiceMetadata(ServiceClass);
 *
 * if (metadata && metadata.transactional) {
 *   // Configure with Unit of Work
 * }
 */
export function getDomainServiceMetadata(target: unknown): DomainServiceOptions | undefined {
  return Reflect.getMetadata(DOMAIN_SERVICE_METADATA_KEY, target as object);
}

/**
 * Retrieves DI-enhanced domain service metadata from a class.
 * Used by the DI system for auto-discovery and registration.
 *
 * @param {unknown} target - The service class to inspect
 * @returns {DIServiceMetadata | undefined} The DI service metadata, or undefined if none exists
 * @example
 * const ServiceClass = require('./order-service');
 * const diMetadata = getDIDomainServiceMetadata(ServiceClass);
 *
 * if (diMetadata && diMetadata.autoRegister) {
 *   // Auto-register with DI container
 * }
 */
export function getDIDomainServiceMetadata(target: unknown): DIServiceMetadata | undefined {
  return Reflect.getMetadata(DI_DOMAIN_SERVICE_METADATA_KEY, target as object);
}

/**
 * @llm-summary is domain service pending d i registration function
 * @llm-domain Pattern
 * @llm-pure true
 *
 * @description
 * isDomainServicePendingDIRegistration function implementing domain pattern implementation for is domain service pending d i registration operations.
 *
 *
 * @param {unknown} target - target parameter
 * @returns {boolean} Returns boolean
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = isDomainServicePendingDIRegistration(target);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => isDomainServicePendingDIRegistration(target));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function isDomainServicePendingDIRegistration(target: unknown): boolean {
  return Reflect.getMetadata('di:registration-pending', target as object) === true;
}
