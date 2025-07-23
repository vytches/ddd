# Intermediate Value Objects - Implementation Overview

**Version**: 2025-01-21 **Package**: @vytches-ddd/value-objects  
**Complexity**: Intermediate **Focus**: Advanced patterns and complex value
object implementations

## Overview

This document provides comprehensive guidance for implementing
intermediate-level value objects using the @vytches-ddd/value-objects package.
It covers advanced patterns including composite structures, range operations,
complex validations, and intelligent business logic.

## Advanced Implementation Patterns

### **1. Composite Value Objects**

Composite value objects aggregate multiple simpler value objects with
intelligent coordination:

```typescript
import { ValueObject } from '@vytches-ddd/value-objects';
import { ValueObjectValidationResult } from './types';

export class ContactInformation extends ValueObject<ContactInformationData> {
  private constructor(data: ContactInformationData) {
    super(data);
  }

  // ✅ Factory with nested value object creation
  static create(
    email: string,
    phoneNumber?: string,
    address?: AddressData,
    preferences?: ContactPreferences
  ): ContactInformation {
    // Create nested value objects
    const emailVO = Email.create(email);
    const phoneVO = phoneNumber ? PhoneNumber.create(phoneNumber) : undefined;
    const addressVO = address
      ? Address.create(
          address.street,
          address.city,
          address.state,
          address.postalCode,
          address.country
        )
      : undefined;

    const data: ContactInformationData = {
      email: emailVO,
      phoneNumber: phoneVO,
      address: addressVO,
      preferences: preferences ?? {
        preferredMethod: 'email',
        allowMarketing: false,
        timezone: 'UTC',
      },
    };

    const validation = ContactInformation.validate(data);
    if (!validation.isValid) {
      throw new Error(
        `Invalid contact information: ${validation.errors.join(', ')}`
      );
    }

    return new ContactInformation(data);
  }

  // ✅ Cross-component validation
  static validate(data: ContactInformationData): ValueObjectValidationResult {
    const errors: string[] = [];

    // Required components
    if (!data.email) {
      errors.push('Email is required');
    }

    // Business rule: SMS preferences require phone number
    if (data.preferences.preferredMethod === 'sms' && !data.phoneNumber) {
      errors.push('SMS preference requires a phone number');
    }

    // Business rule: Marketing consent requires verified email
    if (data.preferences.allowMarketing && !data.email.isVerified) {
      errors.push('Marketing consent requires verified email');
    }

    return errors.length > 0
      ? { isValid: false, errors }
      : { isValid: true, errors: [] };
  }

  // ✅ Intelligent update methods
  updateEmail(newEmail: Email): ContactInformation {
    const newData = { ...this.data, email: newEmail };

    // Re-validate with new email
    const validation = ContactInformation.validate(newData);
    if (!validation.isValid) {
      throw new Error(`Email update failed: ${validation.errors.join(', ')}`);
    }

    return new ContactInformation(newData);
  }

  updatePreferences(updates: Partial<ContactPreferences>): ContactInformation {
    const newPreferences = { ...this.data.preferences, ...updates };
    const newData = { ...this.data, preferences: newPreferences };

    const validation = ContactInformation.validate(newData);
    if (!validation.isValid) {
      throw new Error(
        `Preferences update failed: ${validation.errors.join(', ')}`
      );
    }

    return new ContactInformation(newData);
  }

  // ✅ Composite analysis methods
  getContactScore(): {
    score: number;
    factors: ContactScoreFactor[];
    recommendations: string[];
  } {
    let score = 0;
    const factors: ContactScoreFactor[] = [];
    const recommendations: string[] = [];

    // Email verification
    if (this.data.email.isVerified) {
      score += 30;
      factors.push({ factor: 'verified_email', weight: 30 });
    } else {
      recommendations.push('Verify email address');
    }

    // Phone number availability
    if (this.data.phoneNumber) {
      score += 20;
      factors.push({ factor: 'phone_available', weight: 20 });
    } else {
      recommendations.push('Add phone number for better reach');
    }

    // Address completeness
    if (this.data.address) {
      score += 20;
      factors.push({ factor: 'address_complete', weight: 20 });
    } else {
      recommendations.push('Add address for location-based services');
    }

    // Preferences optimization
    if (this.data.preferences.timezone !== 'UTC') {
      score += 15;
      factors.push({ factor: 'timezone_set', weight: 15 });
    } else {
      recommendations.push(
        'Set specific timezone for better communication timing'
      );
    }

    // Marketing consent (business value)
    if (this.data.preferences.allowMarketing && this.data.email.isVerified) {
      score += 15;
      factors.push({ factor: 'marketing_consent', weight: 15 });
    }

    return { score: Math.min(100, score), factors, recommendations };
  }

  // ✅ Communication intelligence
  getBestContactMethod(): {
    method: ContactMethod;
    availability: boolean;
    reason: string;
  } {
    const preferred = this.data.preferences.preferredMethod;

    // Check preferred method availability
    switch (preferred) {
      case 'email':
        return {
          method: 'email',
          availability: this.data.email.isVerified,
          reason: this.data.email.isVerified
            ? 'Email is verified and preferred'
            : 'Email preferred but not verified',
        };

      case 'sms':
        if (this.data.phoneNumber) {
          return {
            method: 'sms',
            availability: true,
            reason: 'SMS preferred and phone number available',
          };
        } else {
          return {
            method: 'email',
            availability: this.data.email.isVerified,
            reason: 'SMS preferred but no phone number, falling back to email',
          };
        }

      case 'phone':
        if (this.data.phoneNumber) {
          return {
            method: 'phone',
            availability: true,
            reason: 'Phone preferred and number available',
          };
        } else {
          return {
            method: 'email',
            availability: this.data.email.isVerified,
            reason: 'Phone preferred but no number, falling back to email',
          };
        }

      default:
        return {
          method: 'email',
          availability: this.data.email.isVerified,
          reason: 'Default to email communication',
        };
    }
  }
}
```

### **2. Range Value Objects with Complex Operations**

Range value objects handle complex temporal or numeric ranges:

```typescript
export class PriceRange extends ValueObject<PriceRangeData> {
  private constructor(data: PriceRangeData) {
    super(data);
  }

  static create(
    minPrice: Money,
    maxPrice: Money,
    includeMin: boolean = true,
    includeMax: boolean = true
  ): PriceRange {
    // Currency consistency validation
    if (minPrice.currency !== maxPrice.currency) {
      throw new Error('Price range currencies must match');
    }

    // Range validity
    if (minPrice.amount > maxPrice.amount) {
      throw new Error('Minimum price cannot exceed maximum price');
    }

    const data: PriceRangeData = {
      minPrice,
      maxPrice,
      includeMin,
      includeMax,
      currency: minPrice.currency,
    };

    return new PriceRange(data);
  }

  // ✅ Range operations
  contains(price: Money): boolean {
    if (price.currency !== this.data.currency) {
      throw new Error('Cannot compare prices in different currencies');
    }

    const minValid = this.data.includeMin
      ? price.amount >= this.data.minPrice.amount
      : price.amount > this.data.minPrice.amount;

    const maxValid = this.data.includeMax
      ? price.amount <= this.data.maxPrice.amount
      : price.amount < this.data.maxPrice.amount;

    return minValid && maxValid;
  }

  overlaps(other: PriceRange): boolean {
    if (this.data.currency !== other.data.currency) {
      return false;
    }

    return (
      this.data.minPrice.amount <= other.data.maxPrice.amount &&
      this.data.maxPrice.amount >= other.data.minPrice.amount
    );
  }

  intersect(other: PriceRange): PriceRange | null {
    if (!this.overlaps(other)) {
      return null;
    }

    const minPrice =
      this.data.minPrice.amount > other.data.minPrice.amount
        ? this.data.minPrice
        : other.data.minPrice;

    const maxPrice =
      this.data.maxPrice.amount < other.data.maxPrice.amount
        ? this.data.maxPrice
        : other.data.maxPrice;

    return PriceRange.create(minPrice, maxPrice);
  }

  // ✅ Business intelligence
  calculateDiscount(originalPrice: Money): {
    discountAmount: Money;
    discountPercentage: number;
    priceAfterDiscount: Money;
    isValidDiscount: boolean;
  } | null {
    if (!this.contains(originalPrice)) {
      return null;
    }

    // Calculate optimal discount within range
    const midRange = Money.create(
      (this.data.minPrice.amount + this.data.maxPrice.amount) / 2,
      this.data.currency
    );

    const discountAmount = originalPrice.subtract(midRange);
    const discountPercentage =
      (discountAmount.amount / originalPrice.amount) * 100;

    return {
      discountAmount,
      discountPercentage,
      priceAfterDiscount: midRange,
      isValidDiscount: discountPercentage > 0,
    };
  }

  // ✅ Market analysis
  getMarketPosition(currentPrice: Money): MarketPosition {
    if (!this.contains(currentPrice)) {
      return currentPrice.amount < this.data.minPrice.amount
        ? 'below_range'
        : 'above_range';
    }

    const rangeSize = this.data.maxPrice.amount - this.data.minPrice.amount;
    const pricePosition =
      (currentPrice.amount - this.data.minPrice.amount) / rangeSize;

    if (pricePosition <= 0.25) return 'low_end';
    if (pricePosition <= 0.5) return 'mid_low';
    if (pricePosition <= 0.75) return 'mid_high';
    return 'high_end';
  }
}
```

### **3. Statistical Value Objects**

Complex value objects that perform calculations and analysis:

```typescript
export class StatisticalSummary extends ValueObject<StatisticalSummaryData> {
  private constructor(data: StatisticalSummaryData) {
    super(data);
  }

  static fromData(values: number[]): StatisticalSummary {
    if (values.length === 0) {
      throw new Error('Cannot create statistics from empty data set');
    }

    const sortedValues = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const count = values.length;
    const mean = sum / count;

    // Calculate variance and standard deviation
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);

    // Calculate percentiles
    const median = StatisticalSummary.calculatePercentile(sortedValues, 0.5);
    const q1 = StatisticalSummary.calculatePercentile(sortedValues, 0.25);
    const q3 = StatisticalSummary.calculatePercentile(sortedValues, 0.75);

    const data: StatisticalSummaryData = {
      values: [...values],
      count,
      sum,
      mean,
      median,
      standardDeviation,
      variance,
      min: sortedValues[0],
      max: sortedValues[count - 1],
      q1,
      q3,
      range: sortedValues[count - 1] - sortedValues[0],
    };

    return new StatisticalSummary(data);
  }

  private static calculatePercentile(
    sortedValues: number[],
    percentile: number
  ): number {
    const index = percentile * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower];
    }

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  // ✅ Statistical analysis methods
  isOutlier(value: number, method: 'iqr' | 'zscore' = 'iqr'): boolean {
    switch (method) {
      case 'iqr':
        const iqr = this.data.q3 - this.data.q1;
        const lowerBound = this.data.q1 - 1.5 * iqr;
        const upperBound = this.data.q3 + 1.5 * iqr;
        return value < lowerBound || value > upperBound;

      case 'zscore':
        const zscore = Math.abs(
          (value - this.data.mean) / this.data.standardDeviation
        );
        return zscore > 2; // 2 standard deviations
    }
  }

  getPercentileRank(value: number): number {
    const rank = this.data.values.filter(v => v <= value).length;
    return (rank / this.data.count) * 100;
  }

  compare(other: StatisticalSummary): StatisticalComparison {
    const meanDifference = this.data.mean - other.data.mean;
    const meanPercentChange = (meanDifference / other.data.mean) * 100;

    const stdDevDifference =
      this.data.standardDeviation - other.data.standardDeviation;
    const variabilityChange = stdDevDifference > 0 ? 'increased' : 'decreased';

    return {
      meanDifference,
      meanPercentChange,
      variabilityChange,
      summary: this.generateComparisonSummary(
        meanPercentChange,
        variabilityChange
      ),
    };
  }

  private generateComparisonSummary(
    percentChange: number,
    variabilityChange: string
  ): string {
    const direction = percentChange > 0 ? 'increased' : 'decreased';
    const magnitude = Math.abs(percentChange);

    let magnitudeDesc = 'slightly';
    if (magnitude > 20) magnitudeDesc = 'significantly';
    else if (magnitude > 10) magnitudeDesc = 'moderately';

    return `Mean ${direction} ${magnitudeDesc} (${percentChange.toFixed(1)}%), variability ${variabilityChange}`;
  }

  // ✅ Distribution analysis
  getDistributionType(): DistributionType {
    // Skewness calculation
    const skewness = this.calculateSkewness();

    if (Math.abs(skewness) < 0.5) return 'normal';
    if (skewness > 0.5) return 'right_skewed';
    if (skewness < -0.5) return 'left_skewed';

    return 'unknown';
  }

  private calculateSkewness(): number {
    const n = this.data.count;
    const mean = this.data.mean;
    const stdDev = this.data.standardDeviation;

    const skewnessSum = this.data.values.reduce((sum, value) => {
      return sum + Math.pow((value - mean) / stdDev, 3);
    }, 0);

    return (n / ((n - 1) * (n - 2))) * skewnessSum;
  }
}
```

### **4. Validation Patterns for Complex Value Objects**

Advanced validation patterns for intermediate value objects:

```typescript
export class AdvancedValidationExample extends ValueObject<ComplexData> {
  private constructor(data: ComplexData) {
    super(data);
  }

  static validate(data: ComplexData): ValueObjectValidationResult {
    const validationChain = new ValidationChain<ComplexData>();

    return validationChain
      .addRule('basic_validation', this.validateBasicFields)
      .addRule('business_rules', this.validateBusinessRules)
      .addRule('cross_field_validation', this.validateFieldRelationships)
      .addRule('external_constraints', this.validateExternalConstraints)
      .execute(data);
  }

  // ✅ Layered validation approach
  private static validateBasicFields(data: ComplexData): ValidationResult {
    const errors: string[] = [];

    // Type and format validation
    if (!data.identifier || typeof data.identifier !== 'string') {
      errors.push('Identifier must be a non-empty string');
    }

    if (
      data.numericValue !== undefined &&
      typeof data.numericValue !== 'number'
    ) {
      errors.push('Numeric value must be a number');
    }

    // Range validation
    if (
      data.numericValue !== undefined &&
      (data.numericValue < 0 || data.numericValue > 1000000)
    ) {
      errors.push('Numeric value must be between 0 and 1,000,000');
    }

    return { isValid: errors.length === 0, errors };
  }

  private static validateBusinessRules(data: ComplexData): ValidationResult {
    const errors: string[] = [];

    // Business rule: Premium features require verification
    if (data.premiumFeatures && !data.verified) {
      errors.push('Premium features require account verification');
    }

    // Business rule: High-value transactions need approval
    if (
      data.numericValue &&
      data.numericValue > 10000 &&
      !data.approvalRequired
    ) {
      errors.push('High-value transactions require approval flag');
    }

    // Business rule: Active status requires valid end date
    if (
      data.status === 'active' &&
      data.endDate &&
      data.endDate <= new Date()
    ) {
      errors.push('Active status cannot have past end date');
    }

    return { isValid: errors.length === 0, errors };
  }

  private static validateFieldRelationships(
    data: ComplexData
  ): ValidationResult {
    const errors: string[] = [];

    // Cross-field validation: start date must be before end date
    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      errors.push('Start date must be before end date');
    }

    // Conditional validation based on type
    if (data.type === 'subscription' && !data.billingCycle) {
      errors.push('Subscription type requires billing cycle');
    }

    if (data.type === 'one-time' && data.billingCycle) {
      errors.push('One-time type cannot have billing cycle');
    }

    return { isValid: errors.length === 0, errors };
  }

  private static async validateExternalConstraints(
    data: ComplexData
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    // Example: Check external service constraints
    if (data.externalId) {
      const exists = await this.checkExternalIdExists(data.externalId);
      if (!exists) {
        errors.push('External ID does not exist in external system');
      }
    }

    // Example: Check business rules against external data
    if (data.accountId) {
      const accountLimits = await this.getAccountLimits(data.accountId);
      if (data.numericValue && data.numericValue > accountLimits.maxValue) {
        errors.push(`Value exceeds account limit of ${accountLimits.maxValue}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  // Mock external validation methods
  private static async checkExternalIdExists(id: string): Promise<boolean> {
    // In real implementation, this would call external service
    return true;
  }

  private static async getAccountLimits(
    accountId: string
  ): Promise<{ maxValue: number }> {
    // In real implementation, this would fetch from database/service
    return { maxValue: 50000 };
  }
}

// ✅ Validation chain helper
class ValidationChain<T> {
  private rules: Array<{
    name: string;
    validator: (data: T) => ValidationResult | Promise<ValidationResult>;
  }> = [];

  addRule(
    name: string,
    validator: (data: T) => ValidationResult | Promise<ValidationResult>
  ): ValidationChain<T> {
    this.rules.push({ name, validator });
    return this;
  }

  async execute(data: T): Promise<ValueObjectValidationResult> {
    const allErrors: string[] = [];

    for (const rule of this.rules) {
      try {
        const result = await rule.validator(data);
        if (!result.isValid) {
          allErrors.push(
            ...result.errors.map(error => `${rule.name}: ${error}`)
          );
        }
      } catch (error) {
        allErrors.push(
          `${rule.name}: Validation failed - ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }
}
```

## Performance Considerations

### **1. Lazy Loading and Caching**

For expensive computations in value objects:

```typescript
export class ComplexCalculationVO extends ValueObject<ComplexData> {
  private _expensiveCalculationResult?: CalculationResult;
  private _calculationCache = new Map<string, any>();

  // ✅ Lazy loading for expensive operations
  getExpensiveCalculation(): CalculationResult {
    if (!this._expensiveCalculationResult) {
      this._expensiveCalculationResult = this.performExpensiveCalculation();
    }
    return this._expensiveCalculationResult;
  }

  // ✅ Memoization for parameterized calculations
  getParameterizedResult(params: CalculationParams): any {
    const cacheKey = JSON.stringify(params);

    if (this._calculationCache.has(cacheKey)) {
      return this._calculationCache.get(cacheKey);
    }

    const result = this.performParameterizedCalculation(params);
    this._calculationCache.set(cacheKey, result);

    return result;
  }

  private performExpensiveCalculation(): CalculationResult {
    // Expensive computation here
    return { value: 'computed result' };
  }

  private performParameterizedCalculation(params: CalculationParams): any {
    // Parameterized computation here
    return params;
  }
}
```

### **2. Builder Pattern for Complex Construction**

For value objects with many optional parameters:

```typescript
export class ComplexValueObjectBuilder {
  private data: Partial<ComplexValueObjectData> = {};

  static create(): ComplexValueObjectBuilder {
    return new ComplexValueObjectBuilder();
  }

  withIdentifier(id: string): ComplexValueObjectBuilder {
    this.data.identifier = id;
    return this;
  }

  withNumericValue(value: number): ComplexValueObjectBuilder {
    this.data.numericValue = value;
    return this;
  }

  withDateRange(start: Date, end: Date): ComplexValueObjectBuilder {
    this.data.startDate = start;
    this.data.endDate = end;
    return this;
  }

  withOptionalFeatures(features: OptionalFeatures): ComplexValueObjectBuilder {
    this.data.optionalFeatures = features;
    return this;
  }

  build(): ComplexValueObject {
    // Validate required fields
    if (!this.data.identifier) {
      throw new Error('Identifier is required');
    }

    return ComplexValueObject.create(this.data as ComplexValueObjectData);
  }
}

// Usage
const complexVO = ComplexValueObjectBuilder.create()
  .withIdentifier('complex-123')
  .withNumericValue(1000)
  .withDateRange(new Date(), new Date())
  .build();
```

## Testing Intermediate Value Objects

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { ContactInformation } from './contact-information';

describe('ContactInformation - Intermediate Value Object', () => {
  describe('composite validation', () => {
    it('should validate cross-component business rules', () => {
      const [error] = safeRun(() =>
        ContactInformation.create(
          'user@example.com',
          undefined, // No phone
          undefined,
          { preferredMethod: 'sms' } // But wants SMS
        )
      );

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain(
        'SMS preference requires a phone number'
      );
    });
  });

  describe('intelligent analysis', () => {
    it('should calculate contact score correctly', () => {
      const contact = ContactInformation.create(
        'verified@example.com',
        '5551234567',
        {
          street: '123 Main St',
          city: 'Boston',
          state: 'MA',
          postalCode: '02101',
          country: 'US',
        }
      );

      const score = contact.getContactScore();

      expect(score.score).toBeGreaterThan(50);
      expect(score.factors).toContainEqual(
        expect.objectContaining({ factor: 'phone_available' })
      );
    });

    it('should recommend best contact method', () => {
      const contact = ContactInformation.create(
        'user@example.com',
        '5551234567',
        undefined,
        { preferredMethod: 'sms' }
      );

      const bestMethod = contact.getBestContactMethod();

      expect(bestMethod.method).toBe('sms');
      expect(bestMethod.availability).toBe(true);
    });
  });
});
```

## Summary

Intermediate value object implementations focus on:

1. **Composite Structures**: Aggregating multiple value objects with intelligent
   coordination
2. **Complex Validation**: Multi-layered validation with business rules and
   cross-field constraints
3. **Advanced Operations**: Range operations, statistical analysis, and
   intelligent behavior
4. **Performance Optimization**: Lazy loading, caching, and builder patterns
5. **Business Intelligence**: Analysis methods, scoring systems, and
   recommendation engines
6. **Error Handling**: Comprehensive error detection with detailed reporting
7. **Testing Strategy**: Complex scenario testing with business rule validation

These patterns enable sophisticated domain modeling while maintaining value
object principles of immutability, equality, and encapsulation.
