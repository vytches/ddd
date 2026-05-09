/**
 * Example 3 — Inventory reservation service.
 *
 * A stateful coordination service that manages SKU-level reservations.
 * Reservations expire after a TTL — typical pattern for shopping cart
 * holds: "30 minutes to checkout, otherwise stock returns to pool".
 *
 * Use case: cart hold during checkout, ticket reservation, hotel-room
 * holds, anything where supply must be temporarily set aside.
 *
 * Pattern: stateful service coordinated via `initialize()` lifecycle
 * (warming up the in-memory store) and `dispose()` (releasing all
 * outstanding reservations on shutdown).
 */

import { AsyncDomainService, DomainService } from '@vytches/ddd-domain-services';
import { Result } from '@vytches/ddd-utils';

export class InventoryError extends Error {
  constructor(
    message: string,
    public readonly code: 'INSUFFICIENT_STOCK' | 'UNKNOWN_SKU' | 'RESERVATION_NOT_FOUND'
  ) {
    super(message);
    this.name = 'InventoryError';
  }
}

interface Reservation {
  readonly id: string;
  readonly sku: string;
  readonly quantity: number;
  readonly expiresAt: number;
}

@DomainService('InventoryReservationService')
export class InventoryReservationService extends AsyncDomainService {
  private readonly reservations = new Map<string, Reservation>();
  private stockOnHand = new Map<string, number>();

  constructor(private readonly reservationTtlMs: number = 30 * 60_000) {
    super('InventoryReservationService');
  }

  /**
   * Lifecycle hook — called by DI container after construction.
   * Real implementations would warm an in-memory cache from the DB here.
   */
  override async initialize(): Promise<void> {
    this.logger.info('Initializing inventory service');
    // Stub: pretend we loaded from DB.
    this.stockOnHand = new Map([
      ['SKU-A', 100],
      ['SKU-B', 50],
      ['SKU-C', 0],
    ]);
  }

  /**
   * Lifecycle hook — called on shutdown.
   * Real implementations would persist outstanding reservations + flush
   * pending stock updates here.
   */
  override async dispose(): Promise<void> {
    this.logger.info('Releasing all reservations on shutdown', {
      count: this.reservations.size,
    });
    this.reservations.clear();
  }

  /** Reserve N units of SKU. Returns reservation id on success. */
  reserve(sku: string, quantity: number): Result<string, InventoryError> {
    const onHand = this.stockOnHand.get(sku);
    if (onHand === undefined) {
      return Result.fail(new InventoryError(`Unknown SKU: ${sku}`, 'UNKNOWN_SKU'));
    }
    const reserved = this.totalReservedFor(sku);
    if (onHand - reserved < quantity) {
      return Result.fail(
        new InventoryError(
          `Insufficient stock for ${sku}: requested ${quantity}, available ${onHand - reserved}`,
          'INSUFFICIENT_STOCK'
        )
      );
    }
    const id = `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.reservations.set(id, {
      id,
      sku,
      quantity,
      expiresAt: Date.now() + this.reservationTtlMs,
    });
    return Result.ok(id);
  }

  /** Confirm a reservation — converts hold into committed sale. */
  confirm(reservationId: string): Result<void, InventoryError> {
    const r = this.reservations.get(reservationId);
    if (!r) {
      return Result.fail(
        new InventoryError(`Reservation not found: ${reservationId}`, 'RESERVATION_NOT_FOUND')
      );
    }
    this.stockOnHand.set(r.sku, (this.stockOnHand.get(r.sku) ?? 0) - r.quantity);
    this.reservations.delete(reservationId);
    return Result.empty();
  }

  /** Release a reservation explicitly — stock returns to pool. */
  release(reservationId: string): Result<void, InventoryError> {
    if (!this.reservations.delete(reservationId)) {
      return Result.fail(
        new InventoryError(`Reservation not found: ${reservationId}`, 'RESERVATION_NOT_FOUND')
      );
    }
    return Result.empty();
  }

  private totalReservedFor(sku: string): number {
    const now = Date.now();
    let total = 0;
    for (const r of this.reservations.values()) {
      if (r.sku === sku && r.expiresAt > now) total += r.quantity;
    }
    return total;
  }
}
