import { describe, it, expect } from 'vitest';
import * as validationIndex from '../../../src/core/validation/index';
import { ComponentValidator } from '../../../src/core/validation/component-validator';

describe('Validation Index', () => {
  describe('exports', () => {
    it('should export ComponentValidator', () => {
      expect(validationIndex.ComponentValidator).toBe(ComponentValidator);
    });

    it('should export all expected validation modules', () => {
      const exports = Object.keys(validationIndex);

      expect(exports).toContain('ComponentValidator');
      expect(exports).toHaveLength(1);
    });

    it('should create ComponentValidator instance from export', () => {
      const validator = validationIndex.ComponentValidator.create();

      expect(validator).toBeInstanceOf(ComponentValidator);
    });
  });
});
