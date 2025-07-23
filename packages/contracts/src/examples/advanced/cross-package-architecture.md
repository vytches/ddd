# Cross-Package Architecture

**Version**: 1.0.0 **Package**: @vytches-ddd/contracts **Complexity**: Advanced
**Domain**: Foundation **Patterns**: cross-package-integration,
enterprise-architecture, domain-boundaries **Dependencies**:
@vytches-ddd/contracts

## Description

Cross-package architecture demonstrates how foundation contracts enable seamless
integration across multiple VytchesDDD packages. This example shows
enterprise-grade patterns for domain boundaries, event orchestration, and
architectural consistency using contracts as the integration foundation.

## Business Context

Enterprise applications require clean architectural boundaries while maintaining
integration capabilities. Foundation contracts provide the stable interfaces
that enable packages to work together without tight coupling, supporting complex
business processes that span multiple domains.

## Multi-Domain Architecture Foundation

### Domain Boundary Contracts

```typescript
// src/architecture/domain-boundaries.ts
import {
  EntityId,
  IDomainEvent,
  ISpecification,
  IActor,
  IEventBus,
  IEventHandler,
} from '@vytches-ddd/contracts';

// Cross-domain entity contracts
export interface DomainEntity {
  id: EntityId<string>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: IActor;
}

// User Management Domain
export interface UserDomainEntity extends DomainEntity {
  email: string;
  profile: UserProfile;
  preferences: UserPreferences;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  timezone: string;
}

export interface UserPreferences {
  language: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

// Order Management Domain
export interface OrderDomainEntity extends DomainEntity {
  customerId: EntityId<string>; // References User domain
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
}

export interface OrderItem {
  productId: EntityId<string>;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

// Payment Management Domain
export interface PaymentDomainEntity extends DomainEntity {
  orderId: EntityId<string>; // References Order domain
  customerId: EntityId<string>; // References User domain
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
}

export type PaymentMethod =
  | 'credit_card'
  | 'debit_card'
  | 'paypal'
  | 'bank_transfer';
export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded';
```

### Cross-Domain Event Architecture

```typescript
// src/architecture/cross-domain-events.ts
export class CrossDomainEventOrchestrator {
  constructor(
    private readonly eventBus: IEventBus,
    private readonly logger: Logger
  ) {}

  // User domain events that affect other domains
  async handleUserProfileUpdated(
    event: UserProfileUpdatedEvent
  ): Promise<void> {
    this.logger.info('Orchestrating user profile update across domains', {
      userId: event.aggregateId,
      correlationId: event.metadata.correlationId,
    });

    // Notify Order domain for customer data consistency
    const orderSyncEvent = new CustomerDataSyncRequiredEvent(
      event.aggregateId,
      {
        customerId: event.aggregateId,
        updatedFields: event.payload.changes,
        reason: 'profile_update',
      },
      {
        correlationId: event.metadata.correlationId,
        causationId: event.eventType,
        source: 'UserDomain',
        destination: 'OrderDomain',
      }
    );

    // Notify Payment domain for billing address updates
    if (event.payload.changes.address) {
      const billingUpdateEvent = new BillingAddressUpdateRequiredEvent(
        event.aggregateId,
        {
          customerId: event.aggregateId,
          newAddress: event.payload.changes.address,
          effectiveDate: new Date(),
        },
        {
          correlationId: event.metadata.correlationId,
          causationId: event.eventType,
          source: 'UserDomain',
          destination: 'PaymentDomain',
        }
      );

      await this.eventBus.publishMany([orderSyncEvent, billingUpdateEvent]);
    } else {
      await this.eventBus.publish(orderSyncEvent);
    }
  }

  // Order domain events that trigger cross-domain processes
  async handleOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    this.logger.info('Orchestrating order confirmation across domains', {
      orderId: event.aggregateId,
      customerId: event.payload.customerId,
      correlationId: event.metadata.correlationId,
    });

    // Trigger payment processing
    const paymentRequestEvent = new PaymentProcessingRequestedEvent(
      event.payload.paymentId,
      {
        orderId: event.aggregateId,
        customerId: event.payload.customerId,
        amount: event.payload.totalAmount,
        currency: event.payload.currency,
        paymentMethod: event.payload.paymentMethod,
      },
      {
        correlationId: event.metadata.correlationId,
        causationId: event.eventType,
        source: 'OrderDomain',
        destination: 'PaymentDomain',
      }
    );

    // Trigger inventory reservation
    const inventoryReservationEvent = new InventoryReservationRequestedEvent(
      `inventory-${event.aggregateId}`,
      {
        orderId: event.aggregateId,
        items: event.payload.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          reservationTimeout: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        })),
      },
      {
        correlationId: event.metadata.correlationId,
        causationId: event.eventType,
        source: 'OrderDomain',
        destination: 'InventoryDomain',
      }
    );

    // Notify user of order confirmation
    const customerNotificationEvent = new CustomerNotificationRequestedEvent(
      `notification-${event.aggregateId}`,
      {
        customerId: event.payload.customerId,
        type: 'order_confirmed',
        orderId: event.aggregateId,
        notificationChannels: ['email', 'push'],
        templateData: {
          orderNumber: event.payload.orderNumber,
          totalAmount: event.payload.totalAmount,
          currency: event.payload.currency,
        },
      },
      {
        correlationId: event.metadata.correlationId,
        causationId: event.eventType,
        source: 'OrderDomain',
        destination: 'NotificationDomain',
      }
    );

    await this.eventBus.publishMany([
      paymentRequestEvent,
      inventoryReservationEvent,
      customerNotificationEvent,
    ]);
  }

  // Payment domain events that complete business processes
  async handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    this.logger.info('Processing payment completion across domains', {
      paymentId: event.aggregateId,
      orderId: event.payload.orderId,
      status: event.payload.status,
      correlationId: event.metadata.correlationId,
    });

    if (event.payload.status === 'captured') {
      // Notify order domain of successful payment
      const orderPaymentConfirmedEvent = new OrderPaymentConfirmedEvent(
        event.payload.orderId,
        {
          paymentId: event.aggregateId,
          transactionId: event.payload.transactionId,
          amount: event.payload.amount,
          currency: event.payload.currency,
          processedAt: event.occurredAt,
        },
        {
          correlationId: event.metadata.correlationId,
          causationId: event.eventType,
          source: 'PaymentDomain',
          destination: 'OrderDomain',
        }
      );

      // Trigger fulfillment process
      const fulfillmentRequestedEvent = new FulfillmentRequestedEvent(
        `fulfillment-${event.payload.orderId}`,
        {
          orderId: event.payload.orderId,
          customerId: event.payload.customerId,
          priority: 'standard',
          expectedShipDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        },
        {
          correlationId: event.metadata.correlationId,
          causationId: event.eventType,
          source: 'PaymentDomain',
          destination: 'FulfillmentDomain',
        }
      );

      await this.eventBus.publishMany([
        orderPaymentConfirmedEvent,
        fulfillmentRequestedEvent,
      ]);
    } else if (event.payload.status === 'failed') {
      // Handle payment failure
      const orderPaymentFailedEvent = new OrderPaymentFailedEvent(
        event.payload.orderId,
        {
          paymentId: event.aggregateId,
          failureReason: event.payload.failureReason,
          retryable: event.payload.retryable,
          failedAt: event.occurredAt,
        },
        {
          correlationId: event.metadata.correlationId,
          causationId: event.eventType,
          source: 'PaymentDomain',
          destination: 'OrderDomain',
        }
      );

      await this.eventBus.publish(orderPaymentFailedEvent);
    }
  }
}
```

### Cross-Domain Business Rules

```typescript
// src/architecture/cross-domain-rules.ts
export class CrossDomainBusinessRules {
  // Business rule spanning User and Order domains
  static createCustomerEligibilitySpecification(
    minimumAccountAge: number = 30, // days
    minimumOrderHistory: number = 0,
    maxOrderValue: number = 10000
  ): ISpecification<{ user: UserDomainEntity; orderValue: number }> {
    return new CompositeSpecification(
      [
        // User domain rules
        new CustomerAccountAgeSpecification(minimumAccountAge),
        new CustomerAccountStatusSpecification(['active', 'premium']),

        // Order history rules (cross-domain)
        new CustomerOrderHistorySpecification(minimumOrderHistory),
        new OrderValueLimitSpecification(maxOrderValue),
      ],
      'AND'
    );
  }

  // Multi-domain fraud detection specification
  static createFraudDetectionSpecification(): ISpecification<{
    user: UserDomainEntity;
    order: OrderDomainEntity;
    paymentMethod: PaymentMethod;
    recentActivity: RecentActivityData;
  }> {
    return new CompositeSpecification(
      [
        // User behavior patterns
        new SuspiciousUserActivitySpecification(),
        new UnusualLocationSpecification(),

        // Order patterns
        new UnusualOrderSizeSpecification(),
        new HighRiskProductSpecification(),

        // Payment patterns
        new PaymentMethodRiskSpecification(),
        new VelocityCheckSpecification(),
      ],
      'OR'
    ); // Any of these conditions triggers fraud review
  }

  // Cross-domain data consistency specification
  static createDataConsistencySpecification(): ISpecification<{
    user: UserDomainEntity;
    orders: OrderDomainEntity[];
    payments: PaymentDomainEntity[];
  }> {
    return new CompositeSpecification(
      [
        new CustomerDataConsistencySpecification(),
        new OrderPaymentConsistencySpecification(),
        new AuditTrailConsistencySpecification(),
      ],
      'AND'
    );
  }
}

// Implementation classes for cross-domain specifications
class CustomerAccountAgeSpecification
  implements ISpecification<{ user: UserDomainEntity; orderValue: number }>
{
  constructor(private readonly minimumDays: number) {}

  isSatisfiedBy(candidate: {
    user: UserDomainEntity;
    orderValue: number;
  }): boolean {
    const accountAge = Date.now() - candidate.user.createdAt.getTime();
    const ageInDays = accountAge / (1000 * 60 * 60 * 24);
    return ageInDays >= this.minimumDays;
  }
}

class CustomerOrderHistorySpecification
  implements ISpecification<{ user: UserDomainEntity; orderValue: number }>
{
  constructor(private readonly minimumOrders: number) {}

  isSatisfiedBy(candidate: {
    user: UserDomainEntity;
    orderValue: number;
  }): boolean {
    // This would typically query the order domain
    // For demo purposes, assume we have this data
    const orderHistory = (candidate.user as any).orderHistory || [];
    return orderHistory.length >= this.minimumOrders;
  }
}

class OrderValueLimitSpecification
  implements ISpecification<{ user: UserDomainEntity; orderValue: number }>
{
  constructor(private readonly maxValue: number) {}

  isSatisfiedBy(candidate: {
    user: UserDomainEntity;
    orderValue: number;
  }): boolean {
    return candidate.orderValue <= this.maxValue;
  }
}
```

### Actor-Based Cross-Domain Security

```typescript
// src/architecture/cross-domain-security.ts
export class CrossDomainSecurityManager {
  // Multi-domain actor with cross-domain permissions
  static createSystemActor(source: string, permissions: string[]): IActor {
    return {
      id: `system-${source}`,
      type: 'system',
      name: `${source} System`,
      context: {
        source,
        permissions,
        timestamp: new Date(),
        domains: ['user', 'order', 'payment', 'inventory'],
        capabilities: ['read', 'write', 'integrate'],
      },
      isSystem: () => true,
      hasPermission: (permission: string) =>
        permissions.includes(permission) || permissions.includes('*'),
      getDisplayName: () => `${source} System Actor`,
    };
  }

  // Cross-domain service actor
  static createServiceActor(
    serviceId: string,
    sourceDomain: string,
    targetDomains: string[]
  ): IActor {
    return {
      id: serviceId,
      type: 'service',
      name: `${serviceName} Integration Service`,
      context: {
        sourceDomain,
        targetDomains,
        timestamp: new Date(),
        integrationLevel: 'cross-domain',
        permissions: targetDomains.map(domain => `${domain}:integrate`),
      },
      isSystem: () => false,
      hasPermission: (permission: string) => {
        const [domain, action] = permission.split(':');
        return (
          targetDomains.includes(domain) &&
          ['read', 'integrate', 'notify'].includes(action)
        );
      },
      getDisplayName: () => `${serviceName} Service`,
    };
  }

  // User actor with domain-specific permissions
  static createCrossDomainUserActor(
    userId: string,
    role: string,
    domainPermissions: Record<string, string[]>
  ): IActor {
    const allPermissions = Object.entries(domainPermissions).flatMap(
      ([domain, permissions]) =>
        permissions.map(permission => `${domain}:${permission}`)
    );

    return {
      id: userId,
      type: 'user',
      name: `User ${userId}`,
      context: {
        role,
        domainPermissions,
        allPermissions,
        timestamp: new Date(),
        multiDomain: true,
      },
      isSystem: () => false,
      hasPermission: (permission: string) =>
        allPermissions.includes(permission),
      getDisplayName: () => `${role} User`,
    };
  }

  // Permission validation across domains
  static validateCrossDomainOperation(
    actor: IActor,
    operation: {
      sourceDomain: string;
      targetDomain: string;
      action: string;
      resource: string;
    }
  ): boolean {
    // Source domain permission
    const sourcePermission = `${operation.sourceDomain}:${operation.action}`;
    const targetPermission = `${operation.targetDomain}:integrate`;

    // Check both source and target permissions
    return (
      actor.hasPermission(sourcePermission) &&
      (actor.isSystem() || actor.hasPermission(targetPermission))
    );
  }

  // Audit cross-domain operations
  static createCrossDomainAuditEntry(
    actor: IActor,
    operation: string,
    domains: string[],
    details: Record<string, any>
  ): CrossDomainAuditEntry {
    return {
      actorId: actor.id,
      actorType: actor.type,
      operation,
      domains,
      timestamp: new Date(),
      correlationId: details.correlationId || generateCorrelationId(),
      success: details.success ?? true,
      details,
      crossDomainContext: {
        sourceDomain: details.sourceDomain,
        targetDomains: domains.filter(d => d !== details.sourceDomain),
        integrationPattern: details.integrationPattern || 'event-driven',
      },
    };
  }
}

interface CrossDomainAuditEntry {
  actorId: string;
  actorType: string;
  operation: string;
  domains: string[];
  timestamp: Date;
  correlationId: string;
  success: boolean;
  details: Record<string, any>;
  crossDomainContext: {
    sourceDomain: string;
    targetDomains: string[];
    integrationPattern: string;
  };
}
```

### Enterprise Integration Patterns

```typescript
// src/architecture/enterprise-integration.ts
export class EnterpriseIntegrationManager {
  constructor(
    private readonly eventBus: IEventBus,
    private readonly contractRegistry: ContractRegistry
  ) {}

  // Saga coordination using contracts
  async coordinateMultiDomainSaga(
    sagaId: string,
    initialEvent: IDomainEvent,
    coordinationPlan: SagaCoordinationPlan
  ): Promise<void> {
    const sagaContext = {
      sagaId,
      correlationId: initialEvent.metadata.correlationId,
      startTime: new Date(),
      steps: coordinationPlan.steps,
      currentStep: 0,
      compensation: [],
    };

    // Execute saga steps across domains
    for (const step of coordinationPlan.steps) {
      try {
        await this.executeSagaStep(step, sagaContext);
        sagaContext.currentStep++;
      } catch (error) {
        await this.compensateSaga(sagaContext);
        throw error;
      }
    }
  }

  private async executeSagaStep(
    step: SagaStep,
    context: SagaContext
  ): Promise<void> {
    const stepEvent = this.createStepEvent(step, context);

    // Add compensation info
    context.compensation.unshift({
      domain: step.targetDomain,
      action: step.compensationAction,
      data: step.data,
    });

    await this.eventBus.publish(stepEvent);
  }

  // Contract-based API integration
  async integrateWithExternalSystem<T>(
    systemId: string,
    operation: string,
    data: any,
    contract: IntegrationContract<T>
  ): Promise<T> {
    // Validate input against contract
    if (!contract.validateInput(data)) {
      throw new Error(`Input validation failed for ${systemId}.${operation}`);
    }

    // Create integration event
    const integrationEvent = new ExternalSystemIntegrationEvent(
      `integration-${systemId}-${Date.now()}`,
      {
        systemId,
        operation,
        data,
        requestId: generateRequestId(),
        timestamp: new Date(),
      },
      {
        correlationId: generateCorrelationId(),
        source: 'InternalSystem',
        destination: systemId,
        integrationContract: contract.contractId,
      }
    );

    // Publish and wait for response
    await this.eventBus.publish(integrationEvent);

    // In real implementation, this would wait for response event
    return contract.transformResponse(data);
  }

  // Contract registry for cross-package consistency
  registerDomainContract(
    domain: string,
    version: string,
    contract: DomainContract
  ): void {
    this.contractRegistry.register(`${domain}:${version}`, contract);
  }

  validateCrossDomainInteraction(
    sourceDomain: string,
    targetDomain: string,
    interaction: any
  ): boolean {
    const sourceContract = this.contractRegistry.get(sourceDomain);
    const targetContract = this.contractRegistry.get(targetDomain);

    if (!sourceContract || !targetContract) {
      return false;
    }

    return sourceContract.canInteractWith(targetContract, interaction);
  }
}

// Supporting interfaces and types
interface SagaCoordinationPlan {
  sagaType: string;
  steps: SagaStep[];
  timeout: number;
  retryPolicy: RetryPolicy;
}

interface SagaStep {
  stepId: string;
  targetDomain: string;
  action: string;
  data: any;
  compensationAction: string;
  timeout: number;
}

interface SagaContext {
  sagaId: string;
  correlationId: string;
  startTime: Date;
  steps: SagaStep[];
  currentStep: number;
  compensation: CompensationStep[];
}

interface CompensationStep {
  domain: string;
  action: string;
  data: any;
}

interface IntegrationContract<T> {
  contractId: string;
  version: string;
  validateInput(data: any): boolean;
  transformResponse(data: any): T;
}

interface DomainContract {
  domain: string;
  version: string;
  exports: string[];
  imports: string[];
  eventTypes: string[];
  canInteractWith(other: DomainContract, interaction: any): boolean;
}

class ContractRegistry {
  private contracts = new Map<string, DomainContract>();

  register(key: string, contract: DomainContract): void {
    this.contracts.set(key, contract);
  }

  get(key: string): DomainContract | undefined {
    return this.contracts.get(key);
  }
}
```

## Key Features

- **Cross-Domain Integration**: Seamless package integration through contracts
- **Event Orchestration**: Multi-domain business process coordination
- **Business Rule Composition**: Cross-package business rule validation
- **Security Boundaries**: Actor-based cross-domain security
- **Saga Coordination**: Long-running process management
- **Contract Registry**: Package compatibility and validation
- **Enterprise Patterns**: Production-ready integration patterns

## Common Pitfalls

- **Contract Violations**: Ensure all packages adhere to defined contracts
- **Circular Dependencies**: Avoid direct package dependencies through proper
  contracts
- **Event Flooding**: Design efficient cross-domain communication patterns
- **Security Bypass**: Don't skip actor validation in cross-domain operations

## Related Examples

- EntityId Usage - Foundation identity patterns
- Event Interfaces - Core event architecture
- Foundation Contracts - Base patterns and specifications
- Capability System - Extensible architecture patterns

## Best Practices

- Define clear domain boundaries using contracts
- Use events for cross-domain communication
- Implement proper actor-based security
- Design contracts for backward compatibility
- Monitor cross-domain interactions
- Implement proper saga compensation patterns
- Use correlation IDs for traceability
- Validate all cross-domain interactions
