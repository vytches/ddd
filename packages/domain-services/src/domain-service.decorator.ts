import { ServiceLifetime } from '@vytches/ddd-di';
import 'reflect-metadata';
import type { DIServiceMetadata, EnhancedDomainServiceOptions } from './di-types';
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

export function getDomainServiceMetadata(target: unknown): DomainServiceOptions | undefined {
  return Reflect.getMetadata(DOMAIN_SERVICE_METADATA_KEY, target as object);
}

export function getDIDomainServiceMetadata(target: unknown): DIServiceMetadata | undefined {
  return Reflect.getMetadata(DI_DOMAIN_SERVICE_METADATA_KEY, target as object);
}

export function isDomainServicePendingDIRegistration(target: unknown): boolean {
  return Reflect.getMetadata('di:registration-pending', target as object) === true;
}
