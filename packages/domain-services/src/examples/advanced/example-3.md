# Enterprise Domain Service - Expert Example

**Version**: 1.0.0
**Package**: @vytches-ddd/domain-services
**Complexity**: expert
**Domain**: order-management
**Patterns**: domain-service, enterprise, full-stack
**Dependencies**: @vytches-ddd/core, @vytches-ddd/enterprise

## Description

This example demonstrates a comprehensive enterprise domain service that combines all advanced patterns: event sourcing, CQRS, sagas, resilience, policies, logging, and monitoring. It represents a production-ready implementation.

## Business Context

Enterprise applications require services that can handle complex business operations with high availability, auditability, and maintainability. This example shows how to build a domain service that meets enterprise-grade requirements.

## Code Example

```typescript
// enterprise-order.service.ts
import { BaseDomainService } from '@vytches-ddd/domain-services';
import { 
  EventStore, 
  CommandBus, 
  QueryBus, 
  PolicyRegistry,
  SagaOrchestrator,
  CircuitBreaker,
  Logger
} from '@vytches-ddd/enterprise';
import { Result } from '@vytches-ddd/utils';
import { 
  Order, 
  CreateOrderCommand, 
  OrderProcessingResult,
  OrderAggregate,
  OrderCreatedEvent,
  OrderProcessingContext
} from '../types';

/**
 * @llm-summary Enterprise-grade domain service with comprehensive capabilities
 * @llm-domain order-management
 * @llm-complexity Expert
 * 
 * @description
 * Production-ready domain service combining event sourcing, CQRS, sagas,
 * resilience patterns, policy enforcement, and comprehensive observability.
 * 
 * @example
 * ```typescript
 * const service = new EnterpriseOrderService(dependencies);
 * const result = await service.processEnterpriseOrder(command, context);
 * ```
 */
export class EnterpriseOrderService extends BaseDomainService {
  private readonly logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly eventStore: EventStore,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly policyRegistry: PolicyRegistry,
    private readonly sagaOrchestrator: SagaOrchestrator,
    private readonly auditLogger: Logger
  ) {
    super('EnterpriseOrderService');
    this.logger = Logger.forContext('EnterpriseOrderService');
    this.initializeCircuitBreaker();
  }

  /**
   * Processes enterprise order with full feature set
   * 
   * @param command - Order creation command
   * @param context - Processing context with correlation and audit info
   * @returns Result containing processing result or error
   */
  async processEnterpriseOrder(
    command: CreateOrderCommand,
    context: OrderProcessingContext
  ): Promise<Result<OrderProcessingResult, Error>> {
    const correlationId = context.correlationId;
    const startTime = Date.now();

    this.logger.info('Starting enterprise order processing', {
      orderId: command.orderId,
      correlationId,
      userId: command.userId,
      itemCount: command.items.length
    });

    try {
      // Step 1: Policy validation
      const policyResult = await this.validateOrderPolicies(command, context);
      if (policyResult.isFailure()) {
        await this.auditFailure('POLICY_VALIDATION_FAILED', policyResult.error, context);
        return Result.failure(policyResult.error);
      }

      // Step 2: Create order aggregate with event sourcing
      const aggregateResult = await this.createOrderAggregate(command, context);
      if (aggregateResult.isFailure()) {
        await this.auditFailure('AGGREGATE_CREATION_FAILED', aggregateResult.error, context);
        return Result.failure(aggregateResult.error);
      }
      const orderAggregate = aggregateResult.value;

      // Step 3: Execute CQRS commands
      const cqrsResult = await this.executeCQRSCommands(orderAggregate, context);
      if (cqrsResult.isFailure()) {
        await this.auditFailure('CQRS_EXECUTION_FAILED', cqrsResult.error, context);
        return Result.failure(cqrsResult.error);
      }

      // Step 4: Start saga orchestration
      const sagaResult = await this.startSagaOrchestration(orderAggregate, context);
      if (sagaResult.isFailure()) {
        await this.auditFailure('SAGA_START_FAILED', sagaResult.error, context);
        return Result.failure(sagaResult.error);
      }

      // Step 5: Persist events to event store
      await this.persistEvents(orderAggregate, context);

      // Step 6: Create processing result
      const result = await this.createProcessingResult(orderAggregate, context);

      // Step 7: Audit success
      await this.auditSuccess(result, context, Date.now() - startTime);

      this.logger.info('Enterprise order processing completed successfully', {
        orderId: result.orderId,
        correlationId,
        duration: Date.now() - startTime,
        status: result.status
      });

      return Result.success(result);

    } catch (error) {
      this.logger.error('Enterprise order processing failed', {
        orderId: command.orderId,
        correlationId,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.auditFailure('UNEXPECTED_ERROR', error, context);
      return Result.failure(new Error(`Enterprise order processing failed: ${error.message}`));
    }
  }

  /**
   * Validates order using enterprise policies
   */
  private async validateOrderPolicies(
    command: CreateOrderCommand,
    context: OrderProcessingContext
  ): Promise<Result<void, Error>> {
    
    this.logger.debug('Validating order policies', {
      orderId: command.orderId,
      correlationId: context.correlationId
    });

    try {
      // Get comprehensive policy suite
      const policies = await this.policyRegistry.findByDomain('order-management');
      
      for (const policy of policies) {
        const policyResult = await policy.check({
          entity: command,
          context: {
            correlationId: context.correlationId,
            userId: context.userId,
            requestId: context.requestId,
            timestamp: context.timestamp,
            source: 'EnterpriseOrderService'
          }
        });

        if (policyResult.isFailure()) {
          const violations = policyResult.error.violations;
          this.logger.warn('Policy validation failed', {
            policyId: policy.id,
            violations: violations.length,
            correlationId: context.correlationId
          });
          
          return Result.failure(new Error(`Policy validation failed: ${violations.map(v => v.message).join(', ')}`));
        }
      }

      return Result.success();

    } catch (error) {
      this.logger.error('Policy validation error', {
        orderId: command.orderId,
        correlationId: context.correlationId,
        error: error.message
      });
      
      return Result.failure(new Error(`Policy validation error: ${error.message}`));
    }
  }

  /**
   * Creates order aggregate with event sourcing
   */
  private async createOrderAggregate(
    command: CreateOrderCommand,
    context: OrderProcessingContext
  ): Promise<Result<OrderAggregate, Error>> {
    
    this.logger.debug('Creating order aggregate', {
      orderId: command.orderId,
      correlationId: context.correlationId
    });

    try {
      // Create aggregate with domain events
      const orderAggregate = OrderAggregate.create({
        id: command.orderId,
        userId: command.userId,
        items: command.items,
        metadata: {
          correlationId: context.correlationId,
          requestId: context.requestId,
          source: 'EnterpriseOrderService'
        }
      });

      // Validate aggregate state
      const validationResult = orderAggregate.validate();
      if (validationResult.isFailure()) {
        return Result.failure(validationResult.error);
      }

      return Result.success(orderAggregate);

    } catch (error) {
      this.logger.error('Aggregate creation failed', {
        orderId: command.orderId,
        correlationId: context.correlationId,
        error: error.message
      });
      
      return Result.failure(new Error(`Aggregate creation failed: ${error.message}`));
    }
  }

  /**
   * Executes CQRS commands
   */
  private async executeCQRSCommands(
    orderAggregate: OrderAggregate,
    context: OrderProcessingContext
  ): Promise<Result<void, Error>> {
    
    this.logger.debug('Executing CQRS commands', {
      orderId: orderAggregate.id,
      correlationId: context.correlationId
    });

    try {
      // Execute commands through command bus
      const commands = [
        { type: 'ValidateInventory', payload: { orderId: orderAggregate.id, items: orderAggregate.items } },
        { type: 'CalculatePricing', payload: { orderId: orderAggregate.id, customerId: orderAggregate.userId } },
        { type: 'ApplyDiscounts', payload: { orderId: orderAggregate.id, customerId: orderAggregate.userId } }
      ];

      for (const command of commands) {
        const result = await this.commandBus.send(command);
        if (result.isFailure()) {
          return Result.failure(new Error(`CQRS command failed: ${command.type}`));
        }
      }

      return Result.success();

    } catch (error) {
      this.logger.error('CQRS execution failed', {
        orderId: orderAggregate.id,
        correlationId: context.correlationId,
        error: error.message
      });
      
      return Result.failure(new Error(`CQRS execution failed: ${error.message}`));
    }
  }

  /**
   * Starts saga orchestration
   */
  private async startSagaOrchestration(
    orderAggregate: OrderAggregate,
    context: OrderProcessingContext
  ): Promise<Result<void, Error>> {
    
    this.logger.debug('Starting saga orchestration', {
      orderId: orderAggregate.id,
      correlationId: context.correlationId
    });

    try {
      // Create saga start event
      const sagaStartEvent = {
        eventType: 'OrderCreated',
        orderId: orderAggregate.id,
        userId: orderAggregate.userId,
        items: orderAggregate.items,
        totalAmount: orderAggregate.totalAmount,
        createdAt: new Date(),
        metadata: {
          correlationId: context.correlationId,
          requestId: context.requestId,
          source: 'EnterpriseOrderService'
        }
      };

      // Start saga
      const sagaResults = await this.sagaOrchestrator.processEvent(sagaStartEvent, {
        correlationId: context.correlationId,
        userId: context.userId,
        metadata: {
          orderId: orderAggregate.id,
          priority: context.priority
        }
      });

      if (sagaResults.length === 0) {
        return Result.failure(new Error('No saga found to handle order creation'));
      }

      return Result.success();

    } catch (error) {
      this.logger.error('Saga orchestration failed', {
        orderId: orderAggregate.id,
        correlationId: context.correlationId,
        error: error.message
      });
      
      return Result.failure(new Error(`Saga orchestration failed: ${error.message}`));
    }
  }

  /**
   * Persists events to event store
   */
  private async persistEvents(
    orderAggregate: OrderAggregate,
    context: OrderProcessingContext
  ): Promise<void> {
    
    this.logger.debug('Persisting events', {
      orderId: orderAggregate.id,
      correlationId: context.correlationId,
      eventCount: orderAggregate.uncommittedEvents.length
    });

    try {
      // Get uncommitted events
      const events = orderAggregate.uncommittedEvents.map(event => ({
        ...event,
        metadata: {
          ...event.metadata,
          correlationId: context.correlationId,
          requestId: context.requestId,
          userId: context.userId,
          timestamp: new Date().toISOString()
        }
      }));

      // Persist to event store
      await this.eventStore.appendEvents(orderAggregate.id, events);

      // Mark events as committed
      orderAggregate.markEventsAsCommitted();

      this.logger.info('Events persisted successfully', {
        orderId: orderAggregate.id,
        correlationId: context.correlationId,
        eventCount: events.length
      });

    } catch (error) {
      this.logger.error('Event persistence failed', {
        orderId: orderAggregate.id,
        correlationId: context.correlationId,
        error: error.message
      });
      
      throw new Error(`Event persistence failed: ${error.message}`);
    }
  }

  /**
   * Creates processing result
   */
  private async createProcessingResult(
    orderAggregate: OrderAggregate,
    context: OrderProcessingContext
  ): Promise<OrderProcessingResult> {
    
    // Query for additional data
    const inventoryUpdates = await this.queryBus.send({
      type: 'GetInventoryUpdates',
      orderId: orderAggregate.id
    });

    const notifications = await this.queryBus.send({
      type: 'GetNotificationStatus',
      orderId: orderAggregate.id
    });

    return {
      orderId: orderAggregate.id,
      status: orderAggregate.status,
      inventoryUpdates: inventoryUpdates.value || [],
      notifications: notifications.value || [],
      metadata: {
        correlationId: context.correlationId,
        requestId: context.requestId,
        processedAt: new Date().toISOString(),
        processingDuration: Date.now() - context.timestamp.getTime()
      }
    };
  }

  /**
   * Audits successful processing
   */
  private async auditSuccess(
    result: OrderProcessingResult,
    context: OrderProcessingContext,
    duration: number
  ): Promise<void> {
    
    await this.auditLogger.info('Order processing completed', {
      orderId: result.orderId,
      correlationId: context.correlationId,
      userId: context.userId,
      status: result.status,
      duration,
      inventoryUpdates: result.inventoryUpdates.length,
      notifications: result.notifications.length,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Audits processing failure
   */
  private async auditFailure(
    failureType: string,
    error: Error,
    context: OrderProcessingContext
  ): Promise<void> {
    
    await this.auditLogger.error('Order processing failed', {
      failureType,
      error: error.message,
      correlationId: context.correlationId,
      userId: context.userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Initializes circuit breaker
   */
  private initializeCircuitBreaker(): void {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 10000,
      name: 'EnterpriseOrderService'
    });
  }

  /**
   * Gets comprehensive service metrics
   */
  async getServiceMetrics(): Promise<EnterpriseServiceMetrics> {
    return {
      circuitBreaker: this.circuitBreaker.getMetrics(),
      eventStore: await this.eventStore.getMetrics(),
      sagaOrchestrator: await this.sagaOrchestrator.getMetrics(),
      commandBus: await this.commandBus.getMetrics(),
      queryBus: await this.queryBus.getMetrics(),
      policyRegistry: await this.policyRegistry.getMetrics(),
      serviceHealth: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        lastHealthCheck: new Date().toISOString()
      }
    };
  }

  /**
   * Performs health check
   */
  async healthCheck(): Promise<Result<HealthCheckResult, Error>> {
    try {
      const checks = await Promise.allSettled([
        this.eventStore.healthCheck(),
        this.commandBus.healthCheck(),
        this.queryBus.healthCheck(),
        this.sagaOrchestrator.healthCheck()
      ]);

      const failedChecks = checks.filter(check => check.status === 'rejected');
      
      if (failedChecks.length > 0) {
        return Result.failure(new Error(`Health check failed: ${failedChecks.length} components unhealthy`));
      }

      return Result.success({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          eventStore: 'healthy',
          commandBus: 'healthy',
          queryBus: 'healthy',
          sagaOrchestrator: 'healthy'
        }
      });

    } catch (error) {
      return Result.failure(new Error(`Health check error: ${error.message}`));
    }
  }
}

/**
 * Enterprise service metrics interface
 */
interface EnterpriseServiceMetrics {
  circuitBreaker: any;
  eventStore: any;
  sagaOrchestrator: any;
  commandBus: any;
  queryBus: any;
  policyRegistry: any;
  serviceHealth: {
    status: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    lastHealthCheck: string;
  };
}

/**
 * Health check result interface
 */
interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  components: {
    eventStore: string;
    commandBus: string;
    queryBus: string;
    sagaOrchestrator: string;
  };
}
```

## Key Features

- **Event Sourcing**: Complete event sourcing implementation with event store
- **CQRS**: Command and query separation with dedicated buses
- **Saga Orchestration**: Long-running process coordination
- **Policy Enforcement**: Comprehensive business rule validation
- **Resilience Patterns**: Circuit breakers and error handling
- **Comprehensive Logging**: Structured logging with correlation
- **Audit Trail**: Complete audit logging for compliance
- **Health Monitoring**: Health checks and metrics collection
- **Enterprise Integration**: Production-ready enterprise features

## Common Pitfalls

- **Complexity Management**: Keep services focused despite rich feature set
- **Performance**: Monitor performance impact of comprehensive features
- **Configuration**: Manage complex configuration properly
- **Monitoring**: Implement comprehensive monitoring and alerting
- **Testing**: Ensure thorough testing of all enterprise features

## Related Examples

- [Saga-Orchestrated Domain Service](./example-1.md) - Saga patterns
- [Resilient Domain Service](./example-2.md) - Resilience patterns
- [Enterprise examples](../../enterprise/examples/) - Enterprise feature details