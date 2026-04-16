import { Order } from '../domain/order.aggregate';
import type { InMemoryOrderRepository } from '../infrastructure/in-memory-order.repository';

export interface CreateOrderCommand {
  readonly customerId: string;
  readonly items: ReadonlyArray<{
    readonly sku: string;
    readonly name: string;
    readonly price: number;
    readonly qty: number;
  }>;
}

export async function handleCreateOrder(
  command: CreateOrderCommand,
  repository: InMemoryOrderRepository
): Promise<string> {
  const order = new Order();
  order.create(command.customerId);

  for (const item of command.items) {
    order.addItem(item.sku, item.name, item.price, item.qty);
  }

  await repository.save(order);
  return order.getId().value;
}
