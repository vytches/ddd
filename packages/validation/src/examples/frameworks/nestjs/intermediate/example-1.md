# NestJS Advanced Validation with VytchesDDD DI Integration

**Package**: @vytches-ddd/validation  
**Framework**: NestJS  
**Complexity**: Intermediate  
**Focus**: VytchesDDD DI integration with enterprise validation patterns

## Overview

This example demonstrates advanced NestJS integration using VytchesDDD DI for sophisticated validation orchestration, AI-enhanced validation, and enterprise-grade service management.

## Implementation

```typescript
// enterprise-validation.service.ts
import { Injectable } from '@nestjs/common';
import { 
  DomainService, 
  ServiceLifetime, 
  VytchesDDD 
} from '@vytches-ddd/di';
import { 
  EnterpriseValidationOrchestrator,
  AIEnhancedValidationSpecification,
  DataQualityValidator 
} from '@vytches-ddd/validation';
import { User, ValidationContext } from './types'; // From your application

// Domain service managed by VytchesDDD
@DomainService({
  serviceId: 'enterpriseUserValidator',
  lifetime: ServiceLifetime.Singleton,
  context: 'UserManagement',
  dependencies: ['eventBus', 'policyRegistry', 'aiValidationEngine'],
  timeout: 30000,
  middleware: ['logging', 'resilience']
})
export class EnterpriseUserValidationService {
  private orchestrator: EnterpriseValidationOrchestrator;
  private aiValidator: AIEnhancedValidationSpecification<User>;
  private qualityValidator: DataQualityValidator<User>;

  constructor() {
    // ⭐ FOCUS: Enterprise DI with auto-discovery
    this.initializeEnterpriseValidation();
  }

  async validateWithOrchestration(
    user: User,
    coordinationStrategy: 'adaptive' | 'consensus' = 'adaptive'
  ): Promise<GlobalValidationResult> {
    return await this.orchestrator.orchestrateGlobalValidation(
      [user],
      'user-validation',
      coordinationStrategy
    );
  }

  async validateWithAI(user: User): Promise<SpecificationResult> {
    return await this.aiValidator.isSatisfiedByAsync(user);
  }

  async assessDataQuality(user: User): Promise<ValidationResult> {
    return await this.qualityValidator.validate(user);
  }

  private initializeEnterpriseValidation(): void {
    // Enterprise components resolved through VytchesDDD DI
    const eventBus = VytchesDDD.resolve('eventBus');
    const policyRegistry = VytchesDDD.resolve('policyRegistry');
    const aiEngine = VytchesDDD.resolve('aiValidationEngine');

    this.orchestrator = new EnterpriseValidationOrchestrator(
      eventBus,
      policyRegistry,
      aiEngine,
      VytchesDDD.resolve('globalStateManager')
    );

    this.aiValidator = new AIEnhancedValidationSpecification<User>(
      'User',
      VytchesDDD.resolve('userValidationRules'),
      VytchesDDD.resolve('mlModelService'),
      eventBus
    );

    this.qualityValidator = new DataQualityValidator<User>({
      completeness: 0.98,
      accuracy: 0.99,
      consistency: 0.97,
      validity: 0.99,
      uniqueness: 0.98,
      timeliness: 0.95
    });
  }
}

// NestJS bridge service
@Injectable()
export class UserValidationBridgeService {
  private enterpriseValidator: EnterpriseUserValidationService;

  constructor() {
    // ⭐ FOCUS: Bridge pattern with VytchesDDD DI
    this.enterpriseValidator = VytchesDDD.resolve<EnterpriseUserValidationService>(
      'enterpriseUserValidator'
    );
  }

  async validateUser(user: User): Promise<EnterpriseValidationResult> {
    try {
      // Use enterprise validation orchestration
      const orchestrationResult = await this.enterpriseValidator.validateWithOrchestration(
        user,
        'adaptive'
      );

      // AI-enhanced validation
      const aiResult = await this.enterpriseValidator.validateWithAI(user);

      // Data quality assessment
      const qualityResult = await this.enterpriseValidator.assessDataQuality(user);

      return {
        isValid: orchestrationResult.isValid && aiResult.isSatisfied && qualityResult.isValid,
        orchestrationResult,
        aiEnhancedResult: aiResult,
        qualityAssessment: qualityResult,
        overallConfidence: this.calculateOverallConfidence(
          orchestrationResult,
          aiResult,
          qualityResult
        ),
        recommendations: this.generateRecommendations(orchestrationResult, aiResult, qualityResult)
      };

    } catch (error) {
      throw new Error(`Enterprise validation failed: ${error.message}`);
    }
  }

  async validateUserBatch(users: User[]): Promise<BatchEnterpriseValidationResult> {
    const results = await Promise.allSettled(
      users.map(user => this.validateUser(user))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      totalProcessed: users.length,
      successful,
      failed,
      successRate: successful / users.length,
      results: results.map((result, index) => ({
        index,
        status: result.status,
        result: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      }))
    };
  }

  private calculateOverallConfidence(
    orchestration: GlobalValidationResult,
    ai: SpecificationResult,
    quality: ValidationResult
  ): number {
    const orchestrationScore = orchestration.consensusResult.confidenceScore;
    const aiScore = ai.metadata?.prediction?.confidence || 0.5;
    const qualityScore = quality.metadata.qualityMetrics?.overallScore || 0.5;

    return (orchestrationScore * 0.4 + aiScore * 0.4 + qualityScore * 0.2);
  }

  private generateRecommendations(
    orchestration: GlobalValidationResult,
    ai: SpecificationResult,
    quality: ValidationResult
  ): string[] {
    const recommendations: string[] = [];

    if (orchestration.recommendations) {
      recommendations.push(...orchestration.recommendations.map(r => r.description));
    }

    if (!ai.isSatisfied && ai.reason) {
      recommendations.push(`AI Validation: ${ai.reason}`);
    }

    if (quality.warnings.length > 0) {
      recommendations.push(...quality.warnings.map(w => w.suggestion).filter(Boolean));
    }

    return recommendations;
  }
}

// user.controller.ts
import { 
  Controller, 
  Post, 
  Body, 
  BadRequestException,
  HttpStatus,
  HttpCode 
} from '@nestjs/common';
import { UserValidationBridgeService } from './user-validation-bridge.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UserController {
  constructor(
    private readonly userValidationService: UserValidationBridgeService
  ) {}

  @Post('enterprise-validate')
  @HttpCode(HttpStatus.OK)
  async validateUserEnterprise(@Body() createUserDto: CreateUserDto) {
    try {
      // ✅ FOCUS: Enterprise validation with global orchestration
      const result = await this.userValidationService.validateUser(
        createUserDto as User
      );

      if (!result.isValid) {
        throw new BadRequestException({
          message: 'Enterprise validation failed',
          orchestrationResult: result.orchestrationResult,
          aiResult: result.aiEnhancedResult,
          qualityAssessment: result.qualityAssessment
        });
      }

      return {
        success: true,
        message: 'Enterprise validation passed',
        confidence: result.overallConfidence,
        recommendations: result.recommendations,
        validationSummary: {
          globalConsensus: result.orchestrationResult.consensusResult.globalConsensus,
          aiPrediction: result.aiEnhancedResult.metadata?.prediction?.outcome,
          qualityScore: result.qualityAssessment.metadata.qualityMetrics?.overallScore
        }
      };

    } catch (error) {
      throw new BadRequestException({
        message: 'Enterprise validation failed',
        error: error.message
      });
    }
  }

  @Post('batch-enterprise')
  @HttpCode(HttpStatus.OK)
  async validateUserBatchEnterprise(@Body() users: CreateUserDto[]) {
    try {
      const batchResult = await this.userValidationService.validateUserBatch(
        users as User[]
      );

      return {
        success: true,
        summary: {
          total: batchResult.totalProcessed,
          successful: batchResult.successful,
          failed: batchResult.failed,
          successRate: batchResult.successRate
        },
        results: batchResult.results.map(r => ({
          index: r.index,
          isValid: r.result?.isValid || false,
          confidence: r.result?.overallConfidence || 0,
          recommendations: r.result?.recommendations || [],
          error: r.error
        }))
      };

    } catch (error) {
      throw new BadRequestException({
        message: 'Batch enterprise validation failed',
        error: error.message
      });
    }
  }
}

// user.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserValidationBridgeService } from './user-validation-bridge.service';
import { VytchesDDD } from '@vytches-ddd/di';

@Module({
  controllers: [UserController],
  providers: [UserValidationBridgeService],
  exports: [UserValidationBridgeService]
})
export class UserModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD with enterprise features first
    await VytchesDDD.configure({
      enableAutoDiscovery: true,
      contexts: ['UserManagement'],
      enterpriseFeatures: {
        globalCoordination: true,
        aiEnhancement: true,
        qualityMonitoring: true
      }
    });
  }
}
```

## Key Points

- **VytchesDDD DI Integration**: Enterprise-grade dependency injection with auto-discovery
- **Bridge Pattern**: Clean separation between NestJS and VytchesDDD business logic
- **Global Validation Orchestration**: Multi-region validation coordination
- **AI-Enhanced Validation**: Machine learning integration for adaptive validation
- **Enterprise Service Management**: Sophisticated service lifecycle and configuration

## Usage Examples

```bash
# Enterprise validation with global orchestration
curl -X POST http://localhost:3000/users/enterprise-validate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "enterprise.user@example.com",
    "firstName": "Enterprise",
    "lastName": "User",
    "age": 35,
    "phoneNumber": "+1-555-ENTERPRISE"
  }'

# Batch enterprise validation
curl -X POST http://localhost:3000/users/batch-enterprise \
  -H "Content-Type: application/json" \
  -d '[
    {
      "email": "user1@enterprise.com",
      "firstName": "User",
      "lastName": "One",
      "age": 30
    },
    {
      "email": "user2@enterprise.com", 
      "firstName": "User",
      "lastName": "Two",
      "age": 25
    }
  ]'
```

## Best Practices

1. **Initialize VytchesDDD First**: Always configure VytchesDDD before NestJS DI
2. **Use Bridge Pattern**: Keep NestJS services as thin delegation layers
3. **Leverage Enterprise Features**: Utilize AI, global coordination, and quality monitoring
4. **Service Discovery**: Let VytchesDDD auto-discover domain services
5. **Error Handling**: Provide comprehensive error details for enterprise scenarios

## Next Steps

- Review [Basic Manual Integration](../basic/example-1.md)
- Explore [Advanced Enterprise Orchestration](../advanced/example-1.md)
- Study [Global Validation Patterns](../../advanced/example-1.md)