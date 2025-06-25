import { describe, it, expect } from 'vitest';
import { playground } from './index';

describe('Playground Tests', () => {
  it('should be active', () => {
    expect(playground.active).toBe(true);
  });
});
