/**
 * Simple seeded random number generator
 * Used for reproducible randomization of examples
 */
export class SeededRandom {
  private seed: number;

  constructor(seed = 'default') {
    this.seed = this.hashCode(seed);
  }

  /**
   * Generate next random number between 0 and 1
   */
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate random boolean
   */
  nextBoolean(): boolean {
    return this.next() > 0.5;
  }

  /**
   * Shuffle array in place
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = result[i];
      const temp2 = result[j];
      if (temp !== undefined && temp2 !== undefined) {
        [result[i], result[j]] = [temp2, temp];
      }
    }
    return result;
  }

  /**
   * Pick random element from array
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[this.nextInt(0, array.length - 1)]!;
  }

  /**
   * Pick N random elements from array
   */
  pickN<T>(array: T[], n: number): T[] {
    if (n >= array.length) return [...array];

    const shuffled = this.shuffle(array);
    return shuffled.slice(0, n);
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
