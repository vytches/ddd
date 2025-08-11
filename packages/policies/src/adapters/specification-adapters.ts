import type { IAsyncSpecification, ISpecification } from '@vytches/ddd-contracts';
import type { Result } from '@vytches/ddd-utils';
import type { BusinessRuleValidator } from '@vytches/ddd-validation';
import {
  AsyncSpecificationPolicy,
  BaseBusinessPolicy,
  SpecificationPolicy,
} from '../core/base/base-business-policy';
import type { PolicyRequest } from '../core/interfaces/business-policy.interface';
import type { PolicyViolation } from '../core/models/policy-violation';

export class BusinessRuleValidatorAdapter<T> implements ISpecification<T> {
  public readonly name?: string;
  public readonly description?: string;

  constructor(
    private readonly validator: BusinessRuleValidator<T>,
    name?: string,
    description?: string
  ) {
    if (name !== undefined) this.name = name;
    if (description !== undefined) this.description = description;
  }

  /**
   * Check if candidate satisfies the business rules
   */
  public isSatisfiedBy(candidate: T): boolean {
    try {
      const result = this.validator.validate(candidate);
      return result.isSuccess;
    } catch (error) {
      // If validation throws, treat as failure
      return false;
    }
  }

  /**
   * Explain why the specification failed
   */
  public explainFailure(candidate: T): string | null {
    try {
      const result = this.validator.validate(candidate);
      if (result.isSuccess) {
        return null;
      }

      // Extract error messages from validation result
      if (result.error && typeof result.error === 'object') {
        if ('errors' in result.error && Array.isArray(result.error.errors)) {
          return result.error.errors
            .map((err: unknown) => {
              if (typeof err === 'object' && err !== null && 'message' in err) {
                return String((err as { message: unknown }).message);
              }
              return String(err);
            })
            .join('; ');
        }
        if ('message' in result.error && typeof result.error.message === 'string') {
          return result.error.message;
        }
      }

      return `Business rule validation failed: ${result.error}`;
    } catch (error) {
      return `Business rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Combine with another specification using AND logic
   */
  public and(other: ISpecification<T>): ISpecification<T> {
    return new CompositeSpecification(this, other, 'AND');
  }

  /**
   * Combine with another specification using OR logic
   */
  public or(other: ISpecification<T>): ISpecification<T> {
    return new CompositeSpecification(this, other, 'OR');
  }

  /**
   * Negate this specification
   */
  public not(): ISpecification<T> {
    return new NotSpecification(this);
  }

  /**
   * Create adapter from business rule validator
   */
  public static create<T>(
    validator: BusinessRuleValidator<T>,
    name?: string,
    description?: string
  ): BusinessRuleValidatorAdapter<T> {
    return new BusinessRuleValidatorAdapter(validator, name, description);
  }
}

export class BusinessRuleValidatorPolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly validator: BusinessRuleValidator<T>,
    private readonly errorCode = 'BUSINESS_RULE_VIOLATION'
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const validationResult = this.validator.validate(request.entity);

      if (validationResult.isSuccess) {
        return this.success(request.entity);
      }

      // Convert validation errors to policy violations
      const errorMessage = this.extractErrorMessage(validationResult.error);
      const violation = this.createViolation(this.errorCode, errorMessage, 'ERROR', {
        context: request.context,
        details: { validationError: validationResult.error },
      });

      return this.failure(violation);
    } catch (error) {
      const violation = this.createViolation(
        'BUSINESS_RULE_ERROR',
        `Business rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        {
          context: request.context,
          details: { originalError: error },
        }
      );

      return this.failure(violation);
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error && typeof error === 'object') {
      if ('errors' in error && Array.isArray(error.errors)) {
        return error.errors
          .map((err: unknown) => {
            if (typeof err === 'object' && err !== null && 'message' in err) {
              return String((err as { message: unknown }).message);
            }
            return String(err);
          })
          .join('; ');
      }
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }
    }
    return `Business rule validation failed: ${error}`;
  }

  /**
   * Create policy from business rule validator
   */
  public static fromValidator<T>(
    id: string,
    domain: string,
    name: string,
    validator: BusinessRuleValidator<T>,
    errorCode?: string
  ): BusinessRuleValidatorPolicy<T> {
    return new BusinessRuleValidatorPolicy(id, domain, name, validator, errorCode);
  }
}

export class PolicySpecificationFactory {
  /**
   * Create policy from ISpecification
   */
  public static fromSpecification<T>(
    id: string,
    domain: string,
    name: string,
    specification: ISpecification<T>,
    options: {
      errorCode?: string;
      errorMessage?: string;
    } = {}
  ): SpecificationPolicy<T> {
    return SpecificationPolicy.fromSpecification(
      id,
      domain,
      name,
      specification,
      options.errorCode,
      options.errorMessage
    );
  }

  /**
   * Create policy from IAsyncSpecification
   */
  public static fromAsyncSpecification<T>(
    id: string,
    domain: string,
    name: string,
    specification: IAsyncSpecification<T>,
    options: {
      errorCode?: string;
      errorMessage?: string;
    } = {}
  ): AsyncSpecificationPolicy<T> {
    return AsyncSpecificationPolicy.fromAsyncSpecification(
      id,
      domain,
      name,
      specification,
      options.errorCode,
      options.errorMessage
    );
  }

  /**
   * Create policy from BusinessRuleValidator
   */
  public static fromBusinessRuleValidator<T>(
    id: string,
    domain: string,
    name: string,
    validator: BusinessRuleValidator<T>,
    errorCode?: string
  ): BusinessRuleValidatorPolicy<T> {
    return BusinessRuleValidatorPolicy.fromValidator(id, domain, name, validator, errorCode);
  }

  /**
   * Create specification adapter from BusinessRuleValidator
   */
  public static businessRuleValidatorToSpecification<T>(
    validator: BusinessRuleValidator<T>,
    name?: string,
    description?: string
  ): BusinessRuleValidatorAdapter<T> {
    return BusinessRuleValidatorAdapter.create(validator, name, description);
  }

  /**
   * Create policy from BusinessRuleValidator via specification adapter
   */
  public static fromBusinessRuleValidatorAsSpecification<T>(
    id: string,
    domain: string,
    name: string,
    validator: BusinessRuleValidator<T>,
    options: {
      errorCode?: string;
      errorMessage?: string;
      specificationName?: string;
      specificationDescription?: string;
    } = {}
  ): SpecificationPolicy<T> {
    const adapter = BusinessRuleValidatorAdapter.create(
      validator,
      options.specificationName,
      options.specificationDescription
    );

    return SpecificationPolicy.fromSpecification(
      id,
      domain,
      name,
      adapter,
      options.errorCode,
      options.errorMessage
    );
  }
}

// Helper classes for specification composition

class CompositeSpecification<T> implements ISpecification<T> {
  public readonly name?: string;
  public readonly description?: string;

  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>,
    private readonly operator: 'AND' | 'OR'
  ) {
    this.name = `${left.name || 'unnamed'} ${operator} ${right.name || 'unnamed'}`;
    this.description = `Composite specification: ${this.name}`;
  }

  public isSatisfiedBy(candidate: T): boolean {
    const leftResult = this.left.isSatisfiedBy(candidate);
    const rightResult = this.right.isSatisfiedBy(candidate);

    return this.operator === 'AND' ? leftResult && rightResult : leftResult || rightResult;
  }

  public explainFailure(candidate: T): string | null {
    const leftResult = this.left.isSatisfiedBy(candidate);
    const rightResult = this.right.isSatisfiedBy(candidate);

    if (this.operator === 'AND') {
      if (!leftResult && !rightResult) {
        const leftExplanation = this.left.explainFailure?.(candidate);
        const rightExplanation = this.right.explainFailure?.(candidate);
        return [leftExplanation, rightExplanation].filter(Boolean).join(' AND ');
      } else if (!leftResult) {
        return this.left.explainFailure?.(candidate) || null;
      } else if (!rightResult) {
        return this.right.explainFailure?.(candidate) || null;
      }
    } else {
      // OR
      if (!leftResult && !rightResult) {
        const leftExplanation = this.left.explainFailure?.(candidate);
        const rightExplanation = this.right.explainFailure?.(candidate);
        return [leftExplanation, rightExplanation].filter(Boolean).join(' OR ');
      }
    }

    return null;
  }

  public and(other: ISpecification<T>): ISpecification<T> {
    return new CompositeSpecification(this, other, 'AND');
  }

  public or(other: ISpecification<T>): ISpecification<T> {
    return new CompositeSpecification(this, other, 'OR');
  }

  public not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}

class NotSpecification<T> implements ISpecification<T> {
  public readonly name?: string;
  public readonly description?: string;

  constructor(private readonly inner: ISpecification<T>) {
    this.name = `NOT ${inner.name || 'unnamed'}`;
    this.description = `Negated specification: ${this.name}`;
  }

  public isSatisfiedBy(candidate: T): boolean {
    return !this.inner.isSatisfiedBy(candidate);
  }

  public explainFailure(candidate: T): string | null {
    if (this.inner.isSatisfiedBy(candidate)) {
      return `Negation failed: ${this.inner.name || 'unnamed specification'} was satisfied when it should not have been`;
    }
    return null;
  }

  public and(other: ISpecification<T>): ISpecification<T> {
    return new CompositeSpecification(this, other, 'AND');
  }

  public or(other: ISpecification<T>): ISpecification<T> {
    return new CompositeSpecification(this, other, 'OR');
  }

  public not(): ISpecification<T> {
    return this.inner;
  }
}
