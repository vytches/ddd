/**
 * Base class for every error this package raises.
 *
 * Gives consumers a single type to catch adapter-level failures by, instead of
 * string-matching a bare `Error`. Before VF-032b this package threw only
 * untyped `Error`s, so a consumer catching by type missed every failure
 * originating in the NestJS adapter.
 *
 * **Why this does not extend `BaseError`.** VF-032b AC3 asked for a hierarchy
 * rooted in `@vytches/ddd-domain-primitives`' `BaseError`, but the Nx boundary
 * rules do not let a `scope:nestjs` project depend on `scope:domain-primitives`
 * (allowed: di, utils, events, resilience, cqrs, acl, policies, messaging,
 * validation, contracts, testing). Widening that allowlist is an architectural
 * change well outside this task, and adding the dependency anyway would fail
 * `nx lint`. The behaviour of `BaseError` is reproduced here verbatim — `name`
 * set from the constructor, stack capture outside production — so the only
 * difference is the position in the prototype chain. If the boundary is ever
 * widened, this class can start extending `BaseError` without touching any
 * subclass.
 *
 * @public
 * @since 0.31.0
 */
export abstract class VytchesNestJSError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    if (process.env.NODE_ENV !== 'production' && Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * A bounded-context name was empty, blank, or otherwise unusable.
 *
 * Raised by `VytchesDDDModule.forContext()` and `forFeature()` — both key
 * per-context DI registrations off the name, so an empty one would silently
 * collapse two contexts into the same scope.
 *
 * @public
 * @since 0.31.0
 */
export class InvalidContextNameError extends VytchesNestJSError {
  constructor(
    /** Module factory that rejected the name, e.g. `'forFeature'`. */
    public readonly factory: string
  ) {
    super(`VytchesDDDModule.${factory}(): context name cannot be null, empty or blank`);
  }
}

/**
 * A module factory was called with options it cannot act on.
 *
 * @public
 * @since 0.31.0
 */
export class ModuleConfigurationError extends VytchesNestJSError {
  constructor(
    /** Module factory that rejected the options, e.g. `'forRootAsync'`. */
    public readonly factory: string,
    reason: string
  ) {
    super(`VytchesDDDModule.${factory}(): ${reason}`);
  }
}

/**
 * Two different handler classes claimed the same message type on one bus.
 *
 * A command or query may have exactly one handler per bus instance; the second
 * registration is refused rather than silently overwriting the first, which
 * would route messages to whichever handler happened to register last.
 *
 * @public
 * @since 0.31.0
 */
export class ConflictingHandlerRegistrationError extends VytchesNestJSError {
  constructor(
    public readonly kind: string,
    public readonly messageName: string,
    public readonly existingHandler: string,
    public readonly incomingHandler: string
  ) {
    super(
      `BusRegistrationLedger: conflicting ${kind} handler registration for "${messageName}" — ` +
        `already claimed by "${existingHandler}", cannot also register "${incomingHandler}" on the ` +
        `same bus. Each ${kind} messageType may only have one handler per bus instance.`
    );
  }
}
