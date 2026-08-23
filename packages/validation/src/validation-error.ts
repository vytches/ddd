import type { IValidationError, IValidationErrors } from '@vytches/ddd-contracts';

export class ValidationError implements IValidationError {
  constructor(
    public readonly property: string,
    public readonly message: string,
    public readonly context?: Record<string, unknown>,
    /**
     * Stable, machine-readable error identity for i18n/programmatic
     * consumers who previously had to string-match `message` (VF-033 AC4).
     * Built-in `CoreRules` emit stable codes (`'required'`, `'min_length'`,
     * `'max_length'`, `'pattern'`, `'range'`, `'email'`); custom rules may
     * pass their own via `BusinessRuleValidator.addRule(..., code)`.
     */
    public readonly code?: string
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
