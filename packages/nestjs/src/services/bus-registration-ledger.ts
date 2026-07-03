// Class constructor reference used as a ledger key — intentional Function usage.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type ClassRef = Function;

type MessageKey = ClassRef | string;

interface CommandQueryLedgerEntry {
  handlerType: ClassRef;
}

/**
 * Bus-scoped registration ledger (F-M5).
 *
 * Prevents the same (messageType, handlerType) pair from being registered
 * twice onto the same bus instance, and detects genuine conflicts where two
 * *different* handler types claim the same command/query messageType on the
 * same bus.
 *
 * Scoping is by bus object identity (`WeakMap<bus, ...>`), not an explicit
 * busId string: every distinct bus instance — the global bus from
 * `forRoot()`, a local bus from `forFeature()`, a stub bus from
 * `forTesting()` — gets its own independent ledger, and entries are
 * garbage-collected automatically once the bus itself is no longer
 * referenced. This is what makes the guard effective across the real bug
 * scenario for this task: `forRoot()` and `forContext()` each create their
 * own `VytchesExplorerService` instance, both of which discover the *same*
 * app-wide handlers (via `DiscoveryService`) and both of which — when the
 * shadowed/bridged `ICommandBus`/`IQueryBus` tokens resolve to the same
 * global bus object — would otherwise attempt to register the exact same
 * handler onto the exact same bus.
 *
 * Command/query semantics: exactly one handler type may own a given
 * messageType per bus.
 * - Re-registering the SAME (messageType, handlerType) pair is idempotent
 *   (returns `'skip'`).
 * - Registering a DIFFERENT handlerType for an already-claimed messageType
 *   is a genuine conflict (throws).
 *
 * Event semantics: multiple distinct handler types are legitimate for the
 * same eventType (fan-out — this is normal, not a bug). Only exact
 * (eventType, handlerType) duplicates are deduplicated (returns `'skip'`);
 * there is no conflict case for events.
 */
export class BusRegistrationLedger {
  private static readonly commandQueryLedgers = new WeakMap<
    object,
    Map<MessageKey, CommandQueryLedgerEntry>
  >();
  private static readonly eventLedgers = new WeakMap<object, Map<MessageKey, Set<ClassRef>>>();

  /**
   * Claim a (messageType, handlerType) pair on a command or query bus.
   *
   * @returns `'register'` if this is a new claim the caller should proceed
   *   to register with the bus, or `'skip'` if this exact pair is already
   *   registered (idempotent no-op — do not call the bus again).
   * @throws Error if messageType is already claimed by a different
   *   handlerType on this bus (genuine conflict).
   */
  static claimCommandOrQuery(
    bus: object,
    kind: 'command' | 'query',
    messageType: MessageKey,
    handlerType: ClassRef
  ): 'register' | 'skip' {
    let ledger = this.commandQueryLedgers.get(bus);
    if (!ledger) {
      ledger = new Map<MessageKey, CommandQueryLedgerEntry>();
      this.commandQueryLedgers.set(bus, ledger);
    }

    const existing = ledger.get(messageType);
    if (!existing) {
      ledger.set(messageType, { handlerType });
      return 'register';
    }

    if (existing.handlerType === handlerType) {
      return 'skip';
    }

    const messageName = typeof messageType === 'function' ? messageType.name : String(messageType);
    const existingName = existing.handlerType.name || '<anonymous>';
    const incomingName = handlerType.name || '<anonymous>';
    throw new Error(
      `BusRegistrationLedger: conflicting ${kind} handler registration for "${messageName}" — ` +
        `already claimed by "${existingName}", cannot also register "${incomingName}" on the ` +
        `same bus. Each ${kind} messageType may only have one handler per bus instance.`
    );
  }

  /**
   * Claim a (eventType, handlerType) pair on an event bus. Multiple distinct
   * handler types per eventType are legitimate (fan-out) — only exact
   * duplicates are deduplicated. Never throws.
   *
   * @returns `'register'` if this is a new claim the caller should proceed
   *   to register with the bus, or `'skip'` if this exact pair is already
   *   registered (idempotent no-op).
   */
  static claimEvent(
    bus: object,
    eventType: MessageKey,
    handlerType: ClassRef
  ): 'register' | 'skip' {
    let ledger = this.eventLedgers.get(bus);
    if (!ledger) {
      ledger = new Map<MessageKey, Set<ClassRef>>();
      this.eventLedgers.set(bus, ledger);
    }

    let handlerTypes = ledger.get(eventType);
    if (!handlerTypes) {
      handlerTypes = new Set<ClassRef>();
      ledger.set(eventType, handlerTypes);
    }

    if (handlerTypes.has(handlerType)) {
      return 'skip';
    }

    handlerTypes.add(handlerType);
    return 'register';
  }
}
