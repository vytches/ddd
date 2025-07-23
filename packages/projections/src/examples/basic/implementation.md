# Basic Implementation Guide

**Version**: 1.0.0
**Package**: @vytches-ddd/projections
**Complexity**: basic
**Domain**: Event Sourcing
**Patterns**: Implementation strategies, setup patterns, best practices
**Dependencies**: @vytches-ddd/projections, @vytches-ddd/events

## Description

Comprehensive guide for implementing basic event projections in your application. This guide covers setup procedures, implementation patterns, common configurations, and best practices for building reliable projection systems.

## Business Context

Implementing event projections requires understanding of:
- Event sourcing fundamentals and read model concepts
- Projection lifecycle management and error handling
- Performance considerations for real-time updates
- Data consistency and eventual consistency patterns
- Monitoring and maintenance procedures

This guide provides practical implementation strategies for building production-ready projection systems.

## Implementation Overview

```typescript
// basic-projection-implementation.ts
import { 
  ProjectionBase, 
  ProjectionEngine,
  CheckpointCapability,
  CircuitBreakerCapability
} from '@vytches-ddd/projections';
import { IDomainEvent, IEventBus } from '@vytches-ddd/events';
import { 
  UserData,
  ProjectionCheckpoint,
  ServiceResponse 
} from '../types';

// Step 1: Define Your Projection Class
export class CustomerProjection extends ProjectionBase<any> {
  constructor() {
    super('CustomerProjection', 'v1.0');
    
    // Initialize projection state
    this.setState({
      customers: new Map<string, any>(),
      totalCustomers: 0,
      activeCustomers: 0,
      customersBySegment: new Map<string, number>(),
      lastUpdated: new Date()
    });
  }

  // Step 2: Implement Event Handlers
  @EventHandler('CustomerRegistered')
  async onCustomerRegistered(event: IDomainEvent): Promise<void> {
    const customerData = event.payload;
    const state = this.getState();
    
    const customer = {
      id: customerData.customerId,
      name: customerData.name,
      email: customerData.email,
      registrationDate: new Date(event.timestamp),
      segment: this.calculateCustomerSegment(customerData),
      status: 'active',
      totalOrders: 0,
      totalSpent: 0
    };

    state.customers.set(customer.id, customer);
    state.totalCustomers = state.customers.size;
    state.activeCustomers += 1;
    
    // Update segment statistics
    const segment = customer.segment;
    state.customersBySegment.set(segment, (state.customersBySegment.get(segment) || 0) + 1);
    
    state.lastUpdated = new Date();
    this.setState(state);
    
    console.log(`Customer registered: ${customer.name} (${customer.id})`);
  }

  @EventHandler('CustomerOrderPlaced')
  async onCustomerOrderPlaced(event: IDomainEvent): Promise<void> {
    const orderData = event.payload;
    const state = this.getState();
    const customer = state.customers.get(orderData.customerId);
    
    if (customer) {
      customer.totalOrders += 1;
      customer.totalSpent += orderData.orderTotal;
      customer.lastOrderDate = new Date(event.timestamp);
      
      // Recalculate segment based on spending
      const newSegment = this.calculateCustomerSegment(customer);
      if (newSegment !== customer.segment) {
        // Update segment counts
        const oldSegment = customer.segment;
        state.customersBySegment.set(oldSegment, Math.max(0, (state.customersBySegment.get(oldSegment) || 0) - 1));
        state.customersBySegment.set(newSegment, (state.customersBySegment.get(newSegment) || 0) + 1);
        customer.segment = newSegment;
      }
      
      state.customers.set(customer.id, customer);
      state.lastUpdated = new Date();
      this.setState(state);
      
      console.log(`Customer order updated: ${customer.name} - Order #${customer.totalOrders}`);
    }
  }

  // Step 3: Implement Query Methods
  getCustomerById(customerId: string): any {
    return this.getState().customers.get(customerId);
  }

  getCustomersBySegment(segment: string): any[] {
    return Array.from(this.getState().customers.values())
      .filter(customer => customer.segment === segment);
  }

  getTopCustomers(limit: number = 10): any[] {
    return Array.from(this.getState().customers.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  }

  // Step 4: Business Logic Helpers
  private calculateCustomerSegment(customerData: any): string {
    if (customerData.totalSpent > 10000) return 'VIP';
    if (customerData.totalSpent > 5000) return 'Premium';
    if (customerData.totalSpent > 1000) return 'Regular';
    return 'New';
  }

  // Step 5: Health and Validation
  validateProjectionState(): { isValid: boolean; errors: string[] } {
    const state = this.getState();
    const errors: string[] = [];
    
    // Validate customer count
    if (state.totalCustomers !== state.customers.size) {
      errors.push('Total customer count mismatch');
    }
    
    // Validate active customers
    const actualActive = Array.from(state.customers.values())
      .filter(c => c.status === 'active').length;
    if (state.activeCustomers !== actualActive) {
      errors.push('Active customer count mismatch');
    }
    
    return { isValid: errors.length === 0, errors };
  }
}

// Step 6: Setup with Capabilities (Production-Ready)
export class ProductionCustomerProjection extends CustomerProjection {
  private checkpointCapability: CheckpointCapability;
  private circuitBreakerCapability: CircuitBreakerCapability;

  constructor() {
    super();
    this.setupCapabilities();
  }

  private setupCapabilities(): void {
    // Checkpoint for progress tracking
    this.checkpointCapability = new CheckpointCapability({
      projectionName: this.projectionName,
      checkpointInterval: 100,
      timeInterval: 60000, // 1 minute
      storage: 'database' // Use persistent storage in production
    });

    // Circuit breaker for resilience
    this.circuitBreakerCapability = new CircuitBreakerCapability({
      projectionName: this.projectionName,
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringWindow: 60000
    });
  }

  async handle(event: IDomainEvent): Promise<void> {
    // Check circuit breaker
    if (this.circuitBreakerCapability.isOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      await super.handle(event);
      this.circuitBreakerCapability.recordSuccess();
      
      // Update checkpoint
      await this.checkpointCapability.updatePosition(
        event.aggregateId, 
        parseInt(event.eventId) || Date.now()
      );
      
    } catch (error) {
      this.circuitBreakerCapability.recordFailure();
      throw error;
    }
  }

  async loadFromCheckpoint(): Promise<boolean> {
    const checkpoint = await this.checkpointCapability.getLatestCheckpoint();
    if (checkpoint) {
      console.log(`Loading from checkpoint: ${checkpoint.position}`);
      // In production, restore state from checkpoint
      return true;
    }
    return false;
  }
}

// Step 7: Integration with Application
export class ProjectionSetup {
  private engine: ProjectionEngine;
  private eventBus: IEventBus;

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
    this.engine = new ProjectionEngine();
  }

  async initialize(): Promise<ServiceResponse<void>> {
    try {
      console.log('Setting up projection system...');

      // Register projections
      const customerProjection = new ProductionCustomerProjection();
      await this.engine.registerProjection(customerProjection);

      // Try to load from checkpoints
      await customerProjection.loadFromCheckpoint();

      // Connect to event bus
      this.eventBus.subscribe('*', async (event: IDomainEvent) => {
        try {
          await this.engine.processEvent(event);
        } catch (error) {
          console.error('Error processing event in projections:', error);
        }
      });

      // Start the engine
      await this.engine.start();

      return {
        success: true,
        metadata: {
          timestamp: new Date(),
          requestId: 'setup-' + Date.now(),
          duration: 0
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROJECTION_SETUP_FAILED',
          message: 'Failed to setup projection system',
          details: { error: (error as Error).message }
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'setup-' + Date.now(),
          duration: 0
        }
      };
    }
  }

  getProjection<T>(name: string): T | undefined {
    return this.engine.getProjection<T>(name) as T;
  }

  async shutdown(): Promise<void> {
    await this.engine.stop();
    console.log('Projection system shutdown complete');
  }
}
```

## Implementation Steps

### **Step 1: Design Your Projection**

```typescript
// Define what data your projection will maintain
interface CustomerSummary {
  customers: Map<string, CustomerData>;
  totalCustomers: number;
  segmentDistribution: Map<string, number>;
  lastUpdated: Date;
}

// Plan your event handlers
const eventTypes = [
  'CustomerRegistered',
  'CustomerOrderPlaced', 
  'CustomerDeactivated'
];
```

### **Step 2: Implement Event Handlers**

```typescript
@EventHandler('CustomerRegistered')
async onCustomerRegistered(event: IDomainEvent): Promise<void> {
  // 1. Extract data from event
  const customerData = event.payload;
  
  // 2. Transform to projection format
  const customer = this.transformCustomerData(customerData, event);
  
  // 3. Update projection state
  const state = this.getState();
  state.customers.set(customer.id, customer);
  
  // 4. Update aggregates
  this.updateAggregateStatistics(state, customer);
  
  // 5. Save state
  this.setState(state);
}
```

### **Step 3: Add Query Methods**

```typescript
// Specific queries for business needs
getHighValueCustomers(): CustomerData[] {
  return Array.from(this.getState().customers.values())
    .filter(c => c.totalSpent > 5000);
}

getCustomerGrowthMetrics(): GrowthMetrics {
  const customers = Array.from(this.getState().customers.values());
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  return {
    newCustomersLast30Days: customers.filter(c => 
      c.registrationDate >= thirtyDaysAgo
    ).length,
    totalCustomers: customers.length,
    growthRate: this.calculateGrowthRate(customers)
  };
}
```

### **Step 4: Add Resilience Features**

```typescript
// Error handling and recovery
async handle(event: IDomainEvent): Promise<void> {
  try {
    await this.processEvent(event);
  } catch (error) {
    // Log error with context
    console.error(`Projection ${this.projectionName} failed to process event ${event.eventId}:`, error);
    
    // Implement retry logic
    await this.retryEventProcessing(event, error);
  }
}

private async retryEventProcessing(event: IDomainEvent, originalError: Error): Promise<void> {
  const maxRetries = 3;
  let attempt = 1;
  
  while (attempt <= maxRetries) {
    try {
      await this.processEvent(event);
      console.log(`Event ${event.eventId} processed successfully on retry ${attempt}`);
      return;
    } catch (retryError) {
      if (attempt === maxRetries) {
        // Send to dead letter queue
        await this.sendToDeadLetterQueue(event, retryError);
        throw retryError;
      }
      
      // Exponential backoff
      await this.sleep(Math.pow(2, attempt) * 1000);
      attempt++;
    }
  }
}
```

## Configuration Patterns

### **Environment-Specific Configuration**

```typescript
interface ProjectionConfig {
  environment: 'development' | 'staging' | 'production';
  checkpointInterval: number;
  batchSize: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
  };
  monitoring: {
    metricsInterval: number;
    healthCheckInterval: number;
  };
}

const configurations: Record<string, ProjectionConfig> = {
  development: {
    environment: 'development',
    checkpointInterval: 10, // Frequent checkpoints for testing
    batchSize: 1,
    retryPolicy: { maxRetries: 1, backoffMultiplier: 1 },
    monitoring: { metricsInterval: 5000, healthCheckInterval: 10000 }
  },
  
  production: {
    environment: 'production',
    checkpointInterval: 1000, // Less frequent for performance
    batchSize: 100,
    retryPolicy: { maxRetries: 5, backoffMultiplier: 2 },
    monitoring: { metricsInterval: 30000, healthCheckInterval: 60000 }
  }
};
```

### **Dependency Injection Setup**

```typescript
// Container registration
container.register('CustomerProjection', ProductionCustomerProjection);
container.register('ProjectionEngine', ProjectionEngine);

// Factory pattern
export class ProjectionFactory {
  static createCustomerProjection(config: ProjectionConfig): ProductionCustomerProjection {
    const projection = new ProductionCustomerProjection();
    projection.configure(config);
    return projection;
  }
}
```

## Testing Strategies

### **Unit Testing Projections**

```typescript
describe('CustomerProjection', () => {
  let projection: CustomerProjection;
  
  beforeEach(() => {
    projection = new CustomerProjection();
  });

  it('should handle customer registration', async () => {
    const event: IDomainEvent = {
      eventId: '123',
      eventType: 'CustomerRegistered',
      aggregateId: 'customer-1',
      payload: {
        customerId: 'customer-1',
        name: 'John Doe',
        email: 'john@example.com'
      },
      timestamp: new Date(),
      version: 1
    };

    await projection.handle(event);
    
    const customer = projection.getCustomerById('customer-1');
    expect(customer).toBeDefined();
    expect(customer.name).toBe('John Doe');
    expect(customer.segment).toBe('New');
  });

  it('should validate projection state', () => {
    // Add test data
    projection.setState({
      customers: new Map([['1', { id: '1', status: 'active' }]]),
      totalCustomers: 1,
      activeCustomers: 1,
      customersBySegment: new Map(),
      lastUpdated: new Date()
    });

    const validation = projection.validateProjectionState();
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});
```

## Performance Optimization

### **Memory Management**

```typescript
// Implement state cleanup for long-running projections
private cleanupOldData(): void {
  const state = this.getState();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days
  
  for (const [id, customer] of state.customers) {
    if (customer.lastActivity < cutoffDate && customer.status === 'inactive') {
      state.customers.delete(id);
    }
  }
  
  this.setState(state);
}

// Periodic cleanup
setInterval(() => this.cleanupOldData(), 24 * 60 * 60 * 1000); // Daily
```

### **Query Optimization**

```typescript
// Use indexes for frequent queries
private createIndexes(): void {
  this.segmentIndex = new Map<string, Set<string>>();
  this.statusIndex = new Map<string, Set<string>>();
  
  // Rebuild indexes when state changes
  for (const [id, customer] of this.getState().customers) {
    this.addToIndex(this.segmentIndex, customer.segment, id);
    this.addToIndex(this.statusIndex, customer.status, id);
  }
}

getCustomersBySegmentOptimized(segment: string): any[] {
  const customerIds = this.segmentIndex.get(segment) || new Set();
  return Array.from(customerIds).map(id => 
    this.getState().customers.get(id)
  ).filter(Boolean);
}
```

## Monitoring and Observability

### **Metrics Collection**

```typescript
interface ProjectionMetrics {
  eventsProcessed: number;
  processingErrors: number;
  averageProcessingTime: number;
  lastProcessedEvent: Date;
  projectionLag: number;
}

class ProjectionMonitor {
  private metrics: ProjectionMetrics = {
    eventsProcessed: 0,
    processingErrors: 0,
    averageProcessingTime: 0,
    lastProcessedEvent: new Date(),
    projectionLag: 0
  };

  recordEventProcessed(processingTime: number): void {
    this.metrics.eventsProcessed++;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * 0.9) + (processingTime * 0.1);
    this.metrics.lastProcessedEvent = new Date();
  }

  recordError(): void {
    this.metrics.processingErrors++;
  }

  getHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const timeSinceLastEvent = Date.now() - this.metrics.lastProcessedEvent.getTime();
    const errorRate = this.metrics.processingErrors / Math.max(this.metrics.eventsProcessed, 1);
    
    if (timeSinceLastEvent > 5 * 60 * 1000 || errorRate > 0.1) {
      return 'critical';
    }
    
    if (timeSinceLastEvent > 2 * 60 * 1000 || errorRate > 0.05) {
      return 'warning';
    }
    
    return 'healthy';
  }
}
```

## Common Patterns

### **Event Versioning**

```typescript
@EventHandler('CustomerRegistered')
async onCustomerRegistered(event: IDomainEvent): Promise<void> {
  // Handle different event versions
  switch (event.version) {
    case 1:
      return this.handleCustomerRegisteredV1(event);
    case 2:
      return this.handleCustomerRegisteredV2(event);
    default:
      console.warn(`Unsupported event version: ${event.version}`);
  }
}

private handleCustomerRegisteredV1(event: IDomainEvent): Promise<void> {
  // Legacy format handling
}

private handleCustomerRegisteredV2(event: IDomainEvent): Promise<void> {
  // New format with additional fields
}
```

### **State Migration**

```typescript
async migrateProjectionState(fromVersion: string, toVersion: string): Promise<void> {
  console.log(`Migrating projection from ${fromVersion} to ${toVersion}`);
  
  switch (`${fromVersion}->${toVersion}`) {
    case 'v1.0->v1.1':
      await this.migrateV10ToV11();
      break;
    default:
      throw new Error(`Unsupported migration path: ${fromVersion} -> ${toVersion}`);
  }
}

private async migrateV10ToV11(): Promise<void> {
  const state = this.getState();
  
  // Add new fields to existing customers
  for (const [id, customer] of state.customers) {
    customer.loyaltyPoints = customer.loyaltyPoints || 0;
    customer.preferredCategories = customer.preferredCategories || [];
  }
  
  this.setState(state);
}
```

## Best Practices Summary

1. **Design for Idempotency**: Handle duplicate events gracefully
2. **Implement Proper Error Handling**: Use circuit breakers and retry logic
3. **Add Comprehensive Monitoring**: Track performance and health metrics
4. **Plan for State Migration**: Version your projections and plan upgrades
5. **Optimize for Query Patterns**: Design state structure for read efficiency
6. **Test Thoroughly**: Unit test event handlers and state transitions
7. **Monitor Resource Usage**: Implement cleanup and optimization strategies
8. **Document Business Rules**: Clear documentation of projection logic

## Related Examples

- [Simple Event Projection](./example-1.md)
- [Projection with Capabilities](./example-2.md)
- [Projection Engine Setup](./example-3.md)
- [Basic Use Cases](./use-case.md)