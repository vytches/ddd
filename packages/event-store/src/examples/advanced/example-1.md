# Distributed Event Sourcing Architecture

**Version**: 1.0.0 **Package**: @vytches/ddd-event-store **Complexity**:
advanced **Domain**: Architecture **Patterns**: distributed-systems,
event-sourcing, microservices, saga-orchestration **Dependencies**:
@vytches/ddd-event-store, @vytches/ddd-events, @vytches/ddd-messaging,
@vytches/ddd-resilience

## Description

Enterprise-grade distributed event sourcing architecture with microservices
coordination, saga orchestration, and cross-service event propagation. This
example demonstrates sophisticated patterns for building resilient, scalable
event-driven systems across multiple bounded contexts.

## Business Context

Modern enterprise systems require coordination across multiple microservices
while maintaining autonomy and resilience. Distributed event sourcing enables
each service to maintain its own event store while participating in
cross-service business processes through event propagation and saga
orchestration.

## Code Example

```typescript
// distributed-event-architecture.ts
import {
  InMemoryEventStore,
  JsonEventSerializer,
} from '@vytches/ddd-event-store';
import { DomainEvent, EntityId } from '@vytches/ddd-events';
import { Result } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';
import { OutboxPattern, SagaOrchestrator } from '@vytches/ddd-messaging';
import { CircuitBreaker, RetryPolicy } from '@vytches/ddd-resilience';
import { ServiceDiscovery, EventPropagationBus } from './types'; // From your app

// ⭐ FOCUS: Distributed event sourcing coordinator
export class DistributedEventSourcingCoordinator {
  private readonly eventStores = new Map<string, ServiceEventStore>();
  private readonly sagaOrchestrator: SagaOrchestrator;
  private readonly eventPropagationBus: EventPropagationBus;
  private readonly serviceDiscovery: ServiceDiscovery;
  private readonly logger = Logger.forContext('DistributedEventCoordinator');

  constructor() {
    this.sagaOrchestrator = new SagaOrchestrator();
    this.eventPropagationBus = new EventPropagationBus();
    this.serviceDiscovery = new ServiceDiscovery();

    this.setupServiceEventStores();
    this.setupSagaOrchestration();
    this.setupEventPropagation();
  }

  private setupServiceEventStores(): void {
    // ⭐ FOCUS: Initialize event stores for each bounded context
    const services = [
      'order-management',
      'inventory-service',
      'payment-service',
      'shipping-service',
      'notification-service',
      'analytics-service',
    ];

    for (const serviceName of services) {
      const eventStore = new ServiceEventStore(serviceName);
      this.eventStores.set(serviceName, eventStore);
    }
  }

  private setupSagaOrchestration(): void {
    // ⭐ FOCUS: Register distributed sagas
    this.sagaOrchestrator.registerSaga(new OrderFulfillmentSaga());
    this.sagaOrchestrator.registerSaga(new PaymentProcessingSaga());
    this.sagaOrchestrator.registerSaga(new InventoryReservationSaga());
    this.sagaOrchestrator.registerSaga(new CustomerOnboardingSaga());
  }

  private setupEventPropagation(): void {
    // ⭐ FOCUS: Configure cross-service event propagation
    this.eventPropagationBus.subscribeToService(
      'order-management',
      ['OrderCreated', 'OrderStatusChanged', 'OrderCancelled'],
      (event, sourceService) => {
        this.propagateEvent(event, sourceService, [
          'inventory-service',
          'analytics-service',
        ]);
      }
    );

    this.eventPropagationBus.subscribeToService(
      'payment-service',
      ['PaymentProcessed', 'PaymentFailed', 'RefundIssued'],
      (event, sourceService) => {
        this.propagateEvent(event, sourceService, [
          'order-management',
          'analytics-service',
        ]);
      }
    );

    this.eventPropagationBus.subscribeToService(
      'inventory-service',
      ['InventoryReserved', 'InventoryReleased', 'StockDepleted'],
      (event, sourceService) => {
        this.propagateEvent(event, sourceService, [
          'order-management',
          'notification-service',
        ]);
      }
    );
  }

  async processDistributedBusinessProcess(
    processType: 'order-fulfillment' | 'customer-onboarding' | 'product-launch',
    processData: any
  ): Promise<Result<ProcessResult, Error>> {
    try {
      this.logger.info('Starting distributed business process', {
        processType,
        processId: processData.processId,
      });

      switch (processType) {
        case 'order-fulfillment':
          return await this.processOrderFulfillment(processData);
        case 'customer-onboarding':
          return await this.processCustomerOnboarding(processData);
        case 'product-launch':
          return await this.processProductLaunch(processData);
        default:
          return Result.fail(new Error(`Unknown process type: ${processType}`));
      }
    } catch (error) {
      return Result.fail(
        new Error(`Process execution failed: ${error.message}`)
      );
    }
  }

  private async processOrderFulfillment(
    orderData: OrderFulfillmentData
  ): Promise<Result<ProcessResult, Error>> {
    try {
      // ⭐ FOCUS: Distributed saga orchestration for order fulfillment
      const sagaId = EntityId.createUuid().value;

      // Step 1: Create order in order service
      const orderResult = await this.executeServiceCommand(
        'order-management',
        new CreateOrderCommand(
          orderData.customerId,
          orderData.items,
          orderData.shippingAddress
        )
      );

      if (orderResult.isFailure()) {
        return Result.fail(orderResult.error);
      }

      const orderId = orderResult.value.aggregateId;

      // Step 2: Reserve inventory across multiple services
      const inventoryReservations: InventoryReservationRequest[] = [];

      for (const item of orderData.items) {
        const reservationResult = await this.executeServiceCommand(
          'inventory-service',
          new ReserveInventoryCommand(item.productId, item.quantity, orderId)
        );

        if (reservationResult.isFailure()) {
          // ⭐ FOCUS: Compensate previous reservations
          await this.compensateInventoryReservations(inventoryReservations);
          return Result.fail(reservationResult.error);
        }

        inventoryReservations.push({
          productId: item.productId,
          quantity: item.quantity,
          reservationId: reservationResult.value.reservationId,
        });
      }

      // Step 3: Process payment
      const paymentResult = await this.executeServiceCommand(
        'payment-service',
        new ProcessPaymentCommand(
          orderId,
          orderData.paymentMethod,
          orderData.totalAmount
        )
      );

      if (paymentResult.isFailure()) {
        // ⭐ FOCUS: Compensate inventory reservations
        await this.compensateInventoryReservations(inventoryReservations);
        await this.cancelOrder(orderId);
        return Result.fail(paymentResult.error);
      }

      // Step 4: Confirm inventory allocation
      for (const reservation of inventoryReservations) {
        await this.executeServiceCommand(
          'inventory-service',
          new ConfirmInventoryAllocationCommand(reservation.reservationId)
        );
      }

      // Step 5: Schedule shipping
      const shippingResult = await this.executeServiceCommand(
        'shipping-service',
        new ScheduleShipmentCommand(
          orderId,
          orderData.shippingAddress,
          orderData.shippingPreferences
        )
      );

      // Step 6: Send notifications
      await this.executeServiceCommand(
        'notification-service',
        new SendOrderConfirmationCommand(
          orderData.customerId,
          orderId,
          paymentResult.value.transactionId
        )
      );

      const result: ProcessResult = {
        processId: sagaId,
        processType: 'order-fulfillment',
        status: 'completed',
        results: {
          orderId,
          paymentTransactionId: paymentResult.value.transactionId,
          inventoryReservations,
          shipmentId: shippingResult.isSuccess()
            ? shippingResult.value.shipmentId
            : null,
        },
        duration: 0,
        errors: [],
      };

      this.logger.info('Order fulfillment process completed', {
        processId: sagaId,
        orderId,
        paymentTransactionId: paymentResult.value.transactionId,
      });

      return Result.ok(result);
    } catch (error) {
      return Result.fail(
        new Error(`Order fulfillment failed: ${error.message}`)
      );
    }
  }

  private async executeServiceCommand(
    serviceName: string,
    command: ServiceCommand
  ): Promise<Result<ServiceCommandResult, Error>> {
    try {
      const eventStore = this.eventStores.get(serviceName);

      if (!eventStore) {
        return Result.fail(new Error(`Service ${serviceName} not found`));
      }

      // ⭐ FOCUS: Execute command with resilience patterns
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 30000,
      });

      const retryPolicy = new RetryPolicy({
        maxAttempts: 3,
        baseDelay: 1000,
        backoff: 'exponential',
      });

      const executeWithResilience = async (): Promise<ServiceCommandResult> => {
        return await eventStore.handleCommand(command);
      };

      const result = await retryPolicy.execute(() =>
        circuitBreaker.execute(executeWithResilience)
      );

      // ⭐ FOCUS: Propagate resulting events
      if (result.events && result.events.length > 0) {
        await this.propagateServiceEvents(serviceName, result.events);
      }

      return Result.ok(result);
    } catch (error) {
      this.logger.error('Service command execution failed', {
        serviceName,
        commandType: command.type,
        error: error.message,
      });

      return Result.fail(
        new Error(`Command execution failed: ${error.message}`)
      );
    }
  }

  private async propagateEvent(
    event: DomainEvent,
    sourceService: string,
    targetServices: string[]
  ): Promise<void> {
    try {
      // ⭐ FOCUS: Cross-service event propagation with outbox pattern
      for (const targetService of targetServices) {
        const eventStore = this.eventStores.get(targetService);

        if (eventStore) {
          const integrationEvent = this.transformToIntegrationEvent(
            event,
            sourceService
          );
          await eventStore.handleIntegrationEvent(integrationEvent);
        }
      }

      this.logger.debug('Event propagated', {
        eventType: event.eventType,
        sourceService,
        targetServices,
      });
    } catch (error) {
      this.logger.error('Event propagation failed', {
        eventType: event.eventType,
        sourceService,
        targetServices,
        error: error.message,
      });
    }
  }

  private async propagateServiceEvents(
    serviceName: string,
    events: DomainEvent[]
  ): Promise<void> {
    for (const event of events) {
      await this.eventPropagationBus.publishEvent(event, serviceName);
    }
  }

  private transformToIntegrationEvent(
    domainEvent: DomainEvent,
    sourceService: string
  ): IntegrationEvent {
    return {
      eventId: EntityId.createUuid().value,
      eventType: `${sourceService}.${domainEvent.eventType}`,
      aggregateId: domainEvent.aggregateId,
      version: domainEvent.version,
      timestamp: new Date(),
      payload: domainEvent,
      sourceService,
      correlationId: domainEvent.correlationId,
      causationId: domainEvent.eventId,
      metadata: {
        ...domainEvent.metadata,
        sourceService,
        propagatedAt: new Date().toISOString(),
      },
    };
  }

  private async compensateInventoryReservations(
    reservations: InventoryReservationRequest[]
  ): Promise<void> {
    // ⭐ FOCUS: Compensation pattern for distributed transactions
    for (const reservation of reservations) {
      try {
        await this.executeServiceCommand(
          'inventory-service',
          new ReleaseInventoryCommand(reservation.reservationId)
        );
      } catch (error) {
        this.logger.error('Inventory compensation failed', {
          reservationId: reservation.reservationId,
          error: error.message,
        });
      }
    }
  }

  private async cancelOrder(orderId: EntityId): Promise<void> {
    try {
      await this.executeServiceCommand(
        'order-management',
        new CancelOrderCommand(orderId, 'payment-failed')
      );
    } catch (error) {
      this.logger.error('Order cancellation failed', {
        orderId: orderId.value,
        error: error.message,
      });
    }
  }

  async getDistributedProcessStatus(
    processId: string
  ): Promise<Result<ProcessStatus, Error>> {
    try {
      // ⭐ FOCUS: Cross-service process tracking
      const processEvents = await this.collectProcessEvents(processId);
      const currentStatus = this.determineProcessStatus(processEvents);

      return Result.ok({
        processId,
        status: currentStatus.status,
        currentStep: currentStatus.currentStep,
        completedSteps: currentStatus.completedSteps,
        failedSteps: currentStatus.failedSteps,
        lastUpdated: currentStatus.lastUpdated,
        estimatedCompletion: currentStatus.estimatedCompletion,
      });
    } catch (error) {
      return Result.fail(
        new Error(`Process status retrieval failed: ${error.message}`)
      );
    }
  }

  private async collectProcessEvents(
    processId: string
  ): Promise<ProcessEvent[]> {
    const allProcessEvents: ProcessEvent[] = [];

    // ⭐ FOCUS: Collect events from all participating services
    for (const [serviceName, eventStore] of this.eventStores.entries()) {
      const serviceEvents = await eventStore.getProcessEvents(processId);
      allProcessEvents.push(...serviceEvents);
    }

    // Sort by timestamp for chronological order
    return allProcessEvents.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  private determineProcessStatus(events: ProcessEvent[]): ProcessStatusDetails {
    const completedSteps = events
      .filter(e => e.status === 'completed')
      .map(e => e.step);
    const failedSteps = events
      .filter(e => e.status === 'failed')
      .map(e => e.step);
    const lastEvent = events[events.length - 1];

    let status:
      | 'pending'
      | 'in-progress'
      | 'completed'
      | 'failed'
      | 'compensating';

    if (failedSteps.length > 0) {
      status = 'failed';
    } else if (lastEvent?.step === 'notification-sent') {
      status = 'completed';
    } else if (completedSteps.length > 0) {
      status = 'in-progress';
    } else {
      status = 'pending';
    }

    return {
      status,
      currentStep: lastEvent?.step || 'not-started',
      completedSteps,
      failedSteps,
      lastUpdated: lastEvent?.timestamp || new Date(),
      estimatedCompletion: this.estimateCompletion(status, completedSteps),
    };
  }

  private estimateCompletion(
    status: string,
    completedSteps: string[]
  ): Date | null {
    if (status === 'completed' || status === 'failed') {
      return null;
    }

    const totalSteps = 6; // Order creation, inventory, payment, confirmation, shipping, notification
    const remainingSteps = totalSteps - completedSteps.length;
    const avgStepDuration = 30000; // 30 seconds per step

    return new Date(Date.now() + remainingSteps * avgStepDuration);
  }

  // ⭐ FOCUS: Health monitoring for distributed services
  async getDistributedSystemHealth(): Promise<DistributedSystemHealth> {
    const serviceHealthChecks = new Map<string, ServiceHealth>();

    for (const [serviceName, eventStore] of this.eventStores.entries()) {
      try {
        const healthCheck = await eventStore.performHealthCheck();
        serviceHealthChecks.set(serviceName, {
          serviceName,
          isHealthy: healthCheck.isHealthy,
          eventStoreHealth: healthCheck.eventStoreHealth,
          lastEventProcessed: healthCheck.lastEventProcessed,
          processingLatency: healthCheck.processingLatency,
          errorRate: healthCheck.errorRate,
        });
      } catch (error) {
        serviceHealthChecks.set(serviceName, {
          serviceName,
          isHealthy: false,
          eventStoreHealth: 'unhealthy',
          lastEventProcessed: null,
          processingLatency: null,
          errorRate: 1.0,
          error: error.message,
        });
      }
    }

    const healthyServices = Array.from(serviceHealthChecks.values()).filter(
      h => h.isHealthy
    ).length;
    const totalServices = serviceHealthChecks.size;

    return {
      overallHealth:
        healthyServices === totalServices
          ? 'healthy'
          : healthyServices > totalServices / 2
            ? 'degraded'
            : 'unhealthy',
      healthyServices,
      totalServices,
      serviceDetails: Array.from(serviceHealthChecks.values()),
      sagaOrchestrationHealth: await this.sagaOrchestrator.getHealth(),
      eventPropagationHealth: await this.eventPropagationBus.getHealth(),
      timestamp: new Date(),
    };
  }
}

// ⭐ FOCUS: Service-specific event store
export class ServiceEventStore {
  private readonly eventStore: InMemoryEventStore;
  private readonly outboxPattern: OutboxPattern;
  private readonly logger: Logger;

  constructor(private readonly serviceName: string) {
    this.eventStore = new InMemoryEventStore({
      serializer: new JsonEventSerializer(),
      enableSnapshots: true,
      snapshotFrequency: 50,
    });

    this.outboxPattern = new OutboxPattern();
    this.logger = Logger.forContext(`${serviceName}EventStore`);
  }

  async handleCommand(command: ServiceCommand): Promise<ServiceCommandResult> {
    try {
      // ⭐ FOCUS: Command handling with event generation
      const handler = this.getCommandHandler(command.type);
      const result = await handler.handle(command);

      if (result.events && result.events.length > 0) {
        const streamId = `${this.serviceName}-${result.aggregateId}`;
        await this.eventStore.appendEvents(streamId, result.events);

        // ⭐ FOCUS: Add to outbox for reliable propagation
        for (const event of result.events) {
          await this.outboxPattern.addEvent(event);
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Command handling failed', {
        commandType: command.type,
        error: error.message,
      });
      throw error;
    }
  }

  async handleIntegrationEvent(
    integrationEvent: IntegrationEvent
  ): Promise<void> {
    try {
      // ⭐ FOCUS: Handle events from other services
      const handler = this.getIntegrationEventHandler(
        integrationEvent.eventType
      );

      if (handler) {
        await handler.handle(integrationEvent);

        this.logger.debug('Integration event processed', {
          eventType: integrationEvent.eventType,
          sourceService: integrationEvent.sourceService,
        });
      }
    } catch (error) {
      this.logger.error('Integration event handling failed', {
        eventType: integrationEvent.eventType,
        error: error.message,
      });
    }
  }

  async getProcessEvents(processId: string): Promise<ProcessEvent[]> {
    // ⭐ FOCUS: Retrieve events related to specific business process
    const allStreams = await this.eventStore.getAllStreamIds();
    const processEvents: ProcessEvent[] = [];

    for (const streamId of allStreams) {
      const readResult = await this.eventStore.readStream(streamId);

      if (readResult.isSuccess()) {
        const relevantEvents = readResult.value.events.filter(
          event =>
            event.correlationId === processId ||
            event.metadata?.processId === processId
        );

        for (const event of relevantEvents) {
          processEvents.push({
            processId,
            step: this.mapEventToProcessStep(event),
            status: this.determineStepStatus(event),
            timestamp: event.timestamp,
            serviceName: this.serviceName,
            eventType: event.eventType,
            eventId: event.eventId,
          });
        }
      }
    }

    return processEvents;
  }

  private getCommandHandler(commandType: string): CommandHandler {
    // ⭐ FOCUS: Command handler registry
    const handlers = new Map<string, CommandHandler>([
      ['CreateOrder', new CreateOrderHandler()],
      ['ReserveInventory', new ReserveInventoryHandler()],
      ['ProcessPayment', new ProcessPaymentHandler()],
      ['ScheduleShipment', new ScheduleShipmentHandler()],
    ]);

    const handler = handlers.get(commandType);
    if (!handler) {
      throw new Error(`No handler found for command type: ${commandType}`);
    }

    return handler;
  }

  private getIntegrationEventHandler(
    eventType: string
  ): IntegrationEventHandler | null {
    // ⭐ FOCUS: Integration event handler registry
    const handlers = new Map<string, IntegrationEventHandler>([
      ['order-management.OrderCreated', new OrderCreatedIntegrationHandler()],
      [
        'payment-service.PaymentProcessed',
        new PaymentProcessedIntegrationHandler(),
      ],
      [
        'inventory-service.InventoryReserved',
        new InventoryReservedIntegrationHandler(),
      ],
    ]);

    return handlers.get(eventType) || null;
  }

  private mapEventToProcessStep(event: DomainEvent): string {
    const stepMapping = new Map<string, string>([
      ['OrderCreated', 'order-creation'],
      ['InventoryReserved', 'inventory-reservation'],
      ['PaymentProcessed', 'payment-processing'],
      ['ShipmentScheduled', 'shipment-scheduling'],
      ['NotificationSent', 'notification-sent'],
    ]);

    return stepMapping.get(event.eventType) || 'unknown';
  }

  private determineStepStatus(
    event: DomainEvent
  ): 'pending' | 'completed' | 'failed' {
    // ⭐ FOCUS: Determine step status from event
    if (
      event.eventType.includes('Failed') ||
      event.eventType.includes('Cancelled')
    ) {
      return 'failed';
    }

    return 'completed';
  }

  async performHealthCheck(): Promise<ServiceHealthCheck> {
    try {
      // ⭐ FOCUS: Service health monitoring
      const streamCount = (await this.eventStore.getAllStreamIds()).length;
      const lastProcessedEvent = await this.getLastProcessedEvent();
      const errorRate = await this.calculateErrorRate();
      const processingLatency = await this.calculateProcessingLatency();

      return {
        isHealthy: errorRate < 0.05 && processingLatency < 5000,
        eventStoreHealth: streamCount > 0 ? 'healthy' : 'no-data',
        lastEventProcessed: lastProcessedEvent?.timestamp || null,
        processingLatency,
        errorRate,
      };
    } catch (error) {
      return {
        isHealthy: false,
        eventStoreHealth: 'error',
        lastEventProcessed: null,
        processingLatency: null,
        errorRate: 1.0,
        error: error.message,
      };
    }
  }

  private async getLastProcessedEvent(): Promise<DomainEvent | null> {
    const streamIds = await this.eventStore.getAllStreamIds();

    if (streamIds.length === 0) return null;

    let latestEvent: DomainEvent | null = null;

    for (const streamId of streamIds) {
      const readResult = await this.eventStore.readStream(streamId);

      if (readResult.isSuccess() && readResult.value.events.length > 0) {
        const lastEvent =
          readResult.value.events[readResult.value.events.length - 1];

        if (!latestEvent || lastEvent.timestamp > latestEvent.timestamp) {
          latestEvent = lastEvent;
        }
      }
    }

    return latestEvent;
  }

  private async calculateErrorRate(): Promise<number> {
    // Placeholder implementation
    return 0.02; // 2% error rate
  }

  private async calculateProcessingLatency(): Promise<number> {
    // Placeholder implementation
    return 1500; // 1.5 second average latency
  }
}

// ⭐ FOCUS: Supporting types and interfaces
interface OrderFulfillmentData {
  processId: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  shippingAddress: Address;
  shippingPreferences: ShippingPreferences;
}

interface ProcessResult {
  processId: string;
  processType: string;
  status: 'completed' | 'failed' | 'in-progress';
  results: any;
  duration: number;
  errors: string[];
}

interface ServiceCommand {
  type: string;
  aggregateId?: EntityId;
  payload: any;
}

interface ServiceCommandResult {
  aggregateId: EntityId;
  events?: DomainEvent[];
  error?: string;
}

interface IntegrationEvent {
  eventId: string;
  eventType: string;
  aggregateId: EntityId;
  version: number;
  timestamp: Date;
  payload: any;
  sourceService: string;
  correlationId?: string;
  causationId?: string;
  metadata?: any;
}

interface ProcessEvent {
  processId: string;
  step: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
  serviceName: string;
  eventType: string;
  eventId: string;
}

interface ProcessStatus {
  processId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'compensating';
  currentStep: string;
  completedSteps: string[];
  failedSteps: string[];
  lastUpdated: Date;
  estimatedCompletion: Date | null;
}

interface ProcessStatusDetails {
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'compensating';
  currentStep: string;
  completedSteps: string[];
  failedSteps: string[];
  lastUpdated: Date;
  estimatedCompletion: Date | null;
}

interface DistributedSystemHealth {
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  healthyServices: number;
  totalServices: number;
  serviceDetails: ServiceHealth[];
  sagaOrchestrationHealth: any;
  eventPropagationHealth: any;
  timestamp: Date;
}

interface ServiceHealth {
  serviceName: string;
  isHealthy: boolean;
  eventStoreHealth: string;
  lastEventProcessed: Date | null;
  processingLatency: number | null;
  errorRate: number;
  error?: string;
}

interface ServiceHealthCheck {
  isHealthy: boolean;
  eventStoreHealth: string;
  lastEventProcessed: Date | null;
  processingLatency: number | null;
  errorRate: number;
  error?: string;
}

// ⭐ FOCUS: Sample command handlers
class CreateOrderHandler implements CommandHandler {
  async handle(command: ServiceCommand): Promise<ServiceCommandResult> {
    const orderId = EntityId.createUuid();

    const orderCreatedEvent = new OrderCreatedEvent(
      orderId,
      command.payload.customerId,
      command.payload.items,
      command.payload.totalAmount
    );

    return {
      aggregateId: orderId,
      events: [orderCreatedEvent],
    };
  }
}

class ReserveInventoryHandler implements CommandHandler {
  async handle(command: ServiceCommand): Promise<ServiceCommandResult> {
    const reservationId = EntityId.createUuid();

    const inventoryReservedEvent = new InventoryReservedEvent(
      reservationId,
      command.payload.productId,
      command.payload.quantity,
      command.payload.orderId
    );

    return {
      aggregateId: reservationId,
      events: [inventoryReservedEvent],
    };
  }
}

class ProcessPaymentHandler implements CommandHandler {
  async handle(command: ServiceCommand): Promise<ServiceCommandResult> {
    const transactionId = EntityId.createUuid();

    const paymentProcessedEvent = new PaymentProcessedEvent(
      transactionId,
      command.payload.orderId,
      command.payload.amount,
      'successful'
    );

    return {
      aggregateId: transactionId,
      events: [paymentProcessedEvent],
    };
  }
}

// ⭐ FOCUS: Sample integration event handlers
class OrderCreatedIntegrationHandler implements IntegrationEventHandler {
  async handle(integrationEvent: IntegrationEvent): Promise<void> {
    // Handle order created event in inventory service
    console.log('Order created integration event received', integrationEvent);
  }
}

class PaymentProcessedIntegrationHandler implements IntegrationEventHandler {
  async handle(integrationEvent: IntegrationEvent): Promise<void> {
    // Handle payment processed event in order service
    console.log(
      'Payment processed integration event received',
      integrationEvent
    );
  }
}

// ⭐ FOCUS: Sample domain events
export class OrderCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly customerId: string,
    public readonly items: any[],
    public readonly totalAmount: number
  ) {
    super(aggregateId, 'OrderCreated', 1);
  }
}

export class InventoryReservedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly orderId: EntityId
  ) {
    super(aggregateId, 'InventoryReserved', 1);
  }
}

export class PaymentProcessedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly orderId: EntityId,
    public readonly amount: number,
    public readonly status: string
  ) {
    super(aggregateId, 'PaymentProcessed', 1);
  }
}

// ⭐ FOCUS: Saga implementations
class OrderFulfillmentSaga {
  // Saga implementation for order fulfillment process
}

class PaymentProcessingSaga {
  // Saga implementation for payment processing
}

class InventoryReservationSaga {
  // Saga implementation for inventory management
}

class CustomerOnboardingSaga {
  // Saga implementation for customer onboarding
}

// ⭐ FOCUS: Interface definitions
interface CommandHandler {
  handle(command: ServiceCommand): Promise<ServiceCommandResult>;
}

interface IntegrationEventHandler {
  handle(integrationEvent: IntegrationEvent): Promise<void>;
}

interface PaymentMethod {
  type: string;
  provider: string;
  details: any;
}

interface Address {
  street: string;
  city: string;
  country: string;
  postalCode: string;
}

interface ShippingPreferences {
  priority: string;
  carrier?: string;
  instructions?: string;
}

interface InventoryReservationRequest {
  productId: string;
  quantity: number;
  reservationId: string;
}

// ⭐ FOCUS: Sample commands
class CreateOrderCommand implements ServiceCommand {
  type = 'CreateOrder';

  constructor(
    public readonly payload: {
      customerId: string;
      items: any[];
      shippingAddress: Address;
    }
  ) {}
}

class ReserveInventoryCommand implements ServiceCommand {
  type = 'ReserveInventory';

  constructor(
    public readonly productId: string,
    public readonly quantity: number,
    public readonly orderId: EntityId
  ) {
    this.payload = { productId, quantity, orderId };
  }

  payload: any;
}

class ProcessPaymentCommand implements ServiceCommand {
  type = 'ProcessPayment';

  constructor(
    public readonly orderId: EntityId,
    public readonly paymentMethod: PaymentMethod,
    public readonly amount: number
  ) {
    this.payload = { orderId, paymentMethod, amount };
  }

  payload: any;
}

class ScheduleShipmentCommand implements ServiceCommand {
  type = 'ScheduleShipment';

  constructor(
    public readonly orderId: EntityId,
    public readonly shippingAddress: Address,
    public readonly preferences: ShippingPreferences
  ) {
    this.payload = { orderId, shippingAddress, preferences };
  }

  payload: any;
}

class SendOrderConfirmationCommand implements ServiceCommand {
  type = 'SendOrderConfirmation';

  constructor(
    public readonly customerId: string,
    public readonly orderId: EntityId,
    public readonly transactionId: EntityId
  ) {
    this.payload = { customerId, orderId, transactionId };
  }

  payload: any;
}

class ConfirmInventoryAllocationCommand implements ServiceCommand {
  type = 'ConfirmInventoryAllocation';

  constructor(public readonly reservationId: string) {
    this.payload = { reservationId };
  }

  payload: any;
}

class ReleaseInventoryCommand implements ServiceCommand {
  type = 'ReleaseInventory';

  constructor(public readonly reservationId: string) {
    this.payload = { reservationId };
  }

  payload: any;
}

class CancelOrderCommand implements ServiceCommand {
  type = 'CancelOrder';

  constructor(
    public readonly orderId: EntityId,
    public readonly reason: string
  ) {
    this.payload = { orderId, reason };
  }

  payload: any;
}
```

## Usage Examples

```typescript
// Complete distributed event sourcing demonstration
import { DistributedEventSourcingCoordinator } from './distributed-event-architecture';

async function demonstrateDistributedEventSourcing() {
  const coordinator = new DistributedEventSourcingCoordinator();

  console.log('--- Distributed Event Sourcing Demo ---\n');

  // ⭐ FOCUS: 1. Process complex distributed business operation
  console.log('1. Order Fulfillment Process:');

  const orderData = {
    processId: 'order-process-123',
    customerId: 'customer-456',
    items: [
      { productId: 'product-1', quantity: 2, price: 29.99 },
      { productId: 'product-2', quantity: 1, price: 149.99 },
    ],
    totalAmount: 209.97,
    paymentMethod: {
      type: 'credit_card',
      provider: 'visa',
      details: { last4: '1234' },
    },
    shippingAddress: {
      street: '123 Main St',
      city: 'New York',
      country: 'USA',
      postalCode: '10001',
    },
    shippingPreferences: {
      priority: 'standard',
      carrier: 'ups',
      instructions: 'Leave at door',
    },
  };

  const fulfillmentResult = await coordinator.processDistributedBusinessProcess(
    'order-fulfillment',
    orderData
  );

  if (fulfillmentResult.isSuccess()) {
    const result = fulfillmentResult.value;
    console.log('  Order fulfillment completed successfully:');
    console.log(`    Process ID: ${result.processId}`);
    console.log(`    Order ID: ${result.results.orderId}`);
    console.log(
      `    Payment Transaction: ${result.results.paymentTransactionId}`
    );
    console.log(
      `    Inventory Reservations: ${result.results.inventoryReservations.length}`
    );
    console.log(`    Shipment ID: ${result.results.shipmentId || 'Pending'}`);
  } else {
    console.log('  Order fulfillment failed:', fulfillmentResult.error.message);
  }

  // ⭐ FOCUS: 2. Track distributed process status
  console.log('\n2. Process Status Tracking:');

  const statusResult = await coordinator.getDistributedProcessStatus(
    orderData.processId
  );

  if (statusResult.isSuccess()) {
    const status = statusResult.value;
    console.log(`  Process Status: ${status.status}`);
    console.log(`  Current Step: ${status.currentStep}`);
    console.log(`  Completed Steps: ${status.completedSteps.join(', ')}`);
    console.log(`  Failed Steps: ${status.failedSteps.join(', ')}`);
    console.log(`  Last Updated: ${status.lastUpdated.toISOString()}`);

    if (status.estimatedCompletion) {
      console.log(
        `  Estimated Completion: ${status.estimatedCompletion.toISOString()}`
      );
    }
  }

  // ⭐ FOCUS: 3. Monitor distributed system health
  console.log('\n3. Distributed System Health:');

  const healthStatus = await coordinator.getDistributedSystemHealth();

  console.log(`  Overall Health: ${healthStatus.overallHealth}`);
  console.log(
    `  Healthy Services: ${healthStatus.healthyServices}/${healthStatus.totalServices}`
  );

  console.log('  Service Details:');
  healthStatus.serviceDetails.forEach(service => {
    console.log(`    ${service.serviceName}:`);
    console.log(`      Health: ${service.isHealthy ? 'Healthy' : 'Unhealthy'}`);
    console.log(`      Event Store: ${service.eventStoreHealth}`);
    console.log(`      Processing Latency: ${service.processingLatency}ms`);
    console.log(`      Error Rate: ${(service.errorRate * 100).toFixed(2)}%`);

    if (service.lastEventProcessed) {
      console.log(
        `      Last Event: ${service.lastEventProcessed.toISOString()}`
      );
    }
  });

  // ⭐ FOCUS: 4. Customer onboarding process
  console.log('\n4. Customer Onboarding Process:');

  const onboardingData = {
    processId: 'onboarding-789',
    customerData: {
      email: 'new.customer@example.com',
      name: 'John Doe',
      preferences: {
        marketing: true,
        notifications: true,
      },
    },
    verificationMethod: 'email',
    initialSubscription: 'premium',
  };

  const onboardingResult = await coordinator.processDistributedBusinessProcess(
    'customer-onboarding',
    onboardingData
  );

  if (onboardingResult.isSuccess()) {
    console.log('  Customer onboarding initiated successfully');
    console.log(`  Process ID: ${onboardingResult.value.processId}`);
  }

  // ⭐ FOCUS: 5. Demonstrate system resilience
  console.log('\n5. System Resilience Test:');
  console.log('  (Simulating partial service failures...)');

  // Simulate multiple concurrent processes
  const concurrentProcesses = [];

  for (let i = 0; i < 5; i++) {
    const processData = {
      processId: `concurrent-${i}`,
      customerId: `customer-${i}`,
      items: [{ productId: `product-${i}`, quantity: 1, price: 99.99 }],
      totalAmount: 99.99,
      paymentMethod: { type: 'credit_card', provider: 'visa', details: {} },
      shippingAddress: orderData.shippingAddress,
      shippingPreferences: orderData.shippingPreferences,
    };

    concurrentProcesses.push(
      coordinator.processDistributedBusinessProcess(
        'order-fulfillment',
        processData
      )
    );
  }

  const concurrentResults = await Promise.allSettled(concurrentProcesses);
  const successful = concurrentResults.filter(
    r => r.status === 'fulfilled'
  ).length;
  const failed = concurrentResults.filter(r => r.status === 'rejected').length;

  console.log(
    `  Concurrent Processes: ${successful} successful, ${failed} failed`
  );
  console.log(
    `  Success Rate: ${((successful / concurrentProcesses.length) * 100).toFixed(1)}%`
  );

  // ⭐ FOCUS: 6. Final system health check
  console.log('\n6. Post-Load System Health:');

  const finalHealth = await coordinator.getDistributedSystemHealth();
  console.log(`  System Status: ${finalHealth.overallHealth}`);
  console.log(
    `  Services Online: ${finalHealth.healthyServices}/${finalHealth.totalServices}`
  );

  if (finalHealth.overallHealth !== 'healthy') {
    console.log('  Degraded Services:');
    finalHealth.serviceDetails
      .filter(s => !s.isHealthy)
      .forEach(service => {
        console.log(
          `    ${service.serviceName}: ${service.error || 'Performance issues'}`
        );
      });
  }
}

// Run the demonstration
demonstrateDistributedEventSourcing().catch(console.error);
```

## Key Features

- **Distributed Architecture**: Multiple event stores coordinated across
  services
- **Saga Orchestration**: Complex business process coordination with
  compensation
- **Event Propagation**: Cross-service event sharing with outbox pattern
- **Resilience Patterns**: Circuit breakers, retries, and graceful degradation
- **Process Tracking**: End-to-end visibility of distributed business processes
- **Health Monitoring**: Comprehensive system health and performance monitoring
- **Compensation Logic**: Automatic rollback for failed distributed transactions

## Architecture Benefits

1. **Service Autonomy**: Each service maintains its own event store and business
   logic
2. **Scalability**: Independent scaling of services based on load patterns
3. **Resilience**: Failure isolation and graceful degradation capabilities
4. **Observability**: Complete visibility into distributed process execution
5. **Consistency**: Eventually consistent data with strong business process
   integrity
6. **Evolution**: Services can evolve independently while maintaining
   integration

## Distributed Patterns

- **Saga Pattern**: Long-running business processes with compensation
- **Outbox Pattern**: Reliable event publication to external systems
- **Event Sourcing**: Complete audit trail across all services
- **CQRS**: Separate read/write models optimized for each service
- **Circuit Breaker**: Failure protection for service-to-service calls
- **Event-Driven Communication**: Loose coupling through event propagation

## Performance Considerations

- **Network Latency**: Minimize cross-service calls through event propagation
- **Data Consistency**: Balance consistency requirements with performance
- **Resource Utilization**: Monitor and optimize resource usage across services
- **Batch Processing**: Optimize event processing through batching where
  appropriate
- **Caching**: Strategic caching to reduce cross-service dependencies

## Common Pitfalls

- **Distributed Transactions**: Avoid two-phase commit patterns in favor of
  sagas
- **Event Ordering**: Handle out-of-order events gracefully
- **Service Dependencies**: Minimize synchronous dependencies between services
- **Monitoring Complexity**: Implement comprehensive distributed tracing
- **Data Duplication**: Accept controlled duplication for service autonomy

## Related Examples

- [Event Replay Engine](../intermediate/example-1.md)
- [High-Performance Event Store](./example-2.md)
- [Event Store Clustering](./example-3.md)
