import type { InMemoryOrderRepository } from '../infrastructure/in-memory-order.repository';

export interface PlaceOrderCommand {
  readonly orderId: string;
}

export async function handlePlaceOrder(
  command: PlaceOrderCommand,
  repository: InMemoryOrderRepository
): Promise<void> {
  const order = await repository.findById(command.orderId);
  if (!order) {
    throw new Error(`Order not found: ${command.orderId}`);
  }

  order.place();
  await repository.save(order);
}
