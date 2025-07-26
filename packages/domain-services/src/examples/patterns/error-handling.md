// Error Handling Pattern for Domain Services import { BaseDomainService } from
'@vytches/ddd-domain-services'; import { Result } from '@vytches/ddd-utils';
import { DomainError } from '@vytches/ddd-domain-primitives';

export class OrderProcessingService extends BaseDomainService { async
processOrder(orderId: string): Promise<Result<Order, Error>> { try { // Step 1:
Validate with specific error types const validation = await
this.validateOrder(orderId); if (validation.isFailure()) { return
Result.failure( new DomainError( 'ORDER_VALIDATION_FAILED',
`Order ${orderId} validation failed: ${validation.error.message}` ) ); }

      // Step 2: Process with error context
      const order = await this.loadOrder(orderId);
      if (!order) {
        return Result.failure(
          new DomainError(
            'ORDER_NOT_FOUND',
            `Order ${orderId} not found`
          )
        );
      }

      // Step 3: Handle external service errors
      try {
        await this.processPayment(order);
      } catch (paymentError) {
        return Result.failure(
          new DomainError(
            'PAYMENT_PROCESSING_FAILED',
            `Payment failed for order ${orderId}`,
            { originalError: paymentError }
          )
        );
      }

      // Step 4: Return success
      return Result.success(order);

    } catch (error) {
      // Catch-all for unexpected errors
      return Result.failure(
        new DomainError(
          'ORDER_PROCESSING_ERROR',
          `Unexpected error processing order ${orderId}`,
          { originalError: error }
        )
      );
    }

}

// Error aggregation pattern async processMultipleOrders(orderIds: string[]):
Promise<Result<ProcessingReport, Error>> { const errors: DomainError[] = [];
const processed: Order[] = [];

    for (const orderId of orderIds) {
      const result = await this.processOrder(orderId);

      if (result.isFailure()) {
        errors.push(result.error as DomainError);
      } else {
        processed.push(result.value!);
      }
    }

    if (errors.length > 0) {
      return Result.failure(
        new DomainError(
          'BATCH_PROCESSING_PARTIAL_FAILURE',
          `Failed to process ${errors.length} out of ${orderIds.length} orders`,
          { errors, processed }
        )
      );
    }

    return Result.success({
      totalProcessed: processed.length,
      orders: processed
    });

} }
