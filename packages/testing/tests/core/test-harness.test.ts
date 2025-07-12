import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { TestHarness, SimpleTestHarness, TestResourceBuilder } from '../../src';

describe('TestHarness', () => {
  describe('SimpleTestHarness', () => {
    let harness: SimpleTestHarness;

    beforeEach(() => {
      harness = new SimpleTestHarness();
    });

    afterEach(async () => {
      await harness.dispose();
    });

    describe('initialization', () => {
      it('should initialize successfully with default options', async () => {
        await harness.initialize();

        const state = harness.getState();
        expect(state.isInitialized).toBe(true);
        expect(state.isSetup).toBe(false);
        expect(state.hasErrors).toBe(false);
      });

      it('should call custom initialization if provided', async () => {
        const setupFn = vi.fn();
        const customHarness = new SimpleTestHarness({ setupFn });

        await customHarness.initialize();
        await customHarness.setup();

        expect(setupFn).toHaveBeenCalledTimes(1);

        await customHarness.dispose();
      });

      it('should not allow double initialization', async () => {
        await harness.initialize();

        // Second initialization should be idempotent
        await harness.initialize();

        const state = harness.getState();
        expect(state.isInitialized).toBe(true);
      });

      it('should require initialization before setup', async () => {
        const [setupError] = await safeRun(() => harness.setup());
        expect(setupError?.message).toBe(
          'TestHarness must be initialized before use. Call initialize() first.'
        );
      });
    });

    describe('setup and teardown', () => {
      beforeEach(async () => {
        await harness.initialize();
      });

      it('should setup and teardown successfully', async () => {
        await harness.setup();

        let state = harness.getState();
        expect(state.isSetup).toBe(true);
        expect(state.setupTime).toBeInstanceOf(Date);

        await harness.teardown();

        state = harness.getState();
        expect(state.isSetup).toBe(false);
        expect(state.teardownTime).toBeInstanceOf(Date);
      });

      it('should call custom setup and teardown functions', async () => {
        const setupFn = vi.fn();
        const teardownFn = vi.fn();
        const customHarness = new SimpleTestHarness({ setupFn, teardownFn });

        await customHarness.initialize();
        await customHarness.setup();
        await customHarness.teardown();

        expect(setupFn).toHaveBeenCalledTimes(1);
        expect(teardownFn).toHaveBeenCalledTimes(1);

        await customHarness.dispose();
      });

      it('should handle setup errors gracefully', async () => {
        const errorMessage = 'Setup failed';
        const setupFn = vi.fn().mockRejectedValue(new Error(errorMessage));
        const customHarness = new SimpleTestHarness({ setupFn });

        await customHarness.initialize();

        const [setupError] = await safeRun(() => customHarness.setup());
        expect(setupError?.message).toBe(`Failed to setup TestHarness: ${errorMessage}`);

        const errors = customHarness.getErrors();
        expect(errors).toHaveLength(1);
        expect(errors?.[0]?.message).toBe(errorMessage);

        await customHarness.dispose();
      });

      it('should handle teardown errors gracefully without throwing', async () => {
        const teardownFn = vi.fn().mockRejectedValue(new Error('Teardown failed'));
        const customHarness = new SimpleTestHarness({ teardownFn });

        await customHarness.initialize();
        await customHarness.setup();

        // Teardown should not throw even if teardown function fails
        const [teardownError] = await safeRun(() => customHarness.teardown());
        expect(teardownError).toBeUndefined();

        const errors = customHarness.getErrors();
        expect(errors).toHaveLength(1);
        expect(errors?.[0]?.message).toBe('Teardown failed');

        await customHarness.dispose();
      });

      it('should reset harness if already set up', async () => {
        await harness.setup();
        expect(harness.getState().isSetup).toBe(true);

        // Second setup should reset first
        await harness.setup();
        expect(harness.getState().isSetup).toBe(true);
      });
    });

    describe('resource management', () => {
      beforeEach(async () => {
        await harness.initialize();
        await harness.setup();
      });

      it('should register and dispose resources automatically', async () => {
        const disposeFn = vi.fn();
        const resource = TestResourceBuilder.create('test-resource')
          .withDisposal(disposeFn)
          .build();

        // Access protected method for testing
        (harness as any).registerResource(resource);

        expect(harness.getState().resourceCount).toBe(1);

        await harness.teardown();

        expect(disposeFn).toHaveBeenCalledTimes(1);
        expect(harness.getState().resourceCount).toBe(0);
      });

      it('should unregister resources manually', async () => {
        const resource = TestResourceBuilder.create('test-resource', 'manual-resource').build();

        (harness as any).registerResource(resource);
        expect(harness.getState().resourceCount).toBe(1);

        const unregistered = (harness as any).unregisterResource('manual-resource');
        expect(unregistered).toBe(true);
        expect(harness.getState().resourceCount).toBe(0);
      });

      it('should handle resource disposal errors gracefully', async () => {
        const disposeFn = vi.fn().mockRejectedValue(new Error('Disposal failed'));
        const resource = TestResourceBuilder.create('failing-resource')
          .withDisposal(disposeFn)
          .build();

        (harness as any).registerResource(resource);

        await harness.teardown();

        expect(disposeFn).toHaveBeenCalledTimes(1);
        const errors = harness.getErrors();
        expect(errors.some(e => e.message === 'Disposal failed')).toBe(true);
      });
    });

    describe('time freezing integration', () => {
      it('should provide test clock when enabled', async () => {
        const timeHarness = new SimpleTestHarness({ enableTimeFreezing: true });
        await timeHarness.initialize();
        await timeHarness.setup();

        const testClock = (timeHarness as any).getTestClock();
        expect(testClock).toBeDefined();
        expect(typeof testClock.freeze).toBe('function');

        await timeHarness.dispose();
      });

      it('should throw error when accessing test clock if not enabled', async () => {
        await harness.initialize();
        await harness.setup();

        const [clockError] = safeRun(() => (harness as any).getTestClock());
        expect(clockError?.message).toBe(
          'TestClock is not enabled. Set enableTimeFreezing: true in options.'
        );
      });

      it('should restore test clock during teardown', async () => {
        const timeHarness = new SimpleTestHarness({ enableTimeFreezing: true });
        await timeHarness.initialize();
        await timeHarness.setup();

        const testClock = (timeHarness as any).getTestClock();
        const freezeDate = new Date('2024-01-01T12:00:00Z');
        testClock.freeze(freezeDate);

        expect(testClock.isFrozen()).toBe(true);

        await timeHarness.teardown();

        // Clock should be restored after teardown
        expect(testClock.isFrozen()).toBe(false);

        await timeHarness.dispose();
      });
    });

    describe('safe execution utilities', () => {
      beforeEach(async () => {
        await harness.initialize();
        await harness.setup();
      });

      it('should execute functions safely and return success', async () => {
        const result = (harness as any).safeExecute(() => 'success');
        const [error, value] = result;

        expect(error).toBeUndefined();
        expect(value).toBe('success');
      });

      it('should execute functions safely and capture errors', async () => {
        const testError = new Error('test error');
        const result = (harness as any).safeExecute(() => {
          throw testError;
        });
        const [error, value] = result;

        expect(error).toBe(testError);
        expect(value).toBeUndefined();
      });

      it('should provide error assertion utilities', async () => {
        const result = (harness as any).safeExecute(() => {
          throw new TypeError('type error');
        });

        const errorExtractor = (harness as any).expectError(TypeError);
        const error = errorExtractor(result);

        expect(error).toBeInstanceOf(TypeError);
        expect(error.message).toBe('type error');
      });

      it('should provide success assertion utilities', async () => {
        const testValue = { id: 1, name: 'test' };
        const result = (harness as any).safeExecute(() => testValue);

        const value = (harness as any).expectSuccess(result);
        expect(value).toEqual(testValue);
      });
    });

    describe('reset functionality', () => {
      beforeEach(async () => {
        await harness.initialize();
        await harness.setup();
      });

      it('should reset harness state', async () => {
        // Simulate some error
        (harness as any)._errors.push(new Error('test error'));
        expect(harness.getErrors()).toHaveLength(1);

        await harness.reset();

        expect(harness.getErrors()).toHaveLength(0);
      });

      it('should require initialization for reset', async () => {
        const freshHarness = new SimpleTestHarness();

        const [resetError] = await safeRun(() => freshHarness.reset());
        expect(resetError?.message).toBe(
          'TestHarness must be initialized before use. Call initialize() first.'
        );

        await freshHarness.dispose();
      });
    });

    describe('disposal', () => {
      it('should dispose cleanly even if not set up', async () => {
        await harness.initialize();

        const [disposeError] = await safeRun(() => harness.dispose());
        expect(disposeError).toBeUndefined();

        const state = harness.getState();
        expect(state.isInitialized).toBe(false);
      });

      it('should dispose all resources during disposal', async () => {
        const disposeFn = vi.fn();
        const resource = TestResourceBuilder.create('disposal-test')
          .withDisposal(disposeFn)
          .build();

        await harness.initialize();
        await harness.setup();
        (harness as any).registerResource(resource);

        await harness.dispose();

        expect(disposeFn).toHaveBeenCalledTimes(1);
        expect(harness.getState().isInitialized).toBe(false);
      });
    });

    describe('logging', () => {
      it('should log messages when verbose is enabled', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
          return;
        });
        const verboseHarness = new SimpleTestHarness({ verbose: true });

        await verboseHarness.initialize();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[.*\] \[SimpleTestHarness\] TestHarness initialized successfully/)
        );

        consoleSpy.mockRestore();
        await verboseHarness.dispose();
      });

      it('should not log messages when verbose is disabled', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
          return;
        });

        await harness.initialize();

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });
  });

  describe('TestResourceBuilder', () => {
    it('should create resource with default ID', () => {
      const resource = TestResourceBuilder.create('test-type').build();

      expect(resource.type).toBe('test-type');
      expect(resource.id).toMatch(/^test-type-\d+-[a-z0-9]+$/);
      expect(resource.created).toBeInstanceOf(Date);
      expect(typeof resource.dispose).toBe('function');
    });

    it('should create resource with custom ID', () => {
      const resource = TestResourceBuilder.create('test-type').withId('custom-id').build();

      expect(resource.id).toBe('custom-id');
      expect(resource.type).toBe('test-type');
    });

    it('should create resource with custom disposal function', async () => {
      const disposeFn = vi.fn();
      const resource = TestResourceBuilder.create('test-type').withDisposal(disposeFn).build();

      await resource.dispose();
      expect(disposeFn).toHaveBeenCalledTimes(1);
    });

    it('should handle disposal without custom function', async () => {
      const resource = TestResourceBuilder.create('test-type').build();

      const [resourceDisposeError] = await safeRun(() => resource.dispose());
      expect(resourceDisposeError).toBeUndefined();
    });

    it('should support fluent builder pattern', () => {
      const disposeFn = vi.fn();
      const resource = TestResourceBuilder.create('fluent-type')
        .withId('fluent-id')
        .withDisposal(disposeFn)
        .build();

      expect(resource.type).toBe('fluent-type');
      expect(resource.id).toBe('fluent-id');
      expect(resource.dispose).toBe(disposeFn);
    });
  });

  describe('custom TestHarness implementation', () => {
    class CustomTestHarness extends TestHarness {
      private initCalled = false;
      private setupCalled = false;
      private teardownCalled = false;
      private resetCalled = false;
      private disposalCalled = false;

      protected async performInitialization(): Promise<void> {
        this.initCalled = true;
      }

      protected async performSetup(): Promise<void> {
        this.setupCalled = true;
      }

      protected async performTeardown(): Promise<void> {
        this.teardownCalled = true;
      }

      protected async performReset(): Promise<void> {
        this.resetCalled = true;
      }

      protected async performDisposal(): Promise<void> {
        this.disposalCalled = true;
      }

      // Expose for testing
      get calls() {
        return {
          init: this.initCalled,
          setup: this.setupCalled,
          teardown: this.teardownCalled,
          reset: this.resetCalled,
          disposal: this.disposalCalled,
        };
      }
    }

    it('should call all lifecycle methods correctly', async () => {
      const harness = new CustomTestHarness();

      await harness.initialize();
      expect(harness.calls.init).toBe(true);

      await harness.setup();
      expect(harness.calls.setup).toBe(true);

      await harness.reset();
      expect(harness.calls.reset).toBe(true);

      await harness.teardown();
      expect(harness.calls.teardown).toBe(true);

      await harness.dispose();
      expect(harness.calls.disposal).toBe(true);
    });

    it('should maintain proper state throughout lifecycle', async () => {
      const harness = new CustomTestHarness({ verbose: true });

      let state = harness.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.isSetup).toBe(false);

      await harness.initialize();
      state = harness.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isSetup).toBe(false);

      await harness.setup();
      state = harness.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isSetup).toBe(true);
      expect(state.setupTime).toBeInstanceOf(Date);

      await harness.teardown();
      state = harness.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isSetup).toBe(false);
      expect(state.teardownTime).toBeInstanceOf(Date);

      await harness.dispose();
      state = harness.getState();
      expect(state.isInitialized).toBe(false);
    });
  });
});
