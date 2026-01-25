/**
 * Tests for Event Handler DI Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { IDomainEvent, IEventHandler } from '@vytches/ddd-contracts';
import { EventDiscoveryPlugin, EventHandler } from '../../src';

// Test event for testing
class TestEvent implements IDomainEvent {
  public readonly eventName = 'TestEvent';

  constructor(
    public readonly id: string,
    public readonly occurredOn: Date = new Date(),
    public readonly version = 1
  ) {}
}

// Simple test event handler base
abstract class TestEventHandler<T extends IDomainEvent> implements IEventHandler<T> {
  abstract handle(event: T): void | Promise<void>;
}

describe('Event Handler DI Integration', () => {
  describe('@EventHandler decorator with DI options', () => {
    it('should create DI metadata for enhanced options', () => {
      @EventHandler(TestEvent, {
        lifetime: 'singleton',
        context: 'TestContext',
        tags: ['test', 'event'],
        autoRegister: true,
        priority: 100,
      })
      class TestEventHandlerWithDI extends TestEventHandler<TestEvent> {
        handle(event: TestEvent): void {
          console.log('Handling test event:', event.id);
        }
      }

      // Check if DI metadata was created
      const diMetadata = Reflect.getMetadata('di:event-handler', TestEventHandlerWithDI);

      expect(diMetadata).toBeDefined();
      expect(diMetadata.type).toBe('event');
      expect(diMetadata.eventName).toBe(TestEvent);
      expect(diMetadata.handlerType).toBe(TestEventHandlerWithDI);
      expect(diMetadata.options.lifetime).toBe('singleton');
      expect(diMetadata.options.context).toBe('TestContext');
      expect(diMetadata.options.tags).toEqual(['test', 'event']);
      expect(diMetadata.options.autoRegister).toBe(true);
      expect(diMetadata.options.priority).toBe(100);
    });

    it('should maintain backward compatibility for simple handler', () => {
      @EventHandler(TestEvent)
      class SimpleEventHandler extends TestEventHandler<TestEvent> {
        handle(event: TestEvent): void {
          console.log('Simple handling:', event.id);
        }
      }

      const diMetadata = Reflect.getMetadata('di:event-handler', SimpleEventHandler);

      expect(diMetadata).toBeDefined();
      expect(diMetadata.type).toBe('event');
      expect(diMetadata.eventName).toBe(TestEvent);
      expect(diMetadata.handlerType).toBe(SimpleEventHandler);

      // Should have default autoRegister behavior (true)
      expect(diMetadata.options.autoRegister).not.toBe(false);
    });

    it('should support disabling auto-registration', () => {
      @EventHandler(TestEvent, { autoRegister: false })
      class ManualEventHandler extends TestEventHandler<TestEvent> {
        handle(event: TestEvent): void {
          console.log('Manual handling:', event.id);
        }
      }

      const diMetadata = Reflect.getMetadata('di:event-handler', ManualEventHandler);
      expect(diMetadata).toBeDefined();
      expect(diMetadata.options.autoRegister).toBe(false);

      // Should NOT be marked for auto-registration
      const isPending = Reflect.getMetadata('di:registration-pending', ManualEventHandler);
      expect(isPending).toBeUndefined();
    });

    it('should mark handlers as pending DI registration when auto-register is enabled', () => {
      @EventHandler(TestEvent, { autoRegister: true })
      class AutoRegisterHandler extends TestEventHandler<TestEvent> {
        handle(event: TestEvent): void {
          console.log('Auto-register handling:', event.id);
        }
      }

      const isPending = Reflect.getMetadata('di:registration-pending', AutoRegisterHandler);
      expect(isPending).toBe(true);
    });
  });

  describe('EventDiscoveryPlugin', () => {
    let plugin: EventDiscoveryPlugin;

    beforeEach(() => {
      plugin = new EventDiscoveryPlugin();
    });

    it('should be available when events package is loaded', () => {
      expect(plugin.isAvailable()).toBe(true);
    });

    it('should have correct plugin name', () => {
      expect(plugin.name).toBe('Event');
    });

    it('should discover event handlers from assemblies', async () => {
      @EventHandler(TestEvent, {
        lifetime: 'singleton',
        context: 'DiscoveryContext',
        tags: ['discoverable'],
        autoRegister: true,
        priority: 200,
      })
      class DiscoverableEventHandler extends TestEventHandler<TestEvent> {
        handle(event: TestEvent): void {
          console.log('Discoverable handling:', event.id);
        }
      }

      // Create mock assembly
      const assembly = {
        DiscoverableEventHandler,
        someOtherExport: 'not a handler',
      };

      const handlers = await plugin.discoverHandlers([assembly]);

      expect(handlers).toHaveLength(1);
      const handler = handlers[0];
      expect(handler?.type).toBe('event');
      expect(handler?.messageType).toBe(TestEvent);
      expect(handler?.handlerType).toBe(DiscoverableEventHandler);
      expect(handler?.metadata.lifetime).toBe('singleton');
      expect(handler?.metadata.context).toBe('DiscoveryContext');
      expect(handler?.metadata.tags).toEqual(['discoverable']);
      expect(handler?.metadata.priority).toBe(200);
      expect(handler?.metadata.autoRegister).toBe(true);
    });

    it('should not discover handlers with autoRegister disabled', async () => {
      @EventHandler(TestEvent, { autoRegister: false })
      class NonAutoHandler extends TestEventHandler<TestEvent> {
        handle(event: TestEvent): void {
          console.log('Non-auto handling:', event.id);
        }
      }

      const assembly = { NonAutoHandler };
      const handlers = await plugin.discoverHandlers([assembly]);

      expect(handlers).toHaveLength(0);
    });

    it('should handle assemblies with no event handlers', async () => {
      const assembly = {
        someFunction: (): void => {
          // Empty test function
        },
        someValue: 42,
        someObject: { prop: 'value' },
      };

      const handlers = await plugin.discoverHandlers([assembly]);
      expect(handlers).toHaveLength(0);
    });

    it('should handle empty or invalid assemblies', async () => {
      const handlers1 = await plugin.discoverHandlers([]);
      expect(handlers1).toHaveLength(0);

      const handlers2 = await plugin.discoverHandlers([null, undefined, 'invalid']);
      expect(handlers2).toHaveLength(0);

      const handlers3 = await plugin.discoverHandlers();
      expect(handlers3).toHaveLength(0);
    });

    it('should include all relevant metadata in discovered handlers', async () => {
      @EventHandler(TestEvent, {
        lifetime: 'scoped',
        context: 'CompleteContext',
        tags: ['complete', 'metadata', 'test'],
        autoRegister: true,
        priority: 500,
        active: true,
        availableFrom: '1.0.0',
        customProperty: 'custom-value',
      })
      class CompleteMetadataHandler extends TestEventHandler<TestEvent> {
        handle(event: TestEvent): void {
          console.log('Complete metadata handling:', event.id);
        }
      }

      const assembly = { CompleteMetadataHandler };
      const handlers = await plugin.discoverHandlers([assembly]);

      expect(handlers).toHaveLength(1);

      const handler = handlers[0];
      expect(handler?.metadata.eventName).toBe('TestEvent');
      expect(handler?.metadata.handlerType).toBe('CompleteMetadataHandler');
      expect(handler?.metadata.lifetime).toBe('scoped');
      expect(handler?.metadata.context).toBe('CompleteContext');
      expect(handler?.metadata.tags).toEqual(['complete', 'metadata', 'test']);
      expect(handler?.metadata.priority).toBe(500);
      expect(handler?.metadata.active).toBe(true);
      expect(handler?.metadata.autoRegister).toBe(true);
      expect(handler?.metadata.availableFrom).toBe('1.0.0');
      expect(handler?.metadata.registeredAt).toBeInstanceOf(Date);
    });

    it('should handle multiple handlers in single assembly', async () => {
      @EventHandler(TestEvent, {
        tags: ['handler1'],
        autoRegister: true,
      })
      class Handler1 extends TestEventHandler<TestEvent> {
        handle(_event: TestEvent): void {
          // Test handler - no implementation needed
        }
      }

      @EventHandler(TestEvent, {
        tags: ['handler2'],
        autoRegister: true,
      })
      class Handler2 extends TestEventHandler<TestEvent> {
        handle(_event: TestEvent): void {
          // Test handler - no implementation needed
        }
      }

      @EventHandler(TestEvent, {
        autoRegister: false, // This one should not be discovered
      })
      class Handler3 extends TestEventHandler<TestEvent> {
        handle(_event: TestEvent): void {
          // Test handler - no implementation needed
        }
      }

      const assembly = { Handler1, Handler2, Handler3, someOtherThing: 'value' };
      const handlers = await plugin.discoverHandlers([assembly]);

      expect(handlers).toHaveLength(2);

      const handlerNames = handlers.map(h => h.metadata.handlerType);
      expect(handlerNames).toContain('Handler1');
      expect(handlerNames).toContain('Handler2');
      expect(handlerNames).not.toContain('Handler3');
    });
  });
});
