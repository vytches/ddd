# Advanced Data Quality Validation with Metrics

**Version**: 1.0.0
**Package**: @vytches-ddd/validation
**Complexity**: Intermediate
**Domain**: Data Management
**Patterns**: Data Quality Assessment, Metrics Collection, Batch Validation, Quality Scoring
**Dependencies**: @vytches-ddd/validation, @vytches-ddd/core, @vytches-ddd/utils

## Description

This example demonstrates advanced data quality validation with comprehensive metrics collection and quality scoring. It shows how to assess data quality across multiple dimensions, generate actionable reports, and implement automated data quality improvement suggestions.

## Business Context

Enterprise data platforms need to ensure high data quality across multiple systems and sources. Poor data quality costs organizations an average of $15M annually through operational inefficiencies, wrong decisions, and customer dissatisfaction. This example shows how to implement comprehensive data quality assessment with metrics and automated improvement recommendations.

## Code Example

```typescript
// data-quality-validator.ts
import { 
  IValidator,
  ValidationResult,
  DataQualityMetrics,
  DataQualityReport,
  DataQualityIssue,
  BatchValidationResult
} from '@vytches-ddd/validation';
import { Result } from '@vytches-ddd/utils';
import { User, Product, Order } from './types'; // From your application

// Data quality dimensions interface
interface DataQualityDimensions {
  completeness: number;
  accuracy: number;
  consistency: number;
  validity: number;
  uniqueness: number;
  timeliness: number;
}

// Data quality validator with metrics collection
export class DataQualityValidator<T> implements IValidator<T> {
  private qualityThresholds: DataQualityDimensions;
  private validationRules: Map<string, ValidationRule[]>;

  constructor(
    qualityThresholds?: Partial<DataQualityDimensions>,
    customRules?: Map<string, ValidationRule[]>
  ) {
    this.qualityThresholds = {
      completeness: 0.95,
      accuracy: 0.98,
      consistency: 0.95,
      validity: 0.99,
      uniqueness: 0.98,
      timeliness: 0.90,
      ...qualityThresholds
    };
    
    this.validationRules = customRules || new Map();
  }

  async validate(entity: T, context?: ValidationContext): Promise<ValidationResult> {
    const startTime = Date.now();
    const entityType = (entity as any).constructor.name;
    
    // Calculate data quality metrics
    const qualityMetrics = await this.calculateQualityMetrics(entity, entityType);
    
    // Generate quality report
    const qualityReport = await this.generateQualityReport(entity, entityType, qualityMetrics);
    
    // Determine if entity meets quality standards
    const meetsStandards = this.assessQualityStandards(qualityMetrics);
    
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Generate errors and warnings based on quality metrics
    if (qualityMetrics.completeness < this.qualityThresholds.completeness) {
      errors.push({
        field: 'completeness',
        code: 'DATA_INCOMPLETE',
        message: `Data completeness ${(qualityMetrics.completeness * 100).toFixed(1)}% below threshold ${(this.qualityThresholds.completeness * 100).toFixed(1)}%`,
        severity: 'error',
        details: { 
          current: qualityMetrics.completeness,
          threshold: this.qualityThresholds.completeness
        }
      });
    }

    if (qualityMetrics.accuracy < this.qualityThresholds.accuracy) {
      errors.push({
        field: 'accuracy',
        code: 'DATA_INACCURATE',
        message: `Data accuracy ${(qualityMetrics.accuracy * 100).toFixed(1)}% below threshold ${(this.qualityThresholds.accuracy * 100).toFixed(1)}%`,
        severity: 'error',
        details: {
          current: qualityMetrics.accuracy,
          threshold: this.qualityThresholds.accuracy
        }
      });
    }

    if (qualityMetrics.timeliness < this.qualityThresholds.timeliness) {
      warnings.push({
        field: 'timeliness',
        code: 'DATA_OUTDATED',
        message: `Data may be outdated - timeliness score: ${(qualityMetrics.timeliness * 100).toFixed(1)}%`,
        suggestion: 'Consider refreshing data from source systems'
      });
    }

    // Add specific issues from quality report
    qualityReport.issues.forEach(issue => {
      if (issue.severity === 'critical' || issue.severity === 'high') {
        errors.push({
          field: issue.field,
          code: issue.issueType.toUpperCase().replace(' ', '_'),
          message: issue.description,
          severity: issue.severity === 'critical' ? 'critical' : 'error',
          details: { suggestedFix: issue.suggestedFix }
        });
      } else {
        warnings.push({
          field: issue.field,
          code: issue.issueType.toUpperCase().replace(' ', '_'),
          message: issue.description,
          suggestion: issue.suggestedFix
        });
      }
    });

    return {
      isValid: meetsStandards && errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validationDuration: Date.now() - startTime,
        rulesApplied: ['data-quality-assessment'],
        skippedRules: [],
        validatorVersion: '2.0.0',
        context: context || {
          operationType: 'quality-assessment',
          environment: 'production',
          validationLevel: 'enterprise'
        },
        qualityMetrics,
        qualityReport,
        overallQualityScore: qualityMetrics.overallScore
      }
    };
  }

  private async calculateQualityMetrics(entity: T, entityType: string): Promise<DataQualityMetrics> {
    const [
      completeness,
      accuracy,
      consistency,
      validity,
      uniqueness,
      timeliness
    ] = await Promise.all([
      this.assessCompleteness(entity),
      this.assessAccuracy(entity, entityType),
      this.assessConsistency(entity, entityType),
      this.assessValidity(entity),
      this.assessUniqueness(entity, entityType),
      this.assessTimeliness(entity)
    ]);

    const overallScore = this.calculateOverallScore({
      completeness,
      accuracy,
      consistency,
      validity,
      uniqueness,
      timeliness
    });

    return {
      completeness,
      accuracy,
      consistency,
      validity,
      uniqueness,
      timeliness,
      overallScore
    };
  }

  private async assessCompleteness(entity: T): Promise<number> {
    const entityObj = entity as Record<string, any>;
    const totalFields = Object.keys(entityObj).length;
    let nonNullFields = 0;

    Object.values(entityObj).forEach(value => {
      if (value !== null && value !== undefined && value !== '') {
        nonNullFields++;
      }
    });

    return totalFields > 0 ? nonNullFields / totalFields : 0;
  }

  private async assessAccuracy(entity: T, entityType: string): Promise<number> {
    const entityObj = entity as Record<string, any>;
    let accurateFields = 0;
    let totalCheckedFields = 0;

    // Check specific field accuracy based on entity type
    if (entityType === 'User') {
      const user = entity as User;
      
      // Email format accuracy
      if (user.email) {
        totalCheckedFields++;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(user.email)) accurateFields++;
      }

      // Phone number format accuracy
      if (user.phoneNumber) {
        totalCheckedFields++;
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        if (phoneRegex.test(user.phoneNumber)) accurateFields++;
      }

      // Age vs date of birth consistency
      if (user.age && user.dateOfBirth) {
        totalCheckedFields++;
        const calculatedAge = new Date().getFullYear() - user.dateOfBirth.getFullYear();
        if (Math.abs(calculatedAge - user.age) <= 1) accurateFields++;
      }
    }

    return totalCheckedFields > 0 ? accurateFields / totalCheckedFields : 1;
  }

  private async assessConsistency(entity: T, entityType: string): Promise<number> {
    const entityObj = entity as Record<string, any>;
    let consistentChecks = 0;
    let totalConsistencyChecks = 0;

    // Cross-field consistency checks
    if (entityType === 'Order') {
      const order = entity as Order;
      
      // Total amount consistency
      if (order.items && order.totalAmount !== undefined) {
        totalConsistencyChecks++;
        const calculatedTotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
        const variance = Math.abs(calculatedTotal - order.totalAmount) / order.totalAmount;
        if (variance < 0.01) consistentChecks++; // Allow 1% variance for rounding
      }

      // Address consistency
      if (order.shippingAddress && order.billingAddress) {
        totalConsistencyChecks++;
        // Check if country codes are consistent
        if (order.shippingAddress.country === order.billingAddress.country) {
          consistentChecks++;
        }
      }
    }

    return totalConsistencyChecks > 0 ? consistentChecks / totalConsistencyChecks : 1;
  }

  private async assessValidity(entity: T): Promise<number> {
    const entityObj = entity as Record<string, any>;
    let validFields = 0;
    let totalValidatedFields = 0;

    Object.entries(entityObj).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      
      totalValidatedFields++;

      // Basic validity checks
      if (key.includes('email') && typeof value === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(value)) validFields++;
      } else if (key.includes('date') && value instanceof Date) {
        if (!isNaN(value.getTime())) validFields++;
      } else if (key.includes('id') && typeof value === 'string') {
        if (value.length > 0) validFields++;
      } else {
        validFields++; // Assume valid if no specific validation
      }
    });

    return totalValidatedFields > 0 ? validFields / totalValidatedFields : 1;
  }

  private async assessUniqueness(entity: T, entityType: string): Promise<number> {
    // In a real implementation, this would check against a database
    // For this example, we'll return a high score assuming uniqueness
    const entityObj = entity as Record<string, any>;
    
    // Check for duplicate field values within the entity
    const fieldValues = Object.values(entityObj).filter(v => v !== null && v !== undefined);
    const uniqueValues = new Set(fieldValues);
    
    return fieldValues.length > 0 ? uniqueValues.size / fieldValues.length : 1;
  }

  private async assessTimeliness(entity: T): Promise<number> {
    const entityObj = entity as Record<string, any>;
    const now = new Date();
    let timeliness = 1.0; // Default to perfect timeliness

    // Check for timestamp fields
    Object.entries(entityObj).forEach(([key, value]) => {
      if ((key.includes('date') || key.includes('time')) && value instanceof Date) {
        const ageDays = (now.getTime() - value.getTime()) / (1000 * 60 * 60 * 24);
        
        // Reduce timeliness score based on age
        if (ageDays > 365) timeliness *= 0.5; // Very old data
        else if (ageDays > 180) timeliness *= 0.7; // Old data
        else if (ageDays > 30) timeliness *= 0.9; // Somewhat old data
      }
    });

    return Math.max(0, timeliness);
  }

  private calculateOverallScore(metrics: Omit<DataQualityMetrics, 'overallScore'>): number {
    // Weighted average based on business importance
    const weights = {
      completeness: 0.20,
      accuracy: 0.25,
      consistency: 0.20,
      validity: 0.20,
      uniqueness: 0.10,
      timeliness: 0.05
    };

    return (
      metrics.completeness * weights.completeness +
      metrics.accuracy * weights.accuracy +
      metrics.consistency * weights.consistency +
      metrics.validity * weights.validity +
      metrics.uniqueness * weights.uniqueness +
      metrics.timeliness * weights.timeliness
    );
  }

  private async generateQualityReport(
    entity: T,
    entityType: string,
    metrics: DataQualityMetrics
  ): Promise<DataQualityReport> {
    const issues: DataQualityIssue[] = [];
    const recommendations: string[] = [];
    const entityObj = entity as Record<string, any>;

    // Generate issues based on metrics
    if (metrics.completeness < 0.95) {
      issues.push({
        field: 'general',
        issueType: 'missing',
        severity: 'high',
        description: `${((1 - metrics.completeness) * 100).toFixed(1)}% of fields are missing or empty`,
        suggestedFix: 'Fill in missing required fields and review data collection processes'
      });
      recommendations.push('Implement mandatory field validation at data entry points');
    }

    if (metrics.accuracy < 0.95) {
      issues.push({
        field: 'general',
        issueType: 'invalid',
        severity: 'high',
        description: `${((1 - metrics.accuracy) * 100).toFixed(1)}% of fields contain inaccurate data`,
        suggestedFix: 'Review and correct field formats and validation rules'
      });
      recommendations.push('Enhance field-level validation and implement data quality checks');
    }

    if (metrics.consistency < 0.90) {
      issues.push({
        field: 'general',
        issueType: 'inconsistent',
        severity: 'medium',
        description: 'Cross-field data inconsistencies detected',
        suggestedFix: 'Review business rules and implement consistency checks'
      });
      recommendations.push('Implement cross-field validation rules');
    }

    // Add entity-specific recommendations
    if (metrics.overallScore >= 0.95) {
      recommendations.push('Data quality is excellent - maintain current standards');
    } else if (metrics.overallScore >= 0.85) {
      recommendations.push('Good data quality - focus on addressing specific issues identified');
    } else {
      recommendations.push('Data quality needs significant improvement - implement comprehensive data quality program');
    }

    return {
      entityType,
      entityId: entityObj.id || 'unknown',
      metrics,
      issues,
      recommendations,
      assessedAt: new Date()
    };
  }

  private assessQualityStandards(metrics: DataQualityMetrics): boolean {
    return (
      metrics.completeness >= this.qualityThresholds.completeness &&
      metrics.accuracy >= this.qualityThresholds.accuracy &&
      metrics.consistency >= this.qualityThresholds.consistency &&
      metrics.validity >= this.qualityThresholds.validity &&
      metrics.uniqueness >= this.qualityThresholds.uniqueness &&
      metrics.timeliness >= this.qualityThresholds.timeliness
    );
  }

  // Batch validation with quality metrics aggregation
  async validateBatch<T>(
    entities: T[],
    context?: ValidationContext
  ): Promise<BatchValidationResult<T> & { aggregatedQualityMetrics: DataQualityMetrics }> {
    const startTime = Date.now();
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const validationPromises = entities.map(entity => this.validate(entity, context));
    const results = await Promise.allSettled(validationPromises);
    
    const validEntities: T[] = [];
    const invalidEntities: Array<{ entity: T; errors: ValidationError[] }> = [];
    const allQualityMetrics: DataQualityMetrics[] = [];
    
    results.forEach((result, index) => {
      const entity = entities[index];
      
      if (result.status === 'fulfilled') {
        const validationResult = result.value;
        
        if (validationResult.isValid) {
          validEntities.push(entity);
        } else {
          invalidEntities.push({
            entity,
            errors: validationResult.errors
          });
        }
        
        // Collect quality metrics
        if (validationResult.metadata.qualityMetrics) {
          allQualityMetrics.push(validationResult.metadata.qualityMetrics);
        }
      } else {
        invalidEntities.push({
          entity,
          errors: [{
            field: 'system',
            code: 'VALIDATION_ERROR',
            message: 'Validation failed with error',
            severity: 'critical'
          }]
        });
      }
    });
    
    // Calculate aggregated quality metrics
    const aggregatedQualityMetrics = this.aggregateQualityMetrics(allQualityMetrics);
    
    const endTime = Date.now();
    
    return {
      totalProcessed: entities.length,
      validEntities,
      invalidEntities,
      processingTime: endTime - startTime,
      batchMetadata: {
        batchId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        batchSize: entities.length,
        successRate: validEntities.length / entities.length,
        averageValidationTime: (endTime - startTime) / entities.length
      },
      aggregatedQualityMetrics
    };
  }

  private aggregateQualityMetrics(metrics: DataQualityMetrics[]): DataQualityMetrics {
    if (metrics.length === 0) {
      return {
        completeness: 0,
        accuracy: 0,
        consistency: 0,
        validity: 0,
        uniqueness: 0,
        timeliness: 0,
        overallScore: 0
      };
    }

    const averages = metrics.reduce(
      (acc, metric) => ({
        completeness: acc.completeness + metric.completeness,
        accuracy: acc.accuracy + metric.accuracy,
        consistency: acc.consistency + metric.consistency,
        validity: acc.validity + metric.validity,
        uniqueness: acc.uniqueness + metric.uniqueness,
        timeliness: acc.timeliness + metric.timeliness,
        overallScore: acc.overallScore + metric.overallScore
      }),
      {
        completeness: 0,
        accuracy: 0,
        consistency: 0,
        validity: 0,
        uniqueness: 0,
        timeliness: 0,
        overallScore: 0
      }
    );

    const count = metrics.length;
    return {
      completeness: averages.completeness / count,
      accuracy: averages.accuracy / count,
      consistency: averages.consistency / count,
      validity: averages.validity / count,
      uniqueness: averages.uniqueness / count,
      timeliness: averages.timeliness / count,
      overallScore: averages.overallScore / count
    };
  }
}

// Usage example
const dataQualityValidator = new DataQualityValidator<User>({
  completeness: 0.98,
  accuracy: 0.99,
  consistency: 0.95
});

const userData: User = {
  id: 'user-001',
  email: 'john.doe@example.com',
  username: 'johndoe',
  firstName: 'John',
  lastName: 'Doe',
  age: 30,
  dateOfBirth: new Date('1993-05-15'),
  phoneNumber: '+1-555-0123',
  address: {
    street: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    postalCode: '12345',
    country: 'USA',
    isDefault: true
  },
  preferences: {
    language: 'en',
    timezone: 'UTC',
    currency: 'USD',
    emailNotifications: true,
    smsNotifications: false,
    marketingConsent: true
  },
  accountStatus: 'active',
  registrationDate: new Date('2023-01-15'),
  lastLoginDate: new Date('2023-12-01')
};

// Validate single entity with quality metrics
const result = await dataQualityValidator.validate(userData);
console.log('Validation result:', result.isValid);
console.log('Quality metrics:', result.metadata.qualityMetrics);
console.log('Quality report:', result.metadata.qualityReport);

// Batch validation example
const users: User[] = [userData /* ... more users */];
const batchResult = await dataQualityValidator.validateBatch(users);
console.log('Batch validation results:');
console.log('Success rate:', batchResult.batchMetadata.successRate);
console.log('Aggregated quality metrics:', batchResult.aggregatedQualityMetrics);
```

## Key Features

- **Multi-Dimensional Quality Assessment**: Evaluate data across completeness, accuracy, consistency, validity, uniqueness, and timeliness
- **Configurable Quality Thresholds**: Set custom quality standards for different use cases
- **Comprehensive Quality Reports**: Generate detailed reports with specific issues and recommendations
- **Batch Processing**: Efficiently validate large datasets with aggregated quality metrics
- **Weighted Quality Scoring**: Calculate overall quality scores with business-relevant weights
- **Actionable Recommendations**: Provide specific suggestions for improving data quality

## Common Pitfalls

- **Over-Engineering Metrics**: Don't calculate unnecessary quality dimensions that don't provide business value
- **Performance Impact**: Be mindful of calculation complexity when validating large datasets
- **Threshold Sensitivity**: Set realistic quality thresholds based on actual business requirements
- **False Positives**: Tune validation rules to minimize false quality issues

## Related Examples

- [Composite Validation with Policy Integration](./example-1.md)
- [Batch Validation with Performance Optimization](./example-3.md)
- [Enterprise Data Quality Orchestration](../advanced/example-1.md)