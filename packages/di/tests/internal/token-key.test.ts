import { describe, expect, it } from 'vitest';

import { describeToken } from '../../src/internal/token-key';
import type { ServiceToken } from '../../src/types';

describe('describeToken (internal display helper)', () => {
  describe('string tokens', () => {
    it('returns string tokens as-is', () => {
      expect(describeToken('UserRepository')).toBe('UserRepository');
    });

    it('returns the empty string unchanged', () => {
      expect(describeToken('')).toBe('');
    });
  });

  describe('symbol tokens', () => {
    it('renders a symbol via its description', () => {
      expect(describeToken(Symbol('UserRepo'))).toBe('Symbol(UserRepo)');
    });

    it('renders a global symbol registered via Symbol.for()', () => {
      expect(describeToken(Symbol.for('shared-token'))).toBe('Symbol(shared-token)');
    });

    it('renders a description-less symbol without throwing', () => {
      expect(describeToken(Symbol())).toBe('Symbol()');
    });
  });

  describe('class and function tokens', () => {
    it('renders a named class via its name', () => {
      class UserRepository {}
      expect(describeToken(UserRepository)).toBe('UserRepository');
    });

    it('renders a named function via its name', () => {
      function makeService(): void {}
      expect(describeToken(makeService as unknown as ServiceToken)).toBe('makeService');
    });

    it('renders a truly anonymous class as a stable placeholder', () => {
      // Extracting from an array prevents TS/JS name inference,
      // producing a genuinely empty .name.
      const [AnonymousClass] = [class {}];
      expect(AnonymousClass!.name).toBe('');
      expect(describeToken(AnonymousClass!)).toBe('[anonymous function]');
    });

    it('is stable across repeated calls for the same anonymous token', () => {
      const [AnonymousClass] = [class {}];
      const first = describeToken(AnonymousClass!);
      const second = describeToken(AnonymousClass!);
      expect(first).toBe(second);
    });

    it('does not produce identity: two distinct anonymous classes share a description', () => {
      const [A] = [class {}];
      const [B] = [class {}];
      expect(describeToken(A!)).toBe(describeToken(B!));
    });
  });

  describe('never throws (degenerate inputs)', () => {
    it('handles a function whose name getter throws', () => {
      const hostile = (): void => {};
      Object.defineProperty(hostile, 'name', {
        get() {
          throw new Error('hostile name getter');
        },
      });
      expect(() => describeToken(hostile as unknown as ServiceToken)).not.toThrow();
      expect(describeToken(hostile as unknown as ServiceToken)).toBe('[unknown token]');
    });

    it('handles null and undefined without throwing', () => {
      expect(describeToken(null as unknown as ServiceToken)).toBe('null');
      expect(describeToken(undefined as unknown as ServiceToken)).toBe('undefined');
    });

    it('handles a plain object with a throwing toString without throwing', () => {
      const hostile = {
        toString() {
          throw new Error('hostile toString');
        },
      };
      expect(() => describeToken(hostile as unknown as ServiceToken)).not.toThrow();
      expect(describeToken(hostile as unknown as ServiceToken)).toBe('[unknown token]');
    });

    it('handles numbers and booleans via String() fallback', () => {
      expect(describeToken(42 as unknown as ServiceToken)).toBe('42');
      expect(describeToken(false as unknown as ServiceToken)).toBe('false');
    });
  });
});
