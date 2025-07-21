# Context-Aware Event Processing

**Version**: 1.0.0  
**Package**: @vytches-ddd/events  
**Complexity**: beginner  
**Domain**: Multi-Tenant E-commerce  
**Patterns**: context-filtering, multi-tenancy, event-routing  
**Dependencies**: @vytches-ddd/events, @vytches-ddd/utils

## Description

Demonstrates context-aware event processing where events are filtered and routed based on tenant, user, bounded context, or other contextual information. This enables multi-tenant applications and sophisticated event routing scenarios.

## Business Context

In a multi-tenant e-commerce platform, different tenants may have different business rules, integrations, and notification preferences. Context-aware event processing allows the same event to be handled differently for different tenants while maintaining code reuse.

## Code Example

```typescript
// context-aware-events.ts
import { DomainEvent, EventContext } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { OrderCreatedEventData, UserRegisteredEventData } from '../types';

/**
 * @llm-summary Context-enhanced domain event with tenant and user information
 * @llm-domain Multi-Tenant Architecture
 * @llm-complexity Simple
 * 
 * @description
 * Domain event that includes rich context information for multi-tenant
 * scenarios, enabling context-based filtering and routing.
 * 
 * @example
 * ```typescript
 * const event = new OrderCreatedEventWithContext(data, {
 *   tenantId: 'tenant-enterprise',
 *   userId: 'user-123',
 *   boundedContext: 'order-management'
 * });
 * ```
 * 
 * @since 1.0.0
 * @public
 */
export class OrderCreatedEventWithContext extends DomainEvent<OrderCreatedEventData> {
  public readonly context: EventContext;

  constructor(data: OrderCreatedEventData, context: EventContext) {
    super('OrderCreated', data);
    this.context = context;
  }

  /**
   * @llm-summary Gets tenant ID from event context
   * @llm-domain Multi-Tenant Architecture
   * @llm-complexity Simple
   *
   * @description
   * Helper method to extract tenant information from event context
   * for tenant-specific processing.
   *
   * @returns Tenant ID if available in context
   *
   * @since 1.0.0
   * @public
   */
  getTenantId(): string | undefined {
    return this.context.tenantId;
  }

  /**
   * @llm-summary Gets bounded context from event context
   * @llm-domain Multi-Tenant Architecture
   * @llm-complexity Simple
   *
   * @description
   * Helper method to extract bounded context information for
   * context-based event routing and filtering.
   *
   * @returns Bounded context if available
   *
   * @since 1.0.0
   * @public
   */
  getBoundedContext(): string | undefined {
    return this.context.boundedContext;
  }
}

/**
 * @llm-summary User registration event with context for tenant-specific handling
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * User registration event that includes context for tenant-specific
 * welcome flows and onboarding processes.
 *
 * @since 1.0.0
 * @public
 */
export class UserRegisteredEventWithContext extends DomainEvent<UserRegisteredEventData> {
  public readonly context: EventContext;

  constructor(data: UserRegisteredEventData, context: EventContext) {
    super('UserRegistered', data);
    this.context = context;
  }
}
```

```typescript
// tenant-specific-handlers.ts
import { EventHandler } from '@vytches-ddd/events';
import { OrderCreatedEventWithContext, UserRegisteredEventWithContext } from '../types';

/**
 * @llm-summary Enterprise tenant-specific order processing handler
 * @llm-domain Enterprise Order Management
 * @llm-complexity Simple
 *
 * @description
 * Handles order events specifically for enterprise tenants with
 * enhanced processing, approval workflows, and integrations.
 *
 * @since 1.0.0
 * @public
 */
@EventHandler(OrderCreatedEventWithContext, {
  eventContext: 'order-management',
  contextFilter: (event) => event.getTenantId()?.startsWith('tenant-enterprise')
})
export class EnterpriseOrderHandler {
  /**
   * @llm-summary Processes orders for enterprise tenants with enhanced features
   * @llm-domain Enterprise Order Management
   * @llm-complexity Simple
   *
   * @description
   * Handles order creation for enterprise tenants with additional
   * approval workflows, enhanced notifications, and ERP integrations.
   *
   * @param event - Order created event with tenant context
   * @returns Promise that resolves when enterprise processing completes
   *
   * @example
   * ```typescript
   * // Only triggered for tenant IDs starting with 'tenant-enterprise'
   * const event = new OrderCreatedEventWithContext(orderData, {
   *   tenantId: 'tenant-enterprise-acme',
   *   userId: 'user-123'
   * });
   * ```
   *
   * @since 1.0.0
   * @public
   */
  async handle(event: OrderCreatedEventWithContext): Promise<void> {
    const { orderId, total, userId } = event.payload;
    const tenantId = event.getTenantId();
    
    console.log(`🏢 Processing enterprise order ${orderId} for tenant ${tenantId}`);
    
    try {
      // Enterprise-specific processing
      if (total > 10000) {
        await this.requireManagerApproval(orderId, total, tenantId!);
      }
      
      await this.integrateWithErpSystem(orderId, tenantId!);
      await this.sendEnterpriseNotifications(orderId, userId, tenantId!);
      
      console.log(`✅ Enterprise processing completed for order ${orderId}`);
      
    } catch (error) {
      console.error(`❌ Enterprise processing failed for order ${orderId}:`, error);
      throw error;
    }
  }

  private async requireManagerApproval(orderId: string, total: number, tenantId: string): Promise<void> {
    console.log(`  📋 Requiring manager approval for high-value order ${orderId} ($${total})`);
    // Simulate approval workflow
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private async integrateWithErpSystem(orderId: string, tenantId: string): Promise<void> {
    console.log(`  🔗 Integrating order ${orderId} with ERP system for ${tenantId}`);
    // Simulate ERP integration
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private async sendEnterpriseNotifications(orderId: string, userId: string, tenantId: string): Promise<void> {
    console.log(`  📧 Sending enterprise notifications for order ${orderId}`);
    // Simulate enhanced notifications
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}

/**
 * @llm-summary Standard tenant order processing handler
 * @llm-domain Standard Order Management
 * @llm-complexity Simple
 *
 * @description
 * Handles order events for standard tenants with basic processing
 * and standard notification flows.
 *
 * @since 1.0.0
 * @public
 */
@EventHandler(OrderCreatedEventWithContext, {
  eventContext: 'order-management',
  contextFilter: (event) => {
    const tenantId = event.getTenantId();
    return tenantId?.startsWith('tenant-standard') || tenantId?.startsWith('tenant-basic');
  }
})
export class StandardOrderHandler {
  /**
   * @llm-summary Processes orders for standard tenants
   * @llm-domain Standard Order Management
   * @llm-complexity Simple
   *
   * @description
   * Handles order creation for standard tenants with basic
   * processing, standard notifications, and simple workflows.
   *
   * @param event - Order created event with tenant context
   * @returns Promise that resolves when standard processing completes
   *
   * @since 1.0.0
   * @public
   */
  async handle(event: OrderCreatedEventWithContext): Promise<void> {
    const { orderId, total, userId } = event.payload;
    const tenantId = event.getTenantId();
    
    console.log(`🏪 Processing standard order ${orderId} for tenant ${tenantId}`);
    
    try {
      await this.processStandardOrder(orderId, total);
      await this.sendStandardNotifications(orderId, userId);
      
      console.log(`✅ Standard processing completed for order ${orderId}`);
      
    } catch (error) {
      console.error(`❌ Standard processing failed for order ${orderId}:`, error);
      throw error;
    }
  }

  private async processStandardOrder(orderId: string, total: number): Promise<void> {
    console.log(`  📦 Processing standard order ${orderId} ($${total})`);
    // Simulate standard processing
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendStandardNotifications(orderId: string, userId: string): Promise<void> {
    console.log(`  📧 Sending standard notifications for order ${orderId}`);
    // Simulate standard notifications
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * @llm-summary Regional-specific user onboarding handler
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Handles user registration events with region-specific onboarding
 * flows, compliance requirements, and welcome experiences.
 *
 * @since 1.0.0
 * @public
 */
@EventHandler(UserRegisteredEventWithContext, {
  eventContext: 'user-management',
  contextFilter: (event) => event.context.region === 'EU'
})
export class EuropeanUserOnboardingHandler {
  /**
   * @llm-summary Handles user registration for European users with GDPR compliance
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Processes user registration for European users with GDPR-compliant
   * onboarding flow and regional welcome experience.
   *
   * @param event - User registration event with regional context
   * @returns Promise that resolves when EU onboarding completes
   *
   * @since 1.0.0
   * @public
   */
  async handle(event: UserRegisteredEventWithContext): Promise<void> {
    const { userId, email, name } = event.payload;
    const region = event.context.region;
    
    console.log(`🇪🇺 Processing EU user registration for ${userId} in region ${region}`);
    
    try {
      await this.ensureGdprCompliance(userId, email);
      await this.sendEuropeanWelcomeFlow(userId, name);
      await this.setupRegionalPreferences(userId, region!);
      
      console.log(`✅ EU onboarding completed for user ${userId}`);
      
    } catch (error) {
      console.error(`❌ EU onboarding failed for user ${userId}:`, error);
      throw error;
    }
  }

  private async ensureGdprCompliance(userId: string, email: string): Promise<void> {
    console.log(`  🔒 Ensuring GDPR compliance for user ${userId}`);
    // Simulate GDPR compliance setup
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private async sendEuropeanWelcomeFlow(userId: string, name: string): Promise<void> {
    console.log(`  📧 Sending European welcome flow to ${name}`);
    // Simulate regional welcome flow
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  private async setupRegionalPreferences(userId: string, region: string): Promise<void> {
    console.log(`  ⚙️ Setting up regional preferences for ${region}`);
    // Simulate preference setup
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

```typescript
// context-builder.ts
import { EventContext } from '@vytches-ddd/events';

/**
 * @llm-summary Builder for creating rich event contexts
 * @llm-domain System Configuration
 * @llm-complexity Simple
 *
 * @description
 * Utility class for building comprehensive event contexts with
 * tenant, user, regional, and custom metadata information.
 *
 * @example
 * ```typescript
 * const context = ContextBuilder.create()
 *   .withTenant('tenant-enterprise-acme')
 *   .withUser('user-123')
 *   .withRegion('EU')
 *   .withBoundedContext('order-management')
 *   .build();
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ContextBuilder {
  private context: Partial<EventContext> = {};

  private constructor() {}

  /**
   * @llm-summary Creates new context builder instance
   * @llm-domain System Configuration
   * @llm-complexity Simple
   *
   * @description
   * Factory method to create a new context builder for
   * fluent context construction.
   *
   * @returns New ContextBuilder instance
   *
   * @since 1.0.0
   * @public
   */
  public static create(): ContextBuilder {
    return new ContextBuilder();
  }

  /**
   * @llm-summary Sets tenant ID in context
   * @llm-domain Multi-Tenant Architecture
   * @llm-complexity Simple
   *
   * @description
   * Adds tenant identification to event context for
   * tenant-specific event processing and filtering.
   *
   * @param tenantId - Unique tenant identifier
   * @returns ContextBuilder for method chaining
   *
   * @since 1.0.0
   * @public
   */
  public withTenant(tenantId: string): ContextBuilder {
    this.context.tenantId = tenantId;
    return this;
  }

  /**
   * @llm-summary Sets user ID in context
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Adds user identification to event context for
   * user-specific event processing and personalization.
   *
   * @param userId - Unique user identifier
   * @returns ContextBuilder for method chaining
   *
   * @since 1.0.0
   * @public
   */
  public withUser(userId: string): ContextBuilder {
    this.context.userId = userId;
    return this;
  }

  /**
   * @llm-summary Sets bounded context in context
   * @llm-domain Domain Architecture
   * @llm-complexity Simple
   *
   * @description
   * Adds bounded context identification for domain-specific
   * event routing and processing.
   *
   * @param boundedContext - Domain bounded context identifier
   * @returns ContextBuilder for method chaining
   *
   * @since 1.0.0
   * @public
   */
  public withBoundedContext(boundedContext: string): ContextBuilder {
    this.context.boundedContext = boundedContext;
    return this;
  }

  /**
   * @llm-summary Sets regional context
   * @llm-domain Regional Management
   * @llm-complexity Simple
   *
   * @description
   * Adds regional information for region-specific compliance,
   * localization, and business rule processing.
   *
   * @param region - Regional identifier (e.g., 'US', 'EU', 'APAC')
   * @returns ContextBuilder for method chaining
   *
   * @since 1.0.0
   * @public
   */
  public withRegion(region: string): ContextBuilder {
    this.context.region = region;
    return this;
  }

  /**
   * @llm-summary Adds correlation ID for request tracing
   * @llm-domain Observability
   * @llm-complexity Simple
   *
   * @description
   * Adds correlation ID for distributed request tracing
   * and event correlation across system boundaries.
   *
   * @param correlationId - Unique correlation identifier
   * @returns ContextBuilder for method chaining
   *
   * @since 1.0.0
   * @public
   */
  public withCorrelation(correlationId: string): ContextBuilder {
    this.context.correlationId = correlationId;
    return this;
  }

  /**
   * @llm-summary Adds custom metadata to context
   * @llm-domain System Configuration
   * @llm-complexity Simple
   *
   * @description
   * Adds custom metadata for application-specific context
   * information and extended event processing scenarios.
   *
   * @param metadata - Custom metadata object
   * @returns ContextBuilder for method chaining
   *
   * @since 1.0.0
   * @public
   */
  public withMetadata(metadata: Record<string, unknown>): ContextBuilder {
    this.context.metadata = { ...this.context.metadata, ...metadata };
    return this;
  }

  /**
   * @llm-summary Builds final event context
   * @llm-domain System Configuration
   * @llm-complexity Simple
   *
   * @description
   * Constructs the final event context with all specified
   * information and required defaults.
   *
   * @returns Complete EventContext object
   *
   * @since 1.0.0
   * @public
   */
  public build(): EventContext {
    return {
      correlationId: this.context.correlationId || `corr-${Date.now()}`,
      tenantId: this.context.tenantId,
      userId: this.context.userId,
      boundedContext: this.context.boundedContext,
      region: this.context.region,
      timestamp: new Date(),
      metadata: this.context.metadata || {}
    };
  }
}

// Demonstration of context-aware event processing
async function demonstrateContextAwareEvents(): Promise<void> {
  console.log('🌍 Demonstrating context-aware event processing...\n');

  // Simulate different tenant scenarios
  const scenarios = [
    {
      name: 'Enterprise Tenant - High Value Order',
      context: ContextBuilder.create()
        .withTenant('tenant-enterprise-acme')
        .withUser('user-123')
        .withBoundedContext('order-management')
        .withCorrelation('corr-enterprise-001')
        .build(),
      orderData: {
        orderId: 'order-enterprise-001',
        userId: 'user-123',
        total: 15000,
        items: [{ productId: 'server-rack', name: 'Server Rack', quantity: 2, total: 15000 }],
        createdAt: new Date()
      }
    },
    {
      name: 'Standard Tenant - Regular Order',
      context: ContextBuilder.create()
        .withTenant('tenant-standard-shop')
        .withUser('user-456')
        .withBoundedContext('order-management')
        .withCorrelation('corr-standard-001')
        .build(),
      orderData: {
        orderId: 'order-standard-001',
        userId: 'user-456',
        total: 299,
        items: [{ productId: 'laptop', name: 'Laptop', quantity: 1, total: 299 }],
        createdAt: new Date()
      }
    },
    {
      name: 'EU User Registration',
      context: ContextBuilder.create()
        .withTenant('tenant-standard-eu')
        .withUser('user-789')
        .withRegion('EU')
        .withBoundedContext('user-management')
        .withCorrelation('corr-eu-registration-001')
        .build(),
      userData: {
        userId: 'user-789',
        email: 'user@example.eu',
        name: 'Jean Dupont',
        registrationSource: 'web' as const,
        registeredAt: new Date()
      }
    }
  ];

  for (const scenario of scenarios) {
    console.log(`📋 Processing: ${scenario.name}`);
    console.log(`   Context: ${JSON.stringify(scenario.context, null, 2)}`);
    
    try {
      if ('orderData' in scenario) {
        const event = new OrderCreatedEventWithContext(scenario.orderData, scenario.context);
        // Event would be automatically routed to appropriate handlers
        console.log(`   ✅ Order event created with context filtering`);
      } else if ('userData' in scenario) {
        const event = new UserRegisteredEventWithContext(scenario.userData, scenario.context);
        // Event would be automatically routed to regional handlers
        console.log(`   ✅ User registration event created with regional context`);
      }
      
    } catch (error) {
      console.error(`   ❌ Failed to process ${scenario.name}:`, error);
    }
    
    console.log(); // Empty line for readability
  }
}
```

## Key Features

- **🎯 Context Filtering**: Events automatically routed based on context criteria
- **🏢 Multi-Tenancy**: Tenant-specific event processing with shared code base
- **🌍 Regional Handling**: Location-based event processing for compliance and localization
- **🔍 Flexible Filtering**: Custom filter functions for complex routing scenarios
- **📊 Rich Context**: Comprehensive context information including correlation, metadata

## Common Pitfalls

- **❌ Context Bloat**: Don't add unnecessary information to event context
- **❌ Filter Complexity**: Keep context filters simple and efficient
- **❌ Missing Fallbacks**: Consider what happens when context doesn't match any filter
- **❌ Context Mutation**: Don't modify context information after event creation

## Related Examples

- [Example 1: Basic Publishing](./example-1.md) - Foundation repository pattern
- [Example 2: Event Handlers](./example-2.md) - Basic event handler implementation
- [Intermediate: Batch Processing](../intermediate/example-1.md) - Processing multiple contextualized events