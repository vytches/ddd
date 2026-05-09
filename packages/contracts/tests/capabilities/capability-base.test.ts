import { describe, it, expect } from 'vitest';
import { Capability } from '../../src/capabilities/capability-base';
import { safeRun } from '../_helpers/safe-run';

class ConcreteCapability extends Capability<'concrete'> {
  readonly type = 'concrete' as const;

  static override get capabilityType(): string {
    return 'concrete';
  }
}

describe('Capability', () => {
  describe('type property', () => {
    it('should have the correct type', () => {
      const capability = new ConcreteCapability();
      expect(capability.type).toBe('concrete');
    });
  });

  describe('metadata', () => {
    it('should allow setting metadata', () => {
      const capability = new ConcreteCapability();
      capability.metadata = { key: 'value' };
      expect(capability.metadata).toEqual({ key: 'value' });
    });

    it('should be undefined by default', () => {
      const capability = new ConcreteCapability();
      expect(capability.metadata).toBeUndefined();
    });
  });

  describe('isType', () => {
    it('should return true for matching type', () => {
      const capability = new ConcreteCapability();
      expect(capability.isType('concrete')).toBe(true);
    });

    it('should return false for non-matching type', () => {
      const capability = new ConcreteCapability();
      expect(capability.isType('other')).toBe(false);
    });
  });

  describe('static capabilityType', () => {
    it('should return the capability type', () => {
      expect(ConcreteCapability.capabilityType).toBe('concrete');
    });

    it('should throw when not overridden', () => {
      class BadCapability extends Capability<'bad'> {
        readonly type = 'bad' as const;
        // Not overriding capabilityType
      }

      const [error] = safeRun(() => BadCapability.capabilityType);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('must override');
    });
  });
});
