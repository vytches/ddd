# Railway-Oriented Programming

**Version**: 1.0.0 **Package**: @vytches/ddd-utils **Complexity**: advanced
**Domain**: Infrastructure **Patterns**: Railway programming, functional
pipelines, composable operations **Dependencies**: @vytches/ddd-utils

## Description

Railway-oriented programming (ROP) is a functional programming pattern that
treats operations as railway tracks where success continues on the main track
and failures are diverted to an error track. This example demonstrates advanced
railway programming patterns using Result types for building robust, composable
data processing pipelines.

## Business Context

Complex business processes often involve multiple sequential operations where
any step can fail:

- Data processing pipelines with transformation and validation
- Multi-step business workflows with branching logic
- Integration flows with multiple external systems
- Complex validation scenarios with early termination

Railway-oriented programming ensures that once an error occurs, subsequent
operations are bypassed, preventing cascading failures and providing clear error
tracking.

## Code Example

```typescript
// railway-programming.ts
import { Result, LibUtils } from '@vytches/ddd-utils';
import {
  UserData,
  ValidationError,
  Railway,
  Pipeline,
  ChainableOperation,
} from '../types';

// ✅ FOCUS: Railway-oriented programming patterns
export class RailwayOrientedProgramming {
  // 1. Basic Railway Implementation
  createRailway<T, E = Error>(initialValue: T): Railway<T, E> {
    return {
      isSuccess: true,
      value: initialValue,
      error: undefined,
      continue: function <U>(fn: (value: T) => Railway<U, E>): Railway<U, E> {
        if (!this.isSuccess) {
          return {
            isSuccess: false,
            value: undefined,
            error: this.error,
            continue: (fn: any) => this.continue(fn),
            recover: (fn: any) => this.recover(fn),
            tap: (fn: any) => this,
            tapError: (fn: any) => this,
          };
        }
        return fn(this.value!);
      },
      recover: function (fn: (error: E) => Railway<T, E>): Railway<T, E> {
        if (this.isSuccess) {
          return this;
        }
        return fn(this.error!);
      },
      tap: function (fn: (value: T) => void): Railway<T, E> {
        if (this.isSuccess && this.value !== undefined) {
          fn(this.value);
        }
        return this;
      },
      tapError: function (fn: (error: E) => void): Railway<T, E> {
        if (!this.isSuccess && this.error !== undefined) {
          fn(this.error);
        }
        return this;
      },
    };
  }

  private createSuccessRailway<T, E>(value: T): Railway<T, E> {
    return this.createRailway<T, E>(value);
  }

  private createFailureRailway<T, E>(error: E): Railway<T, E> {
    return {
      isSuccess: false,
      value: undefined,
      error,
      continue: function <U>(fn: (value: T) => Railway<U, E>): Railway<U, E> {
        return {
          isSuccess: false,
          value: undefined,
          error: this.error,
          continue: (fn: any) => this.continue(fn),
          recover: (fn: any) => this.recover(fn),
          tap: (fn: any) => this,
          tapError: (fn: any) => this,
        };
      },
      recover: function (fn: (error: E) => Railway<T, E>): Railway<T, E> {
        return fn(this.error!);
      },
      tap: function (fn: (value: T) => void): Railway<T, E> {
        return this;
      },
      tapError: function (fn: (error: E) => void): Railway<T, E> {
        if (this.error !== undefined) {
          fn(this.error);
        }
        return this;
      },
    };
  }

  // 2. User Registration Railway Pipeline
  processUserRegistration(userData: any): Railway<UserData, string> {
    return this.createSuccessRailway<any, string>(userData)
      .continue(this.validateInput.bind(this))
      .continue(this.normalizeData.bind(this))
      .continue(this.checkBusinessRules.bind(this))
      .continue(this.createUser.bind(this))
      .continue(this.persistUser.bind(this))
      .tap(user => console.log(`User registered: ${user.name} (${user.id})`))
      .tapError(error => console.error(`Registration failed: ${error}`));
  }

  private validateInput(data: any): Railway<any, string> {
    if (!data || typeof data !== 'object') {
      return this.createFailureRailway('Invalid input data');
    }

    if (LibUtils.isEmpty(data.email)) {
      return this.createFailureRailway('Email is required');
    }

    if (!data.email.includes('@')) {
      return this.createFailureRailway('Invalid email format');
    }

    if (LibUtils.isEmpty(data.name)) {
      return this.createFailureRailway('Name is required');
    }

    if (data.name.trim().length < 2) {
      return this.createFailureRailway('Name must be at least 2 characters');
    }

    return this.createSuccessRailway(data);
  }

  private normalizeData(data: any): Railway<any, string> {
    try {
      const normalized = {
        email: data.email.toLowerCase().trim(),
        name: data.name.trim(),
        phone: data.phone?.trim() || '',
        role: data.role || 'user',
      };

      return this.createSuccessRailway(normalized);
    } catch (error) {
      return this.createFailureRailway(
        `Data normalization failed: ${(error as Error).message}`
      );
    }
  }

  private checkBusinessRules(data: any): Railway<any, string> {
    // Business rule: No test emails
    if (
      data.email.includes('test') &&
      !data.email.includes('testing@company.com')
    ) {
      return this.createFailureRailway('Test emails are not allowed');
    }

    // Business rule: Admin emails must be from company domain
    if (data.role === 'admin' && !data.email.endsWith('@company.com')) {
      return this.createFailureRailway('Admin users must have company email');
    }

    // Business rule: Name cannot contain special characters except spaces, hyphens, apostrophes
    if (!/^[a-zA-Z\s'-]+$/.test(data.name)) {
      return this.createFailureRailway('Name contains invalid characters');
    }

    return this.createSuccessRailway(data);
  }

  private createUser(data: any): Railway<UserData, string> {
    try {
      const user: UserData = {
        id: LibUtils.getUUID(),
        email: data.email,
        name: data.name,
        role: data.role,
        createdAt: new Date(),
      };

      return this.createSuccessRailway(user);
    } catch (error) {
      return this.createFailureRailway(
        `User creation failed: ${(error as Error).message}`
      );
    }
  }

  private persistUser(user: UserData): Railway<UserData, string> {
    // Simulate database persistence
    if (user.email === 'fail@example.com') {
      return this.createFailureRailway('Database connection failed');
    }

    // Simulate some persistence logic
    const persistedUser = {
      ...user,
      createdAt: new Date(),
    };

    return this.createSuccessRailway(persistedUser);
  }

  // 3. Data Processing Pipeline with Recovery
  processDataWithRecovery(rawData: string): Railway<any, string> {
    return this.createSuccessRailway<string, string>(rawData)
      .continue(this.parseJson.bind(this))
      .recover(this.attemptCsvParse.bind(this)) // Fallback to CSV parsing
      .continue(this.validateStructure.bind(this))
      .continue(this.enrichData.bind(this))
      .recover(this.useDefaultData.bind(this)) // Fallback to defaults
      .tap(data =>
        console.log(`Processed ${data.records?.length || 0} records`)
      )
      .tapError(error => console.error(`Processing failed: ${error}`));
  }

  private parseJson(data: string): Railway<any, string> {
    try {
      const parsed = JSON.parse(data);
      return this.createSuccessRailway(parsed);
    } catch (error) {
      return this.createFailureRailway(
        `JSON parsing failed: ${(error as Error).message}`
      );
    }
  }

  private attemptCsvParse(error: string): Railway<any, string> {
    console.log(`JSON failed (${error}), trying CSV...`);

    // Simple CSV parsing simulation
    try {
      // This would be actual CSV parsing logic
      const mockCsvData = {
        format: 'csv',
        records: [
          { name: 'John', email: 'john@example.com' },
          { name: 'Jane', email: 'jane@example.com' },
        ],
      };

      return this.createSuccessRailway(mockCsvData);
    } catch (csvError) {
      return this.createFailureRailway(`Both JSON and CSV parsing failed`);
    }
  }

  private validateStructure(data: any): Railway<any, string> {
    if (!data || typeof data !== 'object') {
      return this.createFailureRailway('Data must be an object');
    }

    if (!Array.isArray(data.records) && !data.users && !data.items) {
      return this.createFailureRailway(
        'Data must contain records, users, or items array'
      );
    }

    return this.createSuccessRailway(data);
  }

  private enrichData(data: any): Railway<any, string> {
    try {
      const enriched = {
        ...data,
        processedAt: new Date(),
        recordCount:
          data.records?.length || data.users?.length || data.items?.length || 0,
        metadata: {
          processor: 'railway-pipeline',
          version: '1.0.0',
        },
      };

      return this.createSuccessRailway(enriched);
    } catch (error) {
      return this.createFailureRailway(
        `Data enrichment failed: ${(error as Error).message}`
      );
    }
  }

  private useDefaultData(error: string): Railway<any, string> {
    console.log(`Enrichment failed (${error}), using defaults...`);

    const defaultData = {
      records: [],
      processedAt: new Date(),
      recordCount: 0,
      metadata: {
        processor: 'railway-pipeline-fallback',
        version: '1.0.0',
      },
      error: 'Used fallback data due to processing failure',
    };

    return this.createSuccessRailway(defaultData);
  }

  // 4. Complex Business Workflow with Branching
  processOrderWorkflow(orderData: any): Railway<any, string> {
    return this.createSuccessRailway<any, string>(orderData)
      .continue(this.validateOrder.bind(this))
      .continue(this.calculatePricing.bind(this))
      .continue(this.checkInventory.bind(this))
      .continue(this.applyDiscounts.bind(this))
      .continue(this.processPayment.bind(this))
      .continue(this.createOrderRecord.bind(this))
      .continue(this.sendConfirmation.bind(this))
      .tap(order => console.log(`Order completed: ${order.orderId}`))
      .tapError(error => console.error(`Order failed: ${error}`));
  }

  private validateOrder(data: any): Railway<any, string> {
    const errors: string[] = [];

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('Order must contain items');
    }

    if (!data.customer || !data.customer.id) {
      errors.push('Customer information is required');
    }

    if (!data.shippingAddress) {
      errors.push('Shipping address is required');
    }

    if (errors.length > 0) {
      return this.createFailureRailway(
        `Order validation failed: ${errors.join(', ')}`
      );
    }

    return this.createSuccessRailway(data);
  }

  private calculatePricing(data: any): Railway<any, string> {
    try {
      let subtotal = 0;
      const itemsWithPricing = data.items.map((item: any) => {
        const price = item.price || 10; // Default price
        const quantity = item.quantity || 1;
        const total = price * quantity;
        subtotal += total;

        return { ...item, price, quantity, total };
      });

      const tax = subtotal * 0.08; // 8% tax
      const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
      const total = subtotal + tax + shipping;

      const pricedOrder = {
        ...data,
        items: itemsWithPricing,
        pricing: {
          subtotal,
          tax,
          shipping,
          total,
        },
      };

      return this.createSuccessRailway(pricedOrder);
    } catch (error) {
      return this.createFailureRailway(
        `Pricing calculation failed: ${(error as Error).message}`
      );
    }
  }

  private checkInventory(data: any): Railway<any, string> {
    // Simulate inventory check
    const unavailableItems = data.items.filter(
      (item: any) => item.id === 'out-of-stock-item'
    );

    if (unavailableItems.length > 0) {
      return this.createFailureRailway(
        `Items out of stock: ${unavailableItems.map((i: any) => i.name).join(', ')}`
      );
    }

    return this.createSuccessRailway(data);
  }

  private applyDiscounts(data: any): Railway<any, string> {
    try {
      let discountAmount = 0;
      const discounts: string[] = [];

      // First-time customer discount
      if (data.customer.isFirstTime) {
        discountAmount += data.pricing.subtotal * 0.1; // 10%
        discounts.push('First-time customer (10%)');
      }

      // Large order discount
      if (data.pricing.subtotal > 500) {
        discountAmount += 50; // $50 off
        discounts.push('Large order ($50 off)');
      }

      // Loyalty discount
      if (data.customer.loyaltyPoints > 1000) {
        discountAmount += 25; // $25 off
        discounts.push('Loyalty member ($25 off)');
      }

      const finalTotal = Math.max(data.pricing.total - discountAmount, 0);

      const discountedOrder = {
        ...data,
        pricing: {
          ...data.pricing,
          discountAmount,
          discounts,
          finalTotal,
        },
      };

      return this.createSuccessRailway(discountedOrder);
    } catch (error) {
      return this.createFailureRailway(
        `Discount calculation failed: ${(error as Error).message}`
      );
    }
  }

  private processPayment(data: any): Railway<any, string> {
    // Simulate payment processing
    if (data.payment?.method === 'failed_card') {
      return this.createFailureRailway('Payment declined: Insufficient funds');
    }

    if (data.pricing.finalTotal > 10000) {
      return this.createFailureRailway(
        'Payment declined: Amount exceeds limit'
      );
    }

    const paymentResult = {
      transactionId: LibUtils.getUUID(),
      method: data.payment?.method || 'credit_card',
      amount: data.pricing.finalTotal,
      processedAt: new Date(),
    };

    const paidOrder = {
      ...data,
      payment: paymentResult,
    };

    return this.createSuccessRailway(paidOrder);
  }

  private createOrderRecord(data: any): Railway<any, string> {
    try {
      const order = {
        ...data,
        orderId: LibUtils.getUUID(),
        status: 'confirmed',
        createdAt: new Date(),
        estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      return this.createSuccessRailway(order);
    } catch (error) {
      return this.createFailureRailway(
        `Order creation failed: ${(error as Error).message}`
      );
    }
  }

  private sendConfirmation(data: any): Railway<any, string> {
    // Simulate email service that might be down
    if (data.customer.email === 'no-email@example.com') {
      return this.createFailureRailway('Email service unavailable');
    }

    const confirmation = {
      ...data,
      confirmation: {
        emailSent: true,
        sentAt: new Date(),
        confirmationNumber: `ORD-${Date.now()}`,
      },
    };

    return this.createSuccessRailway(confirmation);
  }

  // 5. Parallel Railway Processing
  processMultipleOrdersConcurrently(
    orders: any[]
  ): Promise<Array<Railway<any, string>>> {
    const orderPromises = orders.map(async (order, index) => {
      // Add artificial delay to simulate processing
      await LibUtils.sleep(Math.random() * 1000);

      const result = this.processOrderWorkflow({
        ...order,
        processingIndex: index,
      });

      return result;
    });

    return Promise.all(orderPromises);
  }

  // 6. Railway Composition and Reusability
  createReusableValidationPipeline(): (data: any) => Railway<any, string> {
    return (data: any) => {
      return this.createSuccessRailway<any, string>(data)
        .continue(this.validateInput.bind(this))
        .continue(this.normalizeData.bind(this))
        .continue(this.checkBusinessRules.bind(this));
    };
  }

  createReusablePersistencePipeline(): (data: any) => Railway<any, string> {
    return (data: any) => {
      return this.createSuccessRailway<any, string>(data)
        .continue(this.createUser.bind(this))
        .continue(this.persistUser.bind(this));
    };
  }

  // Compose reusable pipelines
  processUserWithReusablePipelines(userData: any): Railway<UserData, string> {
    const validationPipeline = this.createReusableValidationPipeline();
    const persistencePipeline = this.createReusablePersistencePipeline();

    return validationPipeline(userData)
      .continue(validatedData => persistencePipeline(validatedData))
      .tap(user =>
        console.log(`User processed via reusable pipelines: ${user.name}`)
      )
      .tapError(error => console.error(`Pipeline processing failed: ${error}`));
  }
}
```

## Key Features

- **Two-Track Architecture**: Success track continues, error track bypasses
  subsequent operations
- **Composable Operations**: Build complex workflows from simple, reusable
  functions
- **Automatic Error Propagation**: Errors automatically flow through the
  pipeline without manual checking
- **Recovery Mechanisms**: Ability to recover from errors and continue on
  success track
- **Side Effects**: `tap` and `tapError` for logging and monitoring without
  affecting flow
- **Branching Logic**: Conditional processing based on data or error states

## Usage Examples

```typescript
const railway = new RailwayOrientedProgramming();

// User registration with railway
const userData = { email: 'john@example.com', name: 'John Doe' };
const registrationResult = railway.processUserRegistration(userData);

if (registrationResult.isSuccess) {
  console.log('User registered:', registrationResult.value?.name);
} else {
  console.error('Registration failed:', registrationResult.error);
}

// Data processing with recovery
const rawData = '{"users": [{"name": "Alice", "email": "alice@example.com"}]}';
const processingResult = railway.processDataWithRecovery(rawData);

// Order workflow
const orderData = {
  items: [{ id: 'item1', name: 'Widget', price: 25, quantity: 2 }],
  customer: { id: 'cust1', name: 'Customer', isFirstTime: true },
  shippingAddress: { street: '123 Main St', city: 'City', state: 'ST' },
  payment: { method: 'credit_card' },
};

const orderResult = railway.processOrderWorkflow(orderData);

// Reusable pipeline composition
const composedResult = railway.processUserWithReusablePipelines(userData);

// Parallel processing
const multipleOrders = [orderData, { ...orderData, customer: { id: 'cust2' } }];
const parallelResults =
  await railway.processMultipleOrdersConcurrently(multipleOrders);
```

## Railway Programming Benefits

### **Error Handling**

- **Automatic Propagation**: Errors bypass subsequent operations automatically
- **Type Safety**: Compile-time guarantees about success/failure paths
- **Clean Code**: No nested try/catch blocks or error checking boilerplate

### **Composability**

- **Function Composition**: Easily chain operations together
- **Reusability**: Create reusable pipeline components
- **Testability**: Each operation can be tested independently

### **Readability**

- **Linear Flow**: Code reads like a sequence of operations
- **Clear Intent**: Success and error paths are explicit
- **Domain Focus**: Business logic is not obscured by error handling

## Common Patterns

### **Validation Pipelines**

Chain multiple validation steps with early termination on first failure.

### **Data Transformation**

Transform data through multiple stages with error recovery.

### **Business Workflows**

Model complex business processes with branching and error handling.

### **Integration Flows**

Handle external system integration with fallback mechanisms.

## Best Practices

- **Small Functions**: Keep each railway operation focused and testable
- **Pure Functions**: Avoid side effects in main railway operations (use tap for
  side effects)
- **Error Context**: Provide meaningful error messages for debugging
- **Recovery Points**: Plan where recovery makes business sense
- **Logging**: Use tap and tapError for observability

## Common Pitfalls

- **Overuse of Recovery**: Don't recover from every error - some should
  terminate the flow
- **Complex Operations**: Keep railway functions simple - complex logic should
  be extracted
- **Missing Error Context**: Provide enough information in errors for
  troubleshooting
- **Ignoring Performance**: Long railway chains can impact performance

## Related Examples

- [Monadic Operations](./example-1.md)
- [Advanced Result Patterns](../intermediate/example-1.md)
- [Performance-Optimized Utilities](./example-3.md)
