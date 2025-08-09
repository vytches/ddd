import type { IValidationError, IValidationErrors } from '@vytches/ddd-contracts';

export class ValidationError implements IValidationError {
  constructor(
    public readonly property: string,
    public readonly message: string,
    public readonly context?: Record<string, unknown>
  ) {}

  toString(): string {
    return `${this.property}: ${this.message}`;
  }
}

export class ValidationErrors extends Error implements IValidationErrors {
  public readonly errors: IValidationError[];

  constructor(errors: ValidationError[]) {
    super(
      `Validation failed with ${errors.length} error(s): ${errors.map(e => e.toString()).join('; ')}`
    );
    this.name = 'ValidationErrors';
    this.errors = errors;
  }

  get length(): number {
    return this.errors.length;
  }
}
