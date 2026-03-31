import { AggregateRoot } from '@vytches/ddd-aggregates';
import { EntityId } from '@vytches/ddd-contracts';
import { Money } from './money.value-object';
import { canBePlaced, canBeCancelled } from './order.specs';
import {
  OrderCreated,
  ItemAdded,
  OrderPlaced,
  OrderCancelled,
  type OrderCreatedPayload,
  type ItemAddedPayload,
  type OrderPlacedPayload,
  type OrderCancelledPayload,
} from './events';

interface OrderItem {
  readonly sku: string;
  readonly name: string;
  readonly price: number;
  readonly qty: number;
}

export class Order extends AggregateRoot<string> {
  private customerId = '';
  private items: ReadonlyArray<OrderItem> = [];
  private placed = false;
  private cancelled = false;

  static fromId(id: EntityId<string>): Order {
    return new Order(id);
  }

  constructor(id?: EntityId<string>) {
    super({ id: id ?? EntityId.create(), version: 0 });

    this.registerEventHandler<OrderCreatedPayload>('OrderCreated', payload => {
      this.customerId = payload.customerId;
    });

    this.registerEventHandler<ItemAddedPayload>('ItemAdded', payload => {
      this.items = [
        ...this.items,
        {
          sku: payload.sku,
          name: payload.name,
          price: payload.price,
          qty: payload.qty,
        },
      ];
    });

    this.registerEventHandler<OrderPlacedPayload>('OrderPlaced', () => {
      this.placed = true;
    });

    this.registerEventHandler<OrderCancelledPayload>('OrderCancelled', () => {
      this.cancelled = true;
    });
  }

  // --- Commands ---

  create(customerId: string): void {
    this.apply(new OrderCreated({ customerId }));
  }

  addItem(sku: string, name: string, price: number, qty: number): void {
    if (this.placed) {
      throw new Error('CANNOT_ADD_ITEM_TO_PLACED_ORDER');
    }
    Money.create(price, 'USD'); // validates price
    this.apply(new ItemAdded({ sku, name, price, qty }));
  }

  place(): void {
    const state = { items: this.items, placed: this.placed, cancelled: this.cancelled };
    if (!canBePlaced.isSatisfiedBy(state)) {
      if (this.items.length === 0) throw new Error('ORDER_HAS_NO_ITEMS');
      if (this.placed) throw new Error('ORDER_ALREADY_PLACED');
      if (this.cancelled) throw new Error('ORDER_IS_CANCELLED');
    }

    const totalAmount = this.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    this.apply(new OrderPlaced({ totalAmount, itemCount: this.items.length }));
  }

  cancel(reason: string): void {
    const state = { items: this.items, placed: this.placed, cancelled: this.cancelled };
    if (!canBeCancelled.isSatisfiedBy(state)) {
      throw new Error('ORDER_ALREADY_CANCELLED');
    }
    this.apply(new OrderCancelled({ reason }));
  }

  // --- Queries ---

  getCustomerId(): string {
    return this.customerId;
  }

  getItems(): ReadonlyArray<OrderItem> {
    return this.items;
  }

  isPlaced(): boolean {
    return this.placed;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  getTotal(): Money {
    const amount = this.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    return Money.create(amount, 'USD');
  }
}
