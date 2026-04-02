import { describe, it, expect } from 'vitest';
import type { IDomainEvent, IEventMetadata } from '@vytches/ddd-contracts';
import { Test, GWTAssertionError, matching } from '../../src/gwt';

// --- Inline test fixtures (avoid circular deps with aggregates/events) ---

// Mock event — use event() helper to cast for GWT chain which expects IDomainEvent
class MockDomainEvent<T = unknown> {
  readonly eventName: string;
  readonly payload: T | undefined;

  constructor(payload?: T) {
    this.eventName = this.constructor.name;
    this.payload = payload;
  }
}

/** Cast mock event to IDomainEvent for GWT test chain */
function event<T>(e: MockDomainEvent<T>): IDomainEvent<T> {
  return e as unknown as IDomainEvent<T>;
}

class MockAggregate {
  private events: IDomainEvent[] = [];
  private handlers = new Map<string, (payload: unknown) => void>();

  getDomainEvents(): ReadonlyArray<IDomainEvent> {
    return [...this.events];
  }

  commit(): void {
    this.events = [];
  }

  protected apply(event: IDomainEvent): void {
    this.events.push(event);
    const handler = this.handlers.get(event.eventName);
    if (handler) {
      handler(event.payload);
    }
  }

  protected registerHandler(eventName: string, handler: (payload: unknown) => void): void {
    this.handlers.set(eventName, handler);
  }

  loadFromHistory(events: IDomainEvent[]): void {
    for (const event of events) {
      const handler = this.handlers.get(event.eventName);
      if (handler) {
        handler(event.payload);
      }
    }
  }
}

// --- Test fixtures ---

interface OrderCreatedPayload {
  customerId: string;
}

interface ItemAddedPayload {
  sku: string;
  qty: number;
}

interface OrderPlacedPayload {
  itemCount: number;
}

class OrderCreated extends MockDomainEvent<OrderCreatedPayload> {
  constructor(payload: OrderCreatedPayload) {
    super(payload);
  }
}

class ItemAdded extends MockDomainEvent<ItemAddedPayload> {
  constructor(payload: ItemAddedPayload) {
    super(payload);
  }
}

class OrderPlaced extends MockDomainEvent<OrderPlacedPayload> {
  constructor(payload: OrderPlacedPayload) {
    super(payload);
  }
}

class TestOrder extends MockAggregate {
  private customerId = '';
  private items: Array<{ sku: string; qty: number }> = [];
  private placed = false;

  constructor() {
    super();
    this.registerHandler('OrderCreated', payload => {
      const p = payload as OrderCreatedPayload;
      this.customerId = p.customerId;
    });
    this.registerHandler('ItemAdded', payload => {
      const p = payload as ItemAddedPayload;
      this.items = [...this.items, { sku: p.sku, qty: p.qty }];
    });
    this.registerHandler('OrderPlaced', () => {
      this.placed = true;
    });
  }

  create(customerId: string): void {
    this.apply(new OrderCreated({ customerId }));
  }

  addItem(sku: string, qty: number): void {
    this.apply(new ItemAdded({ sku, qty }));
  }

  place(): void {
    if (this.placed) {
      throw new Error('ORDER_ALREADY_PLACED');
    }
    if (this.items.length === 0) {
      throw new Error('ORDER_EMPTY');
    }
    this.apply(new OrderPlaced({ itemCount: this.items.length }));
  }
}

// --- Tests ---

describe('GWT Aggregate Testing', () => {
  const createOrder = () => new TestOrder();

  describe('givenNothing().when().then()', () => {
    it('should verify events from a fresh aggregate', () => {
      Test(createOrder)
        .givenNothing()
        .when(order => order.create('c1'))
        .then(event(new OrderCreated({ customerId: 'c1' })));
    });
  });

  describe('given().when().then()', () => {
    it('should load history and verify new events', () => {
      Test(createOrder)
        .given(event(new OrderCreated({ customerId: 'c1' })))
        .when(order => order.addItem('SKU-1', 2))
        .then(event(new ItemAdded({ sku: 'SKU-1', qty: 2 })));
    });

    it('should handle multiple history events', () => {
      Test(createOrder)
        .given(
          event(new OrderCreated({ customerId: 'c1' })),
          event(new ItemAdded({ sku: 'A', qty: 1 }))
        )
        .when(order => order.place())
        .then(event(new OrderPlaced({ itemCount: 1 })));
    });

    it('should verify multiple produced events', () => {
      Test(createOrder)
        .given(event(new OrderCreated({ customerId: 'c1' })))
        .when(order => {
          order.addItem('A', 1);
          order.addItem('B', 2);
        })
        .then(
          event(new ItemAdded({ sku: 'A', qty: 1 })),
          event(new ItemAdded({ sku: 'B', qty: 2 }))
        );
    });
  });

  describe('thenError()', () => {
    it('should catch expected domain errors', () => {
      Test(createOrder)
        .given(event(new OrderCreated({ customerId: 'c1' })))
        .when(order => order.place())
        .thenError('ORDER_EMPTY');
    });

    it('should catch already-placed error', () => {
      Test(createOrder)
        .given(
          event(new OrderCreated({ customerId: 'c1' })),
          event(new ItemAdded({ sku: 'A', qty: 1 })),
          event(new OrderPlaced({ itemCount: 1 }))
        )
        .when(order => order.place())
        .thenError('ORDER_ALREADY_PLACED');
    });
  });

  describe('thenNothing()', () => {
    it('should pass when no events produced', () => {
      Test(createOrder)
        .given(event(new OrderCreated({ customerId: 'c1' })))
        .when(() => {
          // no-op action
        })
        .thenNothing();
    });
  });

  describe('partial matching', () => {
    it('should match subset of payload fields', () => {
      Test(createOrder)
        .given(event(new OrderCreated({ customerId: 'c1' })))
        .when(order => order.addItem('SKU-1', 5))
        .then(matching(ItemAdded, { sku: 'SKU-1' }));
    });
  });

  describe('async support', () => {
    it('should handle async when actions', async () => {
      await Test(createOrder)
        .givenNothing()
        .whenAsync(async order => {
          await Promise.resolve();
          order.create('c1');
        })
        .then(event(new OrderCreated({ customerId: 'c1' })));
    });
  });

  describe('error cases', () => {
    it('should throw GWTAssertionError when events dont match', () => {
      expect(() => {
        Test(createOrder)
          .givenNothing()
          .when(order => order.create('c1'))
          .then(event(new OrderCreated({ customerId: 'WRONG' })));
      }).toThrow(GWTAssertionError);
    });

    it('should throw GWTAssertionError when expecting error but none thrown', () => {
      expect(() => {
        Test(createOrder)
          .givenNothing()
          .when(order => order.create('c1'))
          .thenError('SOME_ERROR');
      }).toThrow(GWTAssertionError);
    });

    it('should throw GWTAssertionError when expecting nothing but events produced', () => {
      expect(() => {
        Test(createOrder)
          .givenNothing()
          .when(order => order.create('c1'))
          .thenNothing();
      }).toThrow(GWTAssertionError);
    });

    it('should include formatted GWT context in error message', () => {
      try {
        Test(createOrder)
          .givenNothing()
          .when(order => order.create('c1'))
          .then(event(new OrderCreated({ customerId: 'WRONG' })));
      } catch (err) {
        expect(err).toBeInstanceOf(GWTAssertionError);
        const gwtErr = err as GWTAssertionError;
        expect(gwtErr.message).toContain('GWT Assertion Failed');
        expect(gwtErr.message).toContain('Given:');
        expect(gwtErr.message).toContain('Expected events:');
        expect(gwtErr.message).toContain('Actual events:');
      }
    });
  });
});
