# Projection Engine Setup

**Version**: 1.0.0 **Package**: @vytches-ddd/projections **Complexity**: basic
**Domain**: Event Sourcing **Patterns**: Projection engine, orchestration,
multi-projection management **Dependencies**: @vytches-ddd/projections,
@vytches-ddd/events

## Description

Projection engine implementation for managing multiple projections in a
coordinated manner. This example demonstrates how to set up a projection engine
that handles multiple projections, manages their lifecycle, coordinates event
distribution, and provides centralized monitoring and control.

## Business Context

Enterprise applications require coordinated projection management:

- Multiple read models serving different business needs
- Coordinated startup and shutdown sequences
- Centralized monitoring and health checking
- Event distribution to relevant projections
- Resource management and performance optimization
- Deployment and maintenance coordination

A projection engine provides the infrastructure for managing complex projection
ecosystems at scale.

## Code Example

```typescript
// projection-engine-setup.ts
import {
  ProjectionBase,
  ProjectionEngine,
  ProjectionRegistry,
  ProjectionProcessor,
} from '@vytches-ddd/projections';
import { IDomainEvent, IEventBus } from '@vytches-ddd/events';
import {
  UserData,
  OrderData,
  ProductData,
  ProjectionInstance,
  ProjectionEngine as ProjectionEngineType,
  ProjectionStatistics,
  ServiceResponse,
} from '../types';

// User Profile Projection
class UserProfileProjection extends ProjectionBase<any> {
  constructor() {
    super('UserProfileProjection', 'v1.0');
    this.setState({
      users: new Map<string, UserData>(),
      totalUsers: 0,
      lastUpdated: new Date(),
    });
  }

  @EventHandler('UserRegistered')
  async onUserRegistered(event: IDomainEvent): Promise<void> {
    const userData = event.payload;
    const state = this.getState();

    const user: UserData = {
      id: userData.userId,
      email: userData.email,
      name: userData.name,
      role: userData.role || 'user',
      createdAt: new Date(event.timestamp),
      preferences: userData.preferences || {},
    };

    state.users.set(user.id, user);
    state.totalUsers = state.users.size;
    state.lastUpdated = new Date();

    this.setState(state);
    console.log(`User profile created: ${user.name} (${user.id})`);
  }

  @EventHandler('UserProfileUpdated')
  async onUserProfileUpdated(event: IDomainEvent): Promise<void> {
    const updateData = event.payload;
    const state = this.getState();
    const existingUser = state.users.get(updateData.userId);

    if (existingUser) {
      const updatedUser: UserData = {
        ...existingUser,
        name: updateData.name || existingUser.name,
        email: updateData.email || existingUser.email,
        preferences: {
          ...existingUser.preferences,
          ...(updateData.preferences || {}),
        },
      };

      state.users.set(updatedUser.id, updatedUser);
      state.lastUpdated = new Date();
      this.setState(state);

      console.log(`User profile updated: ${updatedUser.name}`);
    }
  }

  getUserById(userId: string): UserData | undefined {
    return this.getState().users.get(userId);
  }

  getAllUsers(): UserData[] {
    return Array.from(this.getState().users.values());
  }
}

// Order Summary Projection
class OrderSummaryProjection extends ProjectionBase<any> {
  constructor() {
    super('OrderSummaryProjection', 'v1.0');
    this.setState({
      orders: new Map<string, OrderData>(),
      dailySummaries: new Map<string, any>(),
      totalRevenue: 0,
      totalOrders: 0,
      lastUpdated: new Date(),
    });
  }

  @EventHandler('OrderPlaced')
  async onOrderPlaced(event: IDomainEvent): Promise<void> {
    const orderData = event.payload;
    const state = this.getState();

    const order: OrderData = {
      id: orderData.orderId,
      customerId: orderData.customerId,
      items: orderData.items || [],
      total: orderData.total || 0,
      status: 'pending',
      createdAt: new Date(event.timestamp),
      shippingAddress: orderData.shippingAddress,
    };

    state.orders.set(order.id, order);

    // Update daily summary
    const orderDate = order.createdAt.toISOString().split('T')[0];
    const dailySummary = state.dailySummaries.get(orderDate) || {
      date: orderDate,
      orderCount: 0,
      totalRevenue: 0,
      orders: [],
    };

    dailySummary.orderCount += 1;
    dailySummary.totalRevenue += order.total;
    dailySummary.orders.push(order.id);
    state.dailySummaries.set(orderDate, dailySummary);

    // Update totals
    state.totalOrders = state.orders.size;
    state.totalRevenue = Array.from(state.orders.values()).reduce(
      (sum, o) => sum + o.total,
      0
    );
    state.lastUpdated = new Date();

    this.setState(state);
    console.log(`Order placed: ${order.id} - $${order.total}`);
  }

  @EventHandler('OrderConfirmed')
  @EventHandler('OrderShipped')
  @EventHandler('OrderDelivered')
  @EventHandler('OrderCancelled')
  async onOrderStatusChanged(event: IDomainEvent): Promise<void> {
    const orderData = event.payload;
    const state = this.getState();
    const order = state.orders.get(orderData.orderId);

    if (order) {
      const statusMap: Record<string, string> = {
        OrderConfirmed: 'confirmed',
        OrderShipped: 'shipped',
        OrderDelivered: 'delivered',
        OrderCancelled: 'cancelled',
      };

      const updatedOrder: OrderData = {
        ...order,
        status: statusMap[event.eventType] as any,
      };

      state.orders.set(updatedOrder.id, updatedOrder);
      state.lastUpdated = new Date();
      this.setState(state);

      console.log(
        `Order ${event.eventType.replace('Order', '').toLowerCase()}: ${updatedOrder.id}`
      );
    }
  }

  getOrderById(orderId: string): OrderData | undefined {
    return this.getState().orders.get(orderId);
  }

  getDailySummary(date: string): any {
    return this.getState().dailySummaries.get(date);
  }

  getTotalRevenue(): number {
    return this.getState().totalRevenue;
  }
}

// Product Catalog Projection
class ProductCatalogProjection extends ProjectionBase<any> {
  constructor() {
    super('ProductCatalogProjection', 'v1.0');
    this.setState({
      products: new Map<string, ProductData>(),
      categories: new Map<string, any>(),
      totalProducts: 0,
      lastUpdated: new Date(),
    });
  }

  @EventHandler('ProductCreated')
  async onProductCreated(event: IDomainEvent): Promise<void> {
    const productData = event.payload;
    const state = this.getState();

    const product: ProductData = {
      id: productData.productId,
      name: productData.name,
      description: productData.description || '',
      price: productData.price || 0,
      category: productData.category || 'uncategorized',
      inStock: productData.inStock !== false,
      metadata: productData.metadata || {},
    };

    state.products.set(product.id, product);

    // Update category counts
    const categoryStats = state.categories.get(product.category) || {
      name: product.category,
      productCount: 0,
      averagePrice: 0,
      products: [],
    };

    categoryStats.productCount += 1;
    categoryStats.products.push(product.id);
    categoryStats.averagePrice =
      Array.from(state.products.values())
        .filter(p => p.category === product.category)
        .reduce((sum, p) => sum + p.price, 0) / categoryStats.productCount;

    state.categories.set(product.category, categoryStats);
    state.totalProducts = state.products.size;
    state.lastUpdated = new Date();

    this.setState(state);
    console.log(`Product created: ${product.name} (${product.id})`);
  }

  @EventHandler('ProductUpdated')
  async onProductUpdated(event: IDomainEvent): Promise<void> {
    const updateData = event.payload;
    const state = this.getState();
    const existingProduct = state.products.get(updateData.productId);

    if (existingProduct) {
      const updatedProduct: ProductData = {
        ...existingProduct,
        name: updateData.name || existingProduct.name,
        description: updateData.description || existingProduct.description,
        price:
          updateData.price !== undefined
            ? updateData.price
            : existingProduct.price,
        inStock:
          updateData.inStock !== undefined
            ? updateData.inStock
            : existingProduct.inStock,
        metadata: {
          ...existingProduct.metadata,
          ...(updateData.metadata || {}),
        },
      };

      state.products.set(updatedProduct.id, updatedProduct);
      state.lastUpdated = new Date();
      this.setState(state);

      console.log(`Product updated: ${updatedProduct.name}`);
    }
  }

  getProductById(productId: string): ProductData | undefined {
    return this.getState().products.get(productId);
  }

  getProductsByCategory(category: string): ProductData[] {
    return Array.from(this.getState().products.values()).filter(
      product => product.category === category
    );
  }

  getCategoryStats(category: string): any {
    return this.getState().categories.get(category);
  }
}

// ✅ FOCUS: Projection Engine Implementation
export class BasicProjectionEngine implements ProjectionEngineType {
  name: string = 'BasicProjectionEngine';
  projections: ProjectionInstance[] = [];
  capabilities: any[] = [];
  status: 'running' | 'stopped' | 'rebuilding' | 'error' = 'stopped';
  statistics: ProjectionStatistics;

  private projectionInstances: Map<string, ProjectionBase<any>> = new Map();
  private eventProcessor: ProjectionProcessor;
  private healthCheckInterval?: NodeJS.Timeout;
  private eventQueue: IDomainEvent[] = [];
  private isProcessing = false;
  private startTime?: Date;

  constructor() {
    this.statistics = {
      totalEventsProcessed: 0,
      averageProcessingTime: 0,
      errorsPerHour: 0,
      throughputPerSecond: 0,
      uptime: 0,
    };

    this.eventProcessor = new ProjectionProcessor();
    this.setupEventProcessor();
  }

  private setupEventProcessor(): void {
    this.eventProcessor.on(
      'eventProcessed',
      (event: IDomainEvent, projectionName: string, duration: number) => {
        this.statistics.totalEventsProcessed++;
        this.updateAverageProcessingTime(duration);
        this.updateProjectionStatistics(projectionName, true);
      }
    );

    this.eventProcessor.on(
      'eventProcessingFailed',
      (event: IDomainEvent, projectionName: string, error: Error) => {
        this.statistics.errorsPerHour++;
        this.updateProjectionStatistics(projectionName, false);
        console.error(`Event processing failed in ${projectionName}:`, error);
      }
    );
  }

  async initialize(): Promise<ServiceResponse<void>> {
    try {
      console.log('Initializing projection engine...');

      // Register built-in projections
      await this.registerProjection(new UserProfileProjection());
      await this.registerProjection(new OrderSummaryProjection());
      await this.registerProjection(new ProductCatalogProjection());

      this.status = 'stopped';

      return {
        success: true,
        metadata: {
          timestamp: new Date(),
          requestId: 'init-' + Date.now(),
          duration: 0,
        },
      };
    } catch (error) {
      this.status = 'error';
      return {
        success: false,
        error: {
          code: 'ENGINE_INITIALIZATION_FAILED',
          message: 'Failed to initialize projection engine',
          details: { error: (error as Error).message },
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'init-' + Date.now(),
          duration: 0,
        },
      };
    }
  }

  async registerProjection(projection: ProjectionBase<any>): Promise<void> {
    const projectionName = projection.projectionName;

    if (this.projectionInstances.has(projectionName)) {
      throw new Error(`Projection ${projectionName} is already registered`);
    }

    this.projectionInstances.set(projectionName, projection);

    const projectionInstance: ProjectionInstance = {
      name: projectionName,
      status: 'inactive',
      position: 0,
      lastProcessed: new Date(),
      errorCount: 0,
      processingRate: 0,
    };

    this.projections.push(projectionInstance);

    console.log(`Registered projection: ${projectionName}`);
  }

  async start(): Promise<ServiceResponse<void>> {
    try {
      if (this.status === 'running') {
        return {
          success: false,
          error: {
            code: 'ENGINE_ALREADY_RUNNING',
            message: 'Projection engine is already running',
          },
          metadata: {
            timestamp: new Date(),
            requestId: 'start-' + Date.now(),
            duration: 0,
          },
        };
      }

      console.log('Starting projection engine...');

      // Start all projections
      for (const projectionInstance of this.projections) {
        projectionInstance.status = 'active';
        projectionInstance.lastProcessed = new Date();
      }

      this.status = 'running';
      this.startTime = new Date();

      // Start health checks
      this.startHealthChecks();

      // Start event processing
      this.startEventProcessing();

      console.log(
        `Projection engine started with ${this.projections.length} projections`
      );

      return {
        success: true,
        data: undefined,
        metadata: {
          timestamp: new Date(),
          requestId: 'start-' + Date.now(),
          duration: 0,
        },
      };
    } catch (error) {
      this.status = 'error';
      return {
        success: false,
        error: {
          code: 'ENGINE_START_FAILED',
          message: 'Failed to start projection engine',
          details: { error: (error as Error).message },
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'start-' + Date.now(),
          duration: 0,
        },
      };
    }
  }

  async processEvent(event: IDomainEvent): Promise<void> {
    if (this.status !== 'running') {
      throw new Error('Projection engine is not running');
    }

    // Add to event queue
    this.eventQueue.push(event);

    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processEventQueue();
    }
  }

  private async processEventQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processSingleEvent(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processSingleEvent(event: IDomainEvent): Promise<void> {
    const startTime = performance.now();

    // Process event through all relevant projections
    const promises: Promise<void>[] = [];

    for (const [projectionName, projection] of this.projectionInstances) {
      try {
        if (projection.canHandle(event.eventType)) {
          promises.push(this.processEventInProjection(event, projection));
        }
      } catch (error) {
        console.error(
          `Error checking if ${projectionName} can handle ${event.eventType}:`,
          error
        );
        this.updateProjectionStatistics(projectionName, false);
      }
    }

    // Process all projections in parallel
    await Promise.allSettled(promises);

    // Update statistics
    const processingTime = performance.now() - startTime;
    this.updateAverageProcessingTime(processingTime);
    this.updateThroughput();
  }

  private async processEventInProjection(
    event: IDomainEvent,
    projection: ProjectionBase<any>
  ): Promise<void> {
    const projectionName = projection.projectionName;
    const startTime = performance.now();

    try {
      await projection.handle(event);

      const processingTime = performance.now() - startTime;
      this.eventProcessor.emit(
        'eventProcessed',
        event,
        projectionName,
        processingTime
      );

      // Update projection instance
      const projectionInstance = this.projections.find(
        p => p.name === projectionName
      );
      if (projectionInstance) {
        projectionInstance.lastProcessed = new Date();
        projectionInstance.position++;
        projectionInstance.processingRate =
          this.calculateProcessingRate(projectionName);
      }
    } catch (error) {
      this.eventProcessor.emit(
        'eventProcessingFailed',
        event,
        projectionName,
        error
      );

      // Update projection instance error count
      const projectionInstance = this.projections.find(
        p => p.name === projectionName
      );
      if (projectionInstance) {
        projectionInstance.errorCount++;
        projectionInstance.status = 'error';
      }

      throw error;
    }
  }

  async stop(): Promise<ServiceResponse<void>> {
    try {
      console.log('Stopping projection engine...');

      // Wait for current processing to complete
      while (this.isProcessing) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Stop health checks
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Mark all projections as inactive
      for (const projection of this.projections) {
        projection.status = 'inactive';
      }

      this.status = 'stopped';

      console.log('Projection engine stopped');

      return {
        success: true,
        metadata: {
          timestamp: new Date(),
          requestId: 'stop-' + Date.now(),
          duration: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ENGINE_STOP_FAILED',
          message: 'Failed to stop projection engine',
          details: { error: (error as Error).message },
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'stop-' + Date.now(),
          duration: 0,
        },
      };
    }
  }

  // Query methods
  getProjection<T>(projectionName: string): ProjectionBase<T> | undefined {
    return this.projectionInstances.get(projectionName) as ProjectionBase<T>;
  }

  getProjectionStatus(): ProjectionInstance[] {
    return [...this.projections];
  }

  getEngineStatistics(): ProjectionStatistics {
    if (this.startTime) {
      this.statistics.uptime = Date.now() - this.startTime.getTime();
    }
    return { ...this.statistics };
  }

  // Health monitoring
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  private async performHealthCheck(): Promise<void> {
    for (const projectionInstance of this.projections) {
      // Check if projection is responsive
      const timeSinceLastProcessed =
        Date.now() - projectionInstance.lastProcessed.getTime();

      if (
        timeSinceLastProcessed > 5 * 60 * 1000 &&
        this.eventQueue.length > 0
      ) {
        // 5 minutes
        console.warn(
          `Projection ${projectionInstance.name} may be stuck - no processing in 5 minutes`
        );
        projectionInstance.status = 'error';
      }

      // Check error rate
      if (projectionInstance.errorCount > 10) {
        console.warn(
          `Projection ${projectionInstance.name} has high error count: ${projectionInstance.errorCount}`
        );
      }
    }
  }

  // Statistics helpers
  private updateAverageProcessingTime(newTime: number): void {
    this.statistics.averageProcessingTime =
      this.statistics.averageProcessingTime * 0.9 + newTime * 0.1;
  }

  private updateThroughput(): void {
    if (this.startTime) {
      const uptimeSeconds = (Date.now() - this.startTime.getTime()) / 1000;
      this.statistics.throughputPerSecond =
        this.statistics.totalEventsProcessed / Math.max(uptimeSeconds, 1);
    }
  }

  private calculateProcessingRate(projectionName: string): number {
    const projection = this.projections.find(p => p.name === projectionName);
    if (!projection || !this.startTime) {
      return 0;
    }

    const uptimeSeconds = (Date.now() - this.startTime.getTime()) / 1000;
    return projection.position / Math.max(uptimeSeconds, 1);
  }

  private updateProjectionStatistics(
    projectionName: string,
    success: boolean
  ): void {
    // Implementation would update projection-specific statistics
  }
}

// Projection Engine Factory
export class ProjectionEngineFactory {
  static async createBasicEngine(): Promise<BasicProjectionEngine> {
    const engine = new BasicProjectionEngine();
    const result = await engine.initialize();

    if (!result.success) {
      throw new Error(
        `Failed to create projection engine: ${result.error?.message}`
      );
    }

    return engine;
  }

  static async createEngineWithCustomProjections(
    projections: ProjectionBase<any>[]
  ): Promise<BasicProjectionEngine> {
    const engine = new BasicProjectionEngine();

    // Register custom projections
    for (const projection of projections) {
      await engine.registerProjection(projection);
    }

    const result = await engine.initialize();

    if (!result.success) {
      throw new Error(
        `Failed to create projection engine: ${result.error?.message}`
      );
    }

    return engine;
  }
}
```

## Key Features

- **Multi-Projection Management**: Coordinate multiple projections in a single
  engine
- **Event Distribution**: Automatically route events to relevant projections
- **Lifecycle Management**: Coordinated startup, shutdown, and restart
  procedures
- **Health Monitoring**: Continuous health checks and error tracking
- **Performance Statistics**: Comprehensive metrics and throughput monitoring
- **Query Interface**: Access projections and their data through the engine

## Usage Examples

```typescript
// Create and start projection engine
const engine = await ProjectionEngineFactory.createBasicEngine();
const startResult = await engine.start();

if (startResult.success) {
  console.log('Projection engine started successfully');

  // Process various events
  await engine.processEvent({
    eventId: '1001',
    eventType: 'UserRegistered',
    aggregateId: 'user-1',
    payload: {
      userId: 'user-1',
      email: 'john@example.com',
      name: 'John Doe',
      role: 'user',
    },
    timestamp: new Date(),
    version: 1,
  });

  await engine.processEvent({
    eventId: '1002',
    eventType: 'OrderPlaced',
    aggregateId: 'order-1',
    payload: {
      orderId: 'order-1',
      customerId: 'user-1',
      items: [{ productId: 'product-1', quantity: 2, price: 25, total: 50 }],
      total: 50,
      shippingAddress: {
        street: '123 Main St',
        city: 'City',
        state: 'State',
        zipCode: '12345',
        country: 'US',
      },
    },
    timestamp: new Date(),
    version: 1,
  });

  await engine.processEvent({
    eventId: '1003',
    eventType: 'ProductCreated',
    aggregateId: 'product-1',
    payload: {
      productId: 'product-1',
      name: 'Widget',
      description: 'A useful widget',
      price: 25,
      category: 'widgets',
      inStock: true,
    },
    timestamp: new Date(),
    version: 1,
  });

  // Query projections through the engine
  const userProjection = engine.getProjection<any>('UserProfileProjection');
  if (userProjection) {
    const user = userProjection.getUserById('user-1');
    console.log('User profile:', user);
  }

  const orderProjection = engine.getProjection<any>('OrderSummaryProjection');
  if (orderProjection) {
    const order = orderProjection.getOrderById('order-1');
    console.log('Order details:', order);

    const todaysSummary = orderProjection.getDailySummary(
      new Date().toISOString().split('T')[0]
    );
    console.log("Today's sales summary:", todaysSummary);
  }

  const productProjection = engine.getProjection<any>(
    'ProductCatalogProjection'
  );
  if (productProjection) {
    const product = productProjection.getProductById('product-1');
    console.log('Product details:', product);

    const widgetProducts = productProjection.getProductsByCategory('widgets');
    console.log('Widget products:', widgetProducts.length);
  }

  // Check engine status and statistics
  const projectionStatus = engine.getProjectionStatus();
  console.log('Projection status:', projectionStatus);

  const engineStats = engine.getEngineStatistics();
  console.log('Engine statistics:', engineStats);

  // Stop the engine gracefully
  await engine.stop();
  console.log('Projection engine stopped');
}
```

## Engine Management Benefits

### **Coordinated Lifecycle**

- Simultaneous startup and shutdown of all projections
- Dependency management between projections
- Graceful handling of failures

### **Event Distribution**

- Automatic routing to interested projections
- Parallel processing for improved performance
- Error isolation prevents cascade failures

### **Centralized Monitoring**

- Single point for health checking all projections
- Aggregated statistics and metrics
- Performance tracking and optimization

### **Operational Management**

- Easy deployment and configuration
- Centralized logging and debugging
- Simplified maintenance procedures

## Best Practices

- **Projection Independence**: Design projections to be independent of each
  other
- **Error Isolation**: Ensure one projection's failure doesn't affect others
- **Resource Management**: Monitor memory and CPU usage across all projections
- **Deployment Strategy**: Plan for rolling deployments and blue-green
  strategies
- **Monitoring Setup**: Implement comprehensive alerting and dashboards

## Common Pitfalls

- **Resource Contention**: Multiple projections competing for limited resources
- **Event Ordering**: Ensure consistent event ordering across projections
- **State Synchronization**: Avoid dependencies between projection states
- **Memory Growth**: Monitor aggregate memory usage across all projections
- **Error Handling**: Implement proper error boundaries and recovery

## Related Examples

- [Simple Event Projection](./example-1.md)
- [Projection with Capabilities](./example-2.md)
- [Basic Implementation Guide](./implementation.md)
