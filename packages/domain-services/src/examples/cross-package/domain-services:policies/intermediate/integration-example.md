// Domain Service with Policy Integration
import { BaseDomainService } from '@vytches-ddd/domain-services';
import { PolicyBuilder, PolicyContext } from '@vytches-ddd/policies';
import { Result } from '@vytches-ddd/utils';
import { User, Order, CreateOrderCommand } from '../types';

export class OrderValidationService extends BaseDomainService {
  private orderPolicy = PolicyBuilder.create<Order>()
    .withId('order-validation')
    .withDomain('orders')
    .must(order => order.total > 0)
    .withCode('INVALID_TOTAL')
    .withMessage('Order total must be greater than zero')
    .and()
    .must(order => order.items.length > 0)
    .withCode('NO_ITEMS')
    .withMessage('Order must contain at least one item')
    .and()
    .mustAsync(async order => {
      const user = await this.getUserById(order.userId);
      return user && user.isActive;
    })
    .withCode('INVALID_USER')
    .withMessage('Order user must be active')
    .build();

  constructor() {
    super('OrderValidationService');
  }

  async validateAndCreateOrder(command: CreateOrderCommand): Promise<Result<Order, Error>> {
    try {
      // Step 1: Create order from command
      const order = Order.create(command);

      // Step 2: Create policy context
      const context = PolicyContext.create()
        .withUserId(command.userId)
        .withRequestId(command.requestId)
        .withSessionId(command.sessionId)
        .build();

      // Step 3: Validate order with policy
      const validationResult = await this.orderPolicy.check({ entity: order, context });

      if (validationResult.isFailure()) {
        const violations = validationResult.error.violations;
        const errorMessage = violations.map(v => v.message).join(', ');
        return Result.failure(new Error(`Order validation failed: ${errorMessage}`));
      }

      // Step 4: Apply business rules
      const businessRulesResult = await this.applyBusinessRules(order, context);
      if (businessRulesResult.isFailure()) {
        return Result.failure(businessRulesResult.error);
      }

      return Result.success(order);

    } catch (error) {
      return Result.failure(new Error(`Order validation failed: ${error.message}`));
    }
  }

  async validateOrderBatch(commands: CreateOrderCommand[]): Promise<Result<Order[], Error>> {
    const validOrders: Order[] = [];
    const errors: string[] = [];

    for (const command of commands) {
      const result = await this.validateAndCreateOrder(command);
      
      if (result.isSuccess()) {
        validOrders.push(result.value!);
      } else {
        errors.push(`Order ${command.id}: ${result.error.message}`);
      }
    }

    if (errors.length > 0) {
      return Result.failure(new Error(`Batch validation failed: ${errors.join('; ')}`));
    }

    return Result.success(validOrders);
  }

  private async getUserById(userId: string): Promise<User | null> {
    // Get user logic here
    return { id: userId, isActive: true } as User;
  }

  private async applyBusinessRules(order: Order, context: PolicyContext): Promise<Result<void, Error>> {
    // Additional business rules logic
    return Result.success(undefined);
  }
}