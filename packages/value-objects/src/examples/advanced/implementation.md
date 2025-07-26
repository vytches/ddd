# Advanced Value Objects - Implementation Overview

**Version**: 2025-01-21 **Package**: @vytches/ddd-value-objects  
**Complexity**: Advanced **Focus**: Advanced implementation patterns and
architectural considerations

## Overview

This document provides comprehensive guidance for implementing advanced value
objects that handle complex business logic, performance optimization, and
sophisticated domain modeling. It covers patterns for time management, design
systems, geospatial calculations, and other advanced scenarios.

## Advanced Implementation Principles

### **1. Single Responsibility with Rich Behavior**

Advanced value objects should maintain single responsibility while providing
rich, domain-specific behavior:

```typescript
import { ValueObject } from '@vytches/ddd-value-objects';

// ✅ Rich behavior while maintaining single responsibility
export class AdvancedValueObject extends ValueObject<AdvancedData> {
  private constructor(data: AdvancedData) {
    super(data);
  }

  // Core factory method
  static create(/* parameters */): AdvancedValueObject {
    // Validation and normalization
    const normalizedData = this.normalizeAndValidate(/* parameters */);
    return new AdvancedValueObject(normalizedData);
  }

  // ✅ Domain-specific operations
  performDomainOperation(): AdvancedValueObject {
    // Complex business logic
    const transformedData = this.applyDomainRules();
    return new AdvancedValueObject(transformedData);
  }

  // ✅ Analysis and intelligence methods
  analyze(): AnalysisResult {
    return {
      score: this.calculateScore(),
      insights: this.generateInsights(),
      recommendations: this.getRecommendations(),
    };
  }

  // ✅ Integration with external systems
  toExternalFormat<T>(formatter: ExternalFormatter<T>): T {
    return formatter.format(this.data);
  }
}
```

### **2. Performance Optimization Patterns**

Advanced value objects often require performance optimization:

```typescript
export class PerformanceOptimizedValueObject extends ValueObject<ComplexData> {
  // ✅ Lazy computation for expensive operations
  private _cachedResult?: ComputationResult;
  private _computationCache = new Map<string, any>();

  getExpensiveComputation(): ComputationResult {
    if (!this._cachedResult) {
      this._cachedResult = this.performExpensiveCalculation();
    }
    return this._cachedResult;
  }

  // ✅ Memoization for parameterized operations
  getParameterizedResult(params: ParameterSet): any {
    const cacheKey = this.generateCacheKey(params);

    if (this._computationCache.has(cacheKey)) {
      return this._computationCache.get(cacheKey);
    }

    const result = this.computeWithParameters(params);

    // Prevent memory leaks with cache size limit
    if (this._computationCache.size >= 100) {
      const firstKey = this._computationCache.keys().next().value;
      this._computationCache.delete(firstKey);
    }

    this._computationCache.set(cacheKey, result);
    return result;
  }

  // ✅ Batch operations for efficiency
  static processBatch<T>(
    items: T[],
    processor: (item: T) => PerformanceOptimizedValueObject,
    batchSize: number = 100
  ): PerformanceOptimizedValueObject[] {
    const results: PerformanceOptimizedValueObject[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = batch.map(processor);
      results.push(...batchResults);

      // Optional: yield control between batches for UI responsiveness
      if (i % (batchSize * 10) === 0) {
        // In browser environment, yield control
        // await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return results;
  }

  private performExpensiveCalculation(): ComputationResult {
    // Expensive computation logic
    return { value: 'computed' };
  }

  private computeWithParameters(params: ParameterSet): any {
    // Parameterized computation
    return params;
  }

  private generateCacheKey(params: ParameterSet): string {
    // Generate stable cache key
    return JSON.stringify(params);
  }
}
```

### **3. Mathematical and Scientific Value Objects**

For complex calculations and scientific applications:

```typescript
export class ScientificValueObject extends ValueObject<ScientificData> {
  private static readonly PRECISION_THRESHOLD = 1e-10;

  private constructor(data: ScientificData) {
    super(data);
  }

  // ✅ Factory with precision handling
  static create(
    value: number,
    unit: string,
    precision?: number
  ): ScientificValueObject {
    const normalizedValue = precision
      ? parseFloat(value.toFixed(precision))
      : value;

    const data: ScientificData = {
      value: normalizedValue,
      unit,
      precision: precision || this.detectPrecision(value),
    };

    return new ScientificValueObject(data);
  }

  // ✅ Mathematical operations with precision preservation
  add(other: ScientificValueObject): ScientificValueObject {
    this.validateUnits(other, 'addition');

    const resultPrecision = Math.max(this.data.precision, other.data.precision);
    const resultValue = this.data.value + other.data.value;

    return ScientificValueObject.create(
      resultValue,
      this.data.unit,
      resultPrecision
    );
  }

  multiply(scalar: number): ScientificValueObject {
    const resultValue = this.data.value * scalar;
    return ScientificValueObject.create(
      resultValue,
      this.data.unit,
      this.data.precision
    );
  }

  // ✅ Unit conversion with validation
  convertTo(targetUnit: string): ScientificValueObject {
    const conversionFactor = this.getConversionFactor(
      this.data.unit,
      targetUnit
    );
    if (!conversionFactor) {
      throw new Error(`Cannot convert from ${this.data.unit} to ${targetUnit}`);
    }

    const convertedValue = this.data.value * conversionFactor;
    return ScientificValueObject.create(
      convertedValue,
      targetUnit,
      this.data.precision
    );
  }

  // ✅ Comparison with precision awareness
  equals(other: ScientificValueObject): boolean {
    if (this.data.unit !== other.data.unit) {
      return false;
    }

    const difference = Math.abs(this.data.value - other.data.value);
    const threshold = Math.max(
      ScientificValueObject.PRECISION_THRESHOLD,
      Math.pow(10, -Math.min(this.data.precision, other.data.precision))
    );

    return difference < threshold;
  }

  // ✅ Statistical operations
  static calculateStatistics(
    values: ScientificValueObject[]
  ): StatisticalSummary {
    if (values.length === 0) {
      throw new Error('Cannot calculate statistics for empty array');
    }

    // Ensure all values have the same unit
    const baseUnit = values[0].data.unit;
    if (!values.every(v => v.data.unit === baseUnit)) {
      throw new Error(
        'All values must have the same unit for statistical calculations'
      );
    }

    const numericalValues = values.map(v => v.data.value);

    return {
      count: values.length,
      sum: numericalValues.reduce((a, b) => a + b, 0),
      mean: numericalValues.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...numericalValues),
      max: Math.max(...numericalValues),
      standardDeviation: this.calculateStandardDeviation(numericalValues),
      unit: baseUnit,
    };
  }

  private static detectPrecision(value: number): number {
    const str = value.toString();
    const decimalIndex = str.indexOf('.');
    return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
  }

  private validateUnits(other: ScientificValueObject, operation: string): void {
    if (this.data.unit !== other.data.unit) {
      throw new Error(
        `Cannot perform ${operation} on different units: ${this.data.unit} and ${other.data.unit}`
      );
    }
  }

  private getConversionFactor(fromUnit: string, toUnit: string): number | null {
    // Simple conversion table - in production, use comprehensive unit library
    const conversions: Record<string, Record<string, number>> = {
      m: { km: 0.001, cm: 100, mm: 1000 },
      kg: { g: 1000, t: 0.001, lb: 2.20462 },
      // Add more conversions as needed
    };

    return conversions[fromUnit]?.[toUnit] || null;
  }

  private static calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff =
      squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }
}

interface ScientificData {
  value: number;
  unit: string;
  precision: number;
}

interface StatisticalSummary {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  standardDeviation: number;
  unit: string;
}
```

### **4. Strategy Pattern for Complex Operations**

For value objects with multiple operation modes:

```typescript
// ✅ Strategy pattern for different calculation methods
interface CalculationStrategy<T> {
  calculate(data: T): CalculationResult;
  validate(data: T): boolean;
  getName(): string;
}

export class FlexibleValueObject extends ValueObject<FlexibleData> {
  private static strategies = new Map<
    string,
    CalculationStrategy<FlexibleData>
  >();

  private constructor(data: FlexibleData) {
    super(data);
  }

  static registerStrategy(
    name: string,
    strategy: CalculationStrategy<FlexibleData>
  ): void {
    this.strategies.set(name, strategy);
  }

  static create(
    data: FlexibleData,
    strategyName?: string
  ): FlexibleValueObject {
    const strategy = strategyName ? this.strategies.get(strategyName) : null;

    if (strategy && !strategy.validate(data)) {
      throw new Error(`Data validation failed for strategy: ${strategyName}`);
    }

    return new FlexibleValueObject({
      ...data,
      calculationStrategy: strategyName || 'default',
    });
  }

  calculate(): CalculationResult {
    const strategy = FlexibleValueObject.strategies.get(
      this.data.calculationStrategy
    );

    if (!strategy) {
      throw new Error(`Strategy not found: ${this.data.calculationStrategy}`);
    }

    return strategy.calculate(this.data);
  }

  withStrategy(strategyName: string): FlexibleValueObject {
    const strategy = FlexibleValueObject.strategies.get(strategyName);

    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyName}`);
    }

    if (!strategy.validate(this.data)) {
      throw new Error(
        `Current data is not compatible with strategy: ${strategyName}`
      );
    }

    return new FlexibleValueObject({
      ...this.data,
      calculationStrategy: strategyName,
    });
  }
}

// Example strategy implementations
class StandardCalculationStrategy implements CalculationStrategy<FlexibleData> {
  calculate(data: FlexibleData): CalculationResult {
    return { value: data.baseValue * 1.0, method: 'standard' };
  }

  validate(data: FlexibleData): boolean {
    return data.baseValue >= 0;
  }

  getName(): string {
    return 'standard';
  }
}

class PremiumCalculationStrategy implements CalculationStrategy<FlexibleData> {
  calculate(data: FlexibleData): CalculationResult {
    return { value: data.baseValue * 1.25, method: 'premium' };
  }

  validate(data: FlexibleData): boolean {
    return data.baseValue >= 100;
  }

  getName(): string {
    return 'premium';
  }
}

// Register strategies
FlexibleValueObject.registerStrategy(
  'standard',
  new StandardCalculationStrategy()
);
FlexibleValueObject.registerStrategy(
  'premium',
  new PremiumCalculationStrategy()
);
```

### **5. Integration Patterns**

For value objects that interact with external systems:

```typescript
export class IntegratedValueObject extends ValueObject<IntegratedData> {
  private constructor(data: IntegratedData) {
    super(data);
  }

  // ✅ External service integration
  static async createFromExternalService(
    identifier: string,
    service: ExternalDataService
  ): Promise<IntegratedValueObject> {
    try {
      const externalData = await service.fetch(identifier);
      const normalizedData = this.normalizeExternalData(externalData);

      return new IntegratedValueObject(normalizedData);
    } catch (error) {
      throw new Error(
        `Failed to create from external service: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ Validation with external dependencies
  async validateWithExternalService(
    validationService: ValidationService
  ): Promise<ValidationResult> {
    try {
      const isValid = await validationService.validate(this.data);
      return {
        isValid,
        errors: isValid ? [] : ['External validation failed'],
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          `Validation service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        timestamp: new Date(),
      };
    }
  }

  // ✅ Synchronization with external state
  async syncWithExternal(
    syncService: SyncService
  ): Promise<IntegratedValueObject> {
    try {
      const latestData = await syncService.getLatest(this.data.id);
      const mergedData = this.mergeWithExternal(latestData);

      return new IntegratedValueObject(mergedData);
    } catch (error) {
      // Return current instance if sync fails (graceful degradation)
      console.warn('Sync failed, using current data:', error);
      return this;
    }
  }

  // ✅ Export with format adaptation
  export<T>(adapter: ExportAdapter<IntegratedData, T>): T {
    return adapter.adapt(this.data);
  }

  private static normalizeExternalData(externalData: any): IntegratedData {
    // Transform external data format to internal format
    return {
      id: externalData.identifier,
      value: externalData.content,
      metadata: {
        source: 'external',
        lastUpdated: new Date(),
        version: externalData.version || '1.0',
      },
    };
  }

  private mergeWithExternal(externalData: any): IntegratedData {
    // Merge strategy based on timestamps, versions, etc.
    return {
      ...this.data,
      value: externalData.content,
      metadata: {
        ...this.data.metadata,
        lastUpdated: new Date(),
        version: externalData.version,
      },
    };
  }
}

// Supporting interfaces
interface ExternalDataService {
  fetch(identifier: string): Promise<any>;
}

interface ValidationService {
  validate(data: IntegratedData): Promise<boolean>;
}

interface SyncService {
  getLatest(id: string): Promise<any>;
}

interface ExportAdapter<TFrom, TTo> {
  adapt(data: TFrom): TTo;
}

interface IntegratedData {
  id: string;
  value: any;
  metadata: {
    source: string;
    lastUpdated: Date;
    version: string;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  timestamp: Date;
}
```

### **6. Error Handling and Resilience**

Advanced error handling patterns for robust value objects:

```typescript
export class ResilientValueObject extends ValueObject<ResilientData> {
  private constructor(data: ResilientData) {
    super(data);
  }

  // ✅ Factory with comprehensive error handling
  static create(rawData: any): ResilientValueObject {
    try {
      const validatedData = this.validateAndSanitize(rawData);
      return new ResilientValueObject(validatedData);
    } catch (error) {
      throw new ValueObjectCreationError(
        'Failed to create ResilientValueObject',
        error instanceof Error ? error : new Error(String(error)),
        rawData
      );
    }
  }

  // ✅ Safe operations with fallback
  safeOperation<T>(
    operation: () => T,
    fallback: T,
    errorHandler?: (error: Error) => void
  ): T {
    try {
      return operation();
    } catch (error) {
      if (errorHandler) {
        errorHandler(error instanceof Error ? error : new Error(String(error)));
      }
      return fallback;
    }
  }

  // ✅ Async operations with retry logic
  async resilientAsyncOperation<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === retries) {
          throw new RetryExhaustedError(
            `Operation failed after ${retries} attempts`,
            lastError
          );
        }

        // Exponential backoff
        await this.sleep(delay * Math.pow(2, attempt - 1));
      }
    }

    throw lastError!;
  }

  // ✅ Partial failure handling
  processWithPartialFailures<T, R>(
    items: T[],
    processor: (item: T) => R
  ): ProcessingResult<R> {
    const results: R[] = [];
    const errors: ProcessingError[] = [];

    items.forEach((item, index) => {
      try {
        const result = processor(item);
        results.push(result);
      } catch (error) {
        errors.push({
          index,
          item,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    });

    return {
      results,
      errors,
      successCount: results.length,
      failureCount: errors.length,
      successRate: results.length / items.length,
    };
  }

  private static validateAndSanitize(rawData: any): ResilientData {
    // Comprehensive validation and sanitization
    if (!rawData || typeof rawData !== 'object') {
      throw new Error('Invalid input data');
    }

    return {
      value: rawData.value || 0,
      metadata: rawData.metadata || {},
      timestamp: new Date(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Custom error classes
class ValueObjectCreationError extends Error {
  constructor(
    message: string,
    public readonly cause: Error,
    public readonly rawData: any
  ) {
    super(message);
    this.name = 'ValueObjectCreationError';
  }
}

class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

interface ProcessingError {
  index: number;
  item: any;
  error: Error;
}

interface ProcessingResult<T> {
  results: T[];
  errors: ProcessingError[];
  successCount: number;
  failureCount: number;
  successRate: number;
}
```

## Advanced Testing Strategies

### **Property-Based Testing**

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';

describe('AdvancedValueObject - Property-Based Tests', () => {
  // ✅ Property-based testing for mathematical operations
  it('should maintain mathematical properties', () => {
    const testValues = generateTestValues(100);

    testValues.forEach(value => {
      const vo1 = AdvancedValueObject.create(value);
      const vo2 = AdvancedValueObject.create(value);

      // Reflexivity
      expect(vo1.equals(vo2)).toBe(true);

      // Symmetry
      const vo3 = AdvancedValueObject.create(value * 2);
      expect(vo1.equals(vo3)).toBe(vo3.equals(vo1));
    });
  });

  // ✅ Invariant testing
  it('should maintain invariants across operations', () => {
    const testCases = generateInvariantTestCases();

    testCases.forEach(testCase => {
      const vo = AdvancedValueObject.create(testCase.input);
      const result = vo.performOperation(testCase.operation);

      // Check that invariants are maintained
      expect(result.isValid()).toBe(true);
      expect(result.satisfiesInvariant()).toBe(true);
    });
  });

  function generateTestValues(count: number): number[] {
    return Array.from({ length: count }, () => Math.random() * 1000);
  }

  function generateInvariantTestCases(): any[] {
    return [
      { input: { value: 100 }, operation: 'double' },
      { input: { value: 50 }, operation: 'halve' },
      // Add more test cases
    ];
  }
});
```

### **Integration Testing**

```typescript
describe('AdvancedValueObject - Integration Tests', () => {
  // ✅ Testing with external services
  it('should integrate correctly with external services', async () => {
    const mockService = {
      fetch: jest.fn().mockResolvedValue({ data: 'test' }),
      validate: jest.fn().mockResolvedValue(true),
    };

    const [error, result] = await safeRun(async () => {
      return await IntegratedValueObject.createFromExternalService(
        'test-id',
        mockService
      );
    });

    expect(error).toBeNull();
    expect(result).toBeDefined();
    expect(mockService.fetch).toHaveBeenCalledWith('test-id');
  });

  // ✅ Performance testing
  it('should perform efficiently with large datasets', () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => i);

    const startTime = Date.now();
    const results = PerformanceOptimizedValueObject.processBatch(
      largeDataset,
      item => PerformanceOptimizedValueObject.create(item)
    );
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(10000);
    expect(duration).toBeLessThan(5000); // Should complete in less than 5 seconds
  });
});
```

## Summary

Advanced value object implementations should focus on:

1. **Rich Domain Behavior**: Provide sophisticated operations while maintaining
   single responsibility
2. **Performance Optimization**: Use caching, memoization, and batch processing
   for scalability
3. **Strategy Patterns**: Allow flexible behavior through pluggable strategies
4. **External Integration**: Handle external services with resilience and error
   handling
5. **Mathematical Precision**: Maintain accuracy in calculations and conversions
6. **Comprehensive Testing**: Use property-based testing and integration testing
7. **Error Resilience**: Implement robust error handling and recovery strategies
8. **Documentation**: Provide clear documentation for complex behavior and
   business rules

These patterns enable the creation of sophisticated value objects that can
handle complex enterprise requirements while maintaining the core principles of
immutability, equality, and encapsulation.
