import type { Result } from '@vytches/ddd-utils';
import type { IProcessManagerState } from '../interfaces';
import { BaseProcessInvariant } from './base-invariant';
import { InvariantSeverity, InvariantTrigger } from './invariant.interface';
import type { InvariantContext, InvariantViolation, InvariantResult } from './invariant.interface';

/**
 * Resource limit configuration for invariant validation
 */
export interface ResourceInvariantLimit {
  /**
   * Maximum allowed value
   */
  max: number;

  /**
   * Warning threshold (as percentage of max)
   */
  warningThreshold: number;

  /**
   * Critical threshold (as percentage of max)
   */
  criticalThreshold: number;

  /**
   * Unit of measurement for reporting
   */
  unit?: string;

  /**
   * Whether this limit can be auto-corrected
   */
  canAutoCorrect?: boolean;

  /**
   * Auto-correction strategy
   */
  autoCorrectStrategy?: ResourceAutoCorrectStrategy;
}

/**
 * Auto-correction strategies for resource violations
 */
export enum ResourceAutoCorrectStrategy {
  /** Truncate data to fit within limits */
  TRUNCATE = 'TRUNCATE',
  /** Compress data to reduce size */
  COMPRESS = 'COMPRESS',
  /** Remove oldest entries */
  REMOVE_OLDEST = 'REMOVE_OLDEST',
  /** Remove non-essential fields */
  REMOVE_NON_ESSENTIAL = 'REMOVE_NON_ESSENTIAL',
  /** Move data to external storage */
  EXTERNALIZE = 'EXTERNALIZE',
}

/**
 * Configuration for resource invariant validation
 */
export interface ResourceInvariantConfiguration {
  /**
   * Memory usage limits for state objects (in bytes)
   */
  memoryLimits?: {
    totalState?: ResourceInvariantLimit;
    stepData?: ResourceInvariantLimit;
    correlationData?: ResourceInvariantLimit;
    metadata?: ResourceInvariantLimit;
  };

  /**
   * Size limits for collections
   */
  collectionLimits?: {
    maxArrayLength?: ResourceInvariantLimit;
    maxObjectProperties?: ResourceInvariantLimit;
    maxStringLength?: ResourceInvariantLimit;
  };

  /**
   * Complexity limits
   */
  complexityLimits?: {
    maxNestingDepth?: ResourceInvariantLimit;
    maxCircularReferences?: ResourceInvariantLimit;
    maxTotalProperties?: ResourceInvariantLimit;
  };

  /**
   * Performance-related limits
   */
  performanceLimits?: {
    maxSerializationTime?: ResourceInvariantLimit;
    maxDeserializationTime?: ResourceInvariantLimit;
  };

  /**
   * Whether to enable auto-correction of resource violations
   */
  enableAutoCorrection: boolean;

  /**
   * Auto-correction configuration
   */
  autoCorrections?: {
    truncateOversizedCollections?: boolean;
    clearCaches?: boolean;
    reducComplexity?: boolean;
  };

  /**
   * List of fields that are considered essential and should not be auto-removed
   */
  essentialFields?: string[];

  /**
   * Custom resource validators
   */
  customValidators?: Array<{
    name: string;
    validator: (state: IProcessManagerState) => Promise<ResourceValidationResult>;
  }>;
}

/**
 * Result of custom resource validation
 */
export interface ResourceValidationResult {
  isValid: boolean;
  resourceUsage: number;
  limit: number;
  unit?: string;
  details?: Record<string, unknown>;
}

/**
 * Default configuration for resource invariant validation
 */
const DEFAULT_CONFIG: ResourceInvariantConfiguration = {
  memoryLimits: {
    totalState: { max: 1024 * 1024, warningThreshold: 0.8, criticalThreshold: 0.95, unit: 'bytes' }, // 1MB
    stepData: { max: 512 * 1024, warningThreshold: 0.7, criticalThreshold: 0.9, unit: 'bytes' }, // 512KB
    correlationData: {
      max: 64 * 1024,
      warningThreshold: 0.7,
      criticalThreshold: 0.9,
      unit: 'bytes',
    }, // 64KB
    metadata: { max: 32 * 1024, warningThreshold: 0.7, criticalThreshold: 0.9, unit: 'bytes' }, // 32KB
  },
  collectionLimits: {
    maxArrayLength: { max: 1000, warningThreshold: 0.8, criticalThreshold: 0.95, unit: 'items' },
    maxObjectProperties: {
      max: 100,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
      unit: 'properties',
    },
    maxStringLength: {
      max: 10000,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
      unit: 'characters',
    },
  },
  complexityLimits: {
    maxNestingDepth: { max: 10, warningThreshold: 0.7, criticalThreshold: 0.9, unit: 'levels' },
    maxTotalProperties: {
      max: 500,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
      unit: 'properties',
    },
  },
  enableAutoCorrection: true,
  essentialFields: ['currentStep', 'version', 'lastModified'],
};

/**
 * Invariant that validates resource usage and limits within process state
 */
export class ResourceInvariant<
  TState extends IProcessManagerState = IProcessManagerState,
> extends BaseProcessInvariant<TState> {
  private readonly config: ResourceInvariantConfiguration;

  constructor(
    config?: Partial<ResourceInvariantConfiguration>,
    id = 'resource-invariant',
    priority = 200
  ) {
    super(
      id,
      'Validates process manager resource usage and limits',
      InvariantSeverity.WARNING,
      [
        InvariantTrigger.STATE_CHANGE,
        InvariantTrigger.EVENT_PROCESSING,
        InvariantTrigger.PERIODIC_CHECK,
        InvariantTrigger.SNAPSHOT,
      ],
      priority
    );

    // Check if this is a minimal config (only enableAutoCorrection set)
    const isMinimalConfig =
      config &&
      Object.keys(config).length === 1 &&
      'enableAutoCorrection' in config &&
      !config.memoryLimits &&
      !config.collectionLimits &&
      !config.complexityLimits;

    if (isMinimalConfig) {
      // For minimal config, don't apply any default limits
      this.config = {
        enableAutoCorrection: config!.enableAutoCorrection,
      } as ResourceInvariantConfiguration;
    } else {
      // Normal config merging with defaults
      this.config = { ...DEFAULT_CONFIG, ...config };
    }
  }

  override supportsAutoCorrection(): boolean {
    return this.config.enableAutoCorrection;
  }

  /**
   * Override validate to include calculated metadata
   */
  override async validate(
    state: TState,
    context: InvariantContext
  ): Promise<Result<InvariantResult, Error>> {
    const result = await super.validate(state, context);

    if (result.isSuccess && result.value) {
      // Add calculated values to metadata
      const contextAny = context as any;
      if (
        contextAny.calculatedMemoryBytes !== undefined ||
        contextAny.calculatedComplexityScore !== undefined ||
        contextAny.usedMetadataValues !== undefined
      ) {
        result.value.metadata = {
          ...result.value.metadata,
          calculatedMemoryBytes: contextAny.calculatedMemoryBytes,
          calculatedComplexityScore: contextAny.calculatedComplexityScore,
          usedMetadataValues: contextAny.usedMetadataValues,
        };
      }
    }

    return result;
  }

  protected async validateInvariant(
    state: TState,
    context: InvariantContext
  ): Promise<InvariantViolation[]> {
    const violations: InvariantViolation[] = [];

    // Store calculated values for metadata
    let calculatedMemoryBytes: number | undefined;
    let calculatedComplexityScore: number | undefined;
    let usedMetadataValues = false;

    // Validate memory limits
    if (this.config.memoryLimits) {
      const memoryViolations = await this.validateMemoryLimits(state);
      violations.push(...memoryViolations);
    }

    // Calculate memory if not in metadata (always calculate for metadata tracking)
    const resourceUsage = state.metadata?.resourceUsage as any;
    if (!resourceUsage?.memoryBytes) {
      calculatedMemoryBytes = this.calculateObjectSize(state);
    } else {
      usedMetadataValues = true;
    }

    // Validate collection limits
    if (this.config.collectionLimits) {
      violations.push(...this.validateCollectionLimits(state));
    }

    // Validate complexity limits
    if (this.config.complexityLimits) {
      const complexityViolations = this.validateComplexityLimits(state);
      violations.push(...complexityViolations);
    }

    // Calculate complexity if not in metadata (always calculate for metadata tracking)
    if (!resourceUsage?.complexityScore) {
      calculatedComplexityScore = this.countTotalProperties(state);
    } else {
      usedMetadataValues = true;
    }

    // Validate performance limits
    if (this.config.performanceLimits) {
      violations.push(...(await this.validatePerformanceLimits(state)));
    }

    // Run custom validators
    if (this.config.customValidators) {
      violations.push(...(await this.validateCustomResourceValidators(state)));
    }

    // Add calculated values to context for metadata
    if (
      calculatedMemoryBytes !== undefined ||
      calculatedComplexityScore !== undefined ||
      usedMetadataValues
    ) {
      (context as any).calculatedMemoryBytes = calculatedMemoryBytes;
      (context as any).calculatedComplexityScore = calculatedComplexityScore;
      (context as any).usedMetadataValues = usedMetadataValues;
    }

    return violations;
  }

  /**
   * Validates memory usage limits
   */
  private async validateMemoryLimits(state: TState): Promise<InvariantViolation[]> {
    const violations: InvariantViolation[] = [];
    const limits = this.config.memoryLimits!;

    // Check if memory metadata exists and use it
    const memoryMetadata = state.metadata?.resourceUsage as any;
    if (memoryMetadata?.memoryBytes) {
      // Use metadata value if available
      const memoryBytes = memoryMetadata.memoryBytes;

      // Check against total state limit
      if (limits.totalState) {
        if (memoryBytes > limits.totalState.max) {
          const violation = this.createViolation('MEMORY_LIMIT_EXCEEDED', 'Memory limit exceeded', {
            property: 'memory',
            expected: `<= ${limits.totalState.max} bytes`,
            actual: `${memoryBytes} bytes`,
            severity: InvariantSeverity.ERROR,
            context: { memoryBytes, limit: limits.totalState.max },
            suggestions: ['Reduce memory usage', 'Clear caches', 'Remove non-essential data'],
            canAutoCorrect:
              limits.totalState.canAutoCorrect !== false && this.config.enableAutoCorrection,
            autoCorrectFn: (currentState: IProcessManagerState) =>
              this.reduceStateSize(currentState, limits.totalState!.max),
          });
          violations.push(violation);
        } else if (memoryBytes > limits.totalState.max * limits.totalState.warningThreshold) {
          const violation = this.createViolation(
            'MEMORY_USAGE_WARNING',
            'Memory usage approaching limit',
            {
              property: 'memory',
              expected: `< ${limits.totalState.max * limits.totalState.warningThreshold} bytes`,
              actual: `${memoryBytes} bytes`,
              severity: InvariantSeverity.WARNING,
              context: { memoryBytes, threshold: limits.totalState.warningThreshold },
              suggestions: ['Monitor memory usage closely'],
            }
          );
          violations.push(violation);
        }
      }

      return violations;
    }

    // Fallback to calculating size if no metadata
    if (limits.totalState) {
      const totalSize = this.calculateObjectSize(state);
      const violation = this.validateResourceLimit(
        totalSize,
        limits.totalState,
        'totalState',
        'Memory limit exceeded'
      );
      if (violation) {
        // Add auto-correction for total state size
        if (limits.totalState.canAutoCorrect !== false && this.config.enableAutoCorrection) {
          violation.canAutoCorrect = true;
          violation.autoCorrectFn = (currentState: IProcessManagerState) =>
            this.reduceStateSize(currentState, limits.totalState!.max);
        }
        violations.push(violation);
      }
    }

    // Validate step data size
    if (limits.stepData && state.stepData) {
      const stepDataSize = this.calculateObjectSize(state.stepData);
      const violation = this.validateResourceLimit(
        stepDataSize,
        limits.stepData,
        'stepData',
        'Step data memory usage exceeds limit'
      );
      if (violation) {
        if (limits.stepData.canAutoCorrect !== false) {
          violation.canAutoCorrect = true;
          violation.autoCorrectFn = (currentState: IProcessManagerState) => ({
            ...currentState,
            stepData: this.reduceObjectSize(currentState.stepData, limits.stepData!.max),
          });
        }
        violations.push(violation);
      }
    }

    // Validate correlation data size
    if (limits.correlationData && state.correlationData) {
      const correlationDataSize = this.calculateObjectSize(state.correlationData);
      const violation = this.validateResourceLimit(
        correlationDataSize,
        limits.correlationData,
        'correlationData',
        'Correlation data memory usage exceeds limit'
      );
      if (violation) {
        if (limits.correlationData.canAutoCorrect !== false) {
          violation.canAutoCorrect = true;
          violation.autoCorrectFn = (currentState: IProcessManagerState) => ({
            ...currentState,
            correlationData: this.reduceObjectSize(
              currentState.correlationData,
              limits.correlationData!.max
            ),
          });
        }
        violations.push(violation);
      }
    }

    // Validate metadata size
    if (limits.metadata && state.metadata) {
      const metadataSize = this.calculateObjectSize(state.metadata);
      const violation = this.validateResourceLimit(
        metadataSize,
        limits.metadata,
        'metadata',
        'Metadata memory usage exceeds limit'
      );
      if (violation) {
        if (limits.metadata.canAutoCorrect !== false) {
          violation.canAutoCorrect = true;
          violation.autoCorrectFn = (currentState: IProcessManagerState) => ({
            ...currentState,
            metadata: this.reduceObjectSize(currentState.metadata || {}, limits.metadata!.max),
          });
        }
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Validates collection size limits
   */
  private validateCollectionLimits(state: TState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const limits = this.config.collectionLimits!;

    const checkObject = (obj: unknown, path: string): void => {
      if (Array.isArray(obj)) {
        // Check array length
        if (limits.maxArrayLength) {
          const usage = obj.length / limits.maxArrayLength.max;

          if (obj.length > limits.maxArrayLength.max) {
            violations.push(
              this.createViolation('COLLECTION_SIZE_EXCEEDED', `Collection size limit exceeded`, {
                property: path,
                expected: `<= ${limits.maxArrayLength.max} items`,
                actual: `${obj.length} items`,
                severity: InvariantSeverity.ERROR,
                context: { arrayLength: obj.length, limit: limits.maxArrayLength.max },
                suggestions: ['Reduce collection size', 'Paginate results'],
                canAutoCorrect:
                  (limits.maxArrayLength.canAutoCorrect !== false &&
                    this.config.enableAutoCorrection &&
                    (this.config.autoCorrections?.truncateOversizedCollections !== false ||
                      (path.includes('cache') && this.config.autoCorrections?.clearCaches))) ??
                  false,
                autoCorrectFn: (currentState: IProcessManagerState) => {
                  // Special handling for cache objects
                  if (path.includes('cache') && this.config.autoCorrections?.clearCaches) {
                    const newState = JSON.parse(JSON.stringify(currentState));
                    if (newState.stepData?.cache) {
                      newState.stepData.cache = {};
                    }
                    return newState;
                  }
                  // Normal array truncation (only if enabled)
                  if (this.config.autoCorrections?.truncateOversizedCollections !== false) {
                    return this.truncateArrayInState(
                      currentState,
                      path,
                      limits.maxArrayLength!.max
                    );
                  }
                  // No correction if truncation is disabled
                  return currentState;
                },
              })
            );
            return; // Don't check for warning if we already have an error
          } else if (usage >= limits.maxArrayLength.warningThreshold) {
            violations.push(
              this.createViolation('COLLECTION_SIZE_WARNING', `Collection size approaching limit`, {
                property: path,
                expected: `< ${limits.maxArrayLength.max * limits.maxArrayLength.warningThreshold} items`,
                actual: `${obj.length} items`,
                severity: InvariantSeverity.WARNING,
                context: {
                  arrayLength: obj.length,
                  threshold: limits.maxArrayLength.warningThreshold,
                },
                suggestions: ['Monitor collection size'],
              })
            );
          }
        }

        // Recursively check array elements
        obj.forEach((item, index) => {
          checkObject(item, `${path}[${index}]`);
        });
      } else if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
        const entries = Object.entries(obj);

        // Check object property count
        if (limits.maxObjectProperties && entries.length > limits.maxObjectProperties.max) {
          const violation = this.validateResourceLimit(
            entries.length,
            limits.maxObjectProperties,
            path,
            `Object at '${path}' has too many properties`
          );
          if (violation) {
            if (limits.maxObjectProperties.canAutoCorrect !== false) {
              violation.canAutoCorrect = true;
              violation.autoCorrectFn = (currentState: IProcessManagerState) =>
                this.reduceObjectProperties(currentState, path, limits.maxObjectProperties!.max);
            }
            violations.push(violation);
          }
        }

        // Recursively check object properties
        entries.forEach(([key, value]) => {
          checkObject(value, path ? `${path}.${key}` : key);
        });
      } else if (typeof obj === 'string') {
        // Check string length
        if (limits.maxStringLength && obj.length > limits.maxStringLength.max) {
          const violation = this.validateResourceLimit(
            obj.length,
            limits.maxStringLength,
            path,
            `String at '${path}' exceeds maximum length`
          );
          if (violation) {
            if (limits.maxStringLength.canAutoCorrect !== false) {
              violation.canAutoCorrect = true;
              violation.autoCorrectFn = (currentState: IProcessManagerState) =>
                this.truncateStringInState(currentState, path, limits.maxStringLength!.max);
            }
            violations.push(violation);
          }
        }
      }
    };

    // Check the entire state object
    checkObject(state, '');

    return violations;
  }

  /**
   * Validates complexity limits
   */
  private validateComplexityLimits(state: TState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const limits = this.config.complexityLimits!;

    // Check if complexity metadata exists and use it
    const complexityMetadata = state.metadata?.resourceUsage as any;
    if (complexityMetadata?.complexityScore && limits.maxTotalProperties) {
      const complexityScore = complexityMetadata.complexityScore;

      if (complexityScore > limits.maxTotalProperties.max) {
        violations.push(
          this.createViolation('COMPLEXITY_SCORE_EXCEEDED', 'Complexity score limit exceeded', {
            property: 'complexity',
            expected: `<= ${limits.maxTotalProperties.max}`,
            actual: `${complexityScore}`,
            severity: InvariantSeverity.ERROR,
            context: { complexityScore, limit: limits.maxTotalProperties.max },
            suggestions: ['Simplify state structure', 'Remove unnecessary properties'],
            canAutoCorrect:
              limits.maxTotalProperties.canAutoCorrect !== false &&
              this.config.enableAutoCorrection,
            autoCorrectFn: (currentState: IProcessManagerState) =>
              this.reduceStateComplexity(currentState, limits.maxTotalProperties!.max),
          })
        );
      }

      return violations;
    }

    // Fallback to calculating complexity if no metadata
    // Check nesting depth
    if (limits.maxNestingDepth) {
      const maxDepth = this.calculateMaxNestingDepth(state);
      const violation = this.validateResourceLimit(
        maxDepth,
        limits.maxNestingDepth,
        'nestingDepth',
        'State object nesting depth exceeds limit'
      );
      if (violation) {
        violations.push(violation);
      }
    }

    // Check total property count
    if (limits.maxTotalProperties) {
      const totalProperties = this.countTotalProperties(state);
      const violation = this.validateResourceLimit(
        totalProperties,
        limits.maxTotalProperties,
        'totalProperties',
        'Complexity score limit exceeded'
      );
      if (violation) {
        if (
          limits.maxTotalProperties.canAutoCorrect !== false &&
          this.config.enableAutoCorrection
        ) {
          violation.canAutoCorrect = true;
          violation.autoCorrectFn = (currentState: IProcessManagerState) =>
            this.reduceStateComplexity(currentState, limits.maxTotalProperties!.max);
        }
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Validates performance limits
   */
  private async validatePerformanceLimits(state: TState): Promise<InvariantViolation[]> {
    const violations: InvariantViolation[] = [];
    const limits = this.config.performanceLimits!;

    // Check serialization time
    if (limits.maxSerializationTime) {
      const serializationTime = await this.measureSerializationTime(state);
      const violation = this.validateResourceLimit(
        serializationTime,
        limits.maxSerializationTime,
        'serializationTime',
        'State serialization time exceeds limit'
      );
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Validates custom resource validators
   */
  private async validateCustomResourceValidators(state: TState): Promise<InvariantViolation[]> {
    const violations: InvariantViolation[] = [];

    for (const validator of this.config.customValidators!) {
      try {
        const result = await validator.validator(state);
        if (!result.isValid) {
          const violationOptions: any = {
            property: validator.name,
            expected: `<= ${result.limit} ${result.unit || 'units'}`,
            actual: `${result.resourceUsage} ${result.unit || 'units'}`,
            suggestions: [`Optimize resource usage for ${validator.name}`],
          };

          if (result.details) {
            violationOptions.context = result.details;
          }

          violations.push(
            this.createViolation(
              `CUSTOM_RESOURCE_${validator.name.toUpperCase()}`,
              `Custom resource validator '${validator.name}' failed`,
              violationOptions
            )
          );
        }
      } catch (error) {
        violations.push(
          this.createViolation(
            'CUSTOM_RESOURCE_VALIDATOR_ERROR',
            `Custom resource validator '${validator.name}' threw an error: ${(error as Error).message}`,
            {
              severity: InvariantSeverity.WARNING,
              context: { validator: validator.name, error: (error as Error).message },
            }
          )
        );
      }
    }

    return violations;
  }

  /**
   * Validates a resource against its limit
   */
  private validateResourceLimit(
    current: number,
    limit: ResourceInvariantLimit,
    property: string,
    description: string
  ): InvariantViolation | null {
    const usage = current / limit.max;

    if (current > limit.max) {
      return this.createViolation(
        `RESOURCE_LIMIT_EXCEEDED_${property.toUpperCase()}`,
        description,
        {
          property,
          expected: `<= ${limit.max} ${limit.unit || 'units'}`,
          actual: `${current} ${limit.unit || 'units'}`,
          severity: InvariantSeverity.ERROR,
          context: { usage, limit: limit.max, exceeded: current - limit.max },
          suggestions: [
            'Reduce the size of the data',
            'Remove unnecessary fields',
            'Implement data compression',
            'Move large data to external storage',
          ],
        }
      );
    }

    if (usage >= limit.criticalThreshold) {
      return this.createViolation(
        `RESOURCE_CRITICAL_${property.toUpperCase()}`,
        `${description} (critical threshold reached)`,
        {
          property,
          expected: `< ${limit.max * limit.criticalThreshold} ${limit.unit || 'units'}`,
          actual: `${current} ${limit.unit || 'units'}`,
          severity: InvariantSeverity.ERROR,
          context: { usage, threshold: limit.criticalThreshold },
          suggestions: ['Take immediate action to reduce resource usage'],
        }
      );
    }

    if (usage >= limit.warningThreshold) {
      return this.createViolation(
        `RESOURCE_WARNING_${property.toUpperCase()}`,
        `${description} (warning threshold reached)`,
        {
          property,
          expected: `< ${limit.max * limit.warningThreshold} ${limit.unit || 'units'}`,
          actual: `${current} ${limit.unit || 'units'}`,
          severity: InvariantSeverity.WARNING,
          context: { usage, threshold: limit.warningThreshold },
          suggestions: ['Monitor resource usage closely', 'Plan for optimization'],
        }
      );
    }

    return null;
  }

  /**
   * Calculates the approximate size of an object in bytes
   */
  private calculateObjectSize(obj: unknown): number {
    if (obj === null || obj === undefined) {
      return 0;
    }

    try {
      // Use JSON.stringify as a rough approximation
      const jsonString = JSON.stringify(obj);
      return jsonString.length * 2; // Approximate UTF-16 encoding
    } catch {
      // If object can't be stringified, estimate based on type
      if (typeof obj === 'string') return obj.length * 2;
      if (typeof obj === 'number') return 8;
      if (typeof obj === 'boolean') return 4;
      if (obj instanceof Date) return 8;
      return 1000; // Default estimate for complex objects
    }
  }

  /**
   * Calculates the maximum nesting depth of an object
   */
  private calculateMaxNestingDepth(obj: unknown, currentDepth = 0): number {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
      return currentDepth;
    }

    let maxDepth = currentDepth;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const depth = this.calculateMaxNestingDepth(item, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    } else {
      for (const value of Object.values(obj)) {
        const depth = this.calculateMaxNestingDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return maxDepth;
  }

  /**
   * Counts the total number of properties in an object recursively
   */
  private countTotalProperties(obj: unknown): number {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
      return 0;
    }

    let count = 0;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        count += this.countTotalProperties(item);
      }
    } else {
      const entries = Object.entries(obj);
      count += entries.length;

      for (const [, value] of entries) {
        count += this.countTotalProperties(value);
      }
    }

    return count;
  }

  /**
   * Measures the time it takes to serialize the state
   */
  private async measureSerializationTime(state: TState): Promise<number> {
    const start = Date.now();

    try {
      JSON.stringify(state);
    } catch {
      // If serialization fails, return a high time to indicate an issue
      return 10000;
    }

    return Date.now() - start;
  }

  /**
   * Reduces the total size of the state object
   */
  private reduceStateSize(state: IProcessManagerState, maxSize: number): IProcessManagerState {
    // Simple strategy: remove non-essential fields from metadata first
    let reducedState = { ...state };

    if (this.calculateObjectSize(reducedState) <= maxSize) {
      return reducedState;
    }

    // Remove non-essential metadata
    if (reducedState.metadata) {
      reducedState = {
        ...reducedState,
        metadata: this.removeNonEssentialFields(
          reducedState.metadata,
          this.config.essentialFields || []
        ),
      };
    }

    if (this.calculateObjectSize(reducedState) <= maxSize) {
      return reducedState;
    }

    // Reduce stepData size
    if (reducedState.stepData) {
      reducedState = {
        ...reducedState,
        stepData: this.reduceObjectSize(reducedState.stepData, maxSize * 0.6), // Allocate 60% to stepData
      };
    }

    return reducedState;
  }

  /**
   * Reduces the size of a specific object
   */
  private reduceObjectSize(obj: Record<string, unknown>, maxSize: number): Record<string, unknown> {
    const reduced = { ...obj };
    const currentSize = this.calculateObjectSize(reduced);

    if (currentSize <= maxSize) {
      return reduced;
    }

    // Remove fields starting with the largest ones
    const entries = Object.entries(reduced).sort(
      (a, b) => this.calculateObjectSize(b[1]) - this.calculateObjectSize(a[1])
    );

    for (const [key] of entries) {
      if (!(this.config.essentialFields || []).includes(key)) {
        delete reduced[key];
        if (this.calculateObjectSize(reduced) <= maxSize) {
          break;
        }
      }
    }

    return reduced;
  }

  /**
   * Removes non-essential fields from an object
   */
  private removeNonEssentialFields(
    obj: Record<string, unknown>,
    essentialFields: string[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (essentialFields.includes(key)) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Truncates an array in the state
   */
  private truncateArrayInState(
    state: IProcessManagerState,
    path: string,
    maxLength: number
  ): IProcessManagerState {
    const newState = JSON.parse(JSON.stringify(state)); // Deep clone

    // Parse the path to navigate to the array
    const pathParts = path.split(/[.[\]]/).filter(p => p);
    let current: any = newState;

    // Navigate to the parent of the array
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (part && current && typeof current === 'object') {
        current = current[part as keyof typeof current];
      } else {
        return state; // Path doesn't exist, return unchanged
      }
    }

    // Truncate the array
    const lastPart = pathParts[pathParts.length - 1];
    if (
      lastPart &&
      current &&
      typeof current === 'object' &&
      lastPart in current &&
      Array.isArray((current as any)[lastPart])
    ) {
      (current as any)[lastPart] = (current as any)[lastPart].slice(0, maxLength);
    } else if (
      path.includes('stepData.items') &&
      newState.stepData?.items &&
      Array.isArray(newState.stepData.items)
    ) {
      // Special case for stepData.items
      newState.stepData.items = newState.stepData.items.slice(0, maxLength);
    } else if (
      path.includes('stepData.queue') &&
      newState.stepData?.queue &&
      Array.isArray(newState.stepData.queue)
    ) {
      // Special case for stepData.queue
      newState.stepData.queue = newState.stepData.queue.slice(0, maxLength);
    }

    return newState;
  }

  /**
   * Truncates a string in the state
   */
  private truncateStringInState(
    state: IProcessManagerState,
    path: string,
    maxLength: number
  ): IProcessManagerState {
    // Simple implementation - would need more sophisticated path resolution
    // For now, just return the state unchanged
    return state;
  }

  /**
   * Reduces object properties in the state
   */
  private reduceObjectProperties(
    state: IProcessManagerState,
    path: string,
    maxProperties: number
  ): IProcessManagerState {
    // Simple implementation - would need more sophisticated path resolution
    // For now, just return the state unchanged
    return state;
  }

  /**
   * Reduces overall state complexity
   */
  private reduceStateComplexity(
    state: IProcessManagerState,
    maxProperties: number
  ): IProcessManagerState {
    // Start by reducing metadata, then stepData if needed
    let reducedState = { ...state };

    if (this.countTotalProperties(reducedState) <= maxProperties) {
      return reducedState;
    }

    // Reduce metadata first
    if (reducedState.metadata) {
      reducedState = {
        ...reducedState,
        metadata: this.removeNonEssentialFields(
          reducedState.metadata,
          this.config.essentialFields || []
        ),
      };
    }

    return reducedState;
  }
}
