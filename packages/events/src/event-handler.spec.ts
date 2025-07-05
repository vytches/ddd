import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import type { IDomainEvent } from '@vytches-ddd/contracts';
import { EVENT_HANDLER_METADATA, EVENT_HANDLER_OPTIONS } from '@vytches-ddd/contracts';

import type { EventHandlerOptions } from './decorators/event-handler.decorator';
import { EventHandler } from './decorators/event-handler.decorator';

// Przykładowe zdarzenia do testowania
class TestEvent implements IDomainEvent {
  eventType = 'TestEvent';
  payload = {};
}

class AnotherTestEvent implements IDomainEvent {
  eventType = 'AnotherTestEvent';
  payload = {};
}

describe('EventHandler Decorator', () => {
  describe('Class Decorator', () => {
    it('should apply metadata to a class', () => {
      // Arrange
      @EventHandler(TestEvent)
      class TestEventHandler {
        // This is added to inform TypeScript that getEventType exists (added by decorator)
        getEventType!: () => typeof TestEvent;

        handle(_event: TestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const metadata = Reflect.getMetadata(EVENT_HANDLER_METADATA, TestEventHandler);

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.eventType).toBe(TestEvent);
    });

    it('should apply options to a class', () => {
      // Arrange
      const options: EventHandlerOptions = {
        active: false,
        priority: 10,
        customOption: 'custom',
      };

      @EventHandler(TestEvent, options)
      class TestEventHandler {
        handle(_event: TestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const appliedOptions = Reflect.getMetadata(EVENT_HANDLER_OPTIONS, TestEventHandler);

      // Assert
      expect(appliedOptions).toBeDefined();
      expect(appliedOptions.active).toBe(false);
      expect(appliedOptions.priority).toBe(10);
      expect(appliedOptions.customOption).toBe('custom');
    });

    it('should add getEventType helper method to the class prototype', () => {
      // Arrange

      @EventHandler(TestEvent)
      class TestEventHandler {
        handle(_event: TestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const handler = new TestEventHandler();
      // @ts-expect-error Cannot be mocked as vitest mock is no type function
      const eventType = handler['getEventType']();

      // Assert
      expect(eventType).toBe(TestEvent);
      // @ts-expect-error Cannot be mocked as vitest mock is no type function
      expect(typeof handler['getEventType']).toBe('function');
    });

    it('should not override existing getEventType method', () => {
      // Arrange
      const customMethod = vi.fn().mockReturnValue('custom');

      class HandlerWithMethod {
        getEventType() {
          return customMethod();
        }

        handle(_event: TestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const DecoratedHandler = EventHandler(TestEvent)(HandlerWithMethod);
      const handler = new DecoratedHandler();
      const result = handler.getEventType();

      // Assert
      expect(customMethod).toHaveBeenCalled();
      expect(result).toBe('custom');
    });

    it('should handle multiple decorators with different event types', () => {
      // Arrange
      @EventHandler(TestEvent)
      class FirstHandler {
        handle(_event: TestEvent): void {
          // Just a test handler
        }
      }

      @EventHandler(AnotherTestEvent)
      class SecondHandler {
        handle(_event: AnotherTestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const firstMetadata = Reflect.getMetadata(EVENT_HANDLER_METADATA, FirstHandler);
      const secondMetadata = Reflect.getMetadata(EVENT_HANDLER_METADATA, SecondHandler);

      // Assert
      expect(firstMetadata.eventType).toBe(TestEvent);
      expect(secondMetadata.eventType).toBe(AnotherTestEvent);
    });
  });

  describe('Method Decorator', () => {
    it('should apply metadata to a method', () => {
      // Arrange
      class TestService {
        @EventHandler(TestEvent)
        handleTestEvent(_event: TestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const metadata = Reflect.getMetadata(
        EVENT_HANDLER_METADATA,
        TestService.prototype.handleTestEvent
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.eventType).toBe(TestEvent);
    });

    it('should apply options to a method', () => {
      // Arrange
      const options: EventHandlerOptions = {
        active: true,
        priority: 5,
        availableFrom: '1.2.0',
      };

      class TestService {
        @EventHandler(TestEvent, options)
        handleTestEvent(_event: TestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const appliedOptions = Reflect.getMetadata(
        EVENT_HANDLER_OPTIONS,
        TestService.prototype.handleTestEvent
      );

      // Assert
      expect(appliedOptions).toBeDefined();
      expect(appliedOptions.active).toBe(true);
      expect(appliedOptions.priority).toBe(5);
      expect(appliedOptions.availableFrom).toBe('1.2.0');
    });

    it('should handle multiple decorated methods in a single class', () => {
      // Arrange
      class MultiEventHandler {
        @EventHandler(TestEvent, { priority: 10 })
        handleTestEvent(_event: TestEvent): void {
          // Handle test event
        }

        @EventHandler(AnotherTestEvent, { priority: 5 })
        handleAnotherEvent(_event: AnotherTestEvent): void {
          // Handle another event
        }

        regularMethod(): void {
          // Not a handler
        }
      }

      // Act
      const firstMetadata = Reflect.getMetadata(
        EVENT_HANDLER_METADATA,
        MultiEventHandler.prototype.handleTestEvent
      );
      const firstOptions = Reflect.getMetadata(
        EVENT_HANDLER_OPTIONS,
        MultiEventHandler.prototype.handleTestEvent
      );

      const secondMetadata = Reflect.getMetadata(
        EVENT_HANDLER_METADATA,
        MultiEventHandler.prototype.handleAnotherEvent
      );
      const secondOptions = Reflect.getMetadata(
        EVENT_HANDLER_OPTIONS,
        MultiEventHandler.prototype.handleAnotherEvent
      );

      const regularMetadata = Reflect.getMetadata(
        EVENT_HANDLER_METADATA,
        MultiEventHandler.prototype.regularMethod
      );

      // Assert
      expect(firstMetadata.eventType).toBe(TestEvent);
      expect(firstOptions.priority).toBe(10);

      expect(secondMetadata.eventType).toBe(AnotherTestEvent);
      expect(secondOptions.priority).toBe(5);

      expect(regularMetadata).toBeUndefined();
    });
  });

  describe('Default options', () => {
    it('should apply default options when none provided for class', () => {
      // Arrange
      @EventHandler(TestEvent)
      class DefaultOptionsHandler {
        handle(_event: TestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const options = Reflect.getMetadata(EVENT_HANDLER_OPTIONS, DefaultOptionsHandler);

      // Assert
      expect(options).toEqual({});
    });

    it('should apply default options when none provided for method', () => {
      // Arrange
      class DefaultOptionsService {
        @EventHandler(TestEvent)
        handleEvent(_event: TestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const options = Reflect.getMetadata(
        EVENT_HANDLER_OPTIONS,
        DefaultOptionsService.prototype.handleEvent
      );

      // Assert
      expect(options).toEqual({});
    });
  });

  describe('Edge cases and integration', () => {
    it('should handle inheritance correctly for class decorators', () => {
      // Arrange
      @EventHandler(TestEvent, { priority: 10 })
      class BaseHandler {
        // This is added to inform TypeScript that getEventType exists (added by decorator)
        getEventType!: () => typeof TestEvent;

        handle(_event: TestEvent): void {
          // Base handler
        }
      }

      class DerivedHandler extends BaseHandler {
        // Inherits the handler behavior
      }

      // Act
      const baseMetadata = Reflect.getMetadata(EVENT_HANDLER_METADATA, BaseHandler);

      const baseInstance = new BaseHandler();
      const derivedInstance = new DerivedHandler();

      // Assert
      expect(baseMetadata.eventType).toBe(TestEvent);

      // Verify that the helper method is inherited through prototype chain
      expect(baseInstance['getEventType']()).toBe(TestEvent);
      expect(derivedInstance['getEventType']()).toBe(TestEvent);

      // Verify that handler functionality is maintained in derived class
      expect(typeof derivedInstance.handle).toBe('function');
    });

    it('should work with complex options', () => {
      // Arrange
      const complexOptions: EventHandlerOptions = {
        active: true,
        priority: 100,
        availableFrom: '2.0.0',
        complexValue: { nested: { data: true } },
        arrayValue: [1, 2, 3],
      };

      @EventHandler(TestEvent, complexOptions)
      class ComplexHandler {
        handle(_event: TestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const options = Reflect.getMetadata(EVENT_HANDLER_OPTIONS, ComplexHandler);

      // Assert
      expect(options).toEqual(complexOptions);
      expect(options.complexValue.nested.data).toBe(true);
      expect(options.arrayValue).toEqual([1, 2, 3]);
    });

    it('should maintain separate metadata for different handlers', () => {
      // Arrange
      @EventHandler(TestEvent, { active: true })
      class FirstHandler {
        handle(_event: TestEvent): void {
          // Just a test handler
        }
      }

      @EventHandler(TestEvent, { active: false })
      class SecondHandler {
        handle(_event: TestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const firstOptions = Reflect.getMetadata(EVENT_HANDLER_OPTIONS, FirstHandler);
      const secondOptions = Reflect.getMetadata(EVENT_HANDLER_OPTIONS, SecondHandler);

      // Assert
      expect(firstOptions.active).toBe(true);
      expect(secondOptions.active).toBe(false);
    });

    it('should not interfere with other decorators', () => {
      // Arrange - Mock another decorator
      function OtherDecorator(value: string) {
        return function (target: any) {
          Reflect.defineMetadata('custom:metadata', value, target);
          return target;
        };
      }

      // Apply both decorators
      @OtherDecorator('test-value')
      @EventHandler(TestEvent)
      class MultiDecoratorHandler {
        handle(_event: TestEvent): void {
          // Just a test handler
        }
      }

      // Act
      const eventMetadata = Reflect.getMetadata(EVENT_HANDLER_METADATA, MultiDecoratorHandler);
      const customMetadata = Reflect.getMetadata('custom:metadata', MultiDecoratorHandler);

      // Assert
      expect(eventMetadata.eventType).toBe(TestEvent);
      expect(customMetadata).toBe('test-value');
    });
  });
});
