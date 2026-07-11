import type { IDomainEvent } from './domain-event-interfaces';

/**
 * Abstract base class for handling event persistence (e.g., writing events to a store).
 *
 * ## Atomicity requirement (VF-023 AC9, SA-M9 finding — read before implementing)
 *
 * `IBaseRepository.save()` (`@vytches/ddd-repositories`) implements optimistic
 * concurrency by calling {@link getCurrentVersion} and comparing it against
 * the aggregate's `getInitialVersion()` *before* calling {@link handleEvent}
 * for each event — this is a **non-atomic check-then-act** at the repository
 * level. The library's own call sequence does **not** pass an
 * `expectedVersion` into `handleEvent`, and therefore provides **no
 * concurrency guarantee by itself**. Two concurrent `save()` calls can both
 * observe the same `getCurrentVersion()` result, both pass the check, and
 * both proceed to write — a classic lost-update race.
 *
 * A conforming, production-safe implementation of this interface MUST close
 * that gap itself by making the version check and the write **atomic** —
 * e.g. a single compare-and-set operation against the underlying store (a
 * conditional write keyed on `(aggregateId, expectedVersion)`, an optimistic
 * lock column with a `WHERE version = expectedVersion` update, or an
 * equivalent CAS/transaction primitive backed by a unique constraint on
 * `(aggregateId, version)`). `handleEvent` implementations that merely
 * `INSERT`/append without re-validating the expected version *inside the
 * same atomic operation* provide **no actual optimistic-concurrency
 * guarantee**, despite this library's API (a `VersionError` thrown by
 * `save()`) implying one under concurrent writers. See
 * `docs/security/threat-models/TM-VF-023.md` (finding SA-M9,
 * `TM-VF-023-003`) for the full analysis.
 *
 * @public
 * @stable
 * @since 0.22.0
 */
export abstract class IEventPersistenceHandler {
  /**
   * Handle event persistence.
   *
   * MUST be implemented so that persisting the event and validating the
   * aggregate's expected version happen as a single atomic (compare-and-set)
   * operation against the underlying store — see the class-level "Atomicity
   * requirement" doc above. A non-atomic check-then-act implementation
   * (e.g. calling {@link getCurrentVersion} separately, then writing) does
   * not provide a real optimistic-concurrency guarantee under concurrent
   * writers, even though `save()` will appear to enforce one in the
   * uncontended case.
   *
   * @returns new version number after handling the event
   */
  abstract handleEvent(event: IDomainEvent): Promise<number>;

  /**
   * Get current version of an aggregate.
   *
   * Note: when called by `IBaseRepository.save()`, this is a separate,
   * non-atomic read that happens before {@link handleEvent} is invoked — see
   * the class-level "Atomicity requirement" doc. Do not rely on the
   * combination of this method plus a caller-side comparison as your only
   * concurrency guard; the atomicity must live inside {@link handleEvent}
   * itself (or the underlying store's write path).
   */
  abstract getCurrentVersion(aggregateId: unknown): Promise<number | undefined>;
}
