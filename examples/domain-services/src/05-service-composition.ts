/**
 * Example 5 — Service composition (high-level service uses lower-level ones).
 *
 * `CheckoutService` orchestrates `OrderPricingService` + `InventoryReservationService`
 * + `PaymentOrchestrationService`. The composition lives in the domain
 * service layer (not infrastructure), so it stays testable with stubs.
 *
 * Use case: cart checkout end-to-end — price the order, reserve inventory,
 * authorize payment. Each step's failure aborts the flow at a domain
 * boundary (no half-checkouts).
 *
 * Pattern: depend on abstractions (other domain services as constructor
 * args), not implementations. The DI container wires the concrete tree.
 */

import { AsyncDomainService, DomainService } from '@vytches/ddd-domain-services';
import { Result } from '@vytches/ddd-utils';

import {
  OrderPricingService,
  type CartItem,
  type Customer,
  type PricedOrder,
} from './01-order-processing';
import { InventoryReservationService } from './03-inventory-management';
import { PaymentOrchestrationService } from './02-payment-orchestration';

export interface CheckoutResult {
  readonly orderId: string;
  readonly priced: PricedOrder;
  readonly reservationIds: string[];
  readonly authCode: string;
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly stage: 'pricing' | 'inventory' | 'payment',
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

@DomainService('CheckoutService')
export class CheckoutService extends AsyncDomainService {
  constructor(
    private readonly pricing: OrderPricingService,
    private readonly inventory: InventoryReservationService,
    private readonly payments: PaymentOrchestrationService
  ) {
    super('CheckoutService');
  }

  async checkout(
    customer: Customer,
    cart: readonly CartItem[],
    currency: string = 'USD'
  ): Promise<Result<CheckoutResult, CheckoutError>> {
    // Step 1 — price.
    const priceResult = this.pricing.price(customer, cart);
    if (priceResult.isFailure) {
      return Result.fail(
        new CheckoutError(priceResult.error.message, 'pricing', priceResult.error)
      );
    }
    const priced = priceResult.value;

    // Step 2 — reserve every line. Roll back any successful reservations
    // on the first failure (compensate).
    const reservationIds: string[] = [];
    for (const line of cart) {
      const r = this.inventory.reserve(line.sku, line.quantity);
      if (r.isFailure) {
        for (const id of reservationIds) this.inventory.release(id);
        return Result.fail(new CheckoutError(r.error.message, 'inventory', r.error));
      }
      reservationIds.push(r.value);
    }

    // Step 3 — authorize payment.
    const orderId = `ord-${Date.now()}`;
    const auth = await this.payments.authorize(orderId, priced.total, currency);
    if (auth.isFailure) {
      // Compensate: release all reservations.
      for (const id of reservationIds) this.inventory.release(id);
      return Result.fail(new CheckoutError(auth.error.reason, 'payment', auth.error));
    }

    // Step 4 — confirm reservations on successful auth.
    for (const id of reservationIds) this.inventory.confirm(id);

    return Result.ok({
      orderId,
      priced,
      reservationIds,
      authCode: auth.value.authCode,
    });
  }
}
