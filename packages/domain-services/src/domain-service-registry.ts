import type { IDomainServiceRegistry } from './domain-service-registry.interface';
import type { IDomainService } from './domain-service.interface';
import { ServiceDuplicateError, ServiceNotFoundError } from './service.errors';

/**
 * Default implementation of the domain service registry.
 * Provides a simple Map-based storage for domain services with operations
 * for registration, retrieval, and management.
 *
 * @class DefaultDomainServiceRegistry
 * @implements {IDomainServiceRegistry}
 */
export class DefaultDomainServiceRegistry implements IDomainServiceRegistry {
  /**
   * Map containing registered services, keyed by service ID.
   *
   * @private
   * @type {Map<string, IDomainService>}
   */
  private services: Map<string, IDomainService> = new Map();

  /**
   * Registers a domain service in the registry.
   *
   * @template T - Type extending IDomainService
   * @param {T} service - Domain service to register
   * @param {string} [serviceId] - Optional service identifier
   * @throws {Error} If service has no ID or service with the same ID is already registered
   */
  public register<T extends IDomainService>(
    service: T,
    serviceId?: string,
  ): void {
    const id = serviceId || service.serviceId;

    if (!id) {
      throw ServiceNotFoundError.withServiceId('undefined');
    }

    if (this.services.has(id)) {
      throw ServiceDuplicateError.withServiceId(id);
    }

    this.services.set(id, service);
  }

  /**
   * Retrieves a domain service from the registry by its ID.
   *
   * @template T - Type extending IDomainService that will be returned
   * @param {string} serviceId - Service identifier
   * @returns {T | undefined} Domain service or undefined if not found
   */
  public get<T extends IDomainService>(serviceId: string): T | undefined {
    return this.services.get(serviceId) as T | undefined;
  }

  /**
   * Checks if a service with the given ID exists in the registry.
   *
   * @param {string} serviceId - Service identifier to check
   * @returns {boolean} True if the service exists, false otherwise
   */
  public has(serviceId: string): boolean {
    return this.services.has(serviceId);
  }

  /**
   * Removes a service from the registry.
   *
   * @param {string} serviceId - Service identifier to remove
   * @returns {boolean} True if the service was removed, false if it didn't exist
   */
  public remove(serviceId: string): boolean {
    return this.services.delete(serviceId);
  }

  /**
   * Returns all registered services.
   * Creates a new Map to prevent external modification of the internal storage.
   *
   * @returns {Map<string, IDomainService>} Map of services (key: serviceId, value: service)
   */
  public getAll(): Map<string, IDomainService> {
    return new Map(this.services);
  }

  /**
   * Clears the registry by removing all services.
   */
  public clear(): void {
    this.services.clear();
  }
}
