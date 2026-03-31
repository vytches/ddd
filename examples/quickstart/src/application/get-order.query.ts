import type { InMemoryOrderRepository } from '../infrastructure/in-memory-order.repository';

export interface OrderView {
  readonly id: string;
  readonly customerId: string;
  readonly items: ReadonlyArray<{ sku: string; name: string; price: number; qty: number }>;
  readonly totalAmount: number;
  readonly placed: boolean;
  readonly cancelled: boolean;
}

export async function handleGetOrder(
  orderId: string,
  repository: InMemoryOrderRepository
): Promise<OrderView | undefined> {
  const order = await repository.findById(orderId);
  if (!order) return undefined;

  return {
    id: order.getId().value,
    customerId: order.getCustomerId(),
    items: [...order.getItems()],
    totalAmount: order.getTotal().amount,
    placed: order.isPlaced(),
    cancelled: order.isCancelled(),
  };
}
