import { DomainEvent } from '@vytches/ddd-events';

export interface OrderCreatedPayload {
  readonly customerId: string;
}

export interface ItemAddedPayload {
  readonly sku: string;
  readonly name: string;
  readonly price: number;
  readonly qty: number;
}

export interface OrderPlacedPayload {
  readonly totalAmount: number;
  readonly itemCount: number;
}

export interface OrderCancelledPayload {
  readonly reason: string;
}

export class OrderCreated extends DomainEvent<OrderCreatedPayload> {
  constructor(payload: OrderCreatedPayload) {
    super(payload);
  }
}

export class ItemAdded extends DomainEvent<ItemAddedPayload> {
  constructor(payload: ItemAddedPayload) {
    super(payload);
  }
}

export class OrderPlaced extends DomainEvent<OrderPlacedPayload> {
  constructor(payload: OrderPlacedPayload) {
    super(payload);
  }
}

export class OrderCancelled extends DomainEvent<OrderCancelledPayload> {
  constructor(payload: OrderCancelledPayload) {
    super(payload);
  }
}
