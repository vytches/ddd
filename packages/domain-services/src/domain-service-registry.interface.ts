import type { IDomainService } from './domain-service.interface';

/**
 * Registry for domain services.
 * Provides a centralized store for registering, retrieving, and managing domain services.
 * Acts as a service locator for domain services throughout the application.
 *
 * @interface IDomainServiceRegistry
 */
export interface IDomainServiceRegistry {
  /**
   * Registers a domain service in the registry.
   * If a service with the same ID already exists, an error should be thrown.
   *
   * @template T - Type extending IDomainService
   * @param {T} service - Domain service to register
   * @param {string} [serviceId] - Optional service identifier (if not provided, serviceId from the service is used)
   * @throws {Error} If the service has no ID or a service with the same ID is already registered
   * @memberof IDomainServiceRegistry
   */
  register<T extends IDomainService>(service: T, serviceId?: string): void;

  /**
   * Retrieves a domain service from the registry by its identifier.
   *
   * @template T - Type extending IDomainService that will be returned
   * @param {string} serviceId - Service identifier
   * @returns {T | undefined} Domain service or undefined if not found
   * @memberof IDomainServiceRegistry
   */
  get<T extends IDomainService>(serviceId: string): T | undefined;

  /**
   * Checks if a service with the given identifier exists in the registry.
   *
   * @param {string} serviceId - Service identifier to check
   * @returns {boolean} True if the service exists, false otherwise
   * @memberof IDomainServiceRegistry
   */
  has(serviceId: string): boolean;

  /**
   * Removes a service from the registry.
   *
   * @param {string} serviceId - Service identifier to remove
   * @returns {boolean} True if the service was removed, false if it didn't exist
   * @memberof IDomainServiceRegistry
   */
  remove(serviceId: string): boolean;

  /**
   * Returns all registered services.
   *
   * @returns {Map<string, IDomainService>} Map of services (key: serviceId, value: service)
   * @memberof IDomainServiceRegistry
   */
  getAll(): Map<string, IDomainService>;

  /**
   * Clears the registry by removing all services.
   *
   * @memberof IDomainServiceRegistry
   */
  clear(): void;
}
