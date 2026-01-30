import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityRegistry } from '../../src/capabilities/capability-registry';
import { Capability } from '../../src/capabilities/capability-base';

class TestCapability extends Capability<'test'> {
  readonly type = 'test' as const;
  static override get capabilityType(): string {
    return 'test';
  }
}

class AnotherCapability extends Capability<'another'> {
  readonly type = 'another' as const;
  static override get capabilityType(): string {
    return 'another';
  }
}

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry();
  });

  describe('register', () => {
    it('should register a capability', () => {
      const capability = new TestCapability();
      registry.register(capability);
      expect(registry.hasByType('test')).toBe(true);
    });

    it('should return this for chaining', () => {
      const capability = new TestCapability();
      const result = registry.register(capability);
      expect(result).toBe(registry);
    });

    it('should overwrite existing capability of same type', () => {
      const cap1 = new TestCapability();
      cap1.metadata = { version: 1 };
      const cap2 = new TestCapability();
      cap2.metadata = { version: 2 };

      registry.register(cap1);
      registry.register(cap2);

      const retrieved = registry.getByType('test');
      expect(retrieved?.metadata?.version).toBe(2);
    });
  });

  describe('get (by CapabilityClass)', () => {
    it('should return registered capability', () => {
      const capability = new TestCapability();
      registry.register(capability);
      expect(registry.get(TestCapability)).toBe(capability);
    });

    it('should return undefined for unregistered type', () => {
      expect(registry.get(TestCapability)).toBeUndefined();
    });
  });

  describe('getByType', () => {
    it('should return capability by type string', () => {
      const capability = new TestCapability();
      registry.register(capability);
      const result = registry.getByType('test');
      expect(result).toBe(capability);
    });

    it('should return undefined for unregistered type', () => {
      const result = registry.getByType('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('has (by CapabilityClass)', () => {
    it('should return true for registered capability', () => {
      registry.register(new TestCapability());
      expect(registry.has(TestCapability)).toBe(true);
    });

    it('should return false for unregistered capability', () => {
      expect(registry.has(TestCapability)).toBe(false);
    });
  });

  describe('hasByType', () => {
    it('should return true for registered capability type', () => {
      registry.register(new TestCapability());
      expect(registry.hasByType('test')).toBe(true);
    });

    it('should return false for unregistered capability type', () => {
      expect(registry.hasByType('test')).toBe(false);
    });
  });

  describe('remove (by CapabilityClass)', () => {
    it('should remove registered capability', () => {
      registry.register(new TestCapability());
      expect(registry.has(TestCapability)).toBe(true);

      registry.remove(TestCapability);
      expect(registry.has(TestCapability)).toBe(false);
    });

    it('should return true when removing existing capability', () => {
      registry.register(new TestCapability());
      expect(registry.remove(TestCapability)).toBe(true);
    });

    it('should return false when removing non-existent capability', () => {
      expect(registry.remove(TestCapability)).toBe(false);
    });
  });

  describe('removeByType', () => {
    it('should remove capability by type string', () => {
      registry.register(new TestCapability());
      expect(registry.hasByType('test')).toBe(true);

      registry.removeByType('test');
      expect(registry.hasByType('test')).toBe(false);
    });

    it('should return true when removing existing capability', () => {
      registry.register(new TestCapability());
      expect(registry.removeByType('test')).toBe(true);
    });

    it('should return false when removing non-existent capability', () => {
      expect(registry.removeByType('nonexistent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no capabilities registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered capabilities', () => {
      const cap1 = new TestCapability();
      const cap2 = new AnotherCapability();

      registry.register(cap1);
      registry.register(cap2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(cap1);
      expect(all).toContain(cap2);
    });
  });

  describe('getTypes', () => {
    it('should return empty array when no capabilities registered', () => {
      expect(registry.getTypes()).toEqual([]);
    });

    it('should return all registered capability types', () => {
      registry.register(new TestCapability());
      registry.register(new AnotherCapability());

      const types = registry.getTypes();
      expect(types).toHaveLength(2);
      expect(types).toContain('test');
      expect(types).toContain('another');
    });
  });

  describe('clear', () => {
    it('should remove all capabilities', () => {
      registry.register(new TestCapability());
      registry.register(new AnotherCapability());
      expect(registry.size).toBe(2);

      registry.clear();
      expect(registry.size).toBe(0);
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size).toBe(0);
    });

    it('should return correct count', () => {
      registry.register(new TestCapability());
      expect(registry.size).toBe(1);

      registry.register(new AnotherCapability());
      expect(registry.size).toBe(2);
    });
  });
});
