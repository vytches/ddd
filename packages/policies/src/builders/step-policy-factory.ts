import type { Result } from '@vytches/ddd-utils';
import {
  AsyncSpecificationPolicy,
  BaseBusinessPolicy,
  SpecificationPolicy,
} from '../core/base/base-business-policy';
import type { IBusinessPolicy, PolicyRequest } from '../core/interfaces/business-policy.interface';
import type { PolicyViolation, PolicyViolationSeverity } from '../core/models/policy-violation';
import type { IPolicyGroup } from './policy-builder.interface';
import type { PolicyBuildStep } from './policy-builder-types';

/**
 * INTERNAL module. Never re-export any of these symbols from a barrel
 * (`builders/index.ts` or `src/index.ts`) - they exist purely to keep the
 * `PolicyBuildStep` switches in `policy-builder.ts` exhaustive and DRY.
 */

/**
 * Flattened, serialization-safe snapshot of a failed OR-group's violation.
 *
 * Deliberately NOT a `PolicyViolation` instance: `PolicyViolation extends
 * Error`, and nesting live `Error` instances inside `details` would leak
 * `.stack` through loggers that call `JSON.stringify` directly on nested
 * values without going through `PolicyViolation#toJSON` (reopening SA-H5).
 */
export interface GroupFailureSnapshot {
  readonly groupIndex: number;
  readonly code: string;
  readonly message: string;
  readonly severity: PolicyViolationSeverity;
}

/**
 * Exhaustiveness helper for discriminated unions. Only reachable if a new
 * union member is added without updating the corresponding switch - a
 * genuine programmer error, not a runtime condition callers can trigger.
 */
export function assertNever(value: never, context: string): never {
  throw new Error(`Unhandled step type in ${context}: ${JSON.stringify(value)}`);
}

/**
 * Computes an error code honoring an optional prefix, identical to the
 * `generateErrorCode` logic each builder already applies to every other
 * step's error code.
 */
export function computeErrorCode(prefix: string | undefined, code: string): string {
  return prefix ? `${prefix}_${code}` : code;
}

/**
 * Builds the concrete `IBusinessPolicy` for a single `PolicyBuildStep`,
 * covering all 7 members of the union. Used by both `PolicyBuilder`
 * (single-step path) and `BuiltCompositePolicy` (composite path) - callers
 * supply the already-computed id/domain/name identity for their path.
 */
export function createStepPolicy<T>(
  step: PolicyBuildStep<T>,
  id: string,
  domain: string,
  name: string,
  unsupportedStepErrorCode: string
): IBusinessPolicy<T> {
  switch (step.type) {
    case 'specification':
      return SpecificationPolicy.fromSpecification(
        id,
        domain,
        name,
        step.specification!,
        step.errorCode,
        step.errorMessage
      );

    case 'async-specification':
      return AsyncSpecificationPolicy.fromAsyncSpecification(
        id,
        domain,
        name,
        step.asyncSpecification!,
        step.errorCode,
        step.errorMessage
      );

    case 'predicate':
      return new PredicatePolicy(
        id,
        domain,
        name,
        step.predicate!,
        step.errorCode,
        step.errorMessage,
        step.severity
      );

    case 'async-predicate':
      return new AsyncPredicatePolicy(
        id,
        domain,
        name,
        step.asyncPredicate!,
        step.errorCode,
        step.errorMessage,
        step.severity
      );

    case 'rules':
      return new RulesPolicy(
        id,
        domain,
        name,
        step.rulesBuilder!,
        step.errorCode,
        step.errorMessage,
        step.severity
      );

    case 'group-or':
      return new OrGroupsPolicy(
        id,
        domain,
        name,
        step.groups ?? [],
        step.errorCode,
        step.errorMessage,
        step.severity
      );

    case 'conditional':
      // Dead union member: no builder method currently produces a
      // 'conditional' step (see `PolicyBuilder.when()`, which returns a
      // `ConditionalPolicyBuilder` instead of pushing a step). Handled
      // uniformly so the switch stays exhaustive rather than throwing at
      // build() time.
      return new UnsupportedStepPolicy(
        id,
        domain,
        name,
        unsupportedStepErrorCode,
        'Conditional steps are not supported by the step policy factory',
        'ERROR'
      );

    default:
      return assertNever(step.type, 'createStepPolicy');
  }
}

// Helper policy implementations (internal - moved from policy-builder.ts)

class PredicatePolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly predicate: (entity: T, context?: unknown) => boolean,
    private readonly errorCode: string,
    private readonly errorMessage: string,
    private readonly severity: PolicyViolationSeverity
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const satisfied = this.predicate(request.entity, request.context);

      if (satisfied) {
        return this.success(request.entity);
      }

      const violation = this.createViolation(this.errorCode, this.errorMessage, this.severity, {
        context: request.context,
      });

      return this.failure(violation);
    } catch (error) {
      const violation = this.createViolation(
        'PREDICATE_ERROR',
        `Predicate evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }
}

class AsyncPredicatePolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly predicate: (entity: T, context?: unknown) => Promise<boolean>,
    private readonly errorCode: string,
    private readonly errorMessage: string,
    private readonly severity: PolicyViolationSeverity
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const satisfied = await this.predicate(request.entity, request.context);

      if (satisfied) {
        return this.success(request.entity);
      }

      const violation = this.createViolation(this.errorCode, this.errorMessage, this.severity, {
        context: request.context,
      });

      return this.failure(violation);
    } catch (error) {
      const violation = this.createViolation(
        'ASYNC_PREDICATE_ERROR',
        `Async predicate evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }
}

class RulesPolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly rulesBuilder: (entity: T) => boolean,
    private readonly errorCode: string,
    private readonly errorMessage: string,
    private readonly severity: PolicyViolationSeverity
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const satisfied = this.rulesBuilder(request.entity);

      if (satisfied) {
        return this.success(request.entity);
      }

      const violation = this.createViolation(this.errorCode, this.errorMessage, this.severity, {
        context: request.context,
      });

      return this.failure(violation);
    } catch (error) {
      const violation = this.createViolation(
        'RULES_ERROR',
        `Rules evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }
}

/**
 * Evaluates a `group-or` step: at least one of the supplied groups' built
 * policies must succeed.
 *
 * `check()` never throws - both the OR aggregation and `group.getPolicy()`
 * (which can itself throw, e.g. for an empty group) are wrapped.
 *
 * An empty `groups` array is a vacuous OR - by definition it can never be
 * satisfied, so it always fails with zero `groupFailures` entries.
 */
class OrGroupsPolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly groups: readonly IPolicyGroup<T>[],
    private readonly errorCode: string,
    private readonly errorMessage: string,
    private readonly severity: PolicyViolationSeverity
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const groupFailures: GroupFailureSnapshot[] = [];

      for (let groupIndex = 0; groupIndex < this.groups.length; groupIndex += 1) {
        const group = this.groups[groupIndex]!;
        const groupPolicy = group.getPolicy();
        const result = await groupPolicy.check(request);

        if (result.isSuccess) {
          return this.success(request.entity);
        }

        groupFailures.push({
          groupIndex,
          code: result.error.code,
          message: result.error.message,
          severity: result.error.severity,
        });
      }

      const violation = this.createViolation(this.errorCode, this.errorMessage, this.severity, {
        context: request.context,
        details: { groupFailures },
      });

      return this.failure(violation);
    } catch (error) {
      const violation = this.createViolation(
        'GROUP_OR_ERROR',
        `Group OR evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }
}

/**
 * Always-failing policy for step types that have no concrete evaluator
 * (currently only the dead `conditional` `PolicyBuildStep` member). Exists
 * so `createStepPolicy`'s switch can stay exhaustive without throwing at
 * `build()` time.
 */
class UnsupportedStepPolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly errorCode: string,
    private readonly errorMessage: string,
    private readonly severity: PolicyViolationSeverity
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const violation = this.createViolation(this.errorCode, this.errorMessage, this.severity, {
        context: request.context,
      });

      return this.failure(violation);
    } catch (error) {
      const violation = this.createViolation(
        'UNSUPPORTED_STEP_ERROR',
        `Unsupported step evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }
}
