## Intermediate Use Case: E-commerce Order Processing

This example demonstrates a domain service orchestrating a complete order
processing workflow:

```typescript
// order-processing-example.ts
import { OrderProcessingService } from './services/order-processing.service';
import {
  CreateOrderCommand,
  OrderRepository,
  InventoryService,
  PricingService,
} from './domain';

async function processCustomerOrder(customerId: string, cartItems: CartItem[]) {
  // Initialize dependencies
  const orderRepo = new OrderRepository();
  const inventoryService = new InventoryService();
  const pricingService = new PricingService();

  // Create service instance
  const orderService = new OrderProcessingService(
    orderRepo,
    inventoryService,
    pricingService
  );

  // Prepare command
  const command: CreateOrderCommand = {
    customerId,
    items: cartItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.price,
    })),
    shippingAddress: await getCustomerAddress(customerId),
    paymentMethodId: await getDefaultPaymentMethod(customerId),
  };

  // Process order
  const result = await orderService.createOrder(command);

  if (result.isSuccess()) {
    const order = result.value;
    console.log(`Order ${order.id} created successfully`);
    console.log(`Total amount: $${order.totalAmount}`);

    // Trigger additional workflows
    await notifyCustomer(order);
    await initializeShipping(order);

    return { success: true, orderId: order.id };
  } else {
    console.error('Order processing failed:', result.error.message);

    // Handle specific failures
    if (result.error.message.includes('inventory')) {
      await notifyOutOfStock(command.items);
    }

    return { success: false, error: result.error.message };
  }
}
```

## Event-Driven Integration

```typescript
// Listen for domain events published by the service
import { EventBus } from '@vytches/ddd-events';

const eventBus = new EventBus();

// Subscribe to order events
eventBus.subscribe('OrderCreated', async event => {
  console.log('New order created:', event.payload.orderId);

  // Trigger downstream processes
  await updateAnalytics(event.payload);
  await sendOrderConfirmation(event.payload);
  await notifyWarehouse(event.payload);
});

eventBus.subscribe('InventoryReserved', async event => {
  console.log('Inventory reserved for order:', event.payload.orderId);
  await updateInventoryDashboard(event.payload);
});
```

## Handling Complex Scenarios

```typescript
// Bulk order processing with partial failures
async function processBulkOrders(orders: CreateOrderCommand[]) {
  const orderService = createOrderService(); // Helper to create service
  const results = {
    successful: [] as string[],
    failed: [] as { orderId: string; reason: string }[],
  };

  for (const orderCommand of orders) {
    const result = await orderService.createOrder(orderCommand);

    if (result.isSuccess()) {
      results.successful.push(result.value.id);
    } else {
      results.failed.push({
        orderId: orderCommand.tempId || 'unknown',
        reason: result.error.message,
      });
    }
  }

  // Report results
  console.log(`Processed ${orders.length} orders:`);
  console.log(`✓ Successful: ${results.successful.length}`);
  console.log(`✗ Failed: ${results.failed.length}`);

  return results;
}

// Retry logic for transient failures
async function processOrderWithRetry(
  command: CreateOrderCommand,
  maxRetries = 3
): Promise<Result<Order, Error>> {
  const orderService = createOrderService();
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await orderService.createOrder(command);

    if (result.isSuccess()) {
      return result;
    }

    lastError = result.error;

    // Only retry on specific errors
    if (!isRetryableError(lastError)) {
      return result;
    }

    console.log(`Attempt ${attempt} failed, retrying...`);
    await sleep(attempt * 1000); // Exponential backoff
  }

  return Result.failure(lastError!);
}
```
