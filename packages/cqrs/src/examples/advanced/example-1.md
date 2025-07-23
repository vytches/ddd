# Enterprise CQRS with Saga Orchestration

**Version**: 1.0.0
**Package**: @vytches-ddd/cqrs
**Complexity**: Advanced
**Domain**: Architecture
**Patterns**: CQRS, Saga orchestration, Distributed transactions, Compensation
**Dependencies**: @vytches-ddd/cqrs, @vytches-ddd/messaging, @vytches-ddd/events, @vytches-ddd/resilience, @vytches-ddd/di

## Description

This example demonstrates implementing enterprise-grade CQRS with saga orchestration for managing complex distributed transactions. It shows how to coordinate multiple bounded contexts, handle partial failures, implement compensation logic, and ensure eventual consistency across microservices.

## Business Context

Enterprise systems often require complex workflows that span multiple services:
- E-commerce order fulfillment involving inventory, payment, shipping, and notifications
- Financial transactions requiring regulatory compliance, fraud detection, and multi-step approvals
- Healthcare patient admission involving insurance verification, bed allocation, and staff assignment
- Supply chain orchestration with multiple vendors, warehouses, and logistics providers

These scenarios require sophisticated coordination with proper failure handling and compensation.

## Code Example

```typescript
// enterprise-saga-cqrs.ts
import { Command, CommandHandler, CommandBus, Query, QueryHandler } from '@vytches-ddd/cqrs';
import { BaseSaga, SagaStep, SagaContext } from '@vytches-ddd/messaging';
import { DomainEvent, EventBus } from '@vytches-ddd/events';
import { CircuitBreaker, Retry, Timeout } from '@vytches-ddd/resilience';
import { DomainService, Injectable } from '@vytches-ddd/di';
import { Result } from '@vytches-ddd/utils';
import type {
  OrderData,
  PaymentData,
  ShippingData,
  SagaState,
  CompensationContext
} from '../types'; // From your application

// ✅ FOCUS: Complex saga orchestration command
export class ProcessOrderSagaCommand extends Command {
  public readonly sagaId: string;
  public readonly correlationId: string;
  
  constructor(
    public readonly orderData: OrderData,
    public readonly metadata: SagaMetadata
  ) {
    super();
    this.sagaId = `saga-${this.commandId}`;
    this.correlationId = metadata.correlationId || this.commandId;
  }
}

// ✅ FOCUS: Saga state with comprehensive tracking
export interface OrderFulfillmentSagaState extends SagaState {
  orderId: string;
  customerId: string;
  currentStep: string;
  completedSteps: string[];
  failedSteps: string[];
  compensatedSteps: string[];
  inventoryReservationId?: string;
  paymentTransactionId?: string;
  shippingTrackingId?: string;
  notificationIds: string[];
  startedAt: Date;
  completedAt?: Date;
  failureReason?: string;
}

// ✅ FOCUS: Enterprise saga implementation
@DomainService('orderFulfillmentSaga', {
  lifetime: 'scoped',
  context: 'OrderManagement'
})
export class OrderFulfillmentSaga extends BaseSaga<OrderFulfillmentSagaState> {
  private readonly steps: SagaStep[] = [
    {
      name: 'VALIDATE_ORDER',
      handler: this.validateOrder.bind(this),
      compensator: null, // No compensation needed
      retryPolicy: { maxAttempts: 3, baseDelay: 1000 }
    },
    {
      name: 'RESERVE_INVENTORY',
      handler: this.reserveInventory.bind(this),
      compensator: this.releaseInventory.bind(this),
      retryPolicy: { maxAttempts: 3, baseDelay: 2000 },
      timeout: 30000
    },
    {
      name: 'PROCESS_PAYMENT',
      handler: this.processPayment.bind(this),
      compensator: this.refundPayment.bind(this),
      retryPolicy: { maxAttempts: 2, baseDelay: 5000 },
      timeout: 60000
    },
    {
      name: 'ARRANGE_SHIPPING',
      handler: this.arrangeShipping.bind(this),
      compensator: this.cancelShipping.bind(this),
      retryPolicy: { maxAttempts: 3, baseDelay: 3000 }
    },
    {
      name: 'SEND_NOTIFICATIONS',
      handler: this.sendNotifications.bind(this),
      compensator: null, // Best effort, no compensation
      retryPolicy: { maxAttempts: 5, baseDelay: 1000 }
    }
  ];

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly eventBus: EventBus,
    private readonly sagaRepository: ISagaRepository
  ) {
    super('OrderFulfillmentSaga');
  }

  // ✅ FOCUS: Saga execution with distributed coordination
  async execute(command: ProcessOrderSagaCommand): Promise<Result<OrderFulfillmentResult, SagaError>> {
    const sagaContext = this.createSagaContext(command);
    
    try {
      // Initialize saga state
      const initialState: OrderFulfillmentSagaState = {
        sagaId: command.sagaId,
        orderId: command.orderData.orderId,
        customerId: command.orderData.customerId,
        currentStep: 'INITIALIZING',
        completedSteps: [],
        failedSteps: [],
        compensatedSteps: [],
        notificationIds: [],
        startedAt: new Date(),
        status: 'STARTED'
      };

      await this.sagaRepository.save(initialState);

      // Publish saga started event
      await this.eventBus.publish(new SagaStartedEvent(
        command.sagaId,
        'OrderFulfillmentSaga',
        command.orderData
      ));

      // Execute saga steps
      for (const step of this.steps) {
        const stepResult = await this.executeStep(step, sagaContext);
        
        if (stepResult.isFailure()) {
          // Step failed, initiate compensation
          await this.compensate(sagaContext, step.name);
          
          return Result.fail({
            type: 'SAGA_EXECUTION_FAILED',
            sagaId: command.sagaId,
            failedStep: step.name,
            reason: stepResult.error.message,
            compensationCompleted: true
          });
        }

        // Update saga state
        await this.updateSagaState(sagaContext.sagaId, {
          currentStep: step.name,
          completedSteps: [...sagaContext.state.completedSteps, step.name]
        });
      }

      // Saga completed successfully
      const completedState = await this.completeSaga(sagaContext);
      
      await this.eventBus.publish(new SagaCompletedEvent(
        command.sagaId,
        completedState
      ));

      return Result.ok({
        sagaId: command.sagaId,
        orderId: command.orderData.orderId,
        status: 'COMPLETED',
        completedSteps: completedState.completedSteps,
        trackingNumber: completedState.shippingTrackingId!,
        estimatedDelivery: this.calculateDeliveryDate()
      });

    } catch (error) {
      // Catastrophic failure - attempt compensation
      await this.handleCatastrophicFailure(sagaContext, error as Error);
      
      return Result.fail({
        type: 'SAGA_CATASTROPHIC_FAILURE',
        sagaId: command.sagaId,
        message: (error as Error).message
      });
    }
  }

  // ✅ FOCUS: Individual saga steps with business logic
  @CircuitBreaker({ failureThreshold: 5, resetTimeout: 60000 })
  @Retry({ maxAttempts: 3, baseDelay: 2000 })
  private async validateOrder(context: SagaContext): Promise<Result<void, Error>> {
    const validationCommand = new ValidateOrderCommand(
      context.state.orderId,
      context.correlationId
    );

    const result = await this.commandBus.execute(validationCommand);
    
    if (result.isFailure()) {
      return Result.fail(new Error(`Order validation failed: ${result.error.message}`));
    }

    return Result.ok(undefined);
  }

  @Timeout(30000)
  private async reserveInventory(context: SagaContext): Promise<Result<void, Error>> {
    const reservationCommand = new ReserveInventoryCommand(
      context.state.orderId,
      context.orderData.items,
      {
        sagaId: context.sagaId,
        correlationId: context.correlationId,
        priority: context.orderData.priority
      }
    );

    const result = await this.commandBus.execute(reservationCommand);
    
    if (result.isSuccess) {
      // Store reservation ID for potential compensation
      await this.updateSagaState(context.sagaId, {
        inventoryReservationId: result.value.reservationId
      });
    }

    return result;
  }

  private async processPayment(context: SagaContext): Promise<Result<void, Error>> {
    // Check if customer has sufficient credit
    const creditQuery = new CheckCustomerCreditQuery(
      context.state.customerId,
      context.orderData.totalAmount
    );

    const creditResult = await this.queryBus.execute(creditQuery);
    
    if (creditResult.isFailure() || !creditResult.value.hasCredit) {
      return Result.fail(new Error('Insufficient credit'));
    }

    // Process payment
    const paymentCommand = new ProcessPaymentCommand({
      orderId: context.state.orderId,
      customerId: context.state.customerId,
      amount: context.orderData.totalAmount,
      paymentMethod: context.orderData.paymentMethod,
      sagaContext: {
        sagaId: context.sagaId,
        correlationId: context.correlationId
      }
    });

    const paymentResult = await this.commandBus.execute(paymentCommand);
    
    if (paymentResult.isSuccess) {
      await this.updateSagaState(context.sagaId, {
        paymentTransactionId: paymentResult.value.transactionId
      });
    }

    return paymentResult;
  }

  // ✅ FOCUS: Compensation logic for rollback
  private async releaseInventory(context: CompensationContext): Promise<Result<void, Error>> {
    if (!context.state.inventoryReservationId) {
      return Result.ok(undefined); // Nothing to compensate
    }

    const releaseCommand = new ReleaseInventoryReservationCommand(
      context.state.inventoryReservationId,
      {
        reason: 'SAGA_COMPENSATION',
        sagaId: context.sagaId,
        correlationId: context.correlationId
      }
    );

    try {
      await this.commandBus.execute(releaseCommand);
      
      await this.updateSagaState(context.sagaId, {
        compensatedSteps: [...context.state.compensatedSteps, 'RESERVE_INVENTORY']
      });

      return Result.ok(undefined);
    } catch (error) {
      // Log compensation failure but don't fail the entire compensation
      console.error('Inventory release compensation failed:', error);
      return Result.fail(error as Error);
    }
  }

  private async refundPayment(context: CompensationContext): Promise<Result<void, Error>> {
    if (!context.state.paymentTransactionId) {
      return Result.ok(undefined);
    }

    const refundCommand = new RefundPaymentCommand(
      context.state.paymentTransactionId,
      {
        reason: 'ORDER_FULFILLMENT_FAILED',
        sagaId: context.sagaId,
        correlationId: context.correlationId
      }
    );

    const refundResult = await this.commandBus.execute(refundCommand);
    
    if (refundResult.isSuccess) {
      await this.updateSagaState(context.sagaId, {
        compensatedSteps: [...context.state.compensatedSteps, 'PROCESS_PAYMENT']
      });

      // Notify customer about refund
      await this.eventBus.publish(new PaymentRefundedEvent(
        context.state.orderId,
        context.state.paymentTransactionId,
        refundResult.value.refundId
      ));
    }

    return refundResult;
  }

  // ✅ FOCUS: Compensation orchestration
  private async compensate(context: SagaContext, failedStep: string): Promise<void> {
    const stepsToCompensate = this.getCompensationSteps(
      context.state.completedSteps,
      failedStep
    );

    for (const step of stepsToCompensate) {
      if (step.compensator) {
        try {
          await step.compensator({
            ...context,
            compensationReason: failedStep
          });
        } catch (error) {
          // Log but continue compensation
          console.error(`Compensation failed for step ${step.name}:`, error);
        }
      }
    }

    await this.updateSagaState(context.sagaId, {
      status: 'COMPENSATED',
      completedAt: new Date()
    });
  }

  private getCompensationSteps(completedSteps: string[], failedStep: string): SagaStep[] {
    // Return steps in reverse order for compensation
    return this.steps
      .filter(step => completedSteps.includes(step.name))
      .reverse();
  }
}

// ✅ FOCUS: Advanced saga orchestration handler
@Injectable()
@CommandHandler(ProcessOrderSagaCommand)
export class ProcessOrderSagaHandler {
  constructor(
    private readonly sagaOrchestrator: ISagaOrchestrator,
    private readonly orderFulfillmentSaga: OrderFulfillmentSaga
  ) {}

  async execute(command: ProcessOrderSagaCommand): Promise<Result<OrderFulfillmentResult, SagaError>> {
    // Register saga with orchestrator
    await this.sagaOrchestrator.register(
      command.sagaId,
      this.orderFulfillmentSaga,
      {
        timeout: 300000, // 5 minutes
        maxRetries: 1,
        isolationLevel: 'SERIALIZABLE'
      }
    );

    // Execute saga with monitoring
    return await this.sagaOrchestrator.execute(command);
  }
}

// ✅ FOCUS: Query for saga status monitoring
export class GetSagaStatusQuery extends Query<SagaStatusResult> {
  constructor(
    public readonly sagaId: string,
    public readonly includeHistory: boolean = false
  ) {
    super();
  }
}

@QueryHandler(GetSagaStatusQuery)
export class GetSagaStatusHandler {
  constructor(
    private readonly sagaRepository: ISagaRepository,
    private readonly eventStore: IEventStore
  ) {}

  async execute(query: GetSagaStatusQuery): Promise<Result<SagaStatusResult, Error>> {
    const saga = await this.sagaRepository.findById(query.sagaId);
    
    if (!saga) {
      return Result.fail(new Error(`Saga ${query.sagaId} not found`));
    }

    const result: SagaStatusResult = {
      sagaId: saga.sagaId,
      type: saga.type,
      status: saga.status,
      currentStep: saga.currentStep,
      completedSteps: saga.completedSteps,
      failedSteps: saga.failedSteps,
      compensatedSteps: saga.compensatedSteps,
      startedAt: saga.startedAt,
      completedAt: saga.completedAt,
      duration: saga.completedAt 
        ? saga.completedAt.getTime() - saga.startedAt.getTime() 
        : Date.now() - saga.startedAt.getTime()
    };

    if (query.includeHistory) {
      // Fetch saga events from event store
      const events = await this.eventStore.getEventsByCorrelationId(saga.sagaId);
      result.history = events.map(e => ({
        timestamp: e.occurredAt,
        eventType: e.eventType,
        data: e.payload
      }));
    }

    return Result.ok(result);
  }
}

// ✅ FOCUS: Enterprise monitoring and analytics
export class SagaMonitoringService {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly metricsCollector: IMetricsCollector,
    private readonly alertingService: IAlertingService
  ) {}

  async monitorSaga(sagaId: string): Promise<void> {
    const interval = setInterval(async () => {
      const statusQuery = new GetSagaStatusQuery(sagaId, false);
      const result = await this.queryBus.execute(statusQuery);

      if (result.isSuccess) {
        const status = result.value;
        
        // Record metrics
        await this.metricsCollector.recordMetrics({
          operation: 'SagaExecution',
          sagaType: status.type,
          status: status.status,
          duration: status.duration,
          completedSteps: status.completedSteps.length,
          tags: {
            sagaId: status.sagaId
          }
        });

        // Check for alerts
        if (status.duration > 240000 && status.status === 'STARTED') {
          await this.alertingService.sendAlert({
            severity: 'WARNING',
            title: 'Long-running saga detected',
            message: `Saga ${sagaId} has been running for ${status.duration}ms`,
            sagaId
          });
        }

        // Stop monitoring completed sagas
        if (['COMPLETED', 'COMPENSATED', 'FAILED'].includes(status.status)) {
          clearInterval(interval);
        }
      }
    }, 5000); // Check every 5 seconds
  }
}
```

## Key Features

- **Saga Orchestration**: Complete distributed transaction management with compensation
- **Step Coordination**: Sequential execution with proper state management
- **Compensation Logic**: Automatic rollback of completed steps on failure
- **Resilience Patterns**: Circuit breakers, retries, and timeouts for each step
- **State Persistence**: Durable saga state for recovery and monitoring
- **Event Sourcing**: Complete audit trail of saga execution
- **Real-time Monitoring**: Live tracking of saga progress and performance
- **Enterprise Integration**: Coordination across multiple bounded contexts

## Usage Examples

```typescript
// Initialize saga infrastructure
const sagaOrchestrator = new SagaOrchestrator(
  sagaRepository,
  eventBus,
  logger
);

const commandBus = new CommandBus();
commandBus.registerHandler(ProcessOrderSagaCommand, ProcessOrderSagaHandler);

// Execute order fulfillment saga
const orderData: OrderData = {
  orderId: 'order-123',
  customerId: 'customer-456',
  items: [
    { productId: 'prod-1', quantity: 2, price: 50.00 },
    { productId: 'prod-2', quantity: 1, price: 100.00 }
  ],
  totalAmount: 200.00,
  paymentMethod: 'CREDIT_CARD',
  shippingAddress: { /* ... */ },
  priority: 'STANDARD'
};

const sagaCommand = new ProcessOrderSagaCommand(
  orderData,
  {
    correlationId: 'correlation-123',
    initiatedBy: 'user-789',
    source: 'WEB_PORTAL'
  }
);

const result = await commandBus.execute(sagaCommand);

if (result.isSuccess) {
  console.log('Order fulfilled:', result.value);
  
  // Start monitoring
  const monitoringService = new SagaMonitoringService(queryBus, metrics, alerting);
  await monitoringService.monitorSaga(result.value.sagaId);
} else {
  console.error('Order fulfillment failed:', result.error);
}

// Query saga status
const statusQuery = new GetSagaStatusQuery(sagaCommand.sagaId, true);
const status = await queryBus.execute(statusQuery);
```

## Common Pitfalls

- **Compensation Order**: Always compensate in reverse order of execution
- **Idempotency**: Ensure all saga steps and compensations are idempotent
- **State Persistence**: Always persist state changes before proceeding
- **Timeout Management**: Set appropriate timeouts for each step
- **Partial Failures**: Handle scenarios where compensation itself fails
- **Event Ordering**: Ensure proper event sequencing in distributed systems

## Related Examples

- [Event Integration](../intermediate/example-1.md) - CQRS with events
- [Policy Authorization](../intermediate/example-2.md) - Security patterns
- [Distributed Tracing](../intermediate/example-3.md) - Observability
- [AI-Enhanced CQRS](./example-2.md) - Machine learning integration