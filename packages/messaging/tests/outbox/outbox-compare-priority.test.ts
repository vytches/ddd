import { describe, it, expect } from 'vitest';
import { MessagePriority, comparePriority } from '../../src/outbox/outbox-interfaces';

describe('comparePriority (VP-008)', () => {
  describe('canonical order [CRITICAL, HIGH, NORMAL, LOW]', () => {
    it('CRITICAL sorts before HIGH (negative result)', () => {
      expect(comparePriority(MessagePriority.CRITICAL, MessagePriority.HIGH)).toBeLessThan(0);
    });

    it('HIGH sorts before NORMAL (negative result)', () => {
      expect(comparePriority(MessagePriority.HIGH, MessagePriority.NORMAL)).toBeLessThan(0);
    });

    it('NORMAL sorts before LOW (negative result)', () => {
      expect(comparePriority(MessagePriority.NORMAL, MessagePriority.LOW)).toBeLessThan(0);
    });

    it('CRITICAL sorts before LOW (negative result)', () => {
      expect(comparePriority(MessagePriority.CRITICAL, MessagePriority.LOW)).toBeLessThan(0);
    });

    it('LOW sorts after CRITICAL (positive result)', () => {
      expect(comparePriority(MessagePriority.LOW, MessagePriority.CRITICAL)).toBeGreaterThan(0);
    });
  });

  describe('custom order', () => {
    it('custom reversed order: LOW < NORMAL < HIGH < CRITICAL', () => {
      const order: MessagePriority[] = [
        MessagePriority.LOW,
        MessagePriority.NORMAL,
        MessagePriority.HIGH,
        MessagePriority.CRITICAL,
      ];

      // In this reversed order, LOW is now "highest priority" (rank 0)
      expect(comparePriority(MessagePriority.LOW, MessagePriority.NORMAL, order)).toBeLessThan(0);
      expect(comparePriority(MessagePriority.NORMAL, MessagePriority.HIGH, order)).toBeLessThan(0);
      expect(comparePriority(MessagePriority.HIGH, MessagePriority.CRITICAL, order)).toBeLessThan(
        0
      );
      expect(comparePriority(MessagePriority.LOW, MessagePriority.CRITICAL, order)).toBeLessThan(0);
    });
  });

  describe('partial order — missing values sort LAST', () => {
    it('value absent from the partial order sorts after a present value', () => {
      const partialOrder: MessagePriority[] = [MessagePriority.CRITICAL, MessagePriority.HIGH];

      // LOW is absent → rank = order.length (2), CRITICAL has rank 0
      // comparePriority(LOW, CRITICAL) → 2 - 0 = 2 → positive (LOW sorts after CRITICAL)
      expect(
        comparePriority(MessagePriority.LOW, MessagePriority.CRITICAL, partialOrder)
      ).toBeGreaterThan(0);
    });

    it('two absent values produce rank = order.length each, result is 0', () => {
      const partialOrder: MessagePriority[] = [MessagePriority.CRITICAL, MessagePriority.HIGH];

      // NORMAL and LOW are both absent → both rank = 2 → 2 - 2 = 0
      expect(comparePriority(MessagePriority.NORMAL, MessagePriority.LOW, partialOrder)).toBe(0);
    });
  });

  describe('equal values', () => {
    it('comparePriority(HIGH, HIGH) === 0', () => {
      expect(comparePriority(MessagePriority.HIGH, MessagePriority.HIGH)).toBe(0);
    });

    it('comparePriority(CRITICAL, CRITICAL) === 0', () => {
      expect(comparePriority(MessagePriority.CRITICAL, MessagePriority.CRITICAL)).toBe(0);
    });

    it('comparePriority(LOW, LOW) === 0', () => {
      expect(comparePriority(MessagePriority.LOW, MessagePriority.LOW)).toBe(0);
    });
  });

  describe('sort integration', () => {
    it('sorting an array by comparePriority produces CRITICAL-first order', () => {
      const messages = [
        { priority: MessagePriority.LOW },
        { priority: MessagePriority.CRITICAL },
        { priority: MessagePriority.NORMAL },
        { priority: MessagePriority.HIGH },
      ];

      const sorted = [...messages].sort((a, b) => comparePriority(a.priority, b.priority));

      expect(sorted.map(m => m.priority)).toEqual([
        MessagePriority.CRITICAL,
        MessagePriority.HIGH,
        MessagePriority.NORMAL,
        MessagePriority.LOW,
      ]);
    });
  });
});
