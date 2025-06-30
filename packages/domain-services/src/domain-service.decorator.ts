import 'reflect-metadata';

/**
 * Metadata key for storing domain service information.
 * Used internally by the decorator system to associate metadata with decorated classes.
 *
 * @const {Symbol}
 * @private
 */
const DOMAIN_SERVICE_METADATA_KEY = Symbol('DomainService');

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
 * Decorator for marking a class as a domain service.
 * Attaches metadata to the class that can be used for registration and configuration.
 *
 * This decorator supports two usage patterns:
 * 1. Simple: @DomainService('serviceId')
 * 2. Complex: @DomainService({ serviceId: 'id', dependencies: [...], ... })
 *
 * @param {string | DomainServiceOptions} options - Service ID or configuration options
 * @returns {ClassDecorator} A decorator function that adds metadata to the target class
 * @example
 * // Simple usage
 * @DomainService('orderService')
 * class OrderService extends BaseDomainService {...}
 *
 * // Complex usage
 * @DomainService({
 *   serviceId: 'orderService',
 *   dependencies: ['productRepository', 'userService'],
 *   transactional: true,
 *   publishesEvents: true
 * })
 * class OrderService extends UnitOfWorkAwareDomainService {...}
 */
export function DomainService(options: string | DomainServiceOptions) {
  return function (target: any) {
    // Convert string service ID to full options object
    const metadata: DomainServiceOptions =
      typeof options === 'string' ? { serviceId: options } : options;

    // Store metadata on the class
    Reflect.defineMetadata(DOMAIN_SERVICE_METADATA_KEY, metadata, target);

    return target;
  };
}

/**
 * Retrieves domain service metadata from a class.
 * Used by frameworks and containers to discover and configure services.
 *
 * @param {any} target - The service class to inspect
 * @returns {DomainServiceOptions | undefined} The service metadata, or undefined if none exists
 * @example
 * const ServiceClass = require('./order-service');
 * const metadata = getDomainServiceMetadata(ServiceClass);
 *
 * if (metadata && metadata.transactional) {
 *   // Configure with Unit of Work
 * }
 */
export function getDomainServiceMetadata(
  target: any,
): DomainServiceOptions | undefined {
  return Reflect.getMetadata(DOMAIN_SERVICE_METADATA_KEY, target);
}
