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
 * Comprehensive configuration options for domain services.
 * These options control how a service behaves and integrates with the DDD infrastructure.
 *
 * @interface DomainServiceOptions
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
 * Decorator for marking a class as a domain service with optional DI integration.
 * Attaches metadata to the class that can be used for registration and configuration.
 *
 * This decorator supports multiple usage patterns:
 * 1. Simple: @DomainService('serviceId')
 * 2. Legacy: @DomainService({ serviceId: 'id', dependencies: [...], ... })
 * 3. DI Enhanced: @DomainService({ serviceId: 'id', lifetime: 'singleton', context: 'OrderManagement', ... })
 *
 * @param {string | DomainServiceOptions | EnhancedDomainServiceOptions} options - Service configuration
 * @returns {ClassDecorator} A decorator function that adds metadata to the target class
 * @example
 * // Simple usage (backward compatible)
 * @DomainService('orderService')
 * class OrderService extends BaseDomainService {...}
 *
 * // Legacy usage (backward compatible)
 * @DomainService({
 *   serviceId: 'orderService',
 *   dependencies: ['productRepository', 'userService'],
 *   transactional: true,
 *   publishesEvents: true
 * })
 * class OrderService extends UnitOfWorkAwareDomainService {...}
 *
 * // DI Enhanced usage (new)
 * @DomainService({
 *   serviceId: 'orderService',
 *   lifetime: 'singleton',
 *   context: 'OrderManagement',
 *   tags: ['order', 'business'],
 *   autoRegister: true,
 *   dependencies: ['productRepository', 'userService'],
 *   transactional: true,
 *   publishesEvents: true
 * })
 * class OrderService extends UnitOfWorkAwareDomainService {...}
 */
export function DomainService(options: string | DomainServiceOptions | EnhancedDomainServiceOptions) {
  return function <T extends new (...args: any[]) => any>(target: T): T {
    // Convert string service ID to full options object
    const metadata: DomainServiceOptions =
      typeof options === 'string' ? { serviceId: options } : options;

    // Store legacy metadata on the class (backward compatibility)
    Reflect.defineMetadata(DOMAIN_SERVICE_METADATA_KEY, metadata, target);

    // Check if this is DI-enhanced options (has DI-specific properties)
    const isDIEnhanced = typeof options === 'object' && options !== null &&
      ('lifetime' in options || 'context' in options || 'autoRegister' in options || 'tags' in options);

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
        createdAt: new Date()
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
 * Checks if a class is marked for DI auto-registration.
 * Used by discovery plugins to identify services that should be registered.
 *
 * @param {unknown} target - The service class to inspect
 * @returns {boolean} True if the service is pending DI registration
 */
export function isDomainServicePendingDIRegistration(target: unknown): boolean {
  return Reflect.getMetadata('di:registration-pending', target as object) === true;
}
