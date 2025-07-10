import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestDataBuilder,
  EntityIdBuilder,
  UserBuilder,
  DomainEventBuilder,
} from '../../src';

describe('TestDataBuilder', () => {
  beforeEach(() => {
    TestDataBuilder.resetSequences();
    TestDataBuilder.setRandomSeed(12345); // For reproducible tests
  });

  describe('basic functionality', () => {
    interface TestData {
      id: string;
      name: string;
      count: number;
    }

    it('should create builder with defaults', () => {
      const builder = TestDataBuilder.create<TestData>({
        defaults: { id: 'default-id', name: 'Default Name', count: 0 }
      });

      const result = builder.build();

      expect(result.id).toBe('default-id');
      expect(result.name).toBe('Default Name');
      expect(result.count).toBe(0);
    });

    it('should allow property setting', () => {
      const builder = TestDataBuilder.create<TestData>()
        .with('id', 'custom-id')
        .with('name', 'Custom Name')
        .with('count', 42);

      const result = builder.build();

      expect(result.id).toBe('custom-id');
      expect(result.name).toBe('Custom Name');
      expect(result.count).toBe(42);
    });

    it('should allow setting multiple properties', () => {
      const builder = TestDataBuilder.create<TestData>()
        .withProperties({
          id: 'multi-id',
          name: 'Multi Name',
          count: 100
        });

      const result = builder.build();

      expect(result.id).toBe('multi-id');
      expect(result.name).toBe('Multi Name');
      expect(result.count).toBe(100);
    });

    it('should support conditional property setting', () => {
      const condition = true;
      const builder = TestDataBuilder.create<TestData>()
        .with('id', 'base-id')
        .withIf(condition, 'name', 'Conditional Name')
        .withIf(false, 'count', 999);

      const result = builder.build();

      expect(result.id).toBe('base-id');
      expect(result.name).toBe('Conditional Name');
      expect(result.count).toBeUndefined();
    });

    it('should support transformation functions', () => {
      const builder = TestDataBuilder.create<TestData>()
        .with('id', 'transform-id')
        .with('count', 10)
        .transform(data => ({
          ...data,
          name: `Generated for ${data.id}`,
          count: (data.count || 0) * 2
        }));

      const result = builder.build();

      expect(result.id).toBe('transform-id');
      expect(result.name).toBe('Generated for transform-id');
      expect(result.count).toBe(20);
    });
  });

  describe('sequence generation', () => {
    interface SequenceData {
      id: string;
      name: string;
      order: string;
    }

    it('should generate sequential values', () => {
      const builder = TestDataBuilder.create<SequenceData>();

      const item1 = builder.clone().withSequence('id').build();
      const item2 = builder.clone().withSequence('id').build();
      const item3 = builder.clone().withSequence('id').build();

      expect(item1.id).toBe('1');
      expect(item2.id).toBe('2');
      expect(item3.id).toBe('3');
    });

    it('should support sequence options', () => {
      const builder = TestDataBuilder.create<SequenceData>();

      const item1 = builder.clone().withSequence('name', {
        start: 10,
        step: 5,
        prefix: 'item-',
        suffix: '-test'
      }).build();

      const item2 = builder.clone().withSequence('name', {
        prefix: 'item-',
        suffix: '-test'
      }).build();

      expect(item1.name).toBe('item-10-test');
      expect(item2.name).toBe('item-15-test');
    });

    it('should maintain separate sequences for different properties', () => {
      const builder = TestDataBuilder.create<SequenceData>();

      const item = builder
        .withSequence('id', { prefix: 'id-' })
        .withSequence('order', { prefix: 'order-', start: 100 })
        .build();

      expect(item.id).toBe('id-1');
      expect(item.order).toBe('order-100');
    });

    it('should reset sequences when requested', () => {
      const builder = TestDataBuilder.create<SequenceData>();

      // Generate some items
      builder.clone().withSequence('id').build();
      builder.clone().withSequence('id').build();

      TestDataBuilder.resetSequences();

      const item = builder.clone().withSequence('id').build();
      expect(item.id).toBe('1'); // Should start from beginning
    });
  });

  describe('random generation', () => {
    interface RandomData {
      randomString: string;
      randomNumber: number;
      randomBoolean: boolean;
    }

    it('should generate random strings', () => {
      const builder = TestDataBuilder.create<RandomData>()
        .withRandom('randomString', 'string', { length: 8 });

      const result = builder.build();

      expect(typeof result.randomString).toBe('string');
      expect(result.randomString.length).toBe(8);
    });

    it('should generate random numbers within range', () => {
      const builder = TestDataBuilder.create<RandomData>()
        .withRandom('randomNumber', 'number', { min: 10, max: 20 });

      const result = builder.build();

      expect(typeof result.randomNumber).toBe('number');
      expect(result.randomNumber).toBeGreaterThanOrEqual(10);
      expect(result.randomNumber).toBeLessThanOrEqual(20);
    });

    it('should generate random booleans', () => {
      const builder = TestDataBuilder.create<RandomData>()
        .withRandom('randomBoolean', 'boolean');

      const result = builder.build();

      expect(typeof result.randomBoolean).toBe('boolean');
    });

    it('should be reproducible with same seed', () => {
      TestDataBuilder.setRandomSeed(42);
      const builder1 = TestDataBuilder.create<RandomData>()
        .withRandom('randomString', 'string', { length: 10 });
      const result1 = builder1.build();

      TestDataBuilder.setRandomSeed(42);
      const builder2 = TestDataBuilder.create<RandomData>()
        .withRandom('randomString', 'string', { length: 10 });
      const result2 = builder2.build();

      expect(result1.randomString).toBe(result2.randomString);
    });
  });

  describe('validation', () => {
    interface ValidatedData {
      age: number;
      email: string;
    }

    it('should validate data before building', () => {
      const builder = TestDataBuilder.create<ValidatedData>({
        validator: (data) => {
          if (data.age && data.age < 0) return 'Age cannot be negative';
          if (data.email && !data.email.includes('@')) return 'Invalid email';
          return true;
        }
      });

      expect(() => {
        builder.with('age', -5).build();
      }).toThrow('TestDataBuilder validation failed: Age cannot be negative');

      expect(() => {
        builder.with('age', 25).with('email', 'invalid-email').build();
      }).toThrow('TestDataBuilder validation failed: Invalid email');

      expect(() => {
        builder.with('age', 25).with('email', 'valid@email.com').build();
      }).not.toThrow();
    });
  });

  describe('deep merge functionality', () => {
    interface NestedData {
      user: {
        id: string;
        profile: {
          name: string;
          settings: {
            theme: string;
            notifications: boolean;
          };
        };
      };
    }

    it('should deep merge nested objects when enabled', () => {
      const builder = TestDataBuilder.create<NestedData>({
        defaults: {
          user: {
            id: 'default-id',
            profile: {
              name: 'Default Name',
              settings: {
                theme: 'light',
                notifications: true
              }
            }
          }
        },
        deepMerge: true
      });

      const result = builder.withProperties({
        user: {
          profile: {
            settings: {
              theme: 'dark'
            }
          }
        }
      } as any).build();

      expect(result.user.id).toBe('default-id'); // Preserved
      expect(result.user.profile.name).toBe('Default Name'); // Preserved
      expect(result.user.profile.settings.theme).toBe('dark'); // Overridden
      expect(result.user.profile.settings.notifications).toBe(true); // Preserved
    });

    it('should shallow merge when deep merge is disabled', () => {
      const builder = TestDataBuilder.create<NestedData>({
        defaults: {
          user: {
            id: 'default-id',
            profile: {
              name: 'Default Name',
              settings: {
                theme: 'light',
                notifications: true
              }
            }
          }
        },
        deepMerge: false
      });

      const result = builder.withProperties({
        user: {
          profile: {
            settings: {
              theme: 'dark'
            }
          }
        }
      } as any).build();

      expect(result.user.id).toBeUndefined(); // Not preserved
      expect(result.user.profile.name).toBeUndefined(); // Not preserved
      expect(result.user.profile.settings.theme).toBe('dark'); // Set
      expect(result.user.profile.settings.notifications).toBeUndefined(); // Not preserved
    });
  });

  describe('building multiple objects', () => {
    interface CountedData {
      id: string;
      name: string;
      count: number;
    }

    it('should build multiple objects', () => {
      const builder = TestDataBuilder.create<CountedData>({
        defaults: { name: 'Item', count: 1 }
      });

      const items = builder.buildMany(3, 'id');

      expect(items).toHaveLength(3);
      expect(items?.[0]?.id).toBe('1');
      expect(items?.[1]?.id).toBe('2');
      expect(items?.[2]?.id).toBe('3');
      items.forEach(item => {
        expect(item.name).toBe('Item');
        expect(item.count).toBe(1);
      });
    });

    it('should build with specific overrides', () => {
      const builder = TestDataBuilder.create<CountedData>({
        defaults: { id: 'default', name: 'Default', count: 0 }
      });

      const item = builder.buildWith({
        id: 'override',
        count: 42
      });

      expect(item.id).toBe('override');
      expect(item.name).toBe('Default'); // From defaults
      expect(item.count).toBe(42);
    });
  });

  describe('cloning and peeking', () => {
    interface CloneData {
      id: string;
      value: number;
    }

    it('should clone builders independently', () => {
      const baseBuilder = TestDataBuilder.create<CloneData>()
        .with('id', 'base')
        .with('value', 10);

      const clonedBuilder = baseBuilder.clone()
        .with('id', 'cloned')
        .with('value', 20);

      const baseResult = baseBuilder.build();
      const clonedResult = clonedBuilder.build();

      expect(baseResult.id).toBe('base');
      expect(baseResult.value).toBe(10);
      expect(clonedResult.id).toBe('cloned');
      expect(clonedResult.value).toBe(20);
    });

    it('should peek at current data without building', () => {
      const builder = TestDataBuilder.create<CloneData>()
        .with('id', 'peek-test')
        .with('value', 100);

      const peekedData = builder.peek();

      expect(peekedData.id).toBe('peek-test');
      expect(peekedData.value).toBe(100);

      // Should not affect the builder
      const finalResult = builder.build();
      expect(finalResult.id).toBe('peek-test');
      expect(finalResult.value).toBe(100);
    });

    it('should reset to defaults', () => {
      const builder = TestDataBuilder.create<CloneData>({
        defaults: { id: 'default-id', value: 0 }
      });

      builder.with('id', 'modified').with('value', 999);
      expect(builder.peek().id).toBe('modified');

      builder.reset();
      const result = builder.build();

      expect(result.id).toBe('default-id');
      expect(result.value).toBe(0);
    });
  });
});

describe('EntityIdBuilder', () => {
  beforeEach(() => {
    TestDataBuilder.resetSequences();
  });

  it('should create entity IDs with defaults', () => {
    const builder = new EntityIdBuilder();
    const result = builder.build();

    expect(result.id).toBe('entity-id');
  });

  it('should create UUIDs', () => {
    const builder = new EntityIdBuilder();
    const result = builder.withUuid().build();

    // Basic UUID format check
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should create IDs with prefixes', () => {
    const builder = new EntityIdBuilder();

    const user1 = builder.clone().withPrefix('user').build();
    const user2 = builder.clone().withPrefix('user').build();
    const order1 = builder.clone().withPrefix('order').build();

    expect(user1.id).toBe('user-1');
    expect(user2.id).toBe('user-2');
    expect(order1.id).toBe('order-1');
  });
});

describe('UserBuilder', () => {
  beforeEach(() => {
    TestDataBuilder.resetSequences();
  });

  it('should create users with defaults', () => {
    const builder = new UserBuilder();
    const user = builder.build();

    expect(user.id).toBe('user-1');
    expect(user.name).toBe('Test User');
    expect(user.email).toBe('test@example.com');
    expect(user.age).toBe(25);
    expect(user.isActive).toBe(true);
    expect(user.roles).toEqual(['user']);
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('should create users with unique emails', () => {
    const builder = new UserBuilder();

    const user1 = builder.clone().withUniqueEmail().build();
    const user2 = builder.clone().withUniqueEmail().build();

    expect(user1.email).toBe('user1@example.com');
    expect(user2.email).toBe('user2@example.com');
  });

  it('should create admin users', () => {
    const builder = new UserBuilder();
    const admin = builder.asAdmin().build();

    expect(admin.roles).toEqual(['admin', 'user']);
  });

  it('should create inactive users', () => {
    const builder = new UserBuilder();
    const inactiveUser = builder.asInactive().build();

    expect(inactiveUser.isActive).toBe(false);
  });

  it('should validate user data', () => {
    expect(() => {
      new UserBuilder().with('age', -5).build();
    }).toThrow('TestDataBuilder validation failed: Age cannot be negative');

    expect(() => {
      new UserBuilder().with('email', 'invalid-email').build();
    }).toThrow('TestDataBuilder validation failed: Invalid email format');
  });

  it('should create users with random ages', () => {
    const builder = new UserBuilder();
    const user = builder.withRandomAge(18, 30).build();

    expect(user.age).toBeGreaterThanOrEqual(18);
    expect(user.age).toBeLessThanOrEqual(30);
  });
});

describe('DomainEventBuilder', () => {
  beforeEach(() => {
    TestDataBuilder.resetSequences();
  });

  it('should create domain events with defaults', () => {
    const builder = new DomainEventBuilder();
    const event = builder.build();

    expect(event.id).toBe('event-1');
    expect(event.type).toBe('TestEvent');
    expect(event.aggregateId).toBe('aggregate-1');
    expect(event.version).toBe(1);
    expect(event.data).toEqual({});
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it('should create events with specific types', () => {
    const builder = new DomainEventBuilder();
    const event = builder.withEventType('UserCreated').build();

    expect(event.type).toBe('UserCreated');
  });

  it('should create events with aggregate information', () => {
    const builder = new DomainEventBuilder();
    const event = builder.withAggregateInfo('user-123', 5).build();

    expect(event.aggregateId).toBe('user-123');
    expect(event.version).toBe(5);
  });

  it('should create events with correlation data', () => {
    const builder = new DomainEventBuilder();
    const event = builder.withCorrelation('corr-123', 'cause-456').build();

    expect(event.correlationId).toBe('corr-123');
    expect(event.causationId).toBe('cause-456');
  });

  it('should create events with sequential versions', () => {
    const builder = new DomainEventBuilder();

    const event1 = builder.clone().withSequentialVersion().build();
    const event2 = builder.clone().withSequentialVersion().build();
    const event3 = builder.clone().withSequentialVersion().build();

    expect(event1.version).toBe(1);
    expect(event2.version).toBe(2);
    expect(event3.version).toBe(3);
  });

  it('should create events with custom data', () => {
    const builder = new DomainEventBuilder();
    const eventData = { userId: 'user-123', action: 'login' };
    const event = builder.withData(eventData).build();

    expect(event.data).toEqual(eventData);
  });
});
