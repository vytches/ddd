import { describe, it, expect } from 'vitest';
import { Test, matching } from '@vytches/ddd-testing';
import { Order } from '../src/domain/order.aggregate';
import { OrderCreated, ItemAdded, OrderPlaced, OrderCancelled } from '../src/domain/events';
import { Money } from '../src/domain/money.value-object';

const createOrder = () => new Order();

describe('Order Aggregate', () => {
  describe('creation', () => {
    it('should emit OrderCreated event', () => {
      Test(createOrder)
        .givenNothing()
        .when(order => order.create('customer-1'))
        .then(new OrderCreated({ customerId: 'customer-1' }));
    });
  });

  describe('adding items', () => {
    it('should emit ItemAdded event', () => {
      Test(createOrder)
        .given(new OrderCreated({ customerId: 'c1' }))
        .when(order => order.addItem('SKU-001', 'Widget', 9.99, 2))
        .then(new ItemAdded({ sku: 'SKU-001', name: 'Widget', price: 9.99, qty: 2 }));
    });

    it('should allow multiple items', () => {
      Test(createOrder)
        .given(new OrderCreated({ customerId: 'c1' }))
        .when(order => {
          order.addItem('SKU-001', 'Widget', 9.99, 1);
          order.addItem('SKU-002', 'Gadget', 19.99, 3);
        })
        .then(
          new ItemAdded({ sku: 'SKU-001', name: 'Widget', price: 9.99, qty: 1 }),
          new ItemAdded({ sku: 'SKU-002', name: 'Gadget', price: 19.99, qty: 3 })
        );
    });

    it('should reject adding items to placed order', () => {
      Test(createOrder)
        .given(
          new OrderCreated({ customerId: 'c1' }),
          new ItemAdded({ sku: 'A', name: 'A', price: 10, qty: 1 }),
          new OrderPlaced({ totalAmount: 10, itemCount: 1 })
        )
        .when(order => order.addItem('B', 'B', 5, 1))
        .thenError('CANNOT_ADD_ITEM_TO_PLACED_ORDER');
    });

    it('should reject negative price', () => {
      Test(createOrder)
        .given(new OrderCreated({ customerId: 'c1' }))
        .when(order => order.addItem('SKU-001', 'Widget', -5, 1))
        .thenError('Invalid money');
    });
  });

  describe('placing order', () => {
    it('should emit OrderPlaced with total', () => {
      Test(createOrder)
        .given(
          new OrderCreated({ customerId: 'c1' }),
          new ItemAdded({ sku: 'A', name: 'Widget', price: 10, qty: 2 }),
          new ItemAdded({ sku: 'B', name: 'Gadget', price: 5, qty: 1 })
        )
        .when(order => order.place())
        .then(matching(OrderPlaced, { totalAmount: 25, itemCount: 2 }));
    });

    it('should reject placing empty order', () => {
      Test(createOrder)
        .given(new OrderCreated({ customerId: 'c1' }))
        .when(order => order.place())
        .thenError('ORDER_HAS_NO_ITEMS');
    });

    it('should reject placing already placed order', () => {
      Test(createOrder)
        .given(
          new OrderCreated({ customerId: 'c1' }),
          new ItemAdded({ sku: 'A', name: 'A', price: 10, qty: 1 }),
          new OrderPlaced({ totalAmount: 10, itemCount: 1 })
        )
        .when(order => order.place())
        .thenError('ORDER_ALREADY_PLACED');
    });
  });

  describe('cancelling order', () => {
    it('should emit OrderCancelled', () => {
      Test(createOrder)
        .given(
          new OrderCreated({ customerId: 'c1' }),
          new ItemAdded({ sku: 'A', name: 'A', price: 10, qty: 1 })
        )
        .when(order => order.cancel('Changed my mind'))
        .then(new OrderCancelled({ reason: 'Changed my mind' }));
    });

    it('should reject cancelling already cancelled order', () => {
      Test(createOrder)
        .given(new OrderCreated({ customerId: 'c1' }), new OrderCancelled({ reason: 'first' }))
        .when(order => order.cancel('second'))
        .thenError('ORDER_ALREADY_CANCELLED');
    });
  });

  describe('value objects', () => {
    it('should calculate total as Money', () => {
      const order = new Order();
      order.create('c1');
      order.addItem('A', 'Widget', 10, 2);
      order.addItem('B', 'Gadget', 5, 3);

      const total = order.getTotal();
      expect(total.amount).toBe(35);
      expect(total.currency).toBe('USD');
    });

    it('should create Money with validation', () => {
      const money = Money.create(99.99, 'EUR');
      expect(money.amount).toBe(99.99);
      expect(money.currency).toBe('EUR');
    });

    it('should add Money values', () => {
      const a = Money.create(10, 'USD');
      const b = Money.create(20, 'USD');
      const sum = a.add(b);
      expect(sum.amount).toBe(30);
    });
  });
});
