# Advanced Utils Integration - NestJS Intermediate

**Version**: 1.0.0
**Package**: @vytches-ddd/utils
**Complexity**: Intermediate
**Framework**: NestJS
**Base Example**: [Async Result Patterns](../../intermediate/example-2.md)
**Dependencies**: @nestjs/common, @vytches-ddd/utils, @vytches-ddd/di

## Business Context

This example demonstrates advanced VytchesDDD DI integration for utility services in enterprise applications. It shows how to leverage the dependency injection container for automatic service discovery and context-aware utility operations, particularly useful for large-scale financial services platforms requiring sophisticated error handling, async operations, and business rule validation.

## Service Implementation

```typescript
// advanced-utils.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { Result, safeRun } from '@vytches-ddd/utils';
import type {
  BusinessOperation,
  ValidationContext,
  AsyncOperationResult,
  UtilityConfiguration,
  BusinessRule
} from '../types'; // From your application

@Injectable()
export class AdvancedUtilsService {
  private readonly configurationManager: IConfigurationManager;
  private readonly businessRuleEngine: IBusinessRuleEngine;
  private readonly asyncOperationManager: IAsyncOperationManager;

  constructor() {
    // ⭐ FOCUS: @vytches-ddd/di integration for utility services
    this.configurationManager = VytchesDDD.resolve<IConfigurationManager>(
      'configurationManager'
    );
    this.businessRuleEngine = VytchesDDD.resolve<IBusinessRuleEngine>(
      'businessRuleEngine'
    );
    this.asyncOperationManager = VytchesDDD.resolve<IAsyncOperationManager>(
      'asyncOperationManager'
    );
  }

  // ✅ FOCUS: Advanced Result pattern with async operations and VytchesDDD services
  async executeBusinessOperation<T>(
    operation: BusinessOperation<T>,
    context: ValidationContext
  ): Promise<Result<T, BusinessError>> {
    try {
      // Use VytchesDDD service for configuration validation
      const config = await this.configurationManager.getOperationConfig(
        operation.type,
        context
      );

      // Validate business rules through DI
      const ruleValidationResult = await this.businessRuleEngine.validate(
        operation,
        context,
        config.businessRules
      );

      if (ruleValidationResult.isFailure) {
        return Result.fail(ruleValidationResult.error);
      }

      // Execute async operation with utility patterns
      const executionResult = await this.asyncOperationManager.execute(
        operation,
        config
      );

      return executionResult;

    } catch (error) {
      return Result.fail({
        type: 'OPERATION_EXECUTION_ERROR',
        message: `Business operation failed: ${(error as Error).message}`,
        context: context.operationId,
        timestamp: new Date()
      });
    }
  }

  // ✅ FOCUS: Complex async validation with Result.combine
  async validateComplexBusinessRules<T>(
    data: T,
    rules: BusinessRule[],
    context: ValidationContext
  ): Promise<Result<T, ValidationError[]>> {
    // Execute multiple async validations
    const validationPromises = rules.map(async (rule) => {
      const [error, result] = await safeRun(async () => 
        await this.businessRuleEngine.evaluateRule(rule, data, context)
      );
      
      if (error) {
        return Result.fail<boolean, ValidationError>({
          ruleId: rule.id,
          message: `Rule validation failed: ${error.message}`,
          field: rule.field,
          value: data
        });
      }
      
      return result.isValid 
        ? Result.ok<boolean, ValidationError>(true)
        : Result.fail<boolean, ValidationError>({
            ruleId: rule.id,
            message: result.errorMessage,
            field: rule.field,
            value: data
          });
    });

    const validationResults = await Promise.all(validationPromises);
    
    // ⭐ Advanced: Combine multiple Result operations
    const combinedResult = Result.combine(validationResults);
    
    if (combinedResult.isFailure) {
      return Result.fail(combinedResult.error);
    }

    return Result.ok(data);
  }

  // ✅ FOCUS: Safe async operations with Result.tryAsync
  async performAsyncCalculation(
    calculation: FinancialCalculation,
    context: ValidationContext
  ): Promise<Result<CalculationResult, CalculationError>> {
    return Result.tryAsync(async () => {
      // Use VytchesDDD services for complex calculations
      const calculator = VytchesDDD.resolve<IFinancialCalculator>('financialCalculator');
      const validator = VytchesDDD.resolve<ICalculationValidator>('calculationValidator');

      // Validate calculation parameters
      const validation = await validator.validate(calculation);
      if (!validation.isValid) {
        throw new Error(`Calculation validation failed: ${validation.errors.join(', ')}`);
      }

      // Perform calculation with risk assessment
      const result = await calculator.calculate(calculation, context);
      
      // Additional business logic validation
      if (result.riskLevel === 'HIGH') {
        const approvalService = VytchesDDD.resolve<IApprovalService>('approvalService');
        const approval = await approvalService.requireApproval(result, context);
        
        if (!approval.approved) {
          throw new Error('High-risk calculation requires manual approval');
        }
      }

      return result;
    }).catch((error: Error) => ({
      type: 'CALCULATION_ERROR' as const,
      message: error.message,
      calculation: calculation.type,
      context: context.operationId,
      timestamp: new Date()
    }));
  }

  // ✅ FOCUS: Result pattern for batch operations
  async processBatchOperations<T, R>(
    operations: T[],
    processor: (item: T) => Promise<Result<R, ProcessingError>>,
    context: ValidationContext
  ): Promise<Result<R[], BatchProcessingError>> {
    const batchProcessor = VytchesDDD.resolve<IBatchProcessor>('batchProcessor');
    
    try {
      // Process operations in optimized batches
      const batchConfig = await this.configurationManager.getBatchConfig(
        context.tenantId
      );

      const results: R[] = [];
      const errors: ProcessingError[] = [];

      const batches = batchProcessor.createBatches(operations, batchConfig.batchSize);

      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(async (operation) => {
            const [error, result] = await safeRun(async () => 
              await processor(operation)
            );
            
            if (error) {
              return Result.fail<R, ProcessingError>({
                operationId: (operation as any).id,
                message: error.message,
                type: 'PROCESSING_ERROR'
              });
            }
            
            return result;
          })
        );

        // Collect results and errors
        for (const result of batchResults) {
          if (result.isSuccess) {
            results.push(result.value);
          } else {
            errors.push(result.error);
          }
        }

        // Check if we should continue processing based on error threshold
        if (errors.length > batchConfig.maxErrors) {
          return Result.fail({
            type: 'BATCH_ERROR_THRESHOLD_EXCEEDED',
            message: `Too many errors: ${errors.length}`,
            errors,
            processedCount: results.length,
            totalCount: operations.length
          });
        }
      }

      return Result.ok(results);

    } catch (error) {
      return Result.fail({
        type: 'BATCH_PROCESSING_SYSTEM_ERROR',
        message: `Batch processing failed: ${(error as Error).message}`,
        errors: [],
        processedCount: 0,
        totalCount: operations.length
      });
    }
  }

  // ✅ FOCUS: Configuration-driven utility operations
  async executeConfiguredOperation<T>(
    operationType: string,
    data: T,
    context: ValidationContext
  ): Promise<Result<T, ConfigurationError>> {
    try {
      // Get operation configuration through VytchesDDD DI
      const config = await this.configurationManager.getConfiguration(
        operationType,
        context.tenantId
      );

      if (!config) {
        return Result.fail({
          type: 'CONFIGURATION_NOT_FOUND',
          message: `No configuration found for operation: ${operationType}`,
          operationType,
          tenantId: context.tenantId
        });
      }

      // Apply configuration-driven transformations
      const transformedData = await this.applyConfiguredTransformations(
        data,
        config,
        context
      );

      return Result.ok(transformedData);

    } catch (error) {
      return Result.fail({
        type: 'CONFIGURATION_ERROR',
        message: `Configuration operation failed: ${(error as Error).message}`,
        operationType,
        tenantId: context.tenantId
      });
    }
  }

  // ⭐ Private: Apply configuration-driven transformations
  private async applyConfiguredTransformations<T>(
    data: T,
    config: UtilityConfiguration,
    context: ValidationContext
  ): Promise<T> {
    const transformationEngine = VytchesDDD.resolve<ITransformationEngine>(
      'transformationEngine'
    );

    return await transformationEngine.applyTransformations(
      data,
      config.transformations,
      context
    );
  }
}
```

## Module Configuration

```typescript
// advanced-utils.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { AdvancedUtilsService } from './advanced-utils.service';

@Module({
  providers: [AdvancedUtilsService],
  exports: [AdvancedUtilsService],
})
export class AdvancedUtilsModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD before using services
    await VytchesDDD.configure();
  }
}
```

## Usage Example

```typescript
// Example usage in a business service
export class TradingService {
  constructor(
    private readonly advancedUtilsService: AdvancedUtilsService
  ) {}

  async executeTrade(tradeRequest: TradeRequest, context: ValidationContext) {
    // Complex business operation with advanced utilities
    const operation: BusinessOperation<TradeResult> = {
      type: 'EXECUTE_TRADE',
      data: tradeRequest,
      metadata: { priority: 'HIGH', timeout: 30000 }
    };

    const result = await this.advancedUtilsService.executeBusinessOperation(
      operation,
      context
    );

    if (result.isFailure) {
      throw new Error(`Trade execution failed: ${result.error.message}`);
    }

    return result.value;
  }

  async validateTradeRules(tradeData: TradeData, context: ValidationContext) {
    const businessRules: BusinessRule[] = [
      { id: 'RISK_LIMIT', field: 'amount', validator: 'riskLimitValidator' },
      { id: 'MARKET_HOURS', field: 'timestamp', validator: 'marketHoursValidator' },
      { id: 'COMPLIANCE', field: 'instrument', validator: 'complianceValidator' }
    ];

    return await this.advancedUtilsService.validateComplexBusinessRules(
      tradeData,
      businessRules,
      context
    );
  }
}
```

## Key Features

- **VytchesDDD DI Integration**: Advanced dependency injection with service locator pattern
- **Complex Async Operations**: Sophisticated async Result patterns with error handling
- **Business Rule Engine**: Integration with configurable business rule validation
- **Batch Processing**: Optimized batch operations with error threshold management
- **Configuration-Driven**: Dynamic utility operations based on tenant configuration
- **Safe Async Execution**: safeRun integration for exception-safe async operations
- **Result Combination**: Advanced Result.combine patterns for multiple validations

## Common Pitfalls

- **Missing Container Initialization**: Always call `VytchesDDD.configure()` in `OnModuleInit`
- **Service Resolution Timing**: Ensure services are resolved after container configuration
- **Async Result Handling**: Use proper Promise<Result<T, E>> patterns for async operations
- **Batch Error Handling**: Don't ignore partial failures in batch operations
- **Configuration Caching**: Consider caching configuration for performance
- **Context Propagation**: Always pass validation context through the operation chain

## Related Examples

- [Async Result Patterns](../../intermediate/example-2.md) - Base async Result implementation
- [Advanced Async Operations](../../advanced/example-2.md) - Complex async patterns
- [Basic NestJS Integration](../basic/example-1.md) - Simple manual setup approach
- [Advanced NestJS Integration](../advanced/example-1.md) - Complete enterprise platform setup