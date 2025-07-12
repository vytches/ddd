/**
 * Example usage of Domain Services with DI integration
 *
 * This file demonstrates how to use the enhanced @DomainService decorator
 * with VytchesDDD dependency injection system.
 */

import { VytchesDDD, SimpleContainer, ServiceLifetime } from '@vytches-ddd/di';
import { DomainService } from '../domain-service.decorator';
import { IBaseDomainService } from '../base-domain-service';
import { DomainServiceDiscoveryPlugin } from './domain-service-discovery-plugin';

// Simple domain service with basic DI integration
@DomainService({
  serviceId: 'userValidationService',
  lifetime: ServiceLifetime.Singleton,
  autoRegister: true,
  tags: ['validation', 'user'],
})
export class UserValidationService extends IBaseDomainService {
  constructor() {
    super('userValidationService');
  }

  async validateUser(userData: { email: string; age: number }): Promise<boolean> {
    // Simple validation logic
    return userData.email.includes('@') && userData.age >= 18;
  }
}

// Domain service with context isolation
@DomainService({
  serviceId: 'orderProcessingService',
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderManagement',
  autoRegister: true,
  tags: ['order', 'business'],
  dependencies: ['orderRepository', 'paymentService'],
  transactional: true,
  publishesEvents: true,
})
export class OrderProcessingService extends IBaseDomainService {
  constructor() {
    super('orderProcessingService');
  }

  async processOrder(orderId: string): Promise<void> {
    // Use service locator to resolve dependencies
    try {
      const repository = VytchesDDD.resolve<unknown>('orderRepository', 'OrderManagement');
      const paymentService = VytchesDDD.resolve<unknown>('paymentService');

      console.log(`Processing order ${orderId} with repository and payment service`);

      // Business logic here
      await (repository as { findById: (id: string) => Promise<unknown> }).findById(orderId);
      await (paymentService as { processPayment: (id: string) => Promise<unknown> }).processPayment(
        orderId
      );
    } catch (error) {
      console.error('Failed to resolve dependencies:', error);
      throw error;
    }
  }
}

// Legacy domain service (backward compatibility)
@DomainService('legacyInventoryService')
export class LegacyInventoryService extends IBaseDomainService {
  constructor() {
    super('legacyInventoryService');
  }

  checkStock(_productId: string): number {
    // Legacy implementation
    return Math.floor(Math.random() * 100);
  }
}

/**
 * Example setup function showing how to configure DI container with domain services
 */
export async function setupDomainServicesWithDI() {
  // Create and configure container
  const container = new SimpleContainer();

  // Register dependencies manually (these would come from your app's DI setup)
  container.registerInstance('orderRepository', {
    findById: async (id: string) => ({ id, status: 'pending' }),
  });

  container.registerInstance('paymentService', {
    processPayment: async (orderId: string) => {
      console.log(`Payment processed for order ${orderId}`);
    },
  });

  // Configure VytchesDDD with container
  VytchesDDD.configure(container);

  // Optional: Setup context-specific container
  const orderContainer = new SimpleContainer();
  orderContainer.registerInstance('orderRepository', {
    findById: async (id: string) => ({ id, status: 'priority' }),
  });
  VytchesDDD.configureContext('OrderManagement', orderContainer);

  // Register domain service discovery plugin
  VytchesDDD.registerDiscoveryPlugin(new DomainServiceDiscoveryPlugin());

  // Discover and register all domain services
  await VytchesDDD.discoverAndRegisterHandlers();

  return { container, orderContainer };
}

/**
 * Example usage function
 */
export async function exampleUsage() {
  // Setup DI
  await setupDomainServicesWithDI();

  // Use domain services through service locator
  const userService = VytchesDDD.resolve<UserValidationService>('userValidationService');
  const orderService = VytchesDDD.resolve<OrderProcessingService>('orderProcessingService');
  const legacyService = VytchesDDD.resolve<LegacyInventoryService>('legacyInventoryService');

  // Execute business logic
  const isValid = await userService.validateUser({ email: 'test@example.com', age: 25 });
  console.log('User is valid:', isValid);

  await orderService.processOrder('order-123');

  const stock = legacyService.checkStock('product-456');
  console.log('Stock level:', stock);
}

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}
