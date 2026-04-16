import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryOrderRepository } from '../src/infrastructure/in-memory-order.repository';
import { handleCreateOrder } from '../src/application/create-order.command';
import { handlePlaceOrder } from '../src/application/place-order.command';
import { handleGetOrder } from '../src/application/get-order.query';

describe('Order Integration Flow', () => {
  let repository: InMemoryOrderRepository;

  beforeEach(() => {
    repository = new InMemoryOrderRepository();
  });

  it('should create, populate, place, and query an order', async () => {
    // Create order
    const orderId = await handleCreateOrder(
      {
        customerId: 'customer-1',
        items: [
          { sku: 'SKU-001', name: 'Widget', price: 9.99, qty: 2 },
          { sku: 'SKU-002', name: 'Gadget', price: 19.99, qty: 1 },
        ],
      },
      repository
    );

    expect(orderId).toBeDefined();

    // Place order
    await handlePlaceOrder({ orderId }, repository);

    // Query order
    const orderView = await handleGetOrder(orderId, repository);

    expect(orderView).toBeDefined();
    expect(orderView!.customerId).toBe('customer-1');
    expect(orderView!.items).toHaveLength(2);
    expect(orderView!.totalAmount).toBe(39.97);
    expect(orderView!.placed).toBe(true);
    expect(orderView!.cancelled).toBe(false);
  });

  it('should reject placing non-existent order', async () => {
    await expect(handlePlaceOrder({ orderId: 'non-existent' }, repository)).rejects.toThrow(
      'Order not found'
    );
  });

  it('should return undefined for non-existent order query', async () => {
    const result = await handleGetOrder('non-existent', repository);
    expect(result).toBeUndefined();
  });
});
