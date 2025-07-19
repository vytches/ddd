// Domain Service with Repository Integration
import { BaseDomainService } from '@vytches-ddd/domain-services';
import { IBaseRepository } from '@vytches-ddd/repositories';
import { Result } from '@vytches-ddd/utils';
import { User, Order, CreateOrderCommand } from '../types';

export class OrderManagementService extends BaseDomainService {
  constructor(
    private readonly userRepository: IBaseRepository<User>,
    private readonly orderRepository: IBaseRepository<Order>
  ) {
    super('OrderManagementService');
  }

  async createOrder(command: CreateOrderCommand): Promise<Result<Order, Error>> {
    try {
      // Step 1: Load user using repository
      const user = await this.userRepository.findById(command.userId);
      if (!user) {
        return Result.failure(new Error('User not found'));
      }

      // Step 2: Create order aggregate
      const order = Order.create({
        userId: command.userId,
        items: command.items,
        total: command.total
      });

      // Step 3: Save order using repository (automatically publishes events)
      await this.orderRepository.save(order);

      return Result.success(order);

    } catch (error) {
      return Result.failure(new Error(`Order creation failed: ${error.message}`));
    }
  }

  async processOrderBatch(commands: CreateOrderCommand[]): Promise<Result<Order[], Error>> {
    const orders: Order[] = [];
    const errors: Error[] = [];

    for (const command of commands) {
      const result = await this.createOrder(command);
      
      if (result.isSuccess()) {
        orders.push(result.value!);
      } else {
        errors.push(result.error);
      }
    }

    if (errors.length > 0) {
      return Result.failure(new Error(`Failed to process ${errors.length} orders`));
    }

    return Result.success(orders);
  }
}