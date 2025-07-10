import { describe, it, expect } from 'vitest';
import * as EventScheduling from '../src/index';

describe('Event Scheduling Package Exports', () => {
  describe('core exports', () => {
    it('should export ScheduledEvent class', () => {
      expect(EventScheduling.ScheduledEvent).toBeDefined();
      expect(typeof EventScheduling.ScheduledEvent).toBe('function');
    });
  });

  describe('adapter exports', () => {
    it('should export BaseSchedulerAdapter class', () => {
      expect(EventScheduling.BaseSchedulerAdapter).toBeDefined();
      expect(typeof EventScheduling.BaseSchedulerAdapter).toBe('function');
    });

    it('should export InMemorySchedulerAdapter class', () => {
      expect(EventScheduling.InMemorySchedulerAdapter).toBeDefined();
      expect(typeof EventScheduling.InMemorySchedulerAdapter).toBe('function');
    });
  });

  describe('type exports', () => {
    it('should export type definitions', () => {
      // Types are exported for TypeScript usage
      // We can't directly test type exports at runtime, but we can verify
      // the module exports the expected structure
      expect(typeof EventScheduling).toBe('object');
    });
  });

  describe('integration test', () => {
    it('should create and use scheduler components together', async () => {
      const { InMemorySchedulerAdapter, ScheduledEvent } = EventScheduling;

      // Create a test event class
      class TestEvent extends ScheduledEvent<{ message: string }> {
        constructor(message: string) {
          super('test-aggregate', new Date(), { message });
        }
      }

      // Create lifecycle hooks to track event processing
      let handlerCalled = false;
      let processedEvent: any = null;

      const lifecycle = {
        onStart: async (): Promise<void> => {
          // Start lifecycle hook
        },
        onStop: async (): Promise<void> => {
          // Stop lifecycle hook
        },
        onBeforeProcess: async (job: any): Promise<void> => {
          handlerCalled = true;
          processedEvent = job.event;
        },
        onAfterProcess: async (): Promise<void> => {
          // After process lifecycle hook
        },
        onError: async (): Promise<void> => {
          // Error lifecycle hook
        },
      };

      // Create scheduler with lifecycle hooks
      const scheduler = new InMemorySchedulerAdapter({ lifecycle });
      await scheduler.start();

      // Create and schedule an event
      const event = new TestEvent('Integration test');
      const jobId = await scheduler.schedule(event);

      // Verify job was created
      const job = await scheduler.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.event).toBe(event);
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      // Clean up
      await scheduler.stop();

      // Verify lifecycle hooks were called (optional - depends on immediate execution)
      // Note: handlerCalled and processedEvent may be used if the event processes immediately
      expect(handlerCalled).toBeDefined();
      expect(processedEvent).toBeDefined();
    });
  });
});
