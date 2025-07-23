# NestJS Order Processing ACL - Manual Setup

**Version**: 1.0.0  
**Package**: @vytches-ddd/acl  
**Framework**: NestJS  
**Complexity**: Basic  
**Focus**: Order processing with external payment and inventory systems

## Description

This example shows manual NestJS integration with ACL for order processing,
integrating with external payment gateways and inventory management systems
while maintaining clean domain boundaries.

## Business Context

An e-commerce NestJS application processes orders by coordinating with external
payment processors and inventory systems, using ACL to protect the order domain
from external system variations.

## Code Example

```typescript
// order-processing-acl.service.ts - Order processing ACL
import { Injectable } from '@nestjs/common';
import { AntiCorruptionLayer, IDataTranslator } from '@vytches-ddd/acl';
import { Result } from '@vytches-ddd/utils';
import {
  Order,
  ThirdPartyOrderData,
  PaymentRequest,
  PaymentResult,
  ExternalPaymentResponse,
} from '../types'; // From your application

// Order data translator
export class OrderDataTranslator
  implements IDataTranslator<ThirdPartyOrderData, Order>
{
  translate(external: ThirdPartyOrderData): Result<Order, Error> {
    try {
      if (!external.order_reference || !external.buyer_id) {
        return Result.failure(new Error('Missing required order fields'));
      }

      const order: Order = {
        id: external.order_reference,
        customerId: external.buyer_id,
        items: external.line_items.map(item => ({
          productId: item.product_sku,
          quantity: item.qty,
          unitPrice: item.price_per_unit,
          totalPrice: item.line_total,
        })),
        totalAmount: external.grand_total,
        currency: external.currency,
        status: this.mapOrderStatus(external.order_state),
        createdAt: new Date(external.timestamp * 1000),
        shippingAddress: {
          street: external.delivery_address.address_line_1,
          city: external.delivery_address.city,
          postalCode: external.delivery_address.zip_code,
          country: external.delivery_address.country_code,
        },
      };

      return Result.success(order);
    } catch (error) {
      return Result.failure(
        new Error(`Order translation failed: ${error.message}`)
      );
    }
  }

  private mapOrderStatus(externalStatus: string): Order['status'] {
    const statusMap: Record<string, Order['status']> = {
      new: 'pending',
      processing: 'confirmed',
      shipped: 'shipped',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };

    return statusMap[externalStatus.toLowerCase()] || 'pending';
  }
}

// Payment result translator
export class PaymentResultTranslator
  implements IDataTranslator<ExternalPaymentResponse, PaymentResult>
{
  translate(external: ExternalPaymentResponse): Result<PaymentResult, Error> {
    try {
      const result: PaymentResult = {
        transactionId: external.txn_id,
        status: this.mapPaymentStatus(external.status_code),
        amount: external.amount_charged,
        processingFee: external.fee_amount,
        authorizationCode: external.auth_code,
        errorMessage:
          external.status_code !== 200 ? external.message : undefined,
      };

      return Result.success(result);
    } catch (error) {
      return Result.failure(
        new Error(`Payment translation failed: ${error.message}`)
      );
    }
  }

  private mapPaymentStatus(statusCode: number): PaymentResult['status'] {
    if (statusCode === 200) return 'success';
    if (statusCode >= 400 && statusCode < 500) return 'failed';
    return 'pending';
  }
}

// Main order processing ACL service
@Injectable()
export class OrderProcessingACLService {
  private orderACL: AntiCorruptionLayer<ThirdPartyOrderData, Order>;
  private paymentACL: AntiCorruptionLayer<
    ExternalPaymentResponse,
    PaymentResult
  >;

  constructor(
    private externalOrderAPI: ExternalOrderAPI,
    private paymentGatewayAPI: PaymentGatewayAPI,
    private inventoryAPI: InventoryAPI
  ) {
    this.orderACL = new AntiCorruptionLayer(new OrderDataTranslator());
    this.paymentACL = new AntiCorruptionLayer(new PaymentResultTranslator());
  }

  async processOrder(
    order: Order
  ): Promise<Result<OrderProcessingResult, Error>> {
    try {
      // Step 1: Validate inventory availability
      const inventoryResult = await this.validateInventory(order);
      if (inventoryResult.isFailure()) {
        return inventoryResult;
      }

      // Step 2: Process payment
      const paymentRequest: PaymentRequest = {
        orderId: order.id,
        amount: order.totalAmount,
        currency: order.currency,
        customerId: order.customerId,
        paymentMethod: {
          type: 'credit_card',
          details: {}, // Would be populated from order context
        },
      };

      const paymentResult = await this.processPayment(paymentRequest);
      if (paymentResult.isFailure()) {
        return Result.failure(
          new Error(`Payment failed: ${paymentResult.error.message}`)
        );
      }

      // Step 3: Submit order to external system
      const orderSubmissionResult = await this.submitOrderToExternal(order);
      if (orderSubmissionResult.isFailure()) {
        // Rollback payment if order submission fails
        await this.rollbackPayment(paymentResult.value.transactionId);
        return orderSubmissionResult;
      }

      // Step 4: Reserve inventory
      const reservationResult = await this.reserveInventory(order);
      if (reservationResult.isFailure()) {
        // Rollback both payment and order if inventory reservation fails
        await this.rollbackPayment(paymentResult.value.transactionId);
        await this.cancelExternalOrder(orderSubmissionResult.value.id);
        return reservationResult;
      }

      return Result.success({
        orderId: order.id,
        externalOrderId: orderSubmissionResult.value.id,
        paymentResult: paymentResult.value,
        inventoryReserved: reservationResult.value,
        status: 'processed',
      });
    } catch (error) {
      return Result.failure(
        new Error(`Order processing failed: ${error.message}`)
      );
    }
  }

  private async validateInventory(
    order: Order
  ): Promise<Result<boolean, Error>> {
    try {
      for (const item of order.items) {
        const availability = await this.inventoryAPI.checkAvailability(
          item.productId
        );
        if (availability.quantity < item.quantity) {
          return Result.failure(
            new Error(`Insufficient inventory for product ${item.productId}`)
          );
        }
      }
      return Result.success(true);
    } catch (error) {
      return Result.failure(
        new Error(`Inventory validation failed: ${error.message}`)
      );
    }
  }

  private async processPayment(
    request: PaymentRequest
  ): Promise<Result<PaymentResult, Error>> {
    try {
      const externalRequest = this.convertPaymentRequest(request);
      const externalResponse =
        await this.paymentGatewayAPI.processPayment(externalRequest);
      return this.paymentACL.translateData(externalResponse);
    } catch (error) {
      return Result.failure(
        new Error(`Payment processing failed: ${error.message}`)
      );
    }
  }

  private async submitOrderToExternal(
    order: Order
  ): Promise<Result<Order, Error>> {
    try {
      const externalOrderData = this.convertOrderToExternalFormat(order);
      const submittedData =
        await this.externalOrderAPI.submitOrder(externalOrderData);
      return this.orderACL.translateData(submittedData);
    } catch (error) {
      return Result.failure(
        new Error(`Order submission failed: ${error.message}`)
      );
    }
  }

  private async reserveInventory(
    order: Order
  ): Promise<Result<string[], Error>> {
    try {
      const reservationIds: string[] = [];

      for (const item of order.items) {
        const reservationId = await this.inventoryAPI.reserveItem(
          item.productId,
          item.quantity,
          order.id
        );
        reservationIds.push(reservationId);
      }

      return Result.success(reservationIds);
    } catch (error) {
      return Result.failure(
        new Error(`Inventory reservation failed: ${error.message}`)
      );
    }
  }

  private convertPaymentRequest(
    request: PaymentRequest
  ): ExternalPaymentRequest {
    return {
      order_id: request.orderId,
      amount_cents: Math.round(request.amount * 100),
      currency_code: request.currency,
      customer_id: request.customerId,
      payment_type: request.paymentMethod.type,
      payment_details: request.paymentMethod.details,
    };
  }

  private convertOrderToExternalFormat(order: Order): ThirdPartyOrderData {
    return {
      order_reference: order.id,
      buyer_id: order.customerId,
      line_items: order.items.map(item => ({
        product_sku: item.productId,
        qty: item.quantity,
        price_per_unit: item.unitPrice,
        line_total: item.totalPrice,
      })),
      grand_total: order.totalAmount,
      currency: order.currency,
      order_state: 'new',
      timestamp: Math.floor(order.createdAt.getTime() / 1000),
      delivery_address: {
        address_line_1: order.shippingAddress.street,
        city: order.shippingAddress.city,
        zip_code: order.shippingAddress.postalCode,
        country_code: order.shippingAddress.country,
      },
    };
  }

  private async rollbackPayment(transactionId: string): Promise<void> {
    try {
      await this.paymentGatewayAPI.refundPayment(transactionId);
    } catch (error) {
      // Log error but don't throw - this is a cleanup operation
      console.error(
        `Failed to rollback payment ${transactionId}:`,
        error.message
      );
    }
  }

  private async cancelExternalOrder(orderId: string): Promise<void> {
    try {
      await this.externalOrderAPI.cancelOrder(orderId);
    } catch (error) {
      // Log error but don't throw - this is a cleanup operation
      console.error(
        `Failed to cancel external order ${orderId}:`,
        error.message
      );
    }
  }
}

// order.controller.ts - NestJS controller
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { OrderProcessingACLService } from './order-processing-acl.service';
import { CreateOrderDto } from './dto'; // From your application

@Controller('orders')
export class OrderController {
  constructor(private readonly orderProcessingACL: OrderProcessingACLService) {}

  @Post('process')
  async processOrder(@Body() createOrderDto: CreateOrderDto) {
    try {
      // Convert DTO to domain object
      const order: Order = this.convertDtoToOrder(createOrderDto);

      const result = await this.orderProcessingACL.processOrder(order);

      return result.isSuccess()
        ? { success: true, data: result.value }
        : { success: false, error: result.error.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private convertDtoToOrder(dto: CreateOrderDto): Order {
    return {
      id: this.generateOrderId(),
      customerId: dto.customerId,
      items: dto.items,
      totalAmount: dto.totalAmount,
      currency: dto.currency,
      status: 'pending',
      createdAt: new Date(),
      shippingAddress: dto.shippingAddress,
    };
  }

  private generateOrderId(): string {
    return `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// order.module.ts - Module configuration
import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderProcessingACLService } from './order-processing-acl.service';
import { ExternalOrderAPI } from './external-order.api';
import { PaymentGatewayAPI } from './payment-gateway.api';
import { InventoryAPI } from './inventory.api';

@Module({
  controllers: [OrderController],
  providers: [
    OrderProcessingACLService,
    {
      provide: ExternalOrderAPI,
      useFactory: () =>
        new ExternalOrderAPI({
          baseUrl: process.env.EXTERNAL_ORDER_API_URL,
          apiKey: process.env.EXTERNAL_ORDER_API_KEY,
        }),
    },
    {
      provide: PaymentGatewayAPI,
      useFactory: () =>
        new PaymentGatewayAPI({
          baseUrl: process.env.PAYMENT_GATEWAY_URL,
          merchantId: process.env.PAYMENT_MERCHANT_ID,
          secretKey: process.env.PAYMENT_SECRET_KEY,
        }),
    },
    {
      provide: InventoryAPI,
      useFactory: () =>
        new InventoryAPI({
          baseUrl: process.env.INVENTORY_API_URL,
          apiKey: process.env.INVENTORY_API_KEY,
        }),
    },
  ],
  exports: [OrderProcessingACLService],
})
export class OrderModule {}

// Supporting types
interface OrderProcessingResult {
  orderId: string;
  externalOrderId: string;
  paymentResult: PaymentResult;
  inventoryReserved: string[];
  status: string;
}

interface ExternalPaymentRequest {
  order_id: string;
  amount_cents: number;
  currency_code: string;
  customer_id: string;
  payment_type: string;
  payment_details: Record<string, any>;
}
```

## Key Features

- **Multi-System Coordination**: Integrates payment, inventory, and order
  systems
- **Transaction Management**: Proper rollback handling for failed operations
- **Data Translation**: Clean conversion between external and domain formats
- **Error Recovery**: Comprehensive error handling with cleanup operations

## Common Pitfalls

- **Transaction Boundaries**: Ensure proper rollback of all operations on
  failure
- **External Dependencies**: Mock external APIs properly in tests
- **Error Propagation**: Handle partial failures gracefully

## Related Examples

- [Customer ACL Integration](/packages/acl/src/examples/frameworks/nestjs/basic/example-1.md)
- [Advanced Multi-System Integration](/packages/acl/src/examples/intermediate/example-2.md)
