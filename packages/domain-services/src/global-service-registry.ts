/* eslint-disable @typescript-eslint/no-empty-function */
import { DefaultDomainServiceRegistry } from './domain-service-registry';
import type { IDomainServiceRegistry } from './domain-service-registry.interface';

/**
 * Singleton providing global access to a domain service registry.
 * Useful for applications that need a centralized access point to domain services
 * without explicit dependency injection.
 *
 * @class GlobalServiceRegistry
 */
export class GlobalServiceRegistry {
  /**
   * Singleton instance of the service registry.
   *
   * @private
   * @static
   * @type {IDomainServiceRegistry}
   */
  private static instance: IDomainServiceRegistry;

  /**
   * Private constructor to prevent direct instantiation.
   * Use getInstance() to get the singleton instance.
   *
   * @private
   */
  private constructor() {}

  /**
   * Gets the singleton instance of the service registry.
   * Creates a default registry if none exists.
   *
   * @static
   * @returns {IDomainServiceRegistry} The singleton registry instance
   * @example
   * const registry = GlobalServiceRegistry.getInstance();
   * const orderService = registry.get('orderService');
   */
  public static getInstance(): IDomainServiceRegistry {
    if (!GlobalServiceRegistry.instance) {
      GlobalServiceRegistry.instance = new DefaultDomainServiceRegistry();
    }
    return GlobalServiceRegistry.instance;
  }

  /**
   * Sets the registry instance to use.
   * Useful for replacing the default registry with a custom implementation.
   *
   * @static
   * @param {IDomainServiceRegistry} registry - Custom registry implementation to use
   * @example
   * const customRegistry = new CustomDomainServiceRegistry();
   * GlobalServiceRegistry.setInstance(customRegistry);
   */
  public static setInstance(registry: IDomainServiceRegistry): void {
    GlobalServiceRegistry.instance = registry;
  }
}
