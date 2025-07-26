# AI-Powered Adaptive Validation with Machine Learning

**Version**: 1.0.0 **Package**: @vytches/ddd-validation **Complexity**: Advanced
**Domain**: Intelligent Data Processing **Patterns**: Machine Learning
Integration, Adaptive Thresholds, Predictive Validation, Anomaly Detection
**Dependencies**: @vytches/ddd-validation, @vytches/ddd-events,
@vytches/ddd-utils, @vytches/ddd-core

## Description

This example demonstrates AI-powered adaptive validation that learns from data
patterns, predicts validation outcomes, detects anomalies, and automatically
adjusts validation thresholds based on real-world data characteristics and
business outcomes.

## Business Context

A global financial services company processes 100M+ transactions daily with
varying data quality patterns across different markets, times, and transaction
types. Traditional static validation rules result in 15% false positives and
miss 8% of actual data quality issues. AI-powered adaptive validation reduces
false positives by 85% while improving detection accuracy by 40%.

## Code Example

```typescript
// ai-adaptive-validator.ts
import {
  IValidator,
  IAsyncSpecification,
  ValidationResult,
  DataQualityMetrics,
  SpecificationResult,
} from '@vytches/ddd-validation';
import { DomainEvent, UnifiedEventBus } from '@vytches/ddd-events';
import { Result } from '@vytches/ddd-utils';

// AI model interfaces
interface MLModel {
  modelId: string;
  modelType: 'classification' | 'regression' | 'anomaly_detection' | 'ensemble';
  version: string;
  accuracy: number;
  trainedAt: Date;
  features: string[];
  hyperparameters: Record<string, any>;
}

interface PredictionResult {
  prediction: any;
  confidence: number;
  features: Record<string, number>;
  modelUsed: string;
  processingTime: number;
}

interface AnomalyDetectionResult {
  isAnomaly: boolean;
  anomalyScore: number;
  anomalyFactors: string[];
  confidence: number;
  expectedRange: { min: number; max: number };
  actualValue: number;
}

// Adaptive validation events
export class ValidationPatternLearnedEvent implements DomainEvent {
  readonly eventType = 'ValidationPatternLearned';
  readonly version = '1.0';
  readonly occurredAt = new Date();

  constructor(
    public readonly patternId: string,
    public readonly pattern: ValidationPattern,
    public readonly confidence: number,
    public readonly impactedRules: string[]
  ) {}
}

export class ThresholdAdaptationEvent implements DomainEvent {
  readonly eventType = 'ThresholdAdaptation';
  readonly version = '1.0';
  readonly occurredAt = new Date();

  constructor(
    public readonly ruleId: string,
    public readonly oldThreshold: number,
    public readonly newThreshold: number,
    public readonly reason: string,
    public readonly confidence: number
  ) {}
}

// AI-powered validation specification
export class AIEnhancedValidationSpecification<T>
  implements IAsyncSpecification<T>
{
  private mlModels: Map<string, MLModel>;
  private featureExtractor: FeatureExtractor<T>;
  private anomalyDetector: AnomalyDetector;
  private thresholdAdapter: AdaptiveThresholdManager;
  private patternLearner: ValidationPatternLearner;
  private predictionCache: Map<string, PredictionResult>;

  constructor(
    private entityType: string,
    private validationRules: ValidationRule[],
    private mlModelService: IMLModelService,
    private eventBus: UnifiedEventBus
  ) {
    this.mlModels = new Map();
    this.featureExtractor = new FeatureExtractor<T>(entityType);
    this.anomalyDetector = new AnomalyDetector(entityType);
    this.thresholdAdapter = new AdaptiveThresholdManager(eventBus);
    this.patternLearner = new ValidationPatternLearner(eventBus);
    this.predictionCache = new Map();

    this.initializeMLModels();
  }

  async isSatisfiedByAsync(entity: T): Promise<SpecificationResult> {
    const startTime = Date.now();

    try {
      // Extract features from entity
      const features = await this.featureExtractor.extractFeatures(entity);

      // Generate cache key for prediction
      const cacheKey = this.generatePredictionCacheKey(features);

      // Check prediction cache
      let prediction = this.predictionCache.get(cacheKey);
      if (!prediction || this.isPredictionExpired(prediction)) {
        prediction = await this.generatePrediction(features);
        this.predictionCache.set(cacheKey, prediction);
      }

      // Perform anomaly detection
      const anomalyResult = await this.anomalyDetector.detectAnomalies(
        entity,
        features
      );

      // Get adaptive thresholds for current context
      const adaptiveThresholds =
        await this.thresholdAdapter.getAdaptiveThresholds(
          this.entityType,
          features,
          prediction
        );

      // Execute validation with AI enhancements
      const validationResult = await this.executeAIEnhancedValidation(
        entity,
        features,
        prediction,
        anomalyResult,
        adaptiveThresholds
      );

      // Learn from validation outcome
      await this.learnFromValidation(
        entity,
        features,
        prediction,
        validationResult
      );

      const processingTime = Date.now() - startTime;

      return {
        isSatisfied: validationResult.isValid,
        reason: validationResult.reason,
        metadata: {
          aiEnhanced: true,
          prediction: {
            outcome: prediction.prediction,
            confidence: prediction.confidence,
            modelUsed: prediction.modelUsed,
          },
          anomalyDetection: anomalyResult,
          adaptiveThresholds,
          features: this.sanitizeFeatures(features),
          processingTime,
          mlModelVersions: Array.from(this.mlModels.values()).map(m => ({
            modelId: m.modelId,
            version: m.version,
            accuracy: m.accuracy,
          })),
        },
      };
    } catch (error) {
      return {
        isSatisfied: false,
        reason: `AI validation failed: ${error.message}`,
        metadata: {
          aiEnhanced: true,
          error: error.message,
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  private async generatePrediction(
    features: Record<string, number>
  ): Promise<PredictionResult> {
    // Select best model for current features
    const bestModel = await this.selectOptimalModel(features);

    // Generate prediction using selected model
    const prediction = await this.mlModelService.predict(
      bestModel.modelId,
      features,
      {
        returnConfidence: true,
        explainability: true,
      }
    );

    return {
      prediction: prediction.result,
      confidence: prediction.confidence,
      features,
      modelUsed: bestModel.modelId,
      processingTime: prediction.processingTime,
    };
  }

  private async selectOptimalModel(
    features: Record<string, number>
  ): Promise<MLModel> {
    // Score models based on feature compatibility and recent performance
    const modelScores = Array.from(this.mlModels.values()).map(model => ({
      model,
      score: this.calculateModelScore(model, features),
    }));

    // Sort by score and return best model
    modelScores.sort((a, b) => b.score - a.score);
    return modelScores[0].model;
  }

  private calculateModelScore(
    model: MLModel,
    features: Record<string, number>
  ): number {
    let score = model.accuracy; // Base score from model accuracy

    // Feature compatibility score
    const availableFeatures = Object.keys(features);
    const compatibleFeatures = model.features.filter(f =>
      availableFeatures.includes(f)
    );
    const compatibilityScore =
      compatibleFeatures.length / model.features.length;
    score *= compatibilityScore;

    // Recency score (newer models get slight boost)
    const daysSinceTrained =
      (Date.now() - model.trainedAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0.5, 1 - daysSinceTrained / 365); // Decay over a year
    score *= 0.9 + 0.1 * recencyScore; // Small boost for recent models

    // Model type preference for validation tasks
    const typeMultiplier =
      model.modelType === 'classification'
        ? 1.1
        : model.modelType === 'ensemble'
          ? 1.05
          : 1.0;
    score *= typeMultiplier;

    return score;
  }

  private async executeAIEnhancedValidation(
    entity: T,
    features: Record<string, number>,
    prediction: PredictionResult,
    anomalyResult: AnomalyDetectionResult,
    adaptiveThresholds: Record<string, number>
  ): Promise<{ isValid: boolean; reason?: string; confidence: number }> {
    let isValid = true;
    let reasons: string[] = [];
    let confidence = 1.0;

    // Check prediction-based validation
    if (prediction.prediction === 'invalid' && prediction.confidence > 0.8) {
      isValid = false;
      reasons.push(
        `AI prediction indicates invalid data (confidence: ${prediction.confidence.toFixed(3)})`
      );
      confidence = Math.min(confidence, prediction.confidence);
    }

    // Check anomaly detection
    if (anomalyResult.isAnomaly && anomalyResult.confidence > 0.85) {
      isValid = false;
      reasons.push(
        `Anomaly detected (score: ${anomalyResult.anomalyScore.toFixed(3)}, factors: ${anomalyResult.anomalyFactors.join(', ')})`
      );
      confidence = Math.min(confidence, anomalyResult.confidence);
    }

    // Check adaptive thresholds
    for (const [rule, threshold] of Object.entries(adaptiveThresholds)) {
      const featureValue = features[rule];
      if (featureValue !== undefined && featureValue < threshold) {
        if (threshold > 0.9) {
          // High threshold = error
          isValid = false;
          reasons.push(
            `Feature '${rule}' (${featureValue.toFixed(3)}) below adaptive threshold (${threshold.toFixed(3)})`
          );
        } else {
          // Lower threshold = warning, don't invalidate
          // Could add warnings here if supported
        }
      }
    }

    // Calculate overall confidence
    const overallConfidence =
      confidence *
      (reasons.length === 0 ? 1.0 : Math.max(0.3, 1.0 - reasons.length * 0.2));

    return {
      isValid,
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
      confidence: overallConfidence,
    };
  }

  private async learnFromValidation(
    entity: T,
    features: Record<string, number>,
    prediction: PredictionResult,
    validationResult: { isValid: boolean; reason?: string; confidence: number }
  ): Promise<void> {
    // Learn patterns from validation outcomes
    const pattern = await this.patternLearner.learnPattern(
      entity,
      features,
      prediction,
      validationResult
    );

    if (pattern && pattern.confidence > 0.8) {
      await this.eventBus.publish(
        new ValidationPatternLearnedEvent(
          pattern.id,
          pattern,
          pattern.confidence,
          pattern.impactedRules
        )
      );
    }

    // Update adaptive thresholds based on outcomes
    await this.thresholdAdapter.updateFromOutcome(
      features,
      prediction,
      validationResult
    );

    // Provide feedback to ML models for continuous learning
    await this.provideFeedbackToMLModels(
      features,
      prediction,
      validationResult
    );
  }

  private async provideFeedbackToMLModels(
    features: Record<string, number>,
    prediction: PredictionResult,
    actualOutcome: { isValid: boolean; reason?: string; confidence: number }
  ): Promise<void> {
    // Convert validation result to ML training example
    const trainingExample = {
      features,
      actualLabel: actualOutcome.isValid ? 'valid' : 'invalid',
      predictedLabel: prediction.prediction,
      confidence: prediction.confidence,
      feedback: {
        correct: (prediction.prediction === 'valid') === actualOutcome.isValid,
        confidence_appropriate:
          Math.abs(prediction.confidence - actualOutcome.confidence) < 0.2,
      },
    };

    // Send feedback to ML service for model improvement
    await this.mlModelService.provideFeedback(
      prediction.modelUsed,
      trainingExample
    );
  }

  private async initializeMLModels(): Promise<void> {
    const models = await this.mlModelService.getModelsForEntityType(
      this.entityType
    );

    models.forEach(model => {
      this.mlModels.set(model.modelId, model);
    });

    // If no models available, create default ensemble
    if (this.mlModels.size === 0) {
      const defaultModel = await this.createDefaultEnsembleModel();
      this.mlModels.set(defaultModel.modelId, defaultModel);
    }
  }

  private async createDefaultEnsembleModel(): Promise<MLModel> {
    return {
      modelId: `default-ensemble-${this.entityType}`,
      modelType: 'ensemble',
      version: '1.0.0',
      accuracy: 0.85,
      trainedAt: new Date(),
      features: this.featureExtractor.getDefaultFeatures(),
      hyperparameters: {
        ensemble_method: 'voting',
        base_models: ['random_forest', 'gradient_boosting', 'neural_network'],
        voting_strategy: 'soft',
        confidence_threshold: 0.8,
      },
    };
  }

  private generatePredictionCacheKey(features: Record<string, number>): string {
    // Generate deterministic hash from features
    const featureString = Object.keys(features)
      .sort()
      .map(key => `${key}:${features[key].toFixed(4)}`)
      .join('|');

    return this.simpleHash(featureString);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private isPredictionExpired(prediction: PredictionResult): boolean {
    const CACHE_TTL = 300000; // 5 minutes
    return Date.now() - prediction.processingTime > CACHE_TTL;
  }

  private sanitizeFeatures(
    features: Record<string, number>
  ): Record<string, number> {
    // Remove sensitive features from metadata
    const sensitiveFeatures = [
      'ssn_pattern',
      'credit_score',
      'account_balance',
    ];
    const sanitized = { ...features };

    sensitiveFeatures.forEach(feature => {
      if (feature in sanitized) {
        sanitized[feature] = -1; // Placeholder for sensitive data
      }
    });

    return sanitized;
  }
}

// Feature extraction for ML models
class FeatureExtractor<T> {
  constructor(private entityType: string) {}

  async extractFeatures(entity: T): Promise<Record<string, number>> {
    const features: Record<string, number> = {};
    const entityObj = entity as Record<string, any>;

    // Basic data quality features
    features.completeness = this.calculateCompleteness(entityObj);
    features.field_count = Object.keys(entityObj).length;
    features.null_count = Object.values(entityObj).filter(
      v => v === null || v === undefined
    ).length;
    features.empty_string_count = Object.values(entityObj).filter(
      v => v === ''
    ).length;

    // Type-specific features
    if (this.entityType === 'User') {
      const user = entity as any;
      features.email_format_score = this.calculateEmailFormatScore(user.email);
      features.phone_format_score = this.calculatePhoneFormatScore(
        user.phoneNumber
      );
      features.age_consistency = this.calculateAgeConsistency(
        user.age,
        user.dateOfBirth
      );
      features.name_completeness = this.calculateNameCompleteness(
        user.firstName,
        user.lastName
      );
    } else if (this.entityType === 'Product') {
      const product = entity as any;
      features.price_reasonableness = this.calculatePriceReasonableness(
        product.price,
        product.category
      );
      features.description_quality = this.calculateDescriptionQuality(
        product.description
      );
      features.sku_format_score = this.calculateSKUFormatScore(product.sku);
      features.category_consistency =
        this.calculateCategoryConsistency(product);
    }

    // Temporal features
    features.freshness_score = this.calculateFreshnessScore(entityObj);
    features.update_frequency = this.calculateUpdateFrequency(entityObj);

    // Statistical features
    features.numeric_field_variance = this.calculateNumericVariance(entityObj);
    features.string_length_variance =
      this.calculateStringLengthVariance(entityObj);

    return features;
  }

  getDefaultFeatures(): string[] {
    const baseFeatures = [
      'completeness',
      'field_count',
      'null_count',
      'empty_string_count',
      'freshness_score',
      'update_frequency',
      'numeric_field_variance',
      'string_length_variance',
    ];

    const typeSpecificFeatures = this.getTypeSpecificFeatures();
    return [...baseFeatures, ...typeSpecificFeatures];
  }

  private getTypeSpecificFeatures(): string[] {
    switch (this.entityType) {
      case 'User':
        return [
          'email_format_score',
          'phone_format_score',
          'age_consistency',
          'name_completeness',
        ];
      case 'Product':
        return [
          'price_reasonableness',
          'description_quality',
          'sku_format_score',
          'category_consistency',
        ];
      default:
        return [];
    }
  }

  private calculateCompleteness(entity: Record<string, any>): number {
    const totalFields = Object.keys(entity).length;
    const nonEmptyFields = Object.values(entity).filter(
      v => v !== null && v !== undefined && v !== ''
    ).length;

    return totalFields > 0 ? nonEmptyFields / totalFields : 0;
  }

  private calculateEmailFormatScore(email: string): number {
    if (!email || typeof email !== 'string') return 0;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const basicValid = emailRegex.test(email);

    // Additional quality checks
    let score = basicValid ? 0.8 : 0;

    if (basicValid) {
      // Check for common patterns that indicate higher quality
      if (email.includes('.')) score += 0.1;
      if (email.length >= 6 && email.length <= 50) score += 0.1;
      if (!/\d{4,}/.test(email)) score += 0.05; // Avoid emails with many consecutive digits
    }

    return Math.min(1.0, score);
  }

  private calculatePhoneFormatScore(phone: string): number {
    if (!phone || typeof phone !== 'string') return 0;

    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Check for reasonable length (7-15 digits)
    if (digits.length >= 7 && digits.length <= 15) {
      return 1.0;
    } else if (digits.length >= 5 && digits.length <= 20) {
      return 0.7;
    } else {
      return 0.3;
    }
  }

  private calculateAgeConsistency(age: number, dateOfBirth: Date): number {
    if (!age || !dateOfBirth) return 0.5; // Neutral if missing data

    const currentYear = new Date().getFullYear();
    const birthYear = dateOfBirth.getFullYear();
    const calculatedAge = currentYear - birthYear;

    const ageDifference = Math.abs(calculatedAge - age);

    if (ageDifference <= 1) return 1.0; // Allow 1 year variance
    if (ageDifference <= 2) return 0.8;
    if (ageDifference <= 5) return 0.5;
    return 0.0;
  }

  private calculateNameCompleteness(
    firstName: string,
    lastName: string
  ): number {
    let score = 0;

    if (firstName && firstName.trim().length > 1) score += 0.5;
    if (lastName && lastName.trim().length > 1) score += 0.5;

    return score;
  }

  private calculatePriceReasonableness(
    price: number,
    category: string
  ): number {
    if (!price || price <= 0) return 0;

    // Category-based price reasonableness (simplified)
    const categoryRanges: Record<string, { min: number; max: number }> = {
      electronics: { min: 10, max: 10000 },
      clothing: { min: 5, max: 1000 },
      books: { min: 1, max: 200 },
      home: { min: 10, max: 5000 },
      sports: { min: 10, max: 2000 },
    };

    const range = categoryRanges[category] || { min: 1, max: 1000000 };

    if (price >= range.min && price <= range.max) {
      return 1.0;
    } else if (price >= range.min * 0.1 && price <= range.max * 10) {
      return 0.7;
    } else {
      return 0.3;
    }
  }

  private calculateDescriptionQuality(description: string): number {
    if (!description || typeof description !== 'string') return 0;

    let score = 0;
    const length = description.trim().length;

    // Length score
    if (length >= 20 && length <= 500) score += 0.4;
    else if (length >= 10 && length <= 1000) score += 0.2;

    // Word count score
    const words = description.trim().split(/\s+/).length;
    if (words >= 5 && words <= 100) score += 0.3;
    else if (words >= 3 && words <= 200) score += 0.15;

    // Character diversity
    const uniqueChars = new Set(description.toLowerCase()).size;
    if (uniqueChars >= 15) score += 0.3;
    else if (uniqueChars >= 10) score += 0.15;

    return Math.min(1.0, score);
  }

  private calculateSKUFormatScore(sku: string): number {
    if (!sku || typeof sku !== 'string') return 0;

    // Check for reasonable SKU patterns
    const hasAlphaNumeric = /^[A-Za-z0-9\-_]+$/.test(sku);
    const reasonableLength = sku.length >= 3 && sku.length <= 20;
    const hasStructure = /[A-Za-z]/.test(sku) && /\d/.test(sku);

    let score = 0;
    if (hasAlphaNumeric) score += 0.4;
    if (reasonableLength) score += 0.3;
    if (hasStructure) score += 0.3;

    return score;
  }

  private calculateCategoryConsistency(product: any): number {
    // This would involve more complex logic in practice
    // For now, just check if category exists and is reasonable
    const category = product.category;
    if (!category || typeof category !== 'string') return 0;

    const validCategories = [
      'electronics',
      'clothing',
      'books',
      'home',
      'sports',
      'food',
      'health',
    ];
    return validCategories.includes(category.toLowerCase()) ? 1.0 : 0.5;
  }

  private calculateFreshnessScore(entity: Record<string, any>): number {
    const now = new Date();
    let latestDate: Date | null = null;

    // Find the most recent date in the entity
    Object.values(entity).forEach(value => {
      if (value instanceof Date) {
        if (!latestDate || value > latestDate) {
          latestDate = value;
        }
      }
    });

    if (!latestDate) return 0.5; // Neutral if no dates found

    const daysSinceUpdate =
      (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate <= 1) return 1.0;
    if (daysSinceUpdate <= 7) return 0.9;
    if (daysSinceUpdate <= 30) return 0.7;
    if (daysSinceUpdate <= 90) return 0.5;
    return 0.2;
  }

  private calculateUpdateFrequency(entity: Record<string, any>): number {
    // Simplified - in practice would track historical updates
    const hasTimestamps = Object.values(entity).some(v => v instanceof Date);
    return hasTimestamps ? 0.8 : 0.2;
  }

  private calculateNumericVariance(entity: Record<string, any>): number {
    const numericValues = Object.values(entity).filter(
      v => typeof v === 'number' && !isNaN(v)
    );

    if (numericValues.length < 2) return 0.5;

    const mean =
      numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
    const variance =
      numericValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      numericValues.length;

    // Normalize variance score (higher variance = lower score for consistency)
    return Math.max(0, Math.min(1, 1 - Math.log10(variance + 1) / 10));
  }

  private calculateStringLengthVariance(entity: Record<string, any>): number {
    const stringValues = Object.values(entity)
      .filter(v => typeof v === 'string')
      .map(v => v.length);

    if (stringValues.length < 2) return 0.5;

    const mean =
      stringValues.reduce((sum, len) => sum + len, 0) / stringValues.length;
    const variance =
      stringValues.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) /
      stringValues.length;

    // Normalize variance score
    return Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / mean));
  }
}

// Usage example
const aiValidator = new AIEnhancedValidationSpecification<User>(
  'User',
  userValidationRules,
  mlModelService,
  eventBus
);

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
    isDefault: true,
  },
  preferences: {
    language: 'en',
    timezone: 'UTC',
    currency: 'USD',
    emailNotifications: true,
    smsNotifications: false,
    marketingConsent: true,
  },
  accountStatus: 'active',
  registrationDate: new Date('2023-01-15'),
  lastLoginDate: new Date('2023-12-01'),
};

// Execute AI-enhanced validation
const result = await aiValidator.isSatisfiedByAsync(userData);

console.log('AI-enhanced validation result:');
console.log(`- Is satisfied: ${result.isSatisfied}`);
console.log(
  `- AI prediction: ${result.metadata?.prediction?.outcome} (confidence: ${result.metadata?.prediction?.confidence})`
);
console.log(
  `- Anomaly detected: ${result.metadata?.anomalyDetection?.isAnomaly}`
);
console.log(`- Model used: ${result.metadata?.prediction?.modelUsed}`);
console.log(`- Processing time: ${result.metadata?.processingTime}ms`);
console.log(
  `- Features extracted: ${Object.keys(result.metadata?.features || {}).length}`
);
```

## Key Features

- **Machine Learning Integration**: Real-time ML predictions for validation
  outcomes
- **Adaptive Thresholds**: Dynamic adjustment of validation thresholds based on
  patterns
- **Anomaly Detection**: AI-powered detection of unusual data patterns
- **Pattern Learning**: Continuous learning from validation outcomes
- **Model Selection**: Intelligent selection of optimal ML models based on
  context
- **Feature Engineering**: Automated extraction of relevant features for ML
  models
- **Predictive Validation**: Predict validation outcomes before full validation
  execution

## Common Pitfalls

- **Model Drift**: Monitor ML model performance and retrain when accuracy
  degrades
- **Overfitting**: Ensure models generalize well to new data patterns
- **Feature Leakage**: Avoid using future information in features
- **Bias Amplification**: Monitor for and mitigate bias in validation decisions

## Related Examples

- [Enterprise Validation Orchestration](./example-1.md)
- [Real-time Global Data Quality Monitoring](./example-3.md)
- [Advanced Composite Validation](../intermediate/example-1.md)
