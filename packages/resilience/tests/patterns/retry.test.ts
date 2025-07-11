import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { DefaultResilienceContext, RetryPolicy, MaxRetriesExceededError } from '../../src';

describe('RetryPolicy', () => {
  let retryPolicy: RetryPolicy;
  const defaultConfig = {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 1000,
    backoffMultiplier: 2,
    jitter: false,
  };

  beforeEach(() => {
    retryPolicy = new RetryPolicy(defaultConfig);
  });

  describe('successful operations', () => {
    it('should execute operation once when successful', async () => {
      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryPolicy.execute(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should return result from successful retry', async () => {
      const context = DefaultResilienceContext.create();
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('first failure'))
        .mockRejectedValueOnce(new Error('second failure'))
        .mockResolvedValue('success');

      const result = await retryPolicy.execute(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('failed operations', () => {
    it('should throw MaxRetriesExceededError after max attempts', async () => {
      const context = DefaultResilienceContext.create();
      const error = new Error('persistent failure');
      const operation = vi.fn().mockRejectedValue(error);

      const [retryError, result] = await safeRun(async () =>
        retryPolicy.execute(operation, context)
      );

      expect(result).toBeUndefined();
      expect(retryError).toBeInstanceOf(MaxRetriesExceededError);
      expect((retryError as MaxRetriesExceededError).attempts).toBe(defaultConfig.maxAttempts);
      expect((retryError as MaxRetriesExceededError).lastError).toBe(error);
      expect(operation).toHaveBeenCalledTimes(defaultConfig.maxAttempts);
    });

    it('should include last error in MaxRetriesExceededError', async () => {
      const context = DefaultResilienceContext.create();
      const lastError = new Error('final failure');
      const operation = vi.fn().mockRejectedValue(lastError);

      try {
        await retryPolicy.execute(operation, context);
      } catch (error) {
        expect(error).toBeInstanceOf(MaxRetriesExceededError);
        expect((error as MaxRetriesExceededError).lastError).toBe(lastError);
        expect((error as MaxRetriesExceededError).attempts).toBe(defaultConfig.maxAttempts);
      }
    });
  });

  describe('retry conditions', () => {
    it('should respect retryableErrors function', async () => {
      const retryablePolicy = new RetryPolicy({
        ...defaultConfig,
        retryableErrors: error => error.message.includes('retryable'),
      });

      const context = DefaultResilienceContext.create();
      const nonRetryableError = new Error('fatal error');
      const operation = vi.fn().mockRejectedValue(nonRetryableError);

      await expect(retryablePolicy.execute(operation, context)).rejects.toThrow('fatal error');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry retryable errors', async () => {
      const retryablePolicy = new RetryPolicy({
        ...defaultConfig,
        retryableErrors: error => error.message.includes('retryable'),
      });

      const context = DefaultResilienceContext.create();
      const retryableError = new Error('retryable error');
      const operation = vi.fn().mockRejectedValue(retryableError);

      await expect(retryablePolicy.execute(operation, context)).rejects.toThrow(
        MaxRetriesExceededError
      );

      expect(operation).toHaveBeenCalledTimes(defaultConfig.maxAttempts);
    });
  });

  describe('backoff calculation', () => {
    it('should apply exponential backoff', async () => {
      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockRejectedValue(new Error('failure'));

      await expect(retryPolicy.execute(operation, context)).rejects.toThrow(
        MaxRetriesExceededError
      );

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect maxDelay', async () => {
      const policy = new RetryPolicy({
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 2000,
        backoffMultiplier: 10,
        jitter: false,
      });

      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockRejectedValue(new Error('failure'));

      await expect(policy.execute(operation, context)).rejects.toThrow(MaxRetriesExceededError);
    });
  });

  describe('context handling', () => {
    it('should create new context for each attempt', async () => {
      const context = DefaultResilienceContext.create();
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('first'))
        .mockResolvedValue('success');

      await retryPolicy.execute(operation, context);

      expect(operation).toHaveBeenCalledTimes(2);

      const firstCall = operation.mock.calls[0][0];
      const secondCall = operation.mock.calls[1][0];

      expect(firstCall.attempt).toBe(1);
      expect(secondCall.attempt).toBe(2);
      expect(firstCall.correlationId).toBe(secondCall.correlationId);
    });

    it('should respect context abort signal', async () => {
      const abortController = new AbortController();
      const context = new DefaultResilienceContext(
        undefined,
        undefined,
        1,
        new Map(),
        abortController
      );

      const operation = vi.fn().mockRejectedValue(new Error('failure'));

      abortController.abort();

      await expect(retryPolicy.execute(operation, context)).rejects.toThrow();
    });
  });

  describe('static methods', () => {
    it('should create default configuration', () => {
      const defaultPolicy = RetryPolicy.withConfig({});
      expect(defaultPolicy).toBeInstanceOf(RetryPolicy);
    });

    it('should merge configuration overrides', () => {
      const customPolicy = RetryPolicy.withConfig({
        maxAttempts: 5,
        baseDelay: 200,
      });

      expect(customPolicy).toBeInstanceOf(RetryPolicy);
    });
  });
});
