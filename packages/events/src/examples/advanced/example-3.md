# Enterprise Event Mesh Architecture

**Version**: 1.0.0 **Package**: @vytches/ddd-events **Complexity**: advanced
**Domain**: Architecture **Patterns**: event-mesh, distributed-events,
cross-service-communication, event-routing **Dependencies**:
@vytches/ddd-events, @vytches/ddd-resilience, @vytches/ddd-logging,
@vytches/ddd-messaging

## Description

Enterprise-grade event mesh architecture for distributed microservices
communication. This example demonstrates sophisticated event routing,
cross-service event propagation, and resilient distributed event processing
patterns suitable for large-scale enterprise architectures.

## Business Context

Large enterprises with microservices architectures need robust event
communication patterns that span service boundaries while maintaining loose
coupling, fault tolerance, and operational visibility. Event mesh provides
decentralized event routing that scales horizontally and handles partial
failures gracefully.

## Code Example

```typescript
// enterprise-event-mesh.ts
import {
  DomainEvent,
  UnifiedEventBus,
  IEventHandler,
} from '@vytches/ddd-events';
import { EntityId } from '@vytches/ddd-value-objects';
import { Result, AsyncResult } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';
import { CircuitBreaker, RetryPolicy } from '@vytches/ddd-resilience';

// Cross-service domain events
export class CustomerCreatedEvent extends DomainEvent {
  constructor(
    public readonly customerId: EntityId,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly tier: 'bronze' | 'silver' | 'gold' | 'platinum',
    public readonly region: string,
    correlationId?: string
  ) {
    super('CustomerCreated', customerId.value, correlationId);
    this.metadata = {
      service: 'customer-service',
      version: '2.1.0',
      schema: 'customer-v2',
      region,
      tier,
      email,
    };
  }
}

export class OrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly orderId: EntityId,
    public readonly customerId: EntityId,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly items: Array<{
      productId: EntityId;
      quantity: number;
      price: number;
    }>,
    public readonly shippingAddress: {
      street: string;
      city: string;
      country: string;
      postalCode: string;
    },
    correlationId?: string
  ) {
    super('OrderCreated', orderId.value, correlationId);
    this.metadata = {
      service: 'order-service',
      version: '1.8.0',
      schema: 'order-v1',
      customerId: customerId.value,
      amount: totalAmount,
      currency,
      region: this.determineRegion(shippingAddress.country),
    };
  }

  private determineRegion(country: string): string {
    const regionMap: Record<string, string> = {
      US: 'north-america',
      CA: 'north-america',
      GB: 'europe',
      DE: 'europe',
      FR: 'europe',
      JP: 'asia-pacific',
      AU: 'asia-pacific',
    };
    return regionMap[country] || 'global';
  }
}

export class PaymentProcessedEvent extends DomainEvent {
  constructor(
    public readonly paymentId: EntityId,
    public readonly orderId: EntityId,
    public readonly customerId: EntityId,
    public readonly amount: number,
    public readonly currency: string,
    public readonly paymentMethod: string,
    public readonly status: 'completed' | 'failed' | 'pending',
    public readonly transactionId: string,
    correlationId?: string
  ) {
    super('PaymentProcessed', paymentId.value, correlationId);
    this.metadata = {
      service: 'payment-service',
      version: '3.2.1',
      schema: 'payment-v3',
      orderId: orderId.value,
      customerId: customerId.value,
      status,
      amount,
      currency,
    };
  }
}

export class InventoryReservedEvent extends DomainEvent {
  constructor(
    public readonly reservationId: EntityId,
    public readonly orderId: EntityId,
    public readonly items: Array<{
      productId: EntityId;
      quantityReserved: number;
      warehouseLocation: string;
    }>,
    public readonly reservationExpiry: Date,
    correlationId?: string
  ) {
    super('InventoryReserved', reservationId.value, correlationId);
    this.metadata = {
      service: 'inventory-service',
      version: '2.0.3',
      schema: 'inventory-v2',
      orderId: orderId.value,
      itemCount: items.length,
      expiresAt: reservationExpiry.toISOString(),
    };
  }
}

// ⭐ FOCUS: Event mesh router interface
export interface EventMeshRouter {
  route(event: DomainEvent): Promise<Result<EventRoutingResult[], Error>>;
  registerRoute(route: EventRoute): Promise<Result<void, Error>>;
  getRoutes(eventType?: string): EventRoute[];
  updateServiceHealth(serviceName: string, healthy: boolean): void;
}

export interface EventRoute {
  id: string;
  eventType: string;
  sourceService: string;
  targetServices: string[];
  routingStrategy: 'broadcast' | 'round-robin' | 'weighted' | 'conditional';
  conditions?: RouteCondition[];
  priority: number;
  enabled: boolean;
  circuitBreakerConfig?: {
    failureThreshold: number;
    recoveryTime: number;
  };
  retryConfig?: {
    maxAttempts: number;
    baseDelay: number;
  };
}

export interface RouteCondition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than';
  value: any;
}

export interface EventRoutingResult {
  targetService: string;
  success: boolean;
  error?: string;
  duration: number;
  attemptCount: number;
}

// ⭐ FOCUS: Enterprise event mesh implementation
export class EnterpriseEventMesh implements EventMeshRouter {
  private readonly logger = Logger.forContext('EnterpriseEventMesh');
  private readonly routes = new Map<string, EventRoute[]>();
  private readonly serviceHealth = new Map<string, boolean>();
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly retryPolicies = new Map<string, RetryPolicy>();
  private readonly metrics = new Map<string, any>();

  constructor(private readonly eventTransports: Map<string, EventTransport>) {
    this.initializeServiceHealth();
    this.startHealthMonitoring();
  }

  async route(
    event: DomainEvent
  ): Promise<Result<EventRoutingResult[], Error>> {
    const routingStartTime = Date.now();

    try {
      const eventRoutes = this.routes.get(event.eventType) || [];
      const applicableRoutes = await this.filterApplicableRoutes(
        event,
        eventRoutes
      );

      if (applicableRoutes.length === 0) {
        this.logger.warn('No routes found for event', {
          eventType: event.eventType,
          eventId: event.eventId,
          aggregateId: event.aggregateId,
        });
        return Result.ok([]);
      }

      // ⭐ FOCUS: Execute routing strategies
      const routingResults: EventRoutingResult[] = [];

      for (const route of applicableRoutes) {
        const routeResults = await this.executeRoute(event, route);
        routingResults.push(...routeResults);
      }

      const routingDuration = Date.now() - routingStartTime;

      // ⭐ FOCUS: Log routing metrics
      this.logger.info('Event routed through mesh', {
        eventType: event.eventType,
        eventId: event.eventId,
        routesExecuted: applicableRoutes.length,
        totalTargets: routingResults.length,
        successfulRoutes: routingResults.filter(r => r.success).length,
        failedRoutes: routingResults.filter(r => !r.success).length,
        routingDuration,
        correlationId: event.correlationId,
      });

      // Update metrics
      this.updateRoutingMetrics(
        event.eventType,
        routingResults,
        routingDuration
      );

      return Result.ok(routingResults);
    } catch (error) {
      const routingDuration = Date.now() - routingStartTime;

      this.logger.error('Event routing failed', {
        eventType: event.eventType,
        eventId: event.eventId,
        error: error,
        routingDuration,
      });

      return Result.fail(new Error(`Event routing failed: ${error.message}`));
    }
  }

  private async executeRoute(
    event: DomainEvent,
    route: EventRoute
  ): Promise<EventRoutingResult[]> {
    const healthyTargets = route.targetServices.filter(
      service => this.serviceHealth.get(service) !== false
    );

    if (healthyTargets.length === 0) {
      return [
        {
          targetService: route.targetServices.join(','),
          success: false,
          error: 'All target services are unhealthy',
          duration: 0,
          attemptCount: 0,
        },
      ];
    }

    const results: EventRoutingResult[] = [];

    switch (route.routingStrategy) {
      case 'broadcast':
        const broadcastResults = await this.broadcastToServices(
          event,
          healthyTargets,
          route
        );
        results.push(...broadcastResults);
        break;

      case 'round-robin':
        const rrResult = await this.routeRoundRobin(
          event,
          healthyTargets,
          route
        );
        results.push(rrResult);
        break;

      case 'weighted':
        const weightedResult = await this.routeWeighted(
          event,
          healthyTargets,
          route
        );
        results.push(weightedResult);
        break;

      case 'conditional':
        const conditionalResults = await this.routeConditional(event, route);
        results.push(...conditionalResults);
        break;
    }

    return results;
  }

  // ⭐ FOCUS: Broadcast strategy implementation
  private async broadcastToServices(
    event: DomainEvent,
    targetServices: string[],
    route: EventRoute
  ): Promise<EventRoutingResult[]> {
    const results: EventRoutingResult[] = [];

    // Execute all broadcasts in parallel
    const broadcastPromises = targetServices.map(async service => {
      return await this.sendToService(event, service, route);
    });

    const broadcastResults = await Promise.allSettled(broadcastPromises);

    broadcastResults.forEach((result, index) => {
      const service = targetServices[index];

      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          targetService: service,
          success: false,
          error: result.reason?.message || 'Unknown error',
          duration: 0,
          attemptCount: 1,
        });
      }
    });

    return results;
  }

  // ⭐ FOCUS: Round-robin strategy implementation
  private async routeRoundRobin(
    event: DomainEvent,
    targetServices: string[],
    route: EventRoute
  ): Promise<EventRoutingResult> {
    const routeKey = route.id;
    const currentIndex =
      (this.metrics.get(`${routeKey}_rr_index`) || 0) % targetServices.length;
    const selectedService = targetServices[currentIndex];

    // Update round-robin index
    this.metrics.set(`${routeKey}_rr_index`, currentIndex + 1);

    return await this.sendToService(event, selectedService, route);
  }

  // ⭐ FOCUS: Weighted routing strategy
  private async routeWeighted(
    event: DomainEvent,
    targetServices: string[],
    route: EventRoute
  ): Promise<EventRoutingResult> {
    // Simple weighted selection based on service health scores
    const serviceWeights = targetServices.map(service => ({
      service,
      weight: this.getServiceWeight(service),
    }));

    const totalWeight = serviceWeights.reduce((sum, sw) => sum + sw.weight, 0);
    const random = Math.random() * totalWeight;

    let currentWeight = 0;
    let selectedService = serviceWeights[0].service;

    for (const serviceWeight of serviceWeights) {
      currentWeight += serviceWeight.weight;
      if (random <= currentWeight) {
        selectedService = serviceWeight.service;
        break;
      }
    }

    return await this.sendToService(event, selectedService, route);
  }

  // ⭐ FOCUS: Conditional routing based on event metadata
  private async routeConditional(
    event: DomainEvent,
    route: EventRoute
  ): Promise<EventRoutingResult[]> {
    if (!route.conditions || route.conditions.length === 0) {
      return [];
    }

    const matchingServices: string[] = [];

    for (const condition of route.conditions) {
      const fieldValue = this.getEventFieldValue(event, condition.field);

      if (this.evaluateCondition(fieldValue, condition)) {
        matchingServices.push(...route.targetServices);
      }
    }

    if (matchingServices.length === 0) {
      return [];
    }

    // Remove duplicates and send to matching services
    const uniqueServices = Array.from(new Set(matchingServices));
    return await this.broadcastToServices(event, uniqueServices, route);
  }

  // ⭐ FOCUS: Resilient service communication
  private async sendToService(
    event: DomainEvent,
    serviceName: string,
    route: EventRoute
  ): Promise<EventRoutingResult> {
    const startTime = Date.now();
    let attemptCount = 0;

    try {
      // ⭐ FOCUS: Get circuit breaker for service
      const circuitBreakerKey = `${route.id}_${serviceName}`;
      let circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);

      if (!circuitBreaker && route.circuitBreakerConfig) {
        circuitBreaker = new CircuitBreaker(
          route.circuitBreakerConfig.failureThreshold,
          route.circuitBreakerConfig.recoveryTime
        );
        this.circuitBreakers.set(circuitBreakerKey, circuitBreaker);
      }

      // ⭐ FOCUS: Get retry policy for service
      let retryPolicy = this.retryPolicies.get(circuitBreakerKey);

      if (!retryPolicy && route.retryConfig) {
        retryPolicy = new RetryPolicy(
          route.retryConfig.maxAttempts,
          route.retryConfig.baseDelay
        );
        this.retryPolicies.set(circuitBreakerKey, retryPolicy);
      }

      // ⭐ FOCUS: Execute with resilience patterns
      const transportOperation = async () => {
        attemptCount++;
        const transport = this.eventTransports.get(serviceName);

        if (!transport) {
          throw new Error(
            `No transport configured for service: ${serviceName}`
          );
        }

        return await transport.sendEvent(event);
      };

      let result;

      // Apply circuit breaker if configured
      if (circuitBreaker) {
        if (retryPolicy) {
          result = await circuitBreaker.execute(() =>
            retryPolicy!.execute(transportOperation)
          );
        } else {
          result = await circuitBreaker.execute(transportOperation);
        }
      } else if (retryPolicy) {
        result = await retryPolicy.execute(transportOperation);
      } else {
        result = await transportOperation();
      }

      const duration = Date.now() - startTime;

      // Update service health on successful delivery
      this.serviceHealth.set(serviceName, true);

      return {
        targetService: serviceName,
        success: true,
        duration,
        attemptCount,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Update service health on failure
      this.serviceHealth.set(serviceName, false);

      this.logger.error('Failed to send event to service', {
        serviceName,
        eventType: event.eventType,
        eventId: event.eventId,
        error: error,
        duration,
        attemptCount,
      });

      return {
        targetService: serviceName,
        success: false,
        error: error.message,
        duration,
        attemptCount,
      };
    }
  }

  async registerRoute(route: EventRoute): Promise<Result<void, Error>> {
    try {
      if (!this.routes.has(route.eventType)) {
        this.routes.set(route.eventType, []);
      }

      const eventRoutes = this.routes.get(route.eventType)!;

      // Remove existing route with same ID
      const existingIndex = eventRoutes.findIndex(r => r.id === route.id);
      if (existingIndex >= 0) {
        eventRoutes.splice(existingIndex, 1);
      }

      // Add new route sorted by priority
      eventRoutes.push(route);
      eventRoutes.sort((a, b) => b.priority - a.priority);

      this.logger.info('Event route registered', {
        routeId: route.id,
        eventType: route.eventType,
        sourceService: route.sourceService,
        targetServices: route.targetServices,
        strategy: route.routingStrategy,
        priority: route.priority,
      });

      return Result.ok();
    } catch (error) {
      return Result.fail(
        new Error(`Failed to register route: ${error.message}`)
      );
    }
  }

  getRoutes(eventType?: string): EventRoute[] {
    if (eventType) {
      return this.routes.get(eventType) || [];
    }

    const allRoutes: EventRoute[] = [];
    this.routes.forEach(routes => allRoutes.push(...routes));
    return allRoutes;
  }

  updateServiceHealth(serviceName: string, healthy: boolean): void {
    const wasHealthy = this.serviceHealth.get(serviceName);
    this.serviceHealth.set(serviceName, healthy);

    if (wasHealthy !== healthy) {
      this.logger.info('Service health status changed', {
        serviceName,
        healthy,
        previousStatus: wasHealthy,
      });
    }
  }

  // Helper methods
  private async filterApplicableRoutes(
    event: DomainEvent,
    routes: EventRoute[]
  ): Promise<EventRoute[]> {
    return routes.filter(route => route.enabled);
  }

  private getServiceWeight(serviceName: string): number {
    const isHealthy = this.serviceHealth.get(serviceName) !== false;
    const baseWeight = isHealthy ? 1.0 : 0.1;

    // Could be enhanced with actual performance metrics
    return baseWeight;
  }

  private getEventFieldValue(event: DomainEvent, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value: any = event;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private evaluateCondition(
    fieldValue: any,
    condition: RouteCondition
  ): boolean {
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return (
          typeof fieldValue === 'string' && fieldValue.includes(condition.value)
        );
      case 'regex':
        return (
          typeof fieldValue === 'string' &&
          new RegExp(condition.value).test(fieldValue)
        );
      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > condition.value;
      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < condition.value;
      default:
        return false;
    }
  }

  private updateRoutingMetrics(
    eventType: string,
    results: EventRoutingResult[],
    duration: number
  ): void {
    const key = `metrics_${eventType}`;
    const existing = this.metrics.get(key) || {
      totalEvents: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      totalDuration: 0,
    };

    existing.totalEvents++;
    existing.successfulRoutes += results.filter(r => r.success).length;
    existing.failedRoutes += results.filter(r => !r.success).length;
    existing.totalDuration += duration;

    this.metrics.set(key, existing);
  }

  private initializeServiceHealth(): void {
    // Initialize all services as healthy
    this.eventTransports.forEach((_, serviceName) => {
      this.serviceHealth.set(serviceName, true);
    });
  }

  private startHealthMonitoring(): void {
    // Periodically check service health (simplified implementation)
    setInterval(async () => {
      for (const [serviceName, transport] of this.eventTransports) {
        try {
          const healthy = await transport.healthCheck();
          this.updateServiceHealth(serviceName, healthy);
        } catch {
          this.updateServiceHealth(serviceName, false);
        }
      }
    }, 30000); // Every 30 seconds
  }
}

// ⭐ FOCUS: Event transport abstraction
export interface EventTransport {
  sendEvent(event: DomainEvent): Promise<void>;
  healthCheck(): Promise<boolean>;
}

// Implementation for HTTP-based transport
export class HttpEventTransport implements EventTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceName: string
  ) {}

  async sendEvent(event: DomainEvent): Promise<void> {
    const response = await fetch(`${this.baseUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: event.eventType,
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        timestamp: event.timestamp,
        metadata: event.metadata,
        correlationId: event.correlationId,
        payload: event,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      } as any);
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

## Usage Examples

```typescript
// Enterprise event mesh setup
async function setupEventMesh() {
  // ⭐ FOCUS: Configure event transports for different services
  const transports = new Map<string, EventTransport>();
  transports.set(
    'customer-service',
    new HttpEventTransport('http://customer-api:3001', 'customer-service')
  );
  transports.set(
    'order-service',
    new HttpEventTransport('http://order-api:3002', 'order-service')
  );
  transports.set(
    'payment-service',
    new HttpEventTransport('http://payment-api:3003', 'payment-service')
  );
  transports.set(
    'inventory-service',
    new HttpEventTransport('http://inventory-api:3004', 'inventory-service')
  );
  transports.set(
    'notification-service',
    new HttpEventTransport(
      'http://notification-api:3005',
      'notification-service'
    )
  );

  const eventMesh = new EnterpriseEventMesh(transports);

  // ⭐ FOCUS: Register sophisticated routing rules
  await eventMesh.registerRoute({
    id: 'customer-created-broadcast',
    eventType: 'CustomerCreated',
    sourceService: 'customer-service',
    targetServices: [
      'order-service',
      'notification-service',
      'analytics-service',
    ],
    routingStrategy: 'broadcast',
    priority: 100,
    enabled: true,
    circuitBreakerConfig: {
      failureThreshold: 5,
      recoveryTime: 60000,
    },
    retryConfig: {
      maxAttempts: 3,
      baseDelay: 1000,
    },
  });

  await eventMesh.registerRoute({
    id: 'order-created-conditional',
    eventType: 'OrderCreated',
    sourceService: 'order-service',
    targetServices: ['payment-service', 'inventory-service'],
    routingStrategy: 'conditional',
    conditions: [
      { field: 'metadata.amount', operator: 'greater_than', value: 100 },
      { field: 'metadata.region', operator: 'equals', value: 'north-america' },
    ],
    priority: 90,
    enabled: true,
  });

  await eventMesh.registerRoute({
    id: 'payment-processed-weighted',
    eventType: 'PaymentProcessed',
    sourceService: 'payment-service',
    targetServices: ['order-service', 'fulfillment-service'],
    routingStrategy: 'weighted',
    priority: 80,
    enabled: true,
  });

  // ⭐ FOCUS: Route events through the mesh
  const customerId = EntityId.createUuid();
  const customerEvent = new CustomerCreatedEvent(
    customerId,
    'john@example.com',
    'John',
    'Doe',
    'gold',
    'north-america'
  );

  const routingResult = await eventMesh.route(customerEvent);
  if (routingResult.isSuccess()) {
    console.log('Event routed successfully:', routingResult.value);
  }

  // ⭐ FOCUS: Handle service health changes
  eventMesh.updateServiceHealth('payment-service', false); // Mark as unhealthy

  setTimeout(() => {
    eventMesh.updateServiceHealth('payment-service', true); // Recovery
  }, 60000);
}

setupEventMesh();
```

## Key Features

- **Distributed Event Routing**: Intelligent routing across microservices
- **Multiple Routing Strategies**: Broadcast, round-robin, weighted, conditional
- **Circuit Breaker Integration**: Fault tolerance for failing services
- **Retry Logic**: Configurable retry policies per route
- **Service Health Monitoring**: Automatic health tracking and routing
  adaptation
- **Conditional Routing**: Route based on event content and metadata
- **Performance Monitoring**: Comprehensive metrics and observability
- **Enterprise Ready**: Production-grade patterns with proper error handling

## Architecture Benefits

- **Loose Coupling**: Services don't need to know about each other directly
- **Scalability**: Horizontal scaling through distributed routing
- **Fault Tolerance**: Graceful degradation when services fail
- **Flexibility**: Dynamic routing rule configuration
- **Observability**: Complete visibility into event flows

## Performance Considerations

- **Parallel Routing**: Execute broadcasts in parallel for performance
- **Circuit Breaker Tuning**: Adjust thresholds based on service characteristics
- **Health Check Frequency**: Balance accuracy with resource usage
- **Route Caching**: Cache route evaluation results where appropriate

## Common Pitfalls

- **Event Storms**: Prevent cascading events that overwhelm services
- **Route Complexity**: Keep conditional logic simple and maintainable
- **Health Monitoring**: Ensure health checks don't impact performance
- **Circuit Breaker Configuration**: Tune parameters for each service's
  characteristics

## Related Examples

- [Event Stream Processing](./example-2.md)
- [Event Sourcing with Snapshots](./example-1.md)
- [Context-Aware Event Processing](../basic/example-3.md)
