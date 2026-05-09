/**
 * Example 1 — Order processing service.
 *
 * A pure async domain service that validates and prices an order across
 * multiple aggregates (Order, Customer, ProductCatalog). The service has
 * no infrastructure dependencies — it operates on plain data and returns
 * a pricing decision.
 *
 * Use case: cart checkout — given a customer and cart contents, compute
 * the final total + applicable discounts before persisting the order.
 *
 * Pattern: stateless service, dependencies via constructor (not DI lookup),
 * `Result<T>` return type for error-as-value.
 */

import { AsyncDomainService, DomainService } from '@vytches/ddd-domain-services';
import { Result } from '@vytches/ddd-utils';

export interface CartItem {
  readonly sku: string;
  readonly unitPrice: number;
  readonly quantity: number;
}

export interface Customer {
  readonly id: string;
  readonly tier: 'free' | 'premium' | 'vip';
  readonly isActive: boolean;
}

export interface PricedOrder {
  readonly subtotal: number;
  readonly discount: number;
  readonly total: number;
}

export class OrderPricingError extends Error {
  constructor(
    message: string,
    public readonly code: 'INACTIVE_CUSTOMER' | 'EMPTY_CART' | 'INVALID_LINE'
  ) {
    super(message);
    this.name = 'OrderPricingError';
  }
}

/**
 * `@DomainService` marks the class for DI auto-discovery (optional).
 * `AsyncDomainService` adds `initialize()` / `dispose()` lifecycle hooks
 * — useful when the service needs to warm a cache or open a connection
 * pool. For stateless services like this one, the defaults (no-op) work.
 */
@DomainService('OrderPricingService')
export class OrderPricingService extends AsyncDomainService {
  constructor() {
    super('OrderPricingService');
  }

  /**
   * Compute the priced order. Returns `Result<PricedOrder, OrderPricingError>`
   * — failure is an expected outcome (inactive customer, empty cart) so
   * we use Result instead of throwing.
   */
  price(customer: Customer, cart: readonly CartItem[]): Result<PricedOrder, OrderPricingError> {
    if (!customer.isActive) {
      return Result.fail(
        new OrderPricingError(`Customer ${customer.id} is not active`, 'INACTIVE_CUSTOMER')
      );
    }
    if (cart.length === 0) {
      return Result.fail(new OrderPricingError('Cart is empty', 'EMPTY_CART'));
    }

    let subtotal = 0;
    for (const line of cart) {
      if (line.quantity <= 0 || line.unitPrice < 0) {
        return Result.fail(
          new OrderPricingError(`Invalid line for SKU ${line.sku}`, 'INVALID_LINE')
        );
      }
      subtotal += line.unitPrice * line.quantity;
    }

    const discount = this.discountFor(customer.tier, subtotal);
    return Result.ok({ subtotal, discount, total: subtotal - discount });
  }

  private discountFor(tier: Customer['tier'], subtotal: number): number {
    if (tier === 'vip') return subtotal * 0.15;
    if (tier === 'premium' && subtotal >= 100) return subtotal * 0.05;
    return 0;
  }
}
