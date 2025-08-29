import type { ServiceRegistrationOptions as BaseOptions } from '@vytches/ddd-di';

/**
 * Extended service registration options for NestJS adapter
 */
export interface ExtendedServiceRegistrationOptions extends BaseOptions {
  /**
   * Additional metadata for the service
   */
  metadata?: Record<string, unknown>;

  /**
   * Whether to register the service in NestJS DI
   */
  registerInNestJS?: boolean;
}
