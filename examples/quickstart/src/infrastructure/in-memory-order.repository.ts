import type { IDomainEvent } from '@vytches/ddd-contracts';
import { EntityId } from '@vytches/ddd-contracts';
import { Order } from '../domain/order.aggregate';

type Hydratable = { loadFromHistory(events: IDomainEvent[]): void };

/**
 * Simple in-memory repository for the quickstart example.
 * In a real project, you'd extend IBaseRepository from @vytches/ddd-repositories.
 */
export class InMemoryOrderRepository {
  private readonly eventStreams = new Map<string, IDomainEvent[]>();

  async save(order: Order): Promise<void> {
    const id = order.getId().value;
    const newEvents = order.getDomainEvents();

    if (newEvents.length === 0) return;

    const existing = this.eventStreams.get(id) ?? [];
    this.eventStreams.set(id, [...existing, ...newEvents]);
    order.commit();
  }

  async findById(id: string): Promise<Order | undefined> {
    const events = this.eventStreams.get(id);
    if (!events || events.length === 0) return undefined;

    const order = Order.fromId(EntityId.fromUUID(id));
    (order as unknown as Hydratable).loadFromHistory(events);
    order.commit();
    return order;
  }

  async findAll(): Promise<Order[]> {
    const orders: Order[] = [];
    for (const [id, events] of this.eventStreams) {
      const order = Order.fromId(EntityId.fromUUID(id));
      (order as unknown as Hydratable).loadFromHistory(events);
      order.commit();
      orders.push(order);
    }
    return orders;
  }
}
