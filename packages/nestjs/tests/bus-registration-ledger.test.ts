/**
 * VB-003 / D-3 — unit tests for BusRegistrationLedger (F-M5 duplicate-
 * registration guard, TM-VB-003-002, DREAD 9-11, AC #5).
 *
 * Covers, in isolation, the three semantics the ledger implements:
 *   1. claimCommandOrQuery(): idempotent 'skip' for a repeated
 *      (messageType, handlerType) claim on the same bus.
 *   2. claimCommandOrQuery(): throws on a genuine conflict — a DIFFERENT
 *      handlerType claiming an already-claimed messageType on the same bus.
 *   3. claimEvent(): allows legitimate fan-out (multiple distinct handler
 *      types for the same eventType) without ever throwing, while still
 *      deduping exact (eventType, handlerType) repeats.
 *
 * A real end-to-end scenario (two VytchesExplorerService instances — one
 * from forRoot(), one from forContext() — sharing the same underlying bus
 * object) is covered separately in
 * tests/services/vytches-explorer-shared-bus.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { BusRegistrationLedger } from '../src/services/bus-registration-ledger';

class CommandA {}
class CommandAHandler {}
class CommandAHandlerAlt {}

class SomeEvent {}
class EventHandlerOne {}
class EventHandlerTwo {}

describe('BusRegistrationLedger (F-M5 / D-3)', () => {
  describe('claimCommandOrQuery()', () => {
    it('returns "register" for a brand new (bus, messageType) claim', () => {
      const bus = {};
      const result = BusRegistrationLedger.claimCommandOrQuery(
        bus,
        'command',
        CommandA,
        CommandAHandler
      );
      expect(result).toBe('register');
    });

    it('returns "skip" (idempotent) when the SAME handlerType re-claims the same messageType on the same bus', () => {
      const bus = {};
      const first = BusRegistrationLedger.claimCommandOrQuery(
        bus,
        'command',
        CommandA,
        CommandAHandler
      );
      const second = BusRegistrationLedger.claimCommandOrQuery(
        bus,
        'command',
        CommandA,
        CommandAHandler
      );

      expect(first).toBe('register');
      expect(second).toBe('skip');
    });

    it('throws a clear conflict error when a DIFFERENT handlerType claims an already-claimed messageType on the same bus', () => {
      const bus = {};
      BusRegistrationLedger.claimCommandOrQuery(bus, 'command', CommandA, CommandAHandler);

      expect(() =>
        BusRegistrationLedger.claimCommandOrQuery(bus, 'command', CommandA, CommandAHandlerAlt)
      ).toThrow(/conflicting command handler registration/i);
    });

    it('scopes claims by bus identity — the same messageType/handlerType pair is independently claimable on two different bus objects', () => {
      const busOne = {};
      const busTwo = {};

      const resultOne = BusRegistrationLedger.claimCommandOrQuery(
        busOne,
        'command',
        CommandA,
        CommandAHandler
      );
      const resultTwo = BusRegistrationLedger.claimCommandOrQuery(
        busTwo,
        'command',
        CommandA,
        CommandAHandler
      );

      expect(resultOne).toBe('register');
      expect(resultTwo).toBe('register');
    });

    it('supports the "query" kind independently from "command" for the same bus/messageType', () => {
      const bus = {};
      const commandClaim = BusRegistrationLedger.claimCommandOrQuery(
        bus,
        'command',
        CommandA,
        CommandAHandler
      );
      const queryClaim = BusRegistrationLedger.claimCommandOrQuery(
        bus,
        'query',
        CommandA,
        CommandAHandler
      );

      // Command/query ledgers share the same underlying map keyed only by
      // messageType, so a second claim of the *same* messageType with the
      // *same* handlerType is still an idempotent skip regardless of kind
      // label used in the call.
      expect(commandClaim).toBe('register');
      expect(queryClaim).toBe('skip');
    });
  });

  describe('claimEvent()', () => {
    it('returns "register" for a brand new (bus, eventType, handlerType) claim', () => {
      const bus = {};
      const result = BusRegistrationLedger.claimEvent(bus, SomeEvent.name, EventHandlerOne);
      expect(result).toBe('register');
    });

    it('returns "skip" (idempotent) when the SAME handlerType re-claims the same eventType on the same bus', () => {
      const bus = {};
      const first = BusRegistrationLedger.claimEvent(bus, SomeEvent.name, EventHandlerOne);
      const second = BusRegistrationLedger.claimEvent(bus, SomeEvent.name, EventHandlerOne);

      expect(first).toBe('register');
      expect(second).toBe('skip');
    });

    it('allows legitimate fan-out: multiple DISTINCT handler types for the same eventType never throw and both register', () => {
      const bus = {};
      const resultOne = BusRegistrationLedger.claimEvent(bus, SomeEvent.name, EventHandlerOne);
      const resultTwo = BusRegistrationLedger.claimEvent(bus, SomeEvent.name, EventHandlerTwo);

      expect(resultOne).toBe('register');
      expect(resultTwo).toBe('register');
    });

    it('scopes claims by bus identity — the same eventType/handlerType pair is independently claimable on two different bus objects', () => {
      const busOne = {};
      const busTwo = {};

      const resultOne = BusRegistrationLedger.claimEvent(busOne, SomeEvent.name, EventHandlerOne);
      const resultTwo = BusRegistrationLedger.claimEvent(busTwo, SomeEvent.name, EventHandlerOne);

      expect(resultOne).toBe('register');
      expect(resultTwo).toBe('register');
    });
  });
});
