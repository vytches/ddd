import { describe, it, expect, beforeEach } from 'vitest';

import { OrderPricingService } from '../src/01-order-processing';
import {
  PaymentOrchestrationService,
  PaymentAuthorized,
  PaymentDeclined,
} from '../src/02-payment-orchestration';
import { InventoryReservationService } from '../src/03-inventory-management';
import { CheckoutService } from '../src/05-service-composition';
import {
  TransferService,
  type Account,
  type IAccountRepository,
} from '../src/06-transaction-rollback';
import {
  RecordingEventBus,
  FakePaymentGateway,
  gatewayApproved,
  gatewayDeclined,
} from '../src/07-testing-domain-services';

describe('Example 1 — OrderPricingService', () => {
  const svc = new OrderPricingService();

  it('rejects inactive customer', () => {
    const r = svc.price({ id: 'c-1', tier: 'free', isActive: false }, [
      { sku: 'A', unitPrice: 10, quantity: 1 },
    ]);
    expect(r.isFailure).toBe(true);
    if (r.isFailure) expect(r.error.code).toBe('INACTIVE_CUSTOMER');
  });

  it('rejects empty cart', () => {
    const r = svc.price({ id: 'c-1', tier: 'free', isActive: true }, []);
    expect(r.isFailure).toBe(true);
    if (r.isFailure) expect(r.error.code).toBe('EMPTY_CART');
  });

  it('applies VIP 15% discount', () => {
    const r = svc.price({ id: 'c-vip', tier: 'vip', isActive: true }, [
      { sku: 'A', unitPrice: 100, quantity: 2 },
    ]);
    expect(r.isSuccess).toBe(true);
    if (r.isSuccess) {
      expect(r.value.subtotal).toBe(200);
      expect(r.value.discount).toBeCloseTo(30);
      expect(r.value.total).toBeCloseTo(170);
    }
  });

  it('premium gets 5% only above $100', () => {
    const r = svc.price({ id: 'c-p', tier: 'premium', isActive: true }, [
      { sku: 'A', unitPrice: 50, quantity: 1 },
    ]);
    expect(r.isSuccess).toBe(true);
    if (r.isSuccess) expect(r.value.discount).toBe(0);
  });
});

describe('Example 2 — PaymentOrchestrationService', () => {
  it('publishes PaymentAuthorized on approval', async () => {
    const gateway = new FakePaymentGateway(gatewayApproved('AUTH-X'));
    const bus = new RecordingEventBus();
    const svc = new PaymentOrchestrationService(gateway);
    svc.setEventBus(bus as unknown as Parameters<typeof svc.setEventBus>[0]);

    const r = await svc.authorize('ord-1', 100, 'USD');
    expect(r.isSuccess).toBe(true);
    expect(bus.countOfType(PaymentAuthorized)).toBe(1);
    expect(bus.countOfType(PaymentDeclined)).toBe(0);
  });

  it('publishes PaymentDeclined on rejection', async () => {
    const gateway = new FakePaymentGateway(gatewayDeclined('card_declined'));
    const bus = new RecordingEventBus();
    const svc = new PaymentOrchestrationService(gateway);
    svc.setEventBus(bus as unknown as Parameters<typeof svc.setEventBus>[0]);

    const r = await svc.authorize('ord-2', 50, 'USD');
    expect(r.isFailure).toBe(true);
    expect(bus.countOfType(PaymentDeclined)).toBe(1);
    const declined = bus.firstOfType(PaymentDeclined);
    expect(declined?.payload?.reason).toBe('card_declined');
  });
});

describe('Example 3 — InventoryReservationService', () => {
  let svc: InventoryReservationService;

  beforeEach(async () => {
    svc = new InventoryReservationService(60_000);
    await svc.initialize();
  });

  it('reserves available stock', () => {
    const r = svc.reserve('SKU-A', 5);
    expect(r.isSuccess).toBe(true);
  });

  it('rejects unknown SKU', () => {
    const r = svc.reserve('SKU-Z', 1);
    expect(r.isFailure).toBe(true);
    if (r.isFailure) expect(r.error.code).toBe('UNKNOWN_SKU');
  });

  it('rejects insufficient stock (sum of reservations)', () => {
    svc.reserve('SKU-B', 40); // 40/50
    const r = svc.reserve('SKU-B', 20); // would push past 50
    expect(r.isFailure).toBe(true);
    if (r.isFailure) expect(r.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('release frees up reserved capacity', () => {
    const r1 = svc.reserve('SKU-B', 50);
    expect(r1.isSuccess).toBe(true);
    if (r1.isSuccess) {
      const released = svc.release(r1.value);
      expect(released.isSuccess).toBe(true);
      // Now we can reserve again.
      const r2 = svc.reserve('SKU-B', 50);
      expect(r2.isSuccess).toBe(true);
    }
  });
});

describe('Example 5 — CheckoutService composition', () => {
  it('successful checkout: prices, reserves, authorizes', async () => {
    const pricing = new OrderPricingService();
    const inventory = new InventoryReservationService();
    await inventory.initialize();
    const gateway = new FakePaymentGateway(gatewayApproved('AUTH-OK'));
    const bus = new RecordingEventBus();
    const payments = new PaymentOrchestrationService(gateway);
    payments.setEventBus(bus as unknown as Parameters<typeof payments.setEventBus>[0]);

    const checkout = new CheckoutService(pricing, inventory, payments);
    const r = await checkout.checkout({ id: 'c-1', tier: 'premium', isActive: true }, [
      { sku: 'SKU-A', unitPrice: 50, quantity: 2 },
    ]);
    expect(r.isSuccess).toBe(true);
    if (r.isSuccess) {
      // Subtotal 100 → premium 5% discount applies (>=$100 threshold) → 95.
      expect(r.value.priced.total).toBeCloseTo(95);
      expect(r.value.authCode).toBe('AUTH-OK');
      expect(r.value.reservationIds).toHaveLength(1);
    }
    expect(bus.countOfType(PaymentAuthorized)).toBe(1);
  });

  it('payment decline rolls back reservations', async () => {
    const pricing = new OrderPricingService();
    const inventory = new InventoryReservationService();
    await inventory.initialize();
    const gateway = new FakePaymentGateway(gatewayDeclined());
    const bus = new RecordingEventBus();
    const payments = new PaymentOrchestrationService(gateway);
    payments.setEventBus(bus as unknown as Parameters<typeof payments.setEventBus>[0]);

    const checkout = new CheckoutService(pricing, inventory, payments);
    const r = await checkout.checkout({ id: 'c-1', tier: 'free', isActive: true }, [
      { sku: 'SKU-A', unitPrice: 10, quantity: 5 },
    ]);
    expect(r.isFailure).toBe(true);
    if (r.isFailure) expect(r.error.stage).toBe('payment');
    // Stock should be fully restored — try a fresh full reservation.
    const recheck = inventory.reserve('SKU-A', 100);
    expect(recheck.isSuccess).toBe(true);
  });
});

describe('Example 6 — TransferService rollback semantics', () => {
  // Minimal repository fake — we don't use the full UnitOfWork here because
  // executeInTransaction requires a real UoW set on the service. Instead we
  // demonstrate the input validation path which doesn't enter the txn.
  it('rejects negative amount before entering transaction', async () => {
    const svc = new TransferService();
    const r = await svc.transfer('A', 'B', -10);
    expect(r.isFailure).toBe(true);
  });

  it('rejects same-account transfer before entering transaction', async () => {
    const svc = new TransferService();
    const r = await svc.transfer('A', 'A', 100);
    expect(r.isFailure).toBe(true);
  });

  it('throws if no Unit of Work is set (caller responsibility)', async () => {
    // This documents that UoW MUST be set before calling transfer with
    // valid inputs — typical setup happens in a DI composition root.
    const svc = new TransferService();
    const r = await svc.transfer('A', 'B', 100);
    expect(r.isFailure).toBe(true); // wraps the "Unit of Work not set" error
    // For full transactional coverage with a real UoW, see the
    // packages/domain-services tests.
    expect(svc).toBeDefined();
  });
});

describe('Example 7 — Testing helpers', () => {
  it('RecordingEventBus captures publish calls', async () => {
    const bus = new RecordingEventBus();
    await bus.publish(
      new PaymentAuthorized({ orderId: 'o', amount: 1, currency: 'USD', authCode: 'X' })
    );
    expect(bus.published).toHaveLength(1);
    expect(bus.firstOfType(PaymentAuthorized)?.payload?.orderId).toBe('o');
  });

  it('FakePaymentGateway records each call', async () => {
    const gw = new FakePaymentGateway(gatewayApproved());
    await gw.authorize('o-1', 10, 'USD');
    await gw.authorize('o-2', 20, 'EUR');
    expect(gw.calls).toHaveLength(2);
    expect(gw.calls[0]).toEqual({ orderId: 'o-1', amount: 10, currency: 'USD' });
  });
});
