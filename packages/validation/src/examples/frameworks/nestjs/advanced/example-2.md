# NestJS AI-Powered Adaptive Validation - VytchesDDD DI

**Package**: @vytches/ddd-validation  
**Framework**: NestJS  
**Complexity**: Advanced  
**Focus**: AI-powered adaptive validation with machine learning enhancement and
predictive analytics

## Overview

This example demonstrates advanced AI-powered adaptive validation in NestJS
using VytchesDDD DI for machine learning integration, predictive validation
analytics, and intelligent validation adaptation based on historical patterns
and real-time data analysis.

## Implementation

```typescript
// ai-adaptive-validation.service.ts
import { Injectable } from '@nestjs/common';
import { DomainService, ServiceLifetime, VytchesDDD } from '@vytches/ddd-di';
import {
  AIEnhancedValidationSpecification,
  AdaptiveValidationEngine,
  PredictiveValidationAnalyzer,
  ValidationMetrics,
  SpecificationResult,
} from '@vytches/ddd-validation';
import { MLModelService, PredictionRequest, AdaptationRequest } from './types'; // From your application

// AI-powered validation service with VytchesDDD DI
@DomainService({
  serviceId: 'aiAdaptiveValidationService',
  lifetime: ServiceLifetime.Singleton,
  context: 'AIValidation',
  dependencies: [
    'mlModelService',
    'validationHistoryService',
    'adaptationEngine',
    'predictionAnalyzer',
    'eventBus',
  ],
  timeout: 45000,
  middleware: ['logging', 'resilience', 'aiMetrics'],
  autoRegister: true,
})
export class AIAdaptiveValidationService {
  private aiValidator: AIEnhancedValidationSpecification<any>;
  private adaptiveEngine: AdaptiveValidationEngine;
  private predictionAnalyzer: PredictiveValidationAnalyzer;
  private mlModelService: MLModelService;
  private validationMetrics: ValidationMetrics;

  constructor() {
    // ⭐ FOCUS: AI-powered DI with adaptive capabilities
    this.initializeAIValidation();
  }

  async validateWithAI<T>(
    entity: T,
    entityType: string,
    adaptationLevel: 'basic' | 'advanced' | 'predictive' = 'predictive'
  ): Promise<AIValidationResult> {
    // Get AI-enhanced validation
    const aiResult = await this.aiValidator.isSatisfiedByAsync(entity);

    // Apply adaptive thresholds based on historical patterns
    const adaptiveResult = await this.adaptiveEngine.applyAdaptiveValidation(
      entity,
      entityType,
      aiResult,
      adaptationLevel
    );

    // Generate predictions for future validation needs
    const predictions =
      await this.predictionAnalyzer.generateValidationPredictions(
        entity,
        entityType,
        aiResult
      );

    return {
      originalResult: aiResult,
      adaptiveResult,
      predictions,
      confidence: this.calculateOverallConfidence(
        aiResult,
        adaptiveResult,
        predictions
      ),
      adaptations: await this.getAppliedAdaptations(entityType),
      recommendations: await this.generateAIRecommendations(
        aiResult,
        adaptiveResult,
        predictions
      ),
    };
  }

  async trainAdaptiveModel(
    trainingData: ValidationTrainingData[],
    modelType:
      | 'threshold_adaptation'
      | 'pattern_recognition'
      | 'prediction' = 'pattern_recognition'
  ): Promise<ModelTrainingResult> {
    return await this.mlModelService.trainModel({
      data: trainingData,
      modelType,
      validationDomain: 'adaptive_validation',
      trainingParameters: {
        epochs: 100,
        learningRate: 0.001,
        validationSplit: 0.2,
        patience: 10,
      },
    });
  }

  async predictValidationOutcome<T>(
    entity: T,
    entityType: string,
    predictionHorizon: 'immediate' | 'short_term' | 'long_term' = 'short_term'
  ): Promise<ValidationPrediction> {
    return await this.predictionAnalyzer.predictValidationOutcome(
      entity,
      entityType,
      predictionHorizon
    );
  }

  async adaptValidationThresholds(
    entityType: string,
    adaptationRequest: AdaptationRequest
  ): Promise<ThresholdAdaptationResult> {
    return await this.adaptiveEngine.adaptThresholds(
      entityType,
      adaptationRequest
    );
  }

  async getValidationInsights(
    timeRange?: TimeRange,
    entityTypes?: string[]
  ): Promise<AIValidationInsights> {
    const insights = await this.validationMetrics.getAIInsights(
      timeRange,
      entityTypes
    );
    const patterns = await this.predictionAnalyzer.identifyValidationPatterns(
      timeRange,
      entityTypes
    );
    const adaptations = await this.adaptiveEngine.getAdaptationHistory(
      timeRange,
      entityTypes
    );

    return {
      insights,
      patterns,
      adaptations,
      recommendations: await this.generateInsightRecommendations(
        insights,
        patterns,
        adaptations
      ),
    };
  }

  private initializeAIValidation(): void {
    // AI components resolved through VytchesDDD DI
    this.mlModelService = VytchesDDD.resolve<MLModelService>('mlModelService');
    const historyService = VytchesDDD.resolve('validationHistoryService');
    const eventBus = VytchesDDD.resolve('eventBus');

    this.aiValidator = new AIEnhancedValidationSpecification<any>(
      'AdaptiveEntity',
      VytchesDDD.resolve('aiValidationRules'),
      this.mlModelService,
      eventBus,
      VytchesDDD.resolve('aiConfigurationService')
    );

    this.adaptiveEngine =
      VytchesDDD.resolve<AdaptiveValidationEngine>('adaptationEngine');
    this.predictionAnalyzer =
      VytchesDDD.resolve<PredictiveValidationAnalyzer>('predictionAnalyzer');
    this.validationMetrics =
      VytchesDDD.resolve<ValidationMetrics>('validationMetrics');
  }

  private calculateOverallConfidence(
    aiResult: SpecificationResult,
    adaptiveResult: AdaptiveValidationResult,
    predictions: ValidationPrediction
  ): number {
    const aiConfidence = aiResult.metadata?.prediction?.confidence || 0.5;
    const adaptiveConfidence = adaptiveResult.adaptationConfidence || 0.5;
    const predictionConfidence = predictions.confidence || 0.5;

    return (
      aiConfidence * 0.4 + adaptiveConfidence * 0.3 + predictionConfidence * 0.3
    );
  }

  private async getAppliedAdaptations(
    entityType: string
  ): Promise<AppliedAdaptation[]> {
    return await this.adaptiveEngine.getActiveAdaptations(entityType);
  }

  private async generateAIRecommendations(
    aiResult: SpecificationResult,
    adaptiveResult: AdaptiveValidationResult,
    predictions: ValidationPrediction
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (aiResult.metadata?.prediction?.confidence < 0.8) {
      recommendations.push('Consider additional training data for AI model');
    }

    if (adaptiveResult.thresholdAdjustment > 0.1) {
      recommendations.push(
        'Review adaptive threshold changes for potential bias'
      );
    }

    if (predictions.riskLevel === 'high') {
      recommendations.push(
        'Implement additional monitoring for predicted high-risk scenarios'
      );
    }

    return recommendations;
  }

  private async generateInsightRecommendations(
    insights: ValidationInsights,
    patterns: ValidationPattern[],
    adaptations: AdaptationHistory[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (insights.averageAccuracy < 0.9) {
      recommendations.push('Retrain AI models with recent validation data');
    }

    const frequentPatterns = patterns.filter(p => p.frequency > 0.1);
    if (frequentPatterns.length > 0) {
      recommendations.push('Optimize for most frequent validation patterns');
    }

    const recentAdaptations = adaptations.filter(
      a => a.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    if (recentAdaptations.length > 10) {
      recommendations.push(
        'Review adaptation frequency - may indicate unstable thresholds'
      );
    }

    return recommendations;
  }
}

// NestJS bridge service for AI adaptive validation
@Injectable()
export class AIAdaptiveValidationBridgeService {
  private aiValidationService: AIAdaptiveValidationService;

  constructor() {
    // ⭐ FOCUS: Bridge pattern with AI-powered VytchesDDD DI
    this.aiValidationService = VytchesDDD.resolve<AIAdaptiveValidationService>(
      'aiAdaptiveValidationService'
    );
  }

  async processAIValidation<T>(
    entity: T,
    entityType: string,
    options: AIValidationOptions = {}
  ): Promise<ProcessedAIValidationResult> {
    try {
      // AI-powered adaptive validation
      const aiValidation = await this.aiValidationService.validateWithAI(
        entity,
        entityType,
        options.adaptationLevel || 'predictive'
      );

      // Predictive analysis
      const prediction =
        await this.aiValidationService.predictValidationOutcome(
          entity,
          entityType,
          options.predictionHorizon || 'short_term'
        );

      // Enhanced result processing
      const processedResult = this.processAIValidationResults(
        aiValidation,
        prediction
      );

      return {
        ...processedResult,
        entity,
        entityType,
        processingMetadata: {
          timestamp: new Date(),
          aiModel:
            aiValidation.originalResult.metadata?.modelVersion || 'unknown',
          adaptationLevel: options.adaptationLevel || 'predictive',
          predictionHorizon: options.predictionHorizon || 'short_term',
          processingTime: Date.now(),
        },
      };
    } catch (error) {
      throw new Error(`AI adaptive validation failed: ${error.message}`);
    }
  }

  async trainValidationModel(
    trainingRequest: ModelTrainingRequest
  ): Promise<ModelTrainingResponse> {
    const trainingResult = await this.aiValidationService.trainAdaptiveModel(
      trainingRequest.data,
      trainingRequest.modelType
    );

    return {
      success: trainingResult.success,
      modelId: trainingResult.modelId,
      accuracy: trainingResult.metrics.accuracy,
      trainingTime: trainingResult.trainingDuration,
      validationAccuracy: trainingResult.metrics.validationAccuracy,
      modelMetrics: {
        precision: trainingResult.metrics.precision,
        recall: trainingResult.metrics.recall,
        f1Score: trainingResult.metrics.f1Score,
        confusionMatrix: trainingResult.metrics.confusionMatrix,
      },
      recommendations: this.generateTrainingRecommendations(trainingResult),
    };
  }

  async getValidationInsights(
    insightRequest: ValidationInsightRequest
  ): Promise<ValidationInsightResponse> {
    const insights = await this.aiValidationService.getValidationInsights(
      insightRequest.timeRange,
      insightRequest.entityTypes
    );

    return {
      summary: {
        totalValidations: insights.insights.totalValidations,
        averageAccuracy: insights.insights.averageAccuracy,
        adaptationCount: insights.adaptations.length,
        patternCount: insights.patterns.length,
      },
      accuracyTrends: insights.insights.accuracyTrends,
      mostCommonPatterns: insights.patterns
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5),
      recentAdaptations: insights.adaptations
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10),
      recommendations: insights.recommendations,
      predictiveInsights: {
        upcomingPatterns: insights.patterns.filter(
          p => p.trend === 'increasing'
        ),
        riskFactors: insights.insights.riskFactors || [],
        optimizationOpportunities:
          insights.insights.optimizationOpportunities || [],
      },
    };
  }

  private processAIValidationResults(
    aiValidation: AIValidationResult,
    prediction: ValidationPrediction
  ): ProcessedAIValidationCore {
    return {
      isValid: aiValidation.adaptiveResult.isValid,
      confidence: aiValidation.confidence,
      originalAIResult: {
        satisfied: aiValidation.originalResult.isSatisfied,
        reason: aiValidation.originalResult.reason,
        aiConfidence:
          aiValidation.originalResult.metadata?.prediction?.confidence || 0,
      },
      adaptiveEnhancements: {
        thresholdAdjustments:
          aiValidation.adaptiveResult.thresholdAdjustments || [],
        appliedAdaptations: aiValidation.adaptations,
        adaptationReason: aiValidation.adaptiveResult.adaptationReason,
      },
      predictiveAnalysis: {
        futureValidationLikelihood: prediction.likelihood,
        riskLevel: prediction.riskLevel,
        predictedIssues: prediction.predictedIssues || [],
        timeToNextValidation: prediction.timeToNextValidation,
      },
      recommendations: aiValidation.recommendations,
      qualityMetrics: {
        dataQuality: aiValidation.originalResult.metadata?.dataQuality || 0,
        modelReliability:
          aiValidation.originalResult.metadata?.modelReliability || 0,
        predictionAccuracy: prediction.accuracyScore || 0,
      },
    };
  }

  private generateTrainingRecommendations(
    result: ModelTrainingResult
  ): string[] {
    const recommendations: string[] = [];

    if (result.metrics.accuracy < 0.9) {
      recommendations.push('Consider collecting more training data');
      recommendations.push('Review feature engineering approaches');
    }

    if (result.metrics.validationAccuracy < result.metrics.accuracy - 0.05) {
      recommendations.push(
        'Model may be overfitting - consider regularization'
      );
    }

    if (result.metrics.precision < 0.85) {
      recommendations.push('Focus on reducing false positives');
    }

    if (result.metrics.recall < 0.85) {
      recommendations.push('Focus on reducing false negatives');
    }

    return recommendations;
  }
}

// ai-validation.controller.ts
import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpStatus,
  HttpCode,
  Query,
  Get,
} from '@nestjs/common';
import { AIAdaptiveValidationBridgeService } from './ai-adaptive-validation-bridge.service';

@Controller('ai/validation')
export class AIValidationController {
  constructor(
    private readonly aiValidationService: AIAdaptiveValidationBridgeService
  ) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateWithAI(@Body() request: AIValidationRequest) {
    try {
      // ✅ FOCUS: AI-powered adaptive validation
      const result = await this.aiValidationService.processAIValidation(
        request.entity,
        request.entityType,
        request.options
      );

      return {
        success: result.isValid,
        message: 'AI adaptive validation completed',
        validationSummary: {
          entityType: result.entityType,
          isValid: result.isValid,
          confidence: result.confidence,
          aiModelUsed: result.processingMetadata.aiModel,
          adaptationLevel: result.processingMetadata.adaptationLevel,
        },
        aiAnalysis: {
          originalPrediction: result.originalAIResult,
          adaptiveEnhancements: result.adaptiveEnhancements,
          predictiveInsights: result.predictiveAnalysis,
        },
        qualityMetrics: result.qualityMetrics,
        recommendations: result.recommendations,
        processingTime: Date.now() - result.processingMetadata.processingTime,
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'AI validation failed',
        error: error.message,
      });
    }
  }

  @Post('train-model')
  @HttpCode(HttpStatus.CREATED)
  async trainModel(@Body() request: ModelTrainingRequest) {
    try {
      const result =
        await this.aiValidationService.trainValidationModel(request);

      if (!result.success) {
        throw new BadRequestException({
          message: 'Model training failed',
          details: result.modelMetrics,
        });
      }

      return {
        success: true,
        message: 'AI model training completed',
        modelSummary: {
          modelId: result.modelId,
          accuracy: result.accuracy,
          trainingTime: result.trainingTime,
          validationAccuracy: result.validationAccuracy,
        },
        performanceMetrics: result.modelMetrics,
        recommendations: result.recommendations,
        nextSteps: [
          'Deploy model to validation pipeline',
          'Monitor model performance',
          'Schedule retraining based on data drift',
        ],
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Model training failed',
        error: error.message,
      });
    }
  }

  @Get('insights')
  @HttpCode(HttpStatus.OK)
  async getValidationInsights(@Query() query: InsightQueryParams) {
    try {
      const result = await this.aiValidationService.getValidationInsights({
        timeRange: query.timeRange ? JSON.parse(query.timeRange) : undefined,
        entityTypes: query.entityTypes
          ? query.entityTypes.split(',')
          : undefined,
      });

      return {
        success: true,
        message: 'Validation insights retrieved',
        summary: result.summary,
        insights: {
          accuracyTrends: result.accuracyTrends,
          topPatterns: result.mostCommonPatterns,
          recentChanges: result.recentAdaptations.slice(0, 5),
        },
        predictive: result.predictiveInsights,
        recommendations: result.recommendations,
        actionItems: this.generateActionItems(result),
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Failed to retrieve validation insights',
        error: error.message,
      });
    }
  }

  private generateActionItems(insights: ValidationInsightResponse): string[] {
    const actions: string[] = [];

    if (insights.summary.averageAccuracy < 0.9) {
      actions.push('Schedule model retraining session');
    }

    if (insights.recentAdaptations.length > 10) {
      actions.push('Review adaptation triggers for stability');
    }

    if (insights.predictiveInsights.riskFactors.length > 0) {
      actions.push('Address identified risk factors');
    }

    return actions;
  }
}

// ai-validation.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { AIValidationController } from './ai-validation.controller';
import { AIAdaptiveValidationBridgeService } from './ai-adaptive-validation-bridge.service';
import { VytchesDDD } from '@vytches/ddd-di';

@Module({
  controllers: [AIValidationController],
  providers: [AIAdaptiveValidationBridgeService],
  exports: [AIAdaptiveValidationBridgeService],
})
export class AIValidationModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD with AI features
    await VytchesDDD.configure({
      enableAutoDiscovery: true,
      contexts: ['AIValidation'],
      aiFeatures: {
        machineLearning: true,
        adaptiveThresholds: true,
        predictiveAnalytics: true,
        patternRecognition: true,
        automaticModelRetraining: true,
      },
      performance: {
        enableCaching: true,
        cacheTTL: 300000, // 5 minutes
        enableParallelProcessing: true,
      },
    });
  }
}
```

## Key Points

- **AI-Powered Validation**: Machine learning-enhanced validation with adaptive
  capabilities
- **Predictive Analytics**: Forward-looking validation predictions and risk
  assessment
- **Adaptive Thresholds**: Dynamic threshold adjustment based on historical
  patterns
- **Model Training**: Integrated model training and performance monitoring
- **VytchesDDD DI Integration**: Advanced dependency injection for AI services

## Usage Examples

```bash
# AI-powered validation
curl -X POST http://localhost:3000/ai/validation/validate \
  -H "Content-Type: application/json" \
  -d '{
    "entity": {
      "id": "user-001",
      "email": "test@example.com",
      "age": 25,
      "riskScore": 0.2
    },
    "entityType": "user",
    "options": {
      "adaptationLevel": "predictive",
      "predictionHorizon": "short_term"
    }
  }'

# Train AI model
curl -X POST http://localhost:3000/ai/validation/train-model \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {
        "entity": {"email": "valid@example.com", "age": 30},
        "isValid": true,
        "confidence": 0.95
      }
    ],
    "modelType": "pattern_recognition"
  }'

# Get validation insights
curl -X GET "http://localhost:3000/ai/validation/insights?timeRange={\"start\":\"2024-07-01\",\"end\":\"2024-07-21\"}&entityTypes=user,transaction"
```

## Next Steps

- Review [Basic Manual Integration](../basic/example-1.md)
- Explore [Intermediate DI Integration](../intermediate/example-1.md)
- Study [Enterprise Orchestration](./example-1.md)
