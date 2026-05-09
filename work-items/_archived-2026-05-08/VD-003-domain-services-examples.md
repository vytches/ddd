# VD-003: Domain Services Real-World Examples

**Priority**: 84/100  
**Category**: Documentation  
**Pillar**: Developer Experience  
**Estimated Time**: 8 hours  
**Dependencies**: None  
**Status**: Ready for Implementation

## 📋 Context

Domain Services package lacks practical examples showing real-world patterns:

- Order processing service patterns missing
- Payment orchestration not documented
- Inventory management examples absent
- User registration flows unclear
- Service composition patterns missing
- Transaction handling not shown
- Testing patterns undocumented
- Service versioning strategies absent

**Business Impact**: Clarifies service layer patterns, reducing architectural
confusion

## 🎯 Objectives

1. Create comprehensive order processing service example
2. Document payment orchestration patterns
3. Add inventory management service implementation
4. Create user registration flow example
5. Document service composition patterns
6. Add transaction handling examples
7. Create testing patterns for domain services
8. Document service versioning strategies

## 📊 Current Documentation Gaps

```typescript
// Current: Users unclear on domain service patterns
import { DomainService } from '@vytches/ddd-domain-services';

// Missing examples for:
// - Complex business orchestration
// - Cross-aggregate coordination
// - External system integration
// - Transaction boundaries
// - Service composition
// - Error handling patterns
```

## ✅ Implementation Tasks

### Phase 1: Order Processing Service (2 hours)

#### Task 1.1: Complete Order Service

```typescript
// docs/examples/domain/domain-services/order-processing-service.md
import {
  BaseDomainService,
  DomainServiceContext,
} from '@vytches/ddd-domain-services';
import { Result } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';

export class OrderProcessingService extends BaseDomainService {
  private logger = Logger.forContext('OrderProcessingService');

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly paymentService: PaymentService,
    private readonly shippingService: ShippingService,
    private readonly orderRepository: IOrderRepository
  ) {
    super('OrderProcessing', 'Order fulfillment orchestration');
  }

  async processOrder(
    orderId: string,
    context: DomainServiceContext
  ): Promise<Result<OrderResult, OrderError>> {
    this.logger.info('Processing order', {
      orderId,
      correlationId: context.correlationId,
    });

    // 1. Load order aggregate
    const orderResult = await this.orderRepository.findById(orderId);
    if (orderResult.isFailure()) {
      return Result.fail(new OrderNotFoundError(orderId));
    }

    const order = orderResult.value;

    // 2. Reserve inventory (cross-aggregate operation)
    const reservationResult = await this.inventoryService.reserveItems(
      order.items,
      context
    );

    if (reservationResult.isFailure()) {
      await this.handleInventoryFailure(order, reservationResult.error);
      return Result.fail(new InsufficientInventoryError());
    }

    // 3. Process payment
    const paymentResult = await this.paymentService.processPayment(
      order.paymentDetails,
      context
    );

    if (paymentResult.isFailure()) {
      // Compensate: Release inventory
      await this.inventoryService.releaseReservation(
        reservationResult.value.reservationId,
        context
      );
      return Result.fail(new PaymentFailedError());
    }

    // 4. Schedule shipping
    const shippingResult = await this.shippingService.scheduleShipment(
      order,
      context
    );

    if (shippingResult.isFailure()) {
      // Compensate: Refund payment and release inventory
      await this.compensateFailedShipping(
        order,
        paymentResult.value,
        reservationResult.value
      );
      return Result.fail(new ShippingFailedError());
    }

    // 5. Update order status
    order.markAsProcessed(
      paymentResult.value.transactionId,
      shippingResult.value.trackingNumber
    );

    await this.orderRepository.save(order);

    // 6. Publish domain events
    await this.publishOrderProcessedEvent(order, context);

    return Result.ok({
      orderId: order.id,
      status: 'PROCESSED',
      trackingNumber: shippingResult.value.trackingNumber,
      estimatedDelivery: shippingResult.value.estimatedDelivery,
    });
  }

  private async compensateFailedShipping(
    order: Order,
    payment: PaymentResult,
    reservation: ReservationResult
  ): Promise<void> {
    const compensations = [
      this.paymentService.refundPayment(payment.transactionId),
      this.inventoryService.releaseReservation(reservation.reservationId),
    ];

    await Promise.allSettled(compensations);
  }
}
```

#### Task 1.2: Order Validation Service

```typescript
// docs/examples/domain/domain-services/order-validation-service.md
export class OrderValidationService extends BaseDomainService {
  constructor(
    private readonly productCatalog: IProductCatalog,
    private readonly pricingService: PricingService,
    private readonly customerService: CustomerService
  ) {
    super('OrderValidation', 'Order validation and enrichment');
  }

  async validateAndEnrichOrder(
    orderData: CreateOrderData,
    context: DomainServiceContext
  ): Promise<Result<EnrichedOrder, ValidationError>> {
    // Validate customer
    const customerResult = await this.customerService.validateCustomer(
      orderData.customerId,
      context
    );

    if (customerResult.isFailure()) {
      return Result.fail(new InvalidCustomerError());
    }

    // Validate and enrich products
    const enrichedItems = [];
    for (const item of orderData.items) {
      const product = await this.productCatalog.getProduct(item.productId);

      if (!product) {
        return Result.fail(new ProductNotFoundError(item.productId));
      }

      // Calculate pricing with customer discounts
      const price = await this.pricingService.calculatePrice(
        product,
        item.quantity,
        customerResult.value
      );

      enrichedItems.push({
        ...item,
        product,
        unitPrice: price.unitPrice,
        totalPrice: price.total,
        discount: price.discount,
      });
    }

    // Create enriched order
    const enrichedOrder: EnrichedOrder = {
      ...orderData,
      customer: customerResult.value,
      items: enrichedItems,
      totalAmount: enrichedItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      ),
      validatedAt: new Date(),
    };

    return Result.ok(enrichedOrder);
  }
}
```

### Phase 2: Payment Orchestration (1.5 hours)

#### Task 2.1: Payment Processing Service

```typescript
// docs/examples/domain/domain-services/payment-service.md
export class PaymentOrchestrationService extends BaseDomainService {
  constructor(
    private readonly paymentGateway: IPaymentGateway,
    private readonly fraudDetection: FraudDetectionService,
    private readonly ledgerService: LedgerService,
    private readonly notificationService: NotificationService
  ) {
    super('PaymentOrchestration', 'Payment processing and orchestration');
  }

  async processPayment(
    paymentRequest: PaymentRequest,
    context: DomainServiceContext
  ): Promise<Result<PaymentResult, PaymentError>> {
    // 1. Fraud detection
    const fraudCheck = await this.fraudDetection.checkTransaction(
      paymentRequest,
      context
    );

    if (fraudCheck.riskScore > 0.8) {
      await this.handleHighRiskTransaction(paymentRequest, fraudCheck);
      return Result.fail(new FraudDetectedError());
    }

    // 2. Process with appropriate gateway
    const gateway = this.selectPaymentGateway(paymentRequest);
    const transactionResult = await this.processWithRetry(
      () => gateway.charge(paymentRequest),
      3 // max attempts
    );

    if (transactionResult.isFailure()) {
      return Result.fail(new PaymentProcessingError());
    }

    // 3. Record in ledger
    await this.ledgerService.recordTransaction({
      transactionId: transactionResult.value.id,
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
      type: 'CHARGE',
      timestamp: new Date(),
    });

    // 4. Send confirmation
    await this.notificationService.sendPaymentConfirmation(
      paymentRequest.customerId,
      transactionResult.value
    );

    return Result.ok({
      transactionId: transactionResult.value.id,
      status: 'COMPLETED',
      amount: paymentRequest.amount,
      processedAt: new Date(),
    });
  }

  async processRefund(
    transactionId: string,
    reason: RefundReason,
    context: DomainServiceContext
  ): Promise<Result<RefundResult, RefundError>> {
    // 1. Validate original transaction
    const transaction = await this.ledgerService.getTransaction(transactionId);

    if (!transaction) {
      return Result.fail(new TransactionNotFoundError());
    }

    // 2. Process refund through gateway
    const refundResult = await this.paymentGateway.refund(transaction, reason);

    if (refundResult.isFailure()) {
      return Result.fail(new RefundFailedError());
    }

    // 3. Update ledger
    await this.ledgerService.recordTransaction({
      transactionId: refundResult.value.id,
      originalTransactionId: transactionId,
      amount: -transaction.amount,
      type: 'REFUND',
      reason,
      timestamp: new Date(),
    });

    // 4. Notify customer
    await this.notificationService.sendRefundConfirmation(
      transaction.customerId,
      refundResult.value
    );

    return Result.ok(refundResult.value);
  }

  private selectPaymentGateway(request: PaymentRequest): IPaymentGateway {
    // Gateway selection logic based on amount, currency, region, etc.
    if (request.amount > 10000) {
      return this.enterpriseGateway;
    }

    if (request.currency !== 'USD') {
      return this.internationalGateway;
    }

    return this.standardGateway;
  }
}
```

### Phase 3: Inventory Management (1.5 hours)

#### Task 3.1: Inventory Service

```typescript
// docs/examples/domain/domain-services/inventory-service.md
export class InventoryManagementService extends BaseDomainService {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly warehouseService: WarehouseService,
    private readonly restockingService: RestockingService
  ) {
    super('InventoryManagement', 'Inventory control and optimization');
  }

  async reserveItems(
    items: OrderItem[],
    context: DomainServiceContext
  ): Promise<Result<Reservation, InventoryError>> {
    const reservation = Reservation.create();

    // Check availability across warehouses
    for (const item of items) {
      const availability = await this.checkAvailability(
        item.productId,
        item.quantity
      );

      if (!availability.isAvailable) {
        // Try to source from other warehouses
        const sourced = await this.sourceFromAlternativeWarehouses(
          item,
          context
        );

        if (!sourced) {
          return Result.fail(new InsufficientStockError(item.productId));
        }
      }

      // Reserve in optimal warehouse
      const warehouse = this.selectOptimalWarehouse(
        item,
        availability.warehouses
      );

      await this.warehouseService.reserveStock(
        warehouse.id,
        item.productId,
        item.quantity,
        reservation.id
      );

      reservation.addItem({
        productId: item.productId,
        quantity: item.quantity,
        warehouseId: warehouse.id,
      });
    }

    // Set reservation expiry
    reservation.setExpiry(new Date(Date.now() + 15 * 60 * 1000)); // 15 minutes

    await this.inventoryRepository.saveReservation(reservation);

    // Check if restocking needed
    await this.checkRestockingNeeds(items);

    return Result.ok(reservation);
  }

  async releaseReservation(
    reservationId: string,
    context: DomainServiceContext
  ): Promise<Result<void, Error>> {
    const reservation =
      await this.inventoryRepository.getReservation(reservationId);

    if (!reservation) {
      return Result.fail(new ReservationNotFoundError());
    }

    // Release stock in all warehouses
    for (const item of reservation.items) {
      await this.warehouseService.releaseStock(
        item.warehouseId,
        item.productId,
        item.quantity
      );
    }

    reservation.markAsReleased();
    await this.inventoryRepository.saveReservation(reservation);

    return Result.ok();
  }

  private async checkRestockingNeeds(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      const stockLevel = await this.inventoryRepository.getStockLevel(
        item.productId
      );

      if (stockLevel.quantity < stockLevel.reorderPoint) {
        await this.restockingService.createRestockOrder({
          productId: item.productId,
          quantity: stockLevel.reorderQuantity,
          priority:
            stockLevel.quantity < stockLevel.criticalLevel ? 'HIGH' : 'NORMAL',
        });
      }
    }
  }
}
```

### Phase 4: User Registration Flow (1 hour)

#### Task 4.1: User Registration Service

```typescript
// docs/examples/domain/domain-services/user-registration-service.md
export class UserRegistrationService extends BaseDomainService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
    private readonly authService: AuthenticationService,
    private readonly auditService: AuditService
  ) {
    super('UserRegistration', 'User registration and onboarding');
  }

  async registerUser(
    registrationData: UserRegistrationData,
    context: DomainServiceContext
  ): Promise<Result<User, RegistrationError>> {
    // 1. Validate uniqueness
    const existingUser = await this.userRepository.findByEmail(
      registrationData.email
    );

    if (existingUser) {
      return Result.fail(new EmailAlreadyExistsError());
    }

    // 2. Create user aggregate
    const user = User.create({
      email: registrationData.email,
      username: registrationData.username,
      profile: registrationData.profile,
    });

    // 3. Hash password and create credentials
    const hashedPassword = await this.authService.hashPassword(
      registrationData.password
    );

    user.setCredentials({
      passwordHash: hashedPassword,
      mustChangePassword: false,
      passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    });

    // 4. Generate verification token
    const verificationToken = await this.authService.generateVerificationToken(
      user.id
    );

    user.setVerificationToken(verificationToken);

    // 5. Save user
    await this.userRepository.save(user);

    // 6. Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken
    );

    // 7. Audit registration
    await this.auditService.logUserRegistration({
      userId: user.id,
      email: user.email,
      registeredAt: new Date(),
      ipAddress: context.metadata?.ipAddress,
      userAgent: context.metadata?.userAgent,
    });

    // 8. Publish user registered event
    user.addDomainEvent(
      new UserRegisteredEvent({
        userId: user.id,
        email: user.email,
        username: user.username,
      })
    );

    return Result.ok(user);
  }

  async completeOnboarding(
    userId: string,
    onboardingData: OnboardingData,
    context: DomainServiceContext
  ): Promise<Result<void, OnboardingError>> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return Result.fail(new UserNotFoundError());
    }

    // Update user preferences
    user.updatePreferences(onboardingData.preferences);

    // Set up default settings
    user.applyDefaultSettings(onboardingData.selectedPlan);

    // Mark onboarding complete
    user.completeOnboarding();

    await this.userRepository.save(user);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, user.username);

    return Result.ok();
  }
}
```

### Phase 5: Service Composition (1 hour)

#### Task 5.1: Composite Service Pattern

```typescript
// docs/examples/domain/domain-services/composite-service.md
export class OrderFulfillmentService extends BaseDomainService {
  constructor(
    private readonly orderValidation: OrderValidationService,
    private readonly inventoryService: InventoryManagementService,
    private readonly paymentService: PaymentOrchestrationService,
    private readonly shippingService: ShippingService
  ) {
    super('OrderFulfillment', 'Complete order fulfillment orchestration');
  }

  async fulfillOrder(
    orderRequest: OrderRequest,
    context: DomainServiceContext
  ): Promise<Result<FulfillmentResult, FulfillmentError>> {
    // Compose multiple services into a cohesive workflow
    const pipeline = new ServicePipeline<OrderRequest, FulfillmentResult>();

    pipeline
      .addStep('validation', async data => {
        return await this.orderValidation.validateAndEnrichOrder(data, context);
      })
      .addStep('inventory', async enrichedOrder => {
        return await this.inventoryService.reserveItems(
          enrichedOrder.items,
          context
        );
      })
      .addStep('payment', async (enrichedOrder, reservationResult) => {
        return await this.paymentService.processPayment(
          enrichedOrder.paymentDetails,
          context
        );
      })
      .addStep('shipping', async (enrichedOrder, reservation, payment) => {
        return await this.shippingService.scheduleShipment(
          enrichedOrder,
          reservation,
          context
        );
      })
      .withCompensation('inventory', async reservation => {
        await this.inventoryService.releaseReservation(reservation.id, context);
      })
      .withCompensation('payment', async payment => {
        await this.paymentService.processRefund(
          payment.transactionId,
          'ORDER_FAILED',
          context
        );
      });

    return await pipeline.execute(orderRequest);
  }
}

// Service Pipeline implementation
class ServicePipeline<TInput, TOutput> {
  private steps: PipelineStep[] = [];
  private compensations: Map<string, CompensationHandler> = new Map();

  addStep(name: string, handler: StepHandler): this {
    this.steps.push({ name, handler });
    return this;
  }

  withCompensation(stepName: string, handler: CompensationHandler): this {
    this.compensations.set(stepName, handler);
    return this;
  }

  async execute(input: TInput): Promise<Result<TOutput, Error>> {
    const results: any[] = [];
    let currentStep = 0;

    try {
      for (const step of this.steps) {
        const result = await step.handler(input, ...results);

        if (result.isFailure()) {
          await this.compensate(currentStep, results);
          return Result.fail(result.error);
        }

        results.push(result.value);
        currentStep++;
      }

      return Result.ok(results[results.length - 1]);
    } catch (error) {
      await this.compensate(currentStep, results);
      throw error;
    }
  }

  private async compensate(fromStep: number, results: any[]): Promise<void> {
    for (let i = fromStep - 1; i >= 0; i--) {
      const stepName = this.steps[i].name;
      const compensation = this.compensations.get(stepName);

      if (compensation) {
        await compensation(results[i]);
      }
    }
  }
}
```

### Phase 6: Transaction Handling (1 hour)

#### Task 6.1: Transactional Service

```typescript
// docs/examples/domain/domain-services/transactional-service.md
export class TransactionalOrderService extends BaseDomainService {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly orderRepository: IOrderRepository,
    private readonly inventoryRepository: IInventoryRepository
  ) {
    super('TransactionalOrder', 'Transactional order operations');
  }

  async createOrderWithInventoryUpdate(
    orderData: CreateOrderData,
    context: DomainServiceContext
  ): Promise<Result<Order, Error>> {
    return await this.unitOfWork.executeTransaction(async tx => {
      // All operations within transaction boundary
      const order = Order.create(orderData);

      // Reserve inventory within transaction
      for (const item of order.items) {
        const inventory = await tx
          .getRepository(InventoryRepository)
          .findByProductId(item.productId);

        if (!inventory.hasStock(item.quantity)) {
          throw new InsufficientStockError(item.productId);
        }

        inventory.reserve(item.quantity);
        await tx.getRepository(InventoryRepository).save(inventory);
      }

      // Save order within same transaction
      await tx.getRepository(OrderRepository).save(order);

      // Events are published after transaction commits
      order.addDomainEvent(new OrderCreatedEvent(order));

      return order;
    });
  }

  async cancelOrderWithCompensation(
    orderId: string,
    reason: string,
    context: DomainServiceContext
  ): Promise<Result<void, Error>> {
    return await this.unitOfWork.executeTransaction(async tx => {
      const order = await tx.getRepository(OrderRepository).findById(orderId);

      if (!order) {
        throw new OrderNotFoundError(orderId);
      }

      // Cancel order
      order.cancel(reason);

      // Restore inventory
      for (const item of order.items) {
        const inventory = await tx
          .getRepository(InventoryRepository)
          .findByProductId(item.productId);

        inventory.release(item.quantity);
        await tx.getRepository(InventoryRepository).save(inventory);
      }

      await tx.getRepository(OrderRepository).save(order);

      return Result.ok();
    });
  }
}
```

### Phase 7: Testing Patterns (0.5 hours)

#### Task 7.1: Service Testing

```typescript
// docs/examples/domain/domain-services/testing-patterns.md
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';

describe('OrderProcessingService', () => {
  let service: OrderProcessingService;
  let mockInventory: Mock<InventoryService>;
  let mockPayment: Mock<PaymentService>;

  beforeEach(() => {
    mockInventory = createMock<InventoryService>();
    mockPayment = createMock<PaymentService>();

    service = new OrderProcessingService(
      mockInventory,
      mockPayment,
      mockShipping,
      mockRepository
    );
  });

  it('should process order successfully', async () => {
    // Arrange
    mockInventory.reserveItems.mockResolvedValue(Result.ok(reservation));
    mockPayment.processPayment.mockResolvedValue(Result.ok(paymentResult));

    // Act
    const result = await service.processOrder(orderId, context);

    // Assert
    expect(result.isSuccess()).toBe(true);
    expect(mockInventory.reserveItems).toHaveBeenCalledWith(
      order.items,
      context
    );
  });

  it('should compensate on payment failure', async () => {
    // Arrange
    mockInventory.reserveItems.mockResolvedValue(Result.ok(reservation));
    mockPayment.processPayment.mockResolvedValue(
      Result.fail(new PaymentFailedError())
    );

    // Act
    const result = await service.processOrder(orderId, context);

    // Assert
    expect(result.isFailure()).toBe(true);
    expect(mockInventory.releaseReservation).toHaveBeenCalledWith(
      reservation.id,
      context
    );
  });
});
```

### Phase 8: Service Versioning (0.5 hours)

#### Task 8.1: Versioning Strategy

```typescript
// docs/examples/domain/domain-services/versioning.md
export abstract class VersionedDomainService extends BaseDomainService {
  abstract readonly version: string;

  async execute(
    operation: string,
    data: any,
    context: DomainServiceContext
  ): Promise<Result<any, Error>> {
    const version = context.metadata?.apiVersion || 'latest';

    if (version === 'latest') {
      return await this.executeLatest(operation, data, context);
    }

    return await this.executeVersioned(version, operation, data, context);
  }

  protected abstract executeLatest(
    operation: string,
    data: any,
    context: DomainServiceContext
  ): Promise<Result<any, Error>>;

  protected abstract executeVersioned(
    version: string,
    operation: string,
    data: any,
    context: DomainServiceContext
  ): Promise<Result<any, Error>>;
}

export class OrderServiceV2 extends VersionedDomainService {
  readonly version = '2.0.0';

  protected async executeLatest(
    operation: string,
    data: any,
    context: DomainServiceContext
  ): Promise<Result<any, Error>> {
    // V2 implementation
    return await this.processOrderV2(data, context);
  }

  protected async executeVersioned(
    version: string,
    operation: string,
    data: any,
    context: DomainServiceContext
  ): Promise<Result<any, Error>> {
    if (version === '1.0.0') {
      // Adapt V1 request to V2
      const adaptedData = this.adaptV1ToV2(data);
      const result = await this.processOrderV2(adaptedData, context);
      // Adapt V2 response to V1
      return this.adaptV2ResponseToV1(result);
    }

    return Result.fail(new UnsupportedVersionError(version));
  }
}
```

## 📈 Success Metrics

### Documentation Coverage

- [ ] 3+ order processing examples
- [ ] 2+ payment orchestration examples
- [ ] 2+ inventory management examples
- [ ] 2+ user registration examples
- [ ] 3+ service composition patterns
- [ ] 2+ transaction handling examples
- [ ] Complete testing guide
- [ ] Versioning strategy documented

### Quality Metrics

- [ ] All examples compile without errors
- [ ] Examples show real-world patterns
- [ ] Clear separation of concerns
- [ ] Proper error handling and compensation

## 🔧 Technical Implementation Details

### Service Categories

1. **Orchestration**: Coordinating multiple aggregates
2. **Integration**: External system interaction
3. **Validation**: Complex business rule enforcement
4. **Transformation**: Data enrichment and adaptation

### Documentation Structure

```
docs/examples/domain/domain-services/
├── orchestration/
│   ├── order-processing.md
│   └── payment-orchestration.md
├── integration/
│   ├── external-api.md
│   └── legacy-system.md
├── composition/
│   ├── pipeline.md
│   └── composite.md
└── patterns/
    ├── transaction.md
    └── versioning.md
```

## 🚨 Risk Mitigation

### Documentation Risks

- **Over-complexity**: Keep examples focused on single concepts
- **Business logic leak**: Maintain domain boundaries
- **Anti-patterns**: Show correct service usage

### Pattern Risks

- **Anemic services**: Ensure services contain business logic
- **Transaction boundaries**: Clear transaction scope
- **Compensation logic**: Proper rollback patterns

## 📚 References

- [Domain Services Pattern](https://martinfowler.com/bliki/EvansClassification.html)
- [Service Layer Pattern](https://martinfowler.com/eaaCatalog/serviceLayer.html)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Compensation Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction)

## ✅ Definition of Done

- [ ] All service categories documented
- [ ] Real-world examples created
- [ ] Testing patterns documented
- [ ] Versioning strategy clear
- [ ] Examples integrated into CLI
- [ ] Documentation peer reviewed
