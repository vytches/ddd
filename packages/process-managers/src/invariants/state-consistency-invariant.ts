import type { Result } from '@vytches/ddd-utils';
import type { IProcessManagerState } from '../interfaces';
import { BaseProcessInvariant } from './base-invariant';
import { InvariantSeverity, InvariantTrigger } from './invariant.interface';
import type { InvariantContext, InvariantViolation, InvariantResult } from './invariant.interface';

/**
 * Configuration for state consistency validation
 */
export interface StateConsistencyConfiguration {
  /**
   * Whether to validate step data consistency
   */
  validateStepData: boolean;

  /**
   * Whether to validate correlation data consistency
   */
  validateCorrelationData: boolean;

  /**
   * Whether to validate metadata consistency
   */
  validateMetadata: boolean;

  /**
   * Required fields in stepData for each step
   */
  stepDataRequirements?: Record<string, string[]>;

  /**
   * Required fields in correlationData
   */
  correlationDataRequirements?: string[];

  /**
   * Maximum age for lastModified timestamp (in milliseconds)
   */
  maxLastModifiedAge?: number;

  /**
   * Whether to auto-correct minor inconsistencies
   */
  enableAutoCorrection: boolean;

  /**
   * Custom validation functions for specific steps
   */
  customStepValidators?: Record<string, (state: IProcessManagerState) => string[]>;

  /**
   * Custom field validation functions
   */
  fieldValidations?: Record<string, (value: unknown) => boolean | string>;

  /**
   * Fields that should not be null or undefined
   */
  requiredFields?: string[];

  /**
   * Maximum allowed nesting depth for complex objects
   */
  maxNestingDepth?: number;
}

/**
 * Default configuration for state consistency validation
 */
const DEFAULT_CONFIG: StateConsistencyConfiguration = {
  validateStepData: true,
  validateCorrelationData: true,
  validateMetadata: true,
  enableAutoCorrection: true,
  correlationDataRequirements: ['processManagerId'],
  requiredFields: ['currentStep', 'version', 'lastModified', 'stepData', 'correlationData'],
  maxNestingDepth: 5,
};

/**
 * Invariant that validates state consistency and integrity
 */
export class StateConsistencyInvariant<
  TState extends IProcessManagerState = IProcessManagerState,
> extends BaseProcessInvariant<TState> {
  private readonly config: StateConsistencyConfiguration;

  constructor(
    config?: Partial<StateConsistencyConfiguration>,
    id = 'state-consistency',
    priority = 300
  ) {
    super(
      id,
      'Validates process manager state consistency and integrity',
      InvariantSeverity.ERROR,
      [
        InvariantTrigger.STATE_CHANGE,
        InvariantTrigger.INITIALIZATION,
        InvariantTrigger.RECOVERY,
        InvariantTrigger.SNAPSHOT,
      ],
      priority
    );

    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  override supportsAutoCorrection(): boolean {
    return this.config.enableAutoCorrection;
  }

  /**
   * Override validate to add state and context validation
   */
  override async validate(
    state: TState,
    context: InvariantContext
  ): Promise<Result<InvariantResult, Error>> {
    // Validate state first
    if (!state) {
      throw new Error('State is required for invariant validation');
    }

    // Validate context before calling base implementation
    if (!context || !context.processContext) {
      throw new Error('Process context is required for invariant validation');
    }

    return super.validate(state, context);
  }

  protected async validateInvariant(
    state: TState,
    context: InvariantContext
  ): Promise<InvariantViolation[]> {
    const violations: InvariantViolation[] = [];

    // Validate basic structure
    violations.push(...this.validateBasicStructure(state));

    // Validate required fields
    if (this.config.requiredFields) {
      violations.push(...this.validateRequiredFields(state, this.config.requiredFields));
    }

    // Validate step data consistency
    if (this.config.validateStepData) {
      violations.push(...this.validateStepDataConsistency(state));
    }

    // Validate correlation data consistency
    if (this.config.validateCorrelationData) {
      violations.push(...this.validateCorrelationDataConsistency(state));
    }

    // Validate metadata consistency
    if (this.config.validateMetadata) {
      violations.push(...this.validateMetadataConsistency(state));
    }

    // Validate version consistency
    violations.push(...this.validateVersionConsistency(state, context));

    // Validate timestamp consistency
    violations.push(...this.validateTimestampConsistency(state));

    // Validate nesting depth
    if (this.config.maxNestingDepth !== undefined) {
      violations.push(...this.validateNestingDepth(state));
    }

    // Validate custom step requirements
    if (this.config.stepDataRequirements) {
      violations.push(...this.validateStepRequirements(state));
    }

    // Run custom field validators
    if (this.config.fieldValidations) {
      violations.push(...this.validateCustomFieldValidators(state));
    }

    // Run custom validators
    if (this.config.customStepValidators) {
      violations.push(...this.validateCustomStepValidators(state));
    }

    return violations;
  }

  /**
   * Validates basic state structure
   */
  private validateBasicStructure(state: TState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    // Validate that state is an object
    if (!state || typeof state !== 'object') {
      violations.push(
        this.createViolation('INVALID_STATE_TYPE', 'State must be a valid object', {
          expected: 'object',
          actual: typeof state,
          severity: InvariantSeverity.CRITICAL,
          canAutoCorrect: false,
        })
      );
      return violations; // Cannot continue validation if state is not an object
    }

    return violations;
  }

  /**
   * Validates required fields are present and valid
   */
  private validateRequiredFields(state: TState, requiredFields: string[]): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const field of requiredFields) {
      const fieldValue = (state as any)[field];

      // Check if field is missing or null/undefined
      if (fieldValue === null || fieldValue === undefined) {
        const violation = this.createViolation(
          `${this.id}_REQUIRED_FIELD_MISSING`,
          `Required field '${field}' is missing or null`,
          {
            property: field,
            expected: 'non-null value',
            actual: fieldValue,
            canAutoCorrect: this.config.enableAutoCorrection,
            ...(this.config.enableAutoCorrection && {
              autoCorrectFn: this.getAutoCorrectFunction(field),
            }),
          }
        );
        violations.push(violation);
      }
      // Validate field types for known fields
      else if (field === 'version' && typeof fieldValue !== 'number') {
        const violation = this.createViolation(
          `${this.id}_INVALID_TYPE`,
          `Field '${field}' must be a number, got ${typeof fieldValue}`,
          {
            property: field,
            expected: 'number',
            actual: typeof fieldValue,
            canAutoCorrect: this.config.enableAutoCorrection,
            ...(this.config.enableAutoCorrection && {
              autoCorrectFn: this.getAutoCorrectFunction(field),
            }),
          }
        );
        violations.push(violation);
      } else if (field === 'lastModified' && !(fieldValue instanceof Date)) {
        const violation = this.createViolation(
          `${this.id}_INVALID_TYPE`,
          `Field '${field}' must be a Date object, got ${typeof fieldValue}`,
          {
            property: field,
            expected: 'Date',
            actual: typeof fieldValue,
            canAutoCorrect: this.config.enableAutoCorrection,
            ...(this.config.enableAutoCorrection && {
              autoCorrectFn: this.getAutoCorrectFunction(field),
            }),
          }
        );
        violations.push(violation);
      } else if (field === 'currentStep' && typeof fieldValue !== 'string') {
        const violation = this.createViolation(
          `${this.id}_INVALID_TYPE`,
          `Field '${field}' must be a string, got ${typeof fieldValue}`,
          {
            property: field,
            expected: 'string',
            actual: typeof fieldValue,
            canAutoCorrect: this.config.enableAutoCorrection,
            ...(this.config.enableAutoCorrection && {
              autoCorrectFn: this.getAutoCorrectFunction(field),
            }),
          }
        );
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Gets the auto-correction function for a specific field
   */
  private getAutoCorrectFunction(
    field: string
  ): (state: IProcessManagerState) => IProcessManagerState {
    switch (field) {
      case 'stepData':
      case 'correlationData':
      case 'metadata':
        return (currentState: IProcessManagerState) => ({
          ...currentState,
          [field]: {},
        });
      case 'lastModified':
        return (currentState: IProcessManagerState) => ({
          ...currentState,
          [field]: new Date(),
        });
      case 'version':
        return (currentState: IProcessManagerState) => {
          const currentValue = (currentState as any)[field];
          let correctedValue = 0;
          if (typeof currentValue === 'string' && !isNaN(Number(currentValue))) {
            correctedValue = Math.max(0, parseInt(currentValue, 10));
          }
          return {
            ...currentState,
            [field]: correctedValue,
          };
        };
      case 'currentStep':
        return (currentState: IProcessManagerState) => ({
          ...currentState,
          [field]: 'unknown',
        });
      default:
        return (currentState: IProcessManagerState) => currentState;
    }
  }

  /**
   * Validates step data consistency
   */
  private validateStepDataConsistency(state: TState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    if (!state.stepData) {
      violations.push(
        this.createViolation('MISSING_STEP_DATA', 'Step data is required', {
          property: 'stepData',
          expected: 'object',
          actual: state.stepData,
          canAutoCorrect: this.config.enableAutoCorrection,
          ...(this.config.enableAutoCorrection && {
            autoCorrectFn: (currentState: IProcessManagerState) => ({
              ...currentState,
              stepData: {},
            }),
          }),
        })
      );
      return violations;
    }

    if (typeof state.stepData !== 'object') {
      violations.push(
        this.createViolation('INVALID_STEP_DATA_TYPE', 'Step data must be an object', {
          property: 'stepData',
          expected: 'object',
          actual: typeof state.stepData,
          canAutoCorrect: this.config.enableAutoCorrection,
          ...(this.config.enableAutoCorrection && {
            autoCorrectFn: (currentState: IProcessManagerState) => ({
              ...currentState,
              stepData: {},
            }),
          }),
        })
      );
    }

    // Check for circular references
    const circularRef = this.hasCircularReference(state.stepData);
    if (circularRef) {
      violations.push(
        this.createViolation(
          'CIRCULAR_REFERENCE_STEP_DATA',
          'Step data contains circular references',
          {
            property: 'stepData',
            context: { circularPath: circularRef },
            suggestions: ['Remove circular references from step data'],
          }
        )
      );
    }

    return violations;
  }

  /**
   * Validates correlation data consistency
   */
  private validateCorrelationDataConsistency(state: TState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    if (!state.correlationData) {
      violations.push(
        this.createViolation('MISSING_CORRELATION_DATA', 'Correlation data is required', {
          property: 'correlationData',
          expected: 'object',
          actual: state.correlationData,
          canAutoCorrect: this.config.enableAutoCorrection,
          ...(this.config.enableAutoCorrection && {
            autoCorrectFn: (currentState: IProcessManagerState) => ({
              ...currentState,
              correlationData: {},
            }),
          }),
        })
      );
      return violations;
    }

    if (typeof state.correlationData !== 'object') {
      violations.push(
        this.createViolation(
          'INVALID_CORRELATION_DATA_TYPE',
          'Correlation data must be an object',
          {
            property: 'correlationData',
            expected: 'object',
            actual: typeof state.correlationData,
            canAutoCorrect: this.config.enableAutoCorrection,
            ...(this.config.enableAutoCorrection && {
              autoCorrectFn: (currentState: IProcessManagerState) => ({
                ...currentState,
                correlationData: {},
              }),
            }),
          }
        )
      );
    }

    // Validate required correlation fields
    if (this.config.correlationDataRequirements) {
      for (const field of this.config.correlationDataRequirements) {
        if (!(field in state.correlationData) || state.correlationData[field] === undefined) {
          violations.push(
            this.createViolation(
              'MISSING_CORRELATION_FIELD',
              `Required correlation field '${field}' is missing`,
              {
                property: `correlationData.${field}`,
                expected: 'defined value',
                actual: undefined,
                suggestions: [`Add the required field '${field}' to correlationData`],
              }
            )
          );
        }
      }
    }

    return violations;
  }

  /**
   * Validates metadata consistency
   */
  private validateMetadataConsistency(state: TState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    if (state.metadata !== undefined) {
      if (typeof state.metadata !== 'object' || state.metadata === null) {
        violations.push(
          this.createViolation(
            'INVALID_METADATA_TYPE',
            'Metadata must be an object when provided',
            {
              property: 'metadata',
              expected: 'object or undefined',
              actual: typeof state.metadata,
              canAutoCorrect: this.config.enableAutoCorrection,
              ...(this.config.enableAutoCorrection && {
                autoCorrectFn: (currentState: IProcessManagerState) => ({
                  ...currentState,
                  metadata: {},
                }),
              }),
            }
          )
        );
      } else {
        // Check for circular references in metadata
        const circularRef = this.hasCircularReference(state.metadata);
        if (circularRef) {
          violations.push(
            this.createViolation(
              'CIRCULAR_REFERENCE_METADATA',
              'Metadata contains circular references',
              {
                property: 'metadata',
                context: { circularPath: circularRef },
                suggestions: ['Remove circular references from metadata'],
              }
            )
          );
        }
      }
    }

    return violations;
  }

  /**
   * Validates version consistency
   */
  private validateVersionConsistency(
    state: TState,
    context: InvariantContext
  ): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    // Skip version-specific validation if type validation already failed
    // (the required fields validation will handle type checking)
    if (typeof state.version !== 'number') {
      return violations; // Type validation is already handled in validateRequiredFields
    }

    // Version should be a non-negative number
    const versionViolation = this.validateRange(
      state.version,
      0,
      Number.MAX_SAFE_INTEGER,
      'version'
    );
    if (versionViolation) {
      versionViolation.canAutoCorrect = this.config.enableAutoCorrection;
      if (this.config.enableAutoCorrection) {
        versionViolation.autoCorrectFn = (currentState: IProcessManagerState) => ({
          ...currentState,
          version: Math.max(0, Math.floor(state.version) || 0),
        });
      }
      violations.push(versionViolation);
    }

    // If we have a previous state, version should have incremented
    if (context.previousState && context.triggeringOperation === InvariantTrigger.STATE_CHANGE) {
      if (state.version <= context.previousState.version) {
        violations.push(
          this.createViolation(
            'VERSION_NOT_INCREMENTED',
            'Version must increment when state changes',
            {
              property: 'version',
              expected: `greater than ${context.previousState.version}`,
              actual: state.version,
              suggestions: ['Increment version when state changes'],
              canAutoCorrect: this.config.enableAutoCorrection,
              ...(this.config.enableAutoCorrection && {
                autoCorrectFn: (currentState: IProcessManagerState) => ({
                  ...currentState,
                  version: (context.previousState?.version || 0) + 1,
                }),
              }),
            }
          )
        );
      }
    }

    return violations;
  }

  /**
   * Validates timestamp consistency
   */
  private validateTimestampConsistency(state: TState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    // lastModified should be a valid Date
    if (!(state.lastModified instanceof Date)) {
      violations.push(
        this.createViolation('INVALID_LAST_MODIFIED_TYPE', 'lastModified must be a Date object', {
          property: 'lastModified',
          expected: 'Date',
          actual: typeof state.lastModified,
          canAutoCorrect: this.config.enableAutoCorrection,
          ...(this.config.enableAutoCorrection && {
            autoCorrectFn: (currentState: IProcessManagerState) => ({
              ...currentState,
              lastModified: new Date(),
            }),
          }),
        })
      );
    } else {
      // lastModified should not be in the future
      const futureViolation = this.validateNotFuture(state.lastModified, 'lastModified');
      if (futureViolation) {
        futureViolation.canAutoCorrect = this.config.enableAutoCorrection;
        if (this.config.enableAutoCorrection) {
          futureViolation.autoCorrectFn = (currentState: IProcessManagerState) => ({
            ...currentState,
            lastModified: new Date(),
          });
        }
        violations.push(futureViolation);
      }

      // lastModified should not be too old if configured
      if (this.config.maxLastModifiedAge) {
        const now = new Date();
        const age = now.getTime() - state.lastModified.getTime();
        if (age > this.config.maxLastModifiedAge) {
          violations.push(
            this.createViolation('LAST_MODIFIED_TOO_OLD', 'lastModified timestamp is too old', {
              property: 'lastModified',
              expected: `within ${this.config.maxLastModifiedAge}ms of current time`,
              actual: `${age}ms old`,
              context: { maxAge: this.config.maxLastModifiedAge, actualAge: age },
              suggestions: ['Update lastModified timestamp when state changes'],
            })
          );
        }
      }
    }

    return violations;
  }

  /**
   * Validates nesting depth of complex objects
   */
  private validateNestingDepth(state: TState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const maxDepth = this.config.maxNestingDepth!;

    const checkDepth = (obj: unknown, path: string, currentDepth: number): void => {
      if (currentDepth > maxDepth) {
        violations.push(
          this.createViolation('EXCESSIVE_NESTING_DEPTH', `Object nesting too deep at '${path}'`, {
            property: path,
            expected: `maximum depth of ${maxDepth}`,
            actual: `depth exceeds ${maxDepth}`,
            context: { maxDepth, actualDepth: currentDepth },
            suggestions: [
              'Flatten the object structure',
              'Move deeply nested data to external storage',
            ],
          })
        );
        return;
      }

      if (obj && typeof obj === 'object' && !Array.isArray(obj) && !(obj instanceof Date)) {
        for (const [key, value] of Object.entries(obj)) {
          checkDepth(value, path ? `${path}.${key}` : key, currentDepth + 1);
        }
      }
    };

    // Check nesting depth in stepData
    if (state.stepData) {
      checkDepth(state.stepData, 'stepData', 0);
    }

    // Check nesting depth in correlationData
    if (state.correlationData) {
      checkDepth(state.correlationData, 'correlationData', 0);
    }

    // Check nesting depth in metadata
    if (state.metadata) {
      checkDepth(state.metadata, 'metadata', 0);
    }

    return violations;
  }

  /**
   * Validates step-specific requirements
   */
  private validateStepRequirements(state: TState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const requirements = this.config.stepDataRequirements![state.currentStep];

    if (requirements) {
      for (const field of requirements) {
        if (!state.stepData || !(field in state.stepData) || state.stepData[field] === undefined) {
          violations.push(
            this.createViolation(
              'MISSING_STEP_REQUIREMENT',
              `Step '${state.currentStep}' requires field '${field}' in stepData`,
              {
                property: `stepData.${field}`,
                expected: 'defined value',
                actual: undefined,
                context: { currentStep: state.currentStep, requiredField: field },
                suggestions: [
                  `Add the required field '${field}' to stepData for step '${state.currentStep}'`,
                ],
              }
            )
          );
        }
      }
    }

    return violations;
  }

  /**
   * Runs custom field validators
   */
  private validateCustomFieldValidators(state: TState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const [fieldName, validator] of Object.entries(this.config.fieldValidations!)) {
      try {
        const fieldValue = (state as any)[fieldName];
        const result = validator(fieldValue);

        // If result is false or a string (error message), it's a validation error
        if (result !== true) {
          const errorMessage =
            typeof result === 'string' ? result : `Field '${fieldName}' validation failed`;
          violations.push(
            this.createViolation('FIELD_VALIDATION_FAILED', errorMessage, {
              property: fieldName,
              context: { fieldName, customValidator: true },
              severity: InvariantSeverity.ERROR,
            })
          );
        }
      } catch (error) {
        violations.push(
          this.createViolation(
            'FIELD_VALIDATOR_ERROR',
            `Custom field validator for '${fieldName}' threw an error: ${(error as Error).message}`,
            {
              property: fieldName,
              context: { fieldName, error: (error as Error).message },
              severity: InvariantSeverity.ERROR,
            }
          )
        );
      }
    }

    return violations;
  }

  /**
   * Runs custom step validators
   */
  private validateCustomStepValidators(state: TState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const validator = this.config.customStepValidators![state.currentStep];

    if (validator) {
      try {
        const customViolations = validator(state);
        for (const violation of customViolations) {
          violations.push(
            this.createViolation('CUSTOM_VALIDATION_FAILED', violation, {
              context: { currentStep: state.currentStep, customValidator: true },
            })
          );
        }
      } catch (error) {
        violations.push(
          this.createViolation(
            'CUSTOM_VALIDATOR_ERROR',
            `Custom validator for step '${state.currentStep}' threw an error: ${(error as Error).message}`,
            {
              context: { currentStep: state.currentStep, error: (error as Error).message },
              severity: InvariantSeverity.WARNING,
            }
          )
        );
      }
    }

    return violations;
  }

  /**
   * Checks for circular references in an object
   */
  private hasCircularReference(obj: unknown, seen = new WeakSet()): string | null {
    if (obj === null || typeof obj !== 'object') {
      return null;
    }

    if (seen.has(obj as object)) {
      return 'circular reference detected';
    }

    seen.add(obj as object);

    try {
      for (const [key, value] of Object.entries(obj)) {
        const circularPath = this.hasCircularReference(value, seen);
        if (circularPath) {
          return `${key}.${circularPath}`;
        }
      }
    } catch {
      // If we can't iterate the object, it might have issues
      return 'object structure error';
    } finally {
      seen.delete(obj as object);
    }

    return null;
  }
}
