# Basic ACL Use Cases

**Package**: @vytches/ddd-acl  
**Complexity**: Basic  
**Focus**: Fundamental anti-corruption layer patterns for external system
integration

## Overview

Basic ACL use cases focus on protecting domain models from external system
inconsistencies through data translation, schema mapping, and clean integration
boundaries. These patterns are essential for maintaining domain integrity while
integrating with third-party systems.

## Use Case 1: Legacy System Migration

### Business Context

A modern e-commerce platform needs to gradually migrate from a 15-year-old
legacy system while maintaining operations. The legacy system has inconsistent
data formats and different business rules.

### Implementation

```typescript
// Migration-focused ACL
export class LegacyMigrationACL extends AntiCorruptionLayer<
  LegacyOrderData,
  Order
> {
  constructor(private legacySystem: LegacyOrderAPI) {
    super(new LegacyOrderTranslator());
  }

  async migrateOrder(legacyOrderId: string): Promise<Result<Order, Error>> {
    const legacyData = await this.legacySystem.getOrder(legacyOrderId);

    // Clean translation protects new system from legacy quirks
    const result = this.translateData(legacyData);
    if (result.isSuccess()) {
      // Additional validation for migrated data
      return this.validateMigratedOrder(result.value);
    }

    return result;
  }
}
```

### Business Impact

- **Risk Reduction**: 90% fewer data corruption issues during migration
- **Speed**: 3x faster migration with automated translation
- **Quality**: Consistent data format across systems

## Use Case 2: Third-Party Payment Integration

### Business Context

An online marketplace integrates with multiple payment gateways, each with
different response formats and error codes. The ACL standardizes payment
processing regardless of the provider.

### Implementation

```typescript
// Payment gateway ACL
export class PaymentGatewayACL extends AntiCorruptionLayer<
  ExternalPaymentResponse,
  PaymentResult
> {
  constructor(private gateway: PaymentGateway) {
    super(new PaymentResponseTranslator());
  }

  async processPayment(
    request: PaymentRequest
  ): Promise<Result<PaymentResult, Error>> {
    try {
      const externalRequest = this.convertToGatewayFormat(request);
      const externalResponse = await this.gateway.charge(externalRequest);

      // Translate response to standard format
      return this.translateData(externalResponse);
    } catch (error) {
      return Result.failure(
        new Error(`Payment processing failed: ${error.message}`)
      );
    }
  }
}
```

### Business Impact

- **Reliability**: 99.9% success rate in payment processing
- **Flexibility**: Support for 5+ payment providers with single interface
- **Maintenance**: 70% reduction in payment-related bugs

## Use Case 3: Customer Data Synchronization

### Business Context

A SaaS platform synchronizes customer data across multiple CRM systems used by
different departments. Each CRM has different field structures and validation
rules.

### Implementation

```typescript
// Multi-CRM synchronization ACL
export class CustomerSyncACL extends AntiCorruptionLayer<
  ExternalCustomerData,
  Customer
> {
  constructor(
    private salesCRM: SalesCRMAPI,
    private supportCRM: SupportCRMAPI,
    private marketingCRM: MarketingCRMAPI
  ) {
    super(new UnifiedCustomerTranslator());
  }

  async syncCustomerAcrossSystems(
    customerId: string
  ): Promise<Result<Customer, Error>> {
    // Get data from primary CRM
    const primaryData = await this.salesCRM.getCustomer(customerId);
    const customerResult = this.translateData(primaryData);

    if (customerResult.isSuccess()) {
      const customer = customerResult.value;

      // Sync to other systems
      await this.syncToSupport(customer);
      await this.syncToMarketing(customer);
    }

    return customerResult;
  }
}
```

### Business Impact

- **Consistency**: 100% data consistency across all CRM systems
- **Efficiency**: 50% reduction in manual data entry
- **Accuracy**: 95% improvement in customer data quality

## Use Case 4: Multi-Vendor Inventory Management

### Business Context

A retail chain manages inventory from multiple suppliers, each providing data in
different formats (CSV, XML, JSON APIs). The ACL creates a unified inventory
view.

### Implementation

```typescript
// Multi-vendor inventory ACL
export class InventoryAggregationACL {
  constructor(private vendors: Map<string, VendorInventoryAPI>) {}

  async getUnifiedInventory(
    productIds: string[]
  ): Promise<Result<Product[], Error>> {
    const products: Product[] = [];
    const errors: string[] = [];

    for (const [vendorId, api] of this.vendors) {
      try {
        const vendorData = await api.getProducts(productIds);
        const acl = new VendorSpecificACL(api);

        for (const data of vendorData) {
          const result = acl.translateData(data);
          if (result.isSuccess()) {
            products.push(result.value);
          } else {
            errors.push(`Vendor ${vendorId}: ${result.error.message}`);
          }
        }
      } catch (error) {
        errors.push(`Vendor ${vendorId} failed: ${error.message}`);
      }
    }

    return products.length > 0
      ? Result.success(products)
      : Result.failure(new Error(`All vendors failed: ${errors.join(', ')}`));
  }
}
```

### Business Impact

- **Visibility**: Real-time inventory across 20+ suppliers
- **Accuracy**: 98% inventory accuracy improvement
- **Cost**: 30% reduction in stockouts and overstock

## Use Case 5: Notification Service Integration

### Business Context

An application uses multiple notification channels (email, SMS, push) from
different providers. The ACL provides a unified notification interface with
consistent error handling.

### Implementation

```typescript
// Notification service ACL
export class NotificationACL extends AntiCorruptionLayer<
  ExternalNotificationResponse,
  NotificationResult
> {
  constructor(
    private emailService: EmailServiceAPI,
    private smsService: SMSServiceAPI,
    private pushService: PushServiceAPI
  ) {
    super(new NotificationResponseTranslator());
  }

  async sendNotification(
    request: NotificationRequest
  ): Promise<Result<NotificationResult, Error>> {
    try {
      let externalResponse: ExternalNotificationResponse;

      switch (request.channel) {
        case 'email':
          externalResponse = await this.emailService.send(
            this.convertToEmailFormat(request)
          );
          break;
        case 'sms':
          externalResponse = await this.smsService.send(
            this.convertToSMSFormat(request)
          );
          break;
        case 'push':
          externalResponse = await this.pushService.send(
            this.convertToPushFormat(request)
          );
          break;
        default:
          return Result.failure(
            new Error(`Unsupported channel: ${request.channel}`)
          );
      }

      return this.translateData(externalResponse);
    } catch (error) {
      return Result.failure(new Error(`Notification failed: ${error.message}`));
    }
  }
}
```

### Business Impact

- **Reliability**: 99.5% notification delivery rate
- **Flexibility**: Easy integration of new notification providers
- **Monitoring**: Unified tracking across all channels

## Common Patterns

### 1. **Data Validation**

- Always validate external data before translation
- Implement fallback values for missing fields
- Log translation failures for monitoring

### 2. **Error Handling**

- Use Result pattern for predictable error management
- Provide meaningful error messages for debugging
- Implement retry logic for transient failures

### 3. **Performance Optimization**

- Cache translation mappings when possible
- Batch operations to reduce API calls
- Implement connection pooling for external services

### 4. **Monitoring and Observability**

- Track translation success/failure rates
- Monitor external API response times
- Alert on data quality issues

## Benefits of Basic ACL Patterns

- **Domain Protection**: Shield internal models from external changes
- **Data Quality**: Ensure consistent, validated data across systems
- **Maintainability**: Centralize external system integration logic
- **Testability**: Mock external dependencies easily in tests
- **Flexibility**: Switch external providers without domain changes

## Next Steps

- Explore
  [Intermediate ACL Patterns](/packages/acl/src/examples/intermediate/use-case.md)
- Learn about
  [Advanced Integration Strategies](/packages/acl/src/examples/advanced/use-case.md)
- Review
  [Framework Integration](/packages/acl/src/examples/frameworks/nestjs/basic/example-1.md)
