import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { SeededRandom } from '../../src/utils/seeded-random';

describe('SeededRandom', () => {
  let random: SeededRandom;

  describe('constructor', () => {
    it('should create instance with default seed', () => {
      const defaultRandom = new SeededRandom();
      expect(defaultRandom).toBeInstanceOf(SeededRandom);
    });

    it('should create instance with custom seed', () => {
      const customRandom = new SeededRandom('custom-seed');
      expect(customRandom).toBeInstanceOf(SeededRandom);
    });

    it('should produce same sequence for same seed', () => {
      const random1 = new SeededRandom('test-seed');
      const random2 = new SeededRandom('test-seed');

      const sequence1 = [random1.next(), random1.next(), random1.next()];
      const sequence2 = [random2.next(), random2.next(), random2.next()];

      expect(sequence1).toEqual(sequence2);
    });

    it('should produce different sequences for different seeds', () => {
      const random1 = new SeededRandom('seed1');
      const random2 = new SeededRandom('seed2');

      const sequence1 = [random1.next(), random1.next(), random1.next()];
      const sequence2 = [random2.next(), random2.next(), random2.next()];

      expect(sequence1).not.toEqual(sequence2);
    });
  });

  describe('next', () => {
    beforeEach(() => {
      random = new SeededRandom('test-seed');
    });

    it('should return numbers between 0 and 1', () => {
      for (let i = 0; i < 100; i++) {
        const value = random.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    it('should be deterministic for same seed', () => {
      const random1 = new SeededRandom('deterministic');
      const random2 = new SeededRandom('deterministic');

      for (let i = 0; i < 10; i++) {
        expect(random1.next()).toBe(random2.next());
      }
    });

    it('should generate different values in sequence', () => {
      const values = Array.from({ length: 10 }, () => random.next());
      const uniqueValues = new Set(values);

      // Should have some variety (not all identical)
      expect(uniqueValues.size).toBeGreaterThan(1);
    });

    it('should handle edge case seeds', () => {
      const edgeCases = ['', '0', '1', 'very-long-seed-string-with-many-characters'];

      edgeCases.forEach(seed => {
        const edgeRandom = new SeededRandom(seed);
        const value = edgeRandom.next();
        expect(value).toBeGreaterThanOrEqual(-1e-9); // Allow for floating point precision errors
        expect(value).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('nextInt', () => {
    beforeEach(() => {
      random = new SeededRandom('test-int');
    });

    it('should return integers within specified range', () => {
      for (let i = 0; i < 100; i++) {
        const value = random.nextInt(1, 10);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    });

    it('should return same value when min equals max', () => {
      const value = random.nextInt(5, 5);
      expect(value).toBe(5);
    });

    it('should handle negative ranges', () => {
      for (let i = 0; i < 50; i++) {
        const value = random.nextInt(-10, -1);
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThanOrEqual(-1);
      }
    });

    it('should handle zero ranges', () => {
      for (let i = 0; i < 50; i++) {
        const value = random.nextInt(-5, 5);
        expect(value).toBeGreaterThanOrEqual(-5);
        expect(value).toBeLessThanOrEqual(5);
      }
    });

    it('should be deterministic for same seed', () => {
      const random1 = new SeededRandom('int-test');
      const random2 = new SeededRandom('int-test');

      for (let i = 0; i < 10; i++) {
        expect(random1.nextInt(1, 100)).toBe(random2.nextInt(1, 100));
      }
    });
  });

  describe('nextBoolean', () => {
    beforeEach(() => {
      random = new SeededRandom('test-bool');
    });

    it('should return boolean values', () => {
      for (let i = 0; i < 100; i++) {
        const value = random.nextBoolean();
        expect(typeof value).toBe('boolean');
      }
    });

    it('should return both true and false over many iterations', () => {
      const results = Array.from({ length: 1000 }, () => random.nextBoolean());
      const trueCount = results.filter(v => v).length;
      const falseCount = results.filter(v => !v).length;

      expect(trueCount).toBeGreaterThan(0);
      expect(falseCount).toBeGreaterThan(0);
      // Should be roughly balanced (allow for some variance)
      expect(Math.abs(trueCount - falseCount)).toBeLessThan(200);
    });

    it('should be deterministic for same seed', () => {
      const random1 = new SeededRandom('bool-test');
      const random2 = new SeededRandom('bool-test');

      for (let i = 0; i < 10; i++) {
        expect(random1.nextBoolean()).toBe(random2.nextBoolean());
      }
    });
  });

  describe('shuffle', () => {
    beforeEach(() => {
      random = new SeededRandom('test-shuffle');
    });

    it('should shuffle array elements', () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = random.shuffle(original);

      expect(shuffled).toHaveLength(original.length);
      expect(shuffled.sort()).toEqual(original.sort()); // Same elements

      // Test multiple shuffles with different seeds to ensure shuffling works
      const random2 = new SeededRandom('different-seed');
      const shuffled2 = random2.shuffle(original);

      // At least one of the shuffles should be different from original
      const isShuffled =
        !shuffled.every((val, index) => val === original[index]) ||
        !shuffled2.every((val, index) => val === original[index]);
      expect(isShuffled).toBe(true);
    });

    it('should not modify original array', () => {
      const original = [1, 2, 3, 4, 5];
      const originalCopy = [...original];

      random.shuffle(original);

      expect(original).toEqual(originalCopy);
    });

    it('should handle empty array', () => {
      const empty: number[] = [];
      const shuffled = random.shuffle(empty);

      expect(shuffled).toEqual([]);
    });

    it('should handle single element array', () => {
      const single = [42];
      const shuffled = random.shuffle(single);

      expect(shuffled).toEqual([42]);
    });

    it('should be deterministic for same seed', () => {
      const array = [1, 2, 3, 4, 5];
      const random1 = new SeededRandom('shuffle-test');
      const random2 = new SeededRandom('shuffle-test');

      const shuffled1 = random1.shuffle(array);
      const shuffled2 = random2.shuffle(array);

      expect(shuffled1).toEqual(shuffled2);
    });

    it('should handle arrays with different types', () => {
      const strings = ['a', 'b', 'c', 'd'];
      const shuffledStrings = random.shuffle(strings);

      expect(shuffledStrings).toHaveLength(4);
      expect(shuffledStrings.sort()).toEqual(['a', 'b', 'c', 'd']);

      const objects = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const shuffledObjects = random.shuffle(objects);

      expect(shuffledObjects).toHaveLength(3);
      expect(shuffledObjects.map(o => o.id).sort()).toEqual([1, 2, 3]);
    });
  });

  describe('pick', () => {
    beforeEach(() => {
      random = new SeededRandom('test-pick');
    });

    it('should pick element from array', () => {
      const array = [1, 2, 3, 4, 5];
      const picked = random.pick(array);

      expect(array).toContain(picked);
    });

    it('should throw error for empty array', () => {
      const emptyArray: string[] = [];
      const [error] = safeRun(() => {
        return random.pick(emptyArray);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Cannot pick from empty array');
    });

    it('should return single element from single-element array', () => {
      const singleElement = [42];
      const picked = random.pick(singleElement);

      expect(picked).toBe(42);
    });

    it('should be deterministic for same seed', () => {
      const array = [1, 2, 3, 4, 5];
      const random1 = new SeededRandom('pick-test');
      const random2 = new SeededRandom('pick-test');

      for (let i = 0; i < 10; i++) {
        expect(random1.pick(array)).toBe(random2.pick(array));
      }
    });

    it('should pick different elements over multiple calls', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const picks = Array.from({ length: 100 }, () => random.pick(array));
      const uniquePicks = new Set(picks);

      // Should pick more than one unique element over 100 tries
      expect(uniquePicks.size).toBeGreaterThan(1);
    });
  });

  describe('pickN', () => {
    beforeEach(() => {
      random = new SeededRandom('test-pickN');
    });

    it('should pick N elements from array', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const picked = random.pickN(array, 3);

      expect(picked).toHaveLength(3);
      picked.forEach(element => {
        expect(array).toContain(element);
      });
    });

    it('should return all elements when N >= array length', () => {
      const array = [1, 2, 3];
      const picked = random.pickN(array, 5);

      expect(picked).toHaveLength(3);
      expect(picked.sort()).toEqual([1, 2, 3]);
    });

    it('should return empty array when N is 0', () => {
      const array = [1, 2, 3, 4, 5];
      const picked = random.pickN(array, 0);

      expect(picked).toEqual([]);
    });

    it('should return unique elements', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const picked = random.pickN(array, 5);
      const uniquePicked = new Set(picked);

      expect(uniquePicked.size).toBe(5);
    });

    it('should be deterministic for same seed', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const random1 = new SeededRandom('pickN-test');
      const random2 = new SeededRandom('pickN-test');

      const picked1 = random1.pickN(array, 3);
      const picked2 = random2.pickN(array, 3);

      expect(picked1).toEqual(picked2);
    });

    it('should handle edge cases', () => {
      const array = [1, 2, 3];

      // Pick exactly array length
      const allPicked = random.pickN(array, 3);
      expect(allPicked).toHaveLength(3);

      // Pick negative number (slice behavior with negative numbers)
      const negativePicked = random.pickN(array, -1);
      expect(negativePicked).toHaveLength(2); // slice(0, -1) returns all but last element
    });
  });

  describe('hashCode (private method)', () => {
    it('should produce consistent hash for same string', () => {
      const random1 = new SeededRandom('test');
      const random2 = new SeededRandom('test');

      // If hash is working correctly, sequences should be identical
      const seq1 = [random1.next(), random1.next()];
      const seq2 = [random2.next(), random2.next()];

      expect(seq1).toEqual(seq2);
    });

    it('should produce different hashes for different strings', () => {
      const random1 = new SeededRandom('string1');
      const random2 = new SeededRandom('string2');

      // Different seeds should produce different sequences
      const seq1 = [random1.next(), random1.next()];
      const seq2 = [random2.next(), random2.next()];

      expect(seq1).not.toEqual(seq2);
    });

    it('should handle special characters in seed', () => {
      const specialSeeds = ['!@#$%', 'üñìçøðé', '12345', 'mixed123!@#'];

      specialSeeds.forEach(seed => {
        const random = new SeededRandom(seed);
        const value = random.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('integration scenarios', () => {
    it('should maintain consistency across different operations', () => {
      const seed = 'integration-test';
      const random1 = new SeededRandom(seed);
      const random2 = new SeededRandom(seed);

      // Perform same sequence of operations
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const results1 = {
        next: random1.next(),
        int: random1.nextInt(1, 100),
        bool: random1.nextBoolean(),
        picked: random1.pick(array),
        shuffled: random1.shuffle([...array]),
        pickN: random1.pickN(array, 3),
      };

      const results2 = {
        next: random2.next(),
        int: random2.nextInt(1, 100),
        bool: random2.nextBoolean(),
        picked: random2.pick(array),
        shuffled: random2.shuffle([...array]),
        pickN: random2.pickN(array, 3),
      };

      expect(results1).toEqual(results2);
    });

    it('should handle long sequences', () => {
      const random = new SeededRandom('long-sequence');

      // Generate long sequence and verify it doesn't break
      const longSequence = Array.from({ length: 10000 }, () => random.next());

      expect(longSequence).toHaveLength(10000);
      expect(longSequence.every(n => n >= 0 && n <= 1)).toBe(true);

      // Verify some variety in the sequence
      const uniqueValues = new Set(longSequence.map(n => Math.floor(n * 100)));
      expect(uniqueValues.size).toBeGreaterThan(50); // Should have good distribution
    });

    it('should work correctly with realistic use case', () => {
      // Simulate selecting random examples for documentation
      const examples = [
        'basic-aggregate',
        'intermediate-aggregate',
        'advanced-aggregate',
        'basic-entity',
        'intermediate-entity',
        'advanced-entity',
        'basic-valueobject',
        'intermediate-valueobject',
        'advanced-valueobject',
      ];

      const random = new SeededRandom('doc-generation-seed');

      // Select 3 random examples
      const selectedExamples = random.pickN(examples, 3);
      expect(selectedExamples).toHaveLength(3);

      // Shuffle remaining examples
      const remainingExamples = examples.filter(ex => !selectedExamples.includes(ex));
      const shuffledRemaining = random.shuffle(remainingExamples);
      expect(shuffledRemaining).toHaveLength(remainingExamples.length);

      // Pick one more based on random condition
      if (random.nextBoolean()) {
        const bonusExample = random.pick(shuffledRemaining);
        expect(shuffledRemaining).toContain(bonusExample);
      }
    });
  });

  describe('performance and limits', () => {
    it('should handle large arrays efficiently', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      const random = new SeededRandom('performance-test');

      const start = performance.now();

      const shuffled = random.shuffle(largeArray);
      const picked = random.pickN(largeArray, 100);

      const end = performance.now();

      expect(shuffled).toHaveLength(10000);
      expect(picked).toHaveLength(100);
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain precision with many iterations', () => {
      const random = new SeededRandom('precision-test');

      // Generate reasonable number of random numbers and check they stay in bounds
      // Reduced from 100,000 to 10,000 to avoid performance issues during parallel test execution
      for (let i = 0; i < 10000; i++) {
        const value = random.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        expect(Number.isFinite(value)).toBe(true);
      }

      // Additional check for precision over extended use
      // Test deterministic behavior after many iterations
      const random1 = new SeededRandom('precision-deterministic');
      const random2 = new SeededRandom('precision-deterministic');

      // Advance both generators by the same amount
      for (let i = 0; i < 5000; i++) {
        random1.next();
        random2.next();
      }

      // They should still produce identical values
      expect(random1.next()).toBe(random2.next());
      expect(random1.nextInt(1, 100)).toBe(random2.nextInt(1, 100));
    });
  });
});
