import { describe, it, expect } from 'vitest';

import { Result, type IDomainFactory, type IAsyncDomainFactory } from '../../src';

interface OrderProps {
  customerId: string;
  itemCount: number;
}

class Order {
  constructor(public readonly props: OrderProps) {}
}

describe('IDomainFactory — VF-CANON-001 contract', () => {
  describe('synchronous factory', () => {
    class OrderFactory implements IDomainFactory<Order, OrderProps> {
      create(props: OrderProps): Result<Order, Error> {
        if (props.itemCount === 0) {
          return Result.fail(new Error('Order cannot be empty'));
        }
        return Result.ok(new Order(props));
      }
    }

    it('returns Result.ok with the constructed aggregate', () => {
      const factory = new OrderFactory();
      const r = factory.create({ customerId: 'c-1', itemCount: 3 });

      expect(r.isSuccess).toBe(true);
      if (r.isSuccess) {
        expect(r.value).toBeInstanceOf(Order);
        expect(r.value.props.customerId).toBe('c-1');
      }
    });

    it('returns Result.fail on invariant violation', () => {
      const factory = new OrderFactory();
      const r = factory.create({ customerId: 'c-1', itemCount: 0 });

      expect(r.isFailure).toBe(true);
      if (r.isFailure) {
        expect(r.error.message).toContain('cannot be empty');
      }
    });
  });

  describe('asynchronous factory', () => {
    class AsyncOrderFactory implements IAsyncDomainFactory<Order, OrderProps> {
      async create(props: OrderProps): Promise<Result<Order, Error>> {
        // Pretend we make an async lookup here (e.g. customer existence)
        await Promise.resolve();
        if (!props.customerId) {
          return Result.fail(new Error('customerId required'));
        }
        return Result.ok(new Order(props));
      }
    }

    it('resolves to Result.ok with the aggregate', async () => {
      const factory = new AsyncOrderFactory();
      const r = await factory.create({ customerId: 'c-1', itemCount: 1 });
      expect(r.isSuccess).toBe(true);
    });

    it('resolves to Result.fail when async validation fails', async () => {
      const factory = new AsyncOrderFactory();
      const r = await factory.create({ customerId: '', itemCount: 1 });
      expect(r.isFailure).toBe(true);
    });
  });

  describe('contract shape', () => {
    it('IDomainFactory.create returns Result, not throwing', () => {
      class StubFactory implements IDomainFactory<Order, OrderProps> {
        create(props: OrderProps): Result<Order, Error> {
          return Result.ok(new Order(props));
        }
      }
      const f = new StubFactory();
      const r = f.create({ customerId: 'c-1', itemCount: 1 });
      // Type-level check: r is Result, not Order directly
      expect(r).toHaveProperty('isSuccess');
      expect(r).toHaveProperty('isFailure');
    });
  });
});
