import type { OnModuleInit } from '@nestjs/common';
import { Injectable, Module } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
// Mock decorators for testing
const CommandHandler = (commandType: any) => (target: any) => {
  Reflect.defineMetadata(
    'di:handler-metadata',
    {
      type: 'command',
      handlerType: target,
      messageType: commandType,
      registeredAt: new Date(),
      registeredWithDI: false,
    },
    target as object
  );
  Reflect.defineMetadata('di:registration-pending', true, target as object);
  return target;
};

const QueryHandler = (queryType: any) => (target: any) => {
  Reflect.defineMetadata(
    'di:handler-metadata',
    {
      type: 'query',
      handlerType: target,
      messageType: queryType,
      registeredAt: new Date(),
      registeredWithDI: false,
    },
    target as object
  );
  Reflect.defineMetadata('di:registration-pending', true, target as object);
  return target;
};

const EventHandler = (eventType: any) => (target: any) => {
  Reflect.defineMetadata(
    'di:event-handler',
    {
      type: 'event',
      eventType,
      handlerType: target,
    },
    target as object
  );
  return target;
};

const DomainService = (serviceId: string) => (target: any) => {
  Reflect.defineMetadata('DomainService', { serviceId }, target as object);
  Reflect.defineMetadata('di:domain-service', { serviceId }, target as object);
  return target;
};

const Saga = (sagaType: string) => (target: any) => {
  Reflect.defineMetadata(Symbol.for('saga:metadata'), { saga: { sagaType } }, target as object);
  Reflect.defineMetadata('saga:metadata', { saga: { sagaType } }, target as object);
  return target;
};
import { VytchesDDDModule } from '../../src/vytches-ddd.module';
import type { BulkRegistrar } from '../../src/utils/bulk-provider.helper';
import {
  VytchesDDDBulkProvider,
  type MixedServiceConfig,
} from '../../src/utils/bulk-provider.helper';
import type { IDomainEvent } from '@vytches/ddd-contracts';
import type { ICommand, IQuery } from '@vytches/ddd-cqrs';
import type { ISagaExecutionContext, ISagaActionResult } from '@vytches/ddd-messaging';

// Test domain objects
class CreateOrderCommand implements ICommand {
  constructor(
    public readonly orderId: string,
    public readonly amount: number
  ) {}
}

class GetOrderQuery implements IQuery<Order> {
  constructor(public readonly orderId: string) {}
}

class OrderCreatedEvent implements IDomainEvent {
  eventId = `order-created-${Date.now()}`;
  eventType = 'OrderCreated';
  aggregateId: string;
  occurredAt = new Date();
  eventVersion = 1;

  constructor(public readonly payload: { orderId: string; amount: number }) {
    this.aggregateId = payload.orderId;
  }
}

interface Order {
  id: string;
  amount: number;
  status: 'created' | 'processing' | 'completed';
}

// Business handlers and services
@Injectable()
@CommandHandler(CreateOrderCommand)
class CreateOrderHandler {
  async execute(command: CreateOrderCommand): Promise<void> {
    console.log(`Creating order ${command.orderId} for amount ${command.amount}`);
    // Simulate order creation
  }
}

@Injectable()
@QueryHandler(GetOrderQuery)
class GetOrderHandler {
  async execute(query: GetOrderQuery): Promise<Order> {
    console.log(`Getting order ${query.orderId}`);
    return {
      id: query.orderId,
      amount: 100,
      status: 'created',
    };
  }
}

@Injectable()
@EventHandler(OrderCreatedEvent)
class OrderCreatedEventHandler {
  async handle(event: OrderCreatedEvent): Promise<void> {
    console.log(`Handling OrderCreated event for order ${event.payload.orderId}`);
    // Simulate event handling
  }
}

@Injectable()
@DomainService('orderService')
class OrderService {
  async createOrder(orderId: string, amount: number): Promise<Order> {
    console.log(`Order service creating order ${orderId}`);
    return {
      id: orderId,
      amount,
      status: 'created',
    };
  }

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    console.log(`Updating order ${orderId} status to ${status}`);
  }
}

@Injectable()
@Saga('OrderProcessingSaga')
class OrderProcessingSaga {
  async handleEvent(_event: any, _context: ISagaExecutionContext): Promise<ISagaActionResult> {
    console.log('Processing order saga event');
    return { success: true };
  }

  canHandle(event: any): boolean {
    return event.eventType === 'OrderCreated';
  }

  async compensate(stepName: string, _context: ISagaExecutionContext): Promise<ISagaActionResult> {
    console.log(`Compensating step: ${stepName}`);
    return { success: true };
  }
}

// Additional handlers for bulk testing
@Injectable()
@CommandHandler(CreateOrderCommand)
class AlternateOrderHandler {
  async execute(command: CreateOrderCommand): Promise<void> {
    console.log(`Alternate handler for order ${command.orderId}`);
  }
}

@Injectable()
@DomainService('paymentService')
class PaymentService {
  async processPayment(orderId: string, amount: number): Promise<boolean> {
    console.log(`Processing payment for order ${orderId}: $${amount}`);
    return true;
  }
}

@Injectable()
@DomainService('inventoryService')
class InventoryService {
  async reserveItems(orderId: string): Promise<boolean> {
    console.log(`Reserving items for order ${orderId}`);
    return true;
  }
}

/**
 * Module demonstrating the VytchesDDDBulkProvider in action
 * Shows the "20+ handlers registration nightmare" solution
 */
@Module({
  providers: [
    // === INDIVIDUAL REGISTRATIONS ===
    // Handlers
    CreateOrderHandler,
    GetOrderHandler,
    AlternateOrderHandler,
    OrderCreatedEventHandler,

    // Domain Services
    OrderService,
    PaymentService,
    InventoryService,

    // Sagas
    OrderProcessingSaga,

    // === BULK REGISTRATION SOLUTION ===
    // Instead of managing 20+ individual providers, use bulk provider
    VytchesDDDBulkProvider.createBulkRegistrar({
      handlers: [CreateOrderHandler, GetOrderHandler, AlternateOrderHandler],
      domainServices: [OrderService, PaymentService, InventoryService],
      eventHandlers: [OrderCreatedEventHandler],
      sagas: [OrderProcessingSaga],
      options: {
        enableVytchesDDDCapabilities: true,
        context: 'OrderManagement',
        timeout: 5000,
      },
    }),
  ],
})
class OrderManagementModule implements OnModuleInit {
  private bulkRegistrar?: BulkRegistrar;

  constructor(private readonly moduleRef: ModuleRef) {}

  async onModuleInit(): Promise<void> {
    // Get the bulk registrar and perform registration
    try {
      // Find the bulk registrar provider
      const providers = (this.moduleRef as any).providers;
      if (providers) {
        for (const [token, wrapper] of providers) {
          if (typeof token === 'string' && token.startsWith('BULK_REGISTRAR_')) {
            this.bulkRegistrar = wrapper.instance;
            break;
          }
        }
      }

      if (this.bulkRegistrar) {
        console.log('Performing bulk registration...');
        const result = await this.bulkRegistrar.registerAll();

        console.log('Bulk registration completed:', {
          handlers: result.handlers.length,
          services: result.services.length,
          eventHandlers: result.eventHandlers.length,
          sagas: result.sagas.length,
          errors: result.errors.length,
        });

        // Log any errors
        if (result.errors.length > 0) {
          console.warn('Registration errors:', result.errors);
        }
      }
    } catch (error) {
      console.error('Failed to perform bulk registration:', error);
    }
  }
}

describe('VytchesDDDBulkProvider Integration', () => {
  let testingModule: TestingModule;
  let moduleRef: ModuleRef;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forRoot({
          discovery: {
            enabled: false, // Disable auto-discovery to test manual bulk registration
            debug: true,
          },
          cqrs: {
            autoRegisterHandlers: false,
          },
          events: {
            eventBus: {
              type: 'unified',
            },
          },
        }),
        OrderManagementModule,
      ],
    }).compile();

    moduleRef = testingModule.get(ModuleRef);
  });

  afterEach(async () => {
    if (testingModule) {
      await testingModule.close();
    }
  });

  describe('Bulk Registration Integration', () => {
    it('should register all services through bulk provider', async () => {
      // Initialize the module to trigger OnModuleInit
      await testingModule.init();

      // Trigger OnModuleInit on the OrderManagementModule
      const orderManagementModule = testingModule.get(OrderManagementModule);
      if (orderManagementModule.onModuleInit) {
        await orderManagementModule.onModuleInit();
      }

      // Verify all handlers are available in NestJS container
      const createOrderHandler = moduleRef.get(CreateOrderHandler);
      expect(createOrderHandler).toBeInstanceOf(CreateOrderHandler);

      const getOrderHandler = moduleRef.get(GetOrderHandler);
      expect(getOrderHandler).toBeInstanceOf(GetOrderHandler);

      const orderCreatedEventHandler = moduleRef.get(OrderCreatedEventHandler);
      expect(orderCreatedEventHandler).toBeInstanceOf(OrderCreatedEventHandler);

      // Verify domain services
      const orderService = moduleRef.get(OrderService);
      expect(orderService).toBeInstanceOf(OrderService);

      const paymentService = moduleRef.get(PaymentService);
      expect(paymentService).toBeInstanceOf(PaymentService);

      const inventoryService = moduleRef.get(InventoryService);
      expect(inventoryService).toBeInstanceOf(InventoryService);

      // Verify saga
      const orderProcessingSaga = moduleRef.get(OrderProcessingSaga);
      expect(orderProcessingSaga).toBeInstanceOf(OrderProcessingSaga);
    });

    it('should handle bulk registration with different configurations', async () => {
      // Create a custom bulk registrar with different config
      const customConfig: MixedServiceConfig = {
        handlers: [CreateOrderHandler, GetOrderHandler],
        domainServices: [OrderService],
        options: {
          enableVytchesDDDCapabilities: false, // Disable VytchesDDD capabilities
          context: 'CustomContext',
        },
      };

      const customRegistrar = VytchesDDDBulkProvider.createRegistrar(moduleRef, {
        handlers: customConfig.handlers || [],
        services: customConfig.domainServices || [],
        options: customConfig.options || {},
      });

      const result = await customRegistrar.registerAll();

      // Should register handlers and services without VytchesDDD capabilities
      expect(result.handlers).toHaveLength(2);
      expect(result.services).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      // Verify specific registrations
      const handlerResult = result.handlers.find(h => h.className === 'CreateOrderHandler');
      expect(handlerResult).toBeDefined();
      expect(handlerResult?.registered).toBe(true);

      const serviceResult = result.services.find(s => s.className === 'OrderService');
      expect(serviceResult).toBeDefined();
      expect(serviceResult?.registered).toBe(true);
    });

    it('should demonstrate the "20+ handlers" scenario', async () => {
      // Simulate a large number of handlers (the real problem this solves)
      const manyHandlers = [
        CreateOrderHandler,
        GetOrderHandler,
        AlternateOrderHandler,
        // In real scenario, you'd have many more handlers:
        // UpdateOrderHandler, DeleteOrderHandler, CancelOrderHandler,
        // CreatePaymentHandler, ProcessPaymentHandler, RefundPaymentHandler,
        // ReserveInventoryHandler, ReleaseInventoryHandler, ...
        // CreateShipmentHandler, UpdateShipmentHandler, ...
        // SendEmailHandler, SendSMSHandler, ...
        // etc. (20+ handlers total)
      ];

      const manyServices = [
        OrderService,
        PaymentService,
        InventoryService,
        // In real scenario: ShippingService, EmailService, NotificationService,
        // AuditService, ReportingService, etc.
      ];

      // Instead of 20+ individual provider registrations, use bulk provider
      const bulkProvider = VytchesDDDBulkProvider.forMixedServices({
        handlers: manyHandlers,
        domainServices: manyServices,
        eventHandlers: [OrderCreatedEventHandler],
        sagas: [OrderProcessingSaga],
        options: {
          enableVytchesDDDCapabilities: true,
          context: 'LargeScaleOrderManagement',
        },
      });

      // This single call replaces 20+ individual provider definitions
      expect(bulkProvider.length).toBeGreaterThan(manyHandlers.length + manyServices.length);

      console.log(
        `Bulk provider created ${bulkProvider.length} providers from ${manyHandlers.length + manyServices.length + 2} classes`
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing services gracefully', async () => {
      // Create a registrar with a service not registered in the module
      class UnregisteredService {
        doSomething(): string {
          return 'something';
        }
      }

      const registrar = VytchesDDDBulkProvider.createRegistrar(moduleRef, {
        services: [UnregisteredService as any],
        options: { enableVytchesDDDCapabilities: true },
      });

      const result = await registrar.registerAll();

      expect(result.services).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      const error = result.errors[0];
      expect(error?.type).toBe('INSTANCE_NOT_FOUND');
      expect(error?.className).toBe('UnregisteredService');
    });

    it('should prevent duplicate registration attempts', async () => {
      const registrar = VytchesDDDBulkProvider.createRegistrar(moduleRef, {
        handlers: [CreateOrderHandler],
      });

      // First registration should succeed
      const result1 = await registrar.registerAll();
      expect(result1.errors).toHaveLength(0);

      // Second registration should fail
      let secondRegistrationError: Error | null = null;
      try {
        await registrar.registerAll();
      } catch (error) {
        secondRegistrationError = error as Error;
      }

      expect(secondRegistrationError).toBeInstanceOf(Error);
      expect(secondRegistrationError?.message).toContain('already been performed');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk registration efficiently', async () => {
      const startTime = Date.now();

      const registrar = VytchesDDDBulkProvider.createRegistrar(moduleRef, {
        handlers: [CreateOrderHandler, GetOrderHandler, AlternateOrderHandler],
        services: [OrderService, PaymentService, InventoryService],
        eventHandlers: [OrderCreatedEventHandler],
        sagas: [OrderProcessingSaga],
        options: { enableVytchesDDDCapabilities: true },
      });

      const result = await registrar.registerAll();

      const elapsedTime = Date.now() - startTime;

      // Registration should complete quickly
      expect(elapsedTime).toBeLessThan(1000); // Less than 1 second

      // All services should be registered successfully
      const totalRegistered =
        result.handlers.length +
        result.services.length +
        result.eventHandlers.length +
        result.sagas.length;
      expect(totalRegistered).toBe(8); // 3 handlers + 3 services + 1 event handler + 1 saga
      expect(result.errors).toHaveLength(0);

      console.log(
        `Bulk registration completed in ${elapsedTime}ms for ${totalRegistered} services`
      );
    });
  });
});
