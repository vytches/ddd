import { EntityId } from '@vytches/ddd-contracts';
import { describe, expect, it } from 'vitest';
import { AggregateBuilder, AggregateRoot } from '../src';

// Example custom ID implementations extending EntityId
class CustomerId extends EntityId<string> {
  static override create(): CustomerId {
    return new CustomerId(`customer_${Date.now()}`, 'text');
  }

  static fromValue(value: string): CustomerId {
    return new CustomerId(value, 'text');
  }
}

class ProductId extends EntityId<string> {
  constructor(value: string) {
    super(`product_${value}`, 'text');
  }

  static generate(): ProductId {
    const value = Math.random().toString(36).substring(7);
    return new ProductId(value);
  }
}

// Test aggregate with string ID type
class CustomerAggregate extends AggregateRoot<string> {
  private name = '';

  setName(name: string): void {
    this.name = name;
    this.apply('CustomerNameChanged', { name });
  }

  getName(): string {
    return this.name;
  }
}

// Test aggregate with number ID type
class ProductAggregate extends AggregateRoot<number> {
  private price = 0;

  setPrice(price: number): void {
    this.price = price;
    this.apply('ProductPriceChanged', { price });
  }

  getPrice(): number {
    return this.price;
  }
}

describe('Generic ID Support for Aggregates', () => {
  describe('Backward Compatibility with EntityId', () => {
    it('should work with EntityId as default', () => {
      const entityId = EntityId.createWithRandomUUID();
      const aggregate = new AggregateRoot({ id: entityId });

      expect(aggregate.getId()).toBe(entityId);
      expect(aggregate.getId().toString()).toContain('-');
      expect(aggregate.getVersion()).toBe(0);
    });

    it('should work with EntityId through builder', () => {
      const entityId = EntityId.fromText('test-123');
      const aggregate = AggregateBuilder.create({
        id: entityId,
        version: 0,
      }).build();

      expect(aggregate.getId()).toBe(entityId);
      expect(aggregate.getId().toString()).toBe('test-123');
    });

    it('should handle EntityId with different types', () => {
      const uuidId = EntityId.fromUUID('550e8400-e29b-41d4-a716-446655440000');
      const textId = EntityId.fromText('order-456');
      const intId = EntityId.fromInteger(789);

      const agg1 = new AggregateRoot({ id: uuidId });
      const agg2 = new AggregateRoot({ id: textId });
      const agg3 = new AggregateRoot({ id: intId });

      expect(agg1.getId().toString()).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(agg2.getId().toString()).toBe('order-456');
      expect(agg3.getId().toString()).toBe('789');
    });
  });

  describe('Extended EntityId Classes', () => {
    it('should work with CustomerId extending EntityId', () => {
      const customerId = CustomerId.fromValue('customer-123');
      const aggregate = new CustomerAggregate({ id: customerId });

      expect(aggregate.getId()).toBe(customerId);
      expect(aggregate.getId().toString()).toBe('customer-123');
      expect(aggregate.getId()).toBeInstanceOf(EntityId);
    });

    it('should work with ProductId extending EntityId', () => {
      const productId = ProductId.generate();
      const aggregate = new ProductAggregate({
        id: new EntityId(123, 'integer') as EntityId<number>,
      });

      expect(aggregate.getId().value).toBe(123);
      expect(aggregate.getId()).toBeInstanceOf(EntityId);
    });
  });

  describe('Generic Type Parameters', () => {
    it('should work with string ID type', () => {
      const aggregate = new CustomerAggregate({
        id: EntityId.fromText('customer-001'),
      });

      aggregate.setName('John Doe');
      expect(aggregate.getName()).toBe('John Doe');

      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe('CustomerNameChanged');
    });

    it('should work with number ID type', () => {
      const aggregate = new ProductAggregate({
        id: EntityId.fromInteger(42) as unknown as EntityId<number>,
      });

      aggregate.setPrice(99.99);
      expect(aggregate.getPrice()).toBe(99.99);

      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe('ProductPriceChanged');
    });

    it('should work with bigint ID type', () => {
      const bigIntId = EntityId.fromBigInt(
        BigInt('9007199254740992')
      ) as unknown as EntityId<bigint>;
      const aggregate = new AggregateRoot<bigint>({ id: bigIntId });

      // The value is stored internally, check toString() output
      expect(aggregate.getId().toString()).toBe('9007199254740992');
      // Type property is private, check value instead
      expect(aggregate.getId().toString()).toBe('9007199254740992');
    });
  });

  describe('Builder Pattern with Generic IDs', () => {
    it('should work with builder and string IDs', () => {
      const aggregate = AggregateBuilder.create({
        id: EntityId.fromText('builder-test'),
      })
        .withSnapshots()
        .withAudit()
        .build();

      expect(aggregate.getId().toString()).toBe('builder-test');
      // Use proper capability constructors instead of strings
      expect(aggregate.getAllCapabilities()).toHaveLength(2);
    });

    it('should create default ID when not provided', () => {
      const aggregate = AggregateBuilder.create({
        id: EntityId.createWithRandomUUID(),
      }).build(CustomerAggregate);

      expect(aggregate.getId()).toBeDefined();
      expect(aggregate.getId().toString()).toBeTruthy();
      expect(aggregate).toBeInstanceOf(CustomerAggregate);
    });
  });

  describe('Event Handling with Generic IDs', () => {
    it('should include ID in event metadata', () => {
      const aggregate = new CustomerAggregate({
        id: EntityId.fromText('event-test'),
      });

      aggregate.setName('Alice');

      const events = aggregate.getDomainEvents();
      expect(events[0]?.metadata?.aggregateId).toBe('event-test');
      expect(events[0]?.metadata?.aggregateType).toBe('CustomerAggregate');
    });

    it('should handle commit with generic IDs', () => {
      const aggregate = new ProductAggregate({
        id: EntityId.fromInteger(999) as unknown as EntityId<number>,
      });

      aggregate.setPrice(50);
      expect(aggregate.hasChanges()).toBe(true);

      aggregate.commit();
      expect(aggregate.hasChanges()).toBe(false);
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety with different ID types', () => {
      const stringAggregate = new AggregateRoot<string>({
        id: EntityId.fromText('string-id'),
      });

      const numberAggregate = new AggregateRoot<number>({
        id: EntityId.fromInteger(123) as unknown as EntityId<number>,
      });

      // TypeScript should enforce these types correctly
      const stringId: EntityId<string> = stringAggregate.getId();
      const numberId: EntityId<number> = numberAggregate.getId();

      expect(stringId.toString()).toBe('string-id');
      expect(numberId.toString()).toBe('123');
    });
  });
});
