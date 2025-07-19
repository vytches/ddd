// Intermediate Domain Service Implementation
import { BaseDomainService } from '@vytches-ddd/domain-services';
import { Result } from '@vytches-ddd/utils';
import { DomainEvent } from '@vytches-ddd/events';
import { 
  Order, 
  OrderItem, 
  CreateOrderCommand,
  OrderCreatedEvent,
  InventoryService,
  PricingService,
  OrderRepository
} from '../types';

export class OrderProcessingService extends BaseDomainService {
  constructor(
    private orderRepository: OrderRepository,
    private inventoryService: InventoryService,
    private pricingService: PricingService
  ) {
    super('OrderProcessingService');
  }

  async createOrder(command: CreateOrderCommand): Promise<Result<Order, Error>> {
    try {
      // Step 1: Validate order items
      const validation = await this.validateOrderItems(command.items);
      if (validation.isFailure()) {
        return validation;
      }

      // Step 2: Check inventory
      const inventoryCheck = await this.checkInventory(command.items);
      if (inventoryCheck.isFailure()) {
        return inventoryCheck;
      }

      // Step 3: Calculate pricing
      const pricingResult = await this.calculatePricing(command.items);
      if (pricingResult.isFailure()) {
        return pricingResult;
      }

      // Step 4: Create order aggregate
      const order: Order = {
        id: this.generateOrderId(),
        customerId: command.customerId,
        items: command.items,
        totalAmount: pricingResult.value!,
        status: 'pending',
        createdAt: new Date()
      };

      // Step 5: Reserve inventory
      await this.inventoryService.reserveItems(order.id, command.items);

      // Step 6: Save order
      await this.orderRepository.save(order);

      // Step 7: Publish domain event
      const event: OrderCreatedEvent = {
        orderId: order.id,
        customerId: order.customerId,
        totalAmount: order.totalAmount,
        itemCount: order.items.length,
        timestamp: new Date()
      };
      
      await this.publishEvent(new DomainEvent(
        'OrderCreated',
        event,
        { contextId: order.id }
      ));

      return Result.success(order);

    } catch (error) {
      // Rollback inventory reservation if needed
      return Result.failure(
        new Error(`Order creation failed: ${error.message}`)
      );
    }
  }

  private async validateOrderItems(items: OrderItem[]): Promise<Result<void, Error>> {
    if (!items || items.length === 0) {
      return Result.failure(new Error('Order must contain at least one item'));
    }

    for (const item of items) {
      if (item.quantity <= 0) {
        return Result.failure(
          new Error(`Invalid quantity for item ${item.productId}`)
        );
      }
    }

    return Result.success();
  }

  private async checkInventory(items: OrderItem[]): Promise<Result<void, Error>> {
    const availability = await this.inventoryService.checkAvailability(items);
    
    if (!availability.allAvailable) {
      const unavailable = availability.unavailableItems.join(', ');
      return Result.failure(
        new Error(`Items not available: ${unavailable}`)
      );
    }

    return Result.success();
  }

  private async calculatePricing(items: OrderItem[]): Promise<Result<number, Error>> {
    try {
      const total = await this.pricingService.calculateTotal(items);
      return Result.success(total);
    } catch (error) {
      return Result.failure(
        new Error(`Pricing calculation failed: ${error.message}`)
      );
    }
  }

  private generateOrderId(): string {
    return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}