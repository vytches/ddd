import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  AsyncCompositeSpecification,
  AndAsyncSpecification,
  OrAsyncSpecification,
  NotAsyncSpecification,
} from '../../src/specifications/async-composite-specification';

describe('AsyncCompositeSpecification', () => {
  // Test data structure
  interface TestCandidate {
    value: number;
    name: string;
    repository?: {
      findByValue: (value: number) => Promise<boolean>;
    };
  }

  // Custom async specification for testing
  class GreaterThanAsyncSpecification extends AsyncCompositeSpecification<TestCandidate> {
    constructor(private readonly threshold: number) {
      super();
    }

    async isSatisfiedByAsync(candidate: TestCandidate): Promise<boolean> {
      // Simulate async operation
      return new Promise(resolve => {
        setTimeout(() => resolve(candidate.value > this.threshold), 10);
      });
    }
  }

  // Repository-based async specification
  class ExistsInRepositorySpecification extends AsyncCompositeSpecification<TestCandidate> {
    async isSatisfiedByAsync(candidate: TestCandidate): Promise<boolean> {
      if (!candidate.repository) {
        return false;
      }
      return candidate.repository.findByValue(candidate.value);
    }
  }

  describe('Basic async specifications', () => {
    it('should create async specification from predicate', async () => {
      const spec = AsyncCompositeSpecification.create<TestCandidate>(
        async candidate => candidate.value > 5,
        'GreaterThanFive',
        'Value must be greater than 5'
      );

      expect(await spec.isSatisfiedByAsync({ value: 10, name: 'test' })).toBe(true);
      expect(await spec.isSatisfiedByAsync({ value: 3, name: 'test' })).toBe(false);
      expect(spec.name).toBe('GreaterThanFive');
      expect(spec.description).toBe('Value must be greater than 5');
    });

    it('should handle async operations correctly', async () => {
      const spec = new GreaterThanAsyncSpecification(5);

      const result1 = await spec.isSatisfiedByAsync({ value: 10, name: 'test' });
      expect(result1).toBe(true);

      const result2 = await spec.isSatisfiedByAsync({ value: 3, name: 'test' });
      expect(result2).toBe(false);
    });

    it('should handle repository-based async specifications', async () => {
      const mockRepository = {
        findByValue: async (value: number) => value > 10,
      };

      const spec = new ExistsInRepositorySpecification();

      const candidate1 = { value: 15, name: 'test', repository: mockRepository };
      const candidate2 = { value: 5, name: 'test', repository: mockRepository };
      const candidate3 = { value: 15, name: 'test' }; // No repository

      expect(await spec.isSatisfiedByAsync(candidate1)).toBe(true);
      expect(await spec.isSatisfiedByAsync(candidate2)).toBe(false);
      expect(await spec.isSatisfiedByAsync(candidate3)).toBe(false);
    });

    it('should pass context to predicate', async () => {
      let receivedContext: Record<string, unknown> | undefined;

      const spec = AsyncCompositeSpecification.create<TestCandidate>(async (candidate, context) => {
        receivedContext = context;
        return candidate.value > 5;
      });

      const context = { userId: 'user123', tenant: 'tenant456' };
      await spec.isSatisfiedByAsync({ value: 10, name: 'test' }, context);

      expect(receivedContext).toEqual(context);
    });
  });

  describe('AND async specifications', () => {
    it('should combine two async specifications with AND logic', async () => {
      const greaterThan5 = new GreaterThanAsyncSpecification(5);
      const greaterThan10 = new GreaterThanAsyncSpecification(10);

      const combined = greaterThan5.and(greaterThan10);

      expect(await combined.isSatisfiedByAsync({ value: 15, name: 'test' })).toBe(true);
      expect(await combined.isSatisfiedByAsync({ value: 8, name: 'test' })).toBe(false);
      expect(await combined.isSatisfiedByAsync({ value: 3, name: 'test' })).toBe(false);
    });

    it('should execute AND specifications in parallel', async () => {
      let call1Started = false;
      let call2Started = false;

      const spec1 = AsyncCompositeSpecification.create<TestCandidate>(async candidate => {
        call1Started = true;
        await new Promise(resolve => setTimeout(resolve, 50));
        return candidate.value > 5;
      });

      const spec2 = AsyncCompositeSpecification.create<TestCandidate>(async candidate => {
        call2Started = true;
        await new Promise(resolve => setTimeout(resolve, 50));
        return candidate.name === 'test';
      });

      const combined = new AndAsyncSpecification(spec1, spec2);
      const startTime = Date.now();

      const result = await combined.isSatisfiedByAsync({ value: 10, name: 'test' });
      const duration = Date.now() - startTime;

      expect(result).toBe(true);
      expect(call1Started).toBe(true);
      expect(call2Started).toBe(true);
      // Should take ~50ms (parallel) not ~100ms (sequential)
      expect(duration).toBeLessThan(80);
    });

    it('should provide meaningful names for AND specifications', () => {
      const spec1 = AsyncCompositeSpecification.create<TestCandidate>(
        async c => c.value > 5,
        'GreaterThanFive'
      );
      const spec2 = AsyncCompositeSpecification.create<TestCandidate>(
        async c => c.name === 'test',
        'NameIsTest'
      );

      const combined = new AndAsyncSpecification(spec1, spec2);
      expect(combined.name).toBe('(GreaterThanFive AND NameIsTest)');
      expect(combined.description).toBe('Both specifications must be satisfied');
    });
  });

  describe('OR async specifications', () => {
    it('should combine two async specifications with OR logic', async () => {
      const greaterThan10 = new GreaterThanAsyncSpecification(10);
      const nameIsTest = AsyncCompositeSpecification.create<TestCandidate>(
        async c => c.name === 'test'
      );

      const combined = greaterThan10.or(nameIsTest);

      expect(await combined.isSatisfiedByAsync({ value: 15, name: 'other' })).toBe(true);
      expect(await combined.isSatisfiedByAsync({ value: 5, name: 'test' })).toBe(true);
      expect(await combined.isSatisfiedByAsync({ value: 15, name: 'test' })).toBe(true);
      expect(await combined.isSatisfiedByAsync({ value: 5, name: 'other' })).toBe(false);
    });

    it('should execute OR specifications in parallel', async () => {
      const spec1 = AsyncCompositeSpecification.create<TestCandidate>(async candidate => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return candidate.value > 100; // Will be false
      });

      const spec2 = AsyncCompositeSpecification.create<TestCandidate>(async candidate => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return candidate.name === 'test'; // Will be true
      });

      const combined = new OrAsyncSpecification(spec1, spec2);
      const startTime = Date.now();

      const result = await combined.isSatisfiedByAsync({ value: 10, name: 'test' });
      const duration = Date.now() - startTime;

      expect(result).toBe(true);
      // Should take ~50ms (parallel) not ~100ms (sequential)
      expect(duration).toBeLessThan(80);
    });

    it('should provide meaningful names for OR specifications', () => {
      const spec1 = AsyncCompositeSpecification.create<TestCandidate>(
        async c => c.value > 100,
        'VeryHigh'
      );
      const spec2 = AsyncCompositeSpecification.create<TestCandidate>(
        async c => c.value < 0,
        'Negative'
      );

      const combined = new OrAsyncSpecification(spec1, spec2);
      expect(combined.name).toBe('(VeryHigh OR Negative)');
      expect(combined.description).toBe('At least one specification must be satisfied');
    });
  });

  describe('NOT async specifications', () => {
    it('should negate an async specification', async () => {
      const greaterThan10 = new GreaterThanAsyncSpecification(10);
      const notGreaterThan10 = greaterThan10.not();

      expect(await notGreaterThan10.isSatisfiedByAsync({ value: 15, name: 'test' })).toBe(false);
      expect(await notGreaterThan10.isSatisfiedByAsync({ value: 5, name: 'test' })).toBe(true);
    });

    it('should provide meaningful names for NOT specifications', () => {
      const spec = AsyncCompositeSpecification.create<TestCandidate>(
        async c => c.value > 10,
        'GreaterThanTen'
      );

      const negated = new NotAsyncSpecification(spec);
      expect(negated.name).toBe('NOT(GreaterThanTen)');
      expect(negated.description).toBe('The specification must NOT be satisfied');
    });
  });

  describe('Complex combinations', () => {
    it('should handle complex async specification combinations', async () => {
      const greaterThan5 = new GreaterThanAsyncSpecification(5);
      const greaterThan10 = new GreaterThanAsyncSpecification(10);
      const nameIsTest = AsyncCompositeSpecification.create<TestCandidate>(
        async c => c.name === 'test'
      );

      // (value > 5 AND name === 'test') OR (value > 10)
      const complex = greaterThan5.and(nameIsTest).or(greaterThan10);

      expect(await complex.isSatisfiedByAsync({ value: 8, name: 'test' })).toBe(true);
      expect(await complex.isSatisfiedByAsync({ value: 12, name: 'other' })).toBe(true);
      expect(await complex.isSatisfiedByAsync({ value: 8, name: 'other' })).toBe(false);
      expect(await complex.isSatisfiedByAsync({ value: 3, name: 'test' })).toBe(false);
    });

    it('should handle nested NOT operations', async () => {
      const greaterThan10 = new GreaterThanAsyncSpecification(10);
      const doubleNegation = greaterThan10.not().not();

      expect(await doubleNegation.isSatisfiedByAsync({ value: 15, name: 'test' })).toBe(true);
      expect(await doubleNegation.isSatisfiedByAsync({ value: 5, name: 'test' })).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle errors in async specifications', async () => {
      const errorSpec = AsyncCompositeSpecification.create<TestCandidate>(async () => {
        throw new Error('Async operation failed');
      });

      const [error] = await safeRun(
        async () => await errorSpec.isSatisfiedByAsync({ value: 10, name: 'test' })
      );

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Async operation failed');
    });

    it('should propagate errors in AND specifications', async () => {
      const goodSpec = AsyncCompositeSpecification.create<TestCandidate>(async c => c.value > 5);
      const errorSpec = AsyncCompositeSpecification.create<TestCandidate>(async () => {
        throw new Error('Database connection failed');
      });

      const combined = new AndAsyncSpecification(goodSpec, errorSpec);

      const [error] = await safeRun(
        async () => await combined.isSatisfiedByAsync({ value: 10, name: 'test' })
      );

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Database connection failed');
    });
  });

  describe('Failure explanations', () => {
    class ExplainableAsyncSpec extends AsyncCompositeSpecification<TestCandidate> {
      constructor(private readonly threshold: number) {
        super();
      }

      async isSatisfiedByAsync(candidate: TestCandidate): Promise<boolean> {
        return candidate.value > this.threshold;
      }

      override async explainFailureAsync(candidate: TestCandidate): Promise<string | null> {
        if (candidate.value <= this.threshold) {
          return `Value ${candidate.value} is not greater than ${this.threshold}`;
        }
        return null;
      }
    }

    it('should explain failures for single specifications', async () => {
      const spec = new ExplainableAsyncSpec(10);
      const candidate = { value: 5, name: 'test' };

      const satisfied = await spec.isSatisfiedByAsync(candidate);
      expect(satisfied).toBe(false);

      const explanation = await spec.explainFailureAsync(candidate);
      expect(explanation).toBe('Value 5 is not greater than 10');
    });

    it('should explain failures for AND specifications', async () => {
      const spec1 = new ExplainableAsyncSpec(5);
      const spec2 = new ExplainableAsyncSpec(10);
      const combined = new AndAsyncSpecification(spec1, spec2);

      const candidate = { value: 7, name: 'test' };
      const explanation = await combined.explainFailureAsync(candidate);

      expect(explanation).toBe('Value 7 is not greater than 10');
    });

    it('should explain failures for OR specifications when both fail', async () => {
      const spec1 = new ExplainableAsyncSpec(10);
      const spec2 = new ExplainableAsyncSpec(20);
      const combined = new OrAsyncSpecification(spec1, spec2);

      const candidate = { value: 5, name: 'test' };
      const explanation = await combined.explainFailureAsync(candidate);

      expect(explanation).toBe(
        '(Value 5 is not greater than 10 OR Value 5 is not greater than 20)'
      );
    });

    it('should not explain failures for OR specifications when one succeeds', async () => {
      const spec1 = new ExplainableAsyncSpec(10);
      const spec2 = new ExplainableAsyncSpec(3);
      const combined = new OrAsyncSpecification(spec1, spec2);

      const candidate = { value: 5, name: 'test' };
      const explanation = await combined.explainFailureAsync(candidate);

      expect(explanation).toBe(null);
    });

    it('should explain failures for NOT specifications', async () => {
      const spec = AsyncCompositeSpecification.create<TestCandidate>(
        async c => c.value > 10,
        'GreaterThanTen'
      );
      const notSpec = new NotAsyncSpecification(spec);

      const candidate = { value: 15, name: 'test' };
      const explanation = await notSpec.explainFailureAsync(candidate);

      expect(explanation).toBe('Expected specification to fail: GreaterThanTen');
    });
  });
});
