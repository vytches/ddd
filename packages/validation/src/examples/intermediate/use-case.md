# Intermediate Validation Use Cases

**Package**: @vytches/ddd-validation **Complexity**: Intermediate **Focus**:
Advanced validation scenarios with composite patterns, async operations, and
performance optimization

## Overview

Intermediate validation use cases demonstrate sophisticated validation patterns
for enterprise applications requiring high performance, complex business rules,
and integration with external services.

## Use Case 1: Financial Trading Platform - Real-time Risk Validation

### Business Context

A high-frequency trading platform processes 500,000 trades per minute and
requires real-time risk validation with sub-millisecond latency. Each trade must
be validated against portfolio limits, regulatory requirements, and market
conditions while maintaining 99.99% uptime.

### Implementation with @vytches/ddd-validation

```typescript
import {
  CompositeSpecification,
  IAsyncSpecification,
  BatchValidationOptimizer,
} from '@vytches/ddd-validation';

class TradingRiskValidator {
  private batchOptimizer: BatchValidationOptimizer<TradeOrder>;
  private riskSpecs: Map<string, IAsyncSpecification<TradeOrder>>;

  constructor(
    riskService: IRiskService,
    complianceService: IComplianceService
  ) {
    // High-performance batch optimizer for trading volume
    this.batchOptimizer = new BatchValidationOptimizer(this, {
      batchSize: 5000,
      maxConcurrency: 16,
      enableCaching: true,
      cacheSize: 100000,
      cacheTtl: 30000, // 30 seconds for trading data
      enableStreaming: true,
      memoryThreshold: 500 * 1024 * 1024, // 500MB
    });

    this.initializeRiskSpecifications(riskService, complianceService);
  }

  async validateTradeOrders(
    orders: TradeOrder[]
  ): Promise<BatchValidationResult<TradeOrder>> {
    // Real-time batch validation with sub-second processing
    return await this.batchOptimizer.validateBatch({
      entities: orders,
      context: {
        operationType: 'create',
        environment: 'production',
        validationLevel: 'strict',
        businessRules: { realTimeRisk: true, regulatoryCompliance: true },
      },
      parallelProcessing: true,
      continueOnError: false, // Stop on critical risk violations
    });
  }

  private initializeRiskSpecifications(
    riskService: IRiskService,
    complianceService: IComplianceService
  ): void {
    this.riskSpecs = new Map([
      ['position-limits', new PositionLimitSpecification(riskService)],
      ['market-risk', new MarketRiskSpecification(riskService)],
      ['compliance', new TradingComplianceSpecification(complianceService)],
      ['liquidity', new LiquidityRiskSpecification(riskService)],
    ]);
  }
}
```

### Business Impact

- **Performance**: 99.8% of trades validated within 10ms SLA
- **Risk Reduction**: 95% reduction in regulatory violations
- **Throughput**: Handle 10x trading volume with same infrastructure
- **Availability**: 99.99% uptime with real-time validation

## Use Case 2: Healthcare Data Integration - Multi-Source Validation

### Business Context

A healthcare network integrates patient data from 150+ hospitals with different
EMR systems. Data quality varies significantly across sources, requiring
sophisticated validation that adapts to source characteristics while maintaining
HIPAA compliance.

### Implementation with @vytches/ddd-validation

```typescript
class HealthcareDataValidator {
  private dataQualityValidator: DataQualityValidator<PatientRecord>;
  private sourceAdapters: Map<string, SourceValidationAdapter>;

  constructor() {
    // Adaptive quality thresholds based on data source
    this.dataQualityValidator = new DataQualityValidator({
      completeness: 0.9, // Lower for legacy systems
      accuracy: 0.98, // Critical for patient safety
      consistency: 0.85, // Vary across systems
      validity: 0.99, // Must be valid
      uniqueness: 0.95, // Some duplicates acceptable
      timeliness: 0.7, // Legacy data may be old
    });

    this.initializeSourceAdapters();
  }

  async validatePatientRecords(
    records: PatientRecord[],
    sourceSystem: string
  ): Promise<ValidationResult[]> {
    const adapter = this.sourceAdapters.get(sourceSystem);
    const adjustedThresholds = adapter?.getQualityThresholds() || {};

    // Adjust validator for specific source characteristics
    const sourceValidator = new DataQualityValidator(adjustedThresholds);

    const results = await Promise.all(
      records.map(record =>
        sourceValidator.validate(record, {
          operationType: 'create',
          environment: 'production',
          validationLevel: 'strict',
          businessRules: {
            hipaaCompliant: true,
            sourceSystem,
            requiresMedicalReview: adapter?.requiresReview(record),
          },
        })
      )
    );

    // Generate aggregate quality report
    await this.generateQualityReport(sourceSystem, results);

    return results;
  }

  private async generateQualityReport(
    sourceSystem: string,
    results: ValidationResult[]
  ): Promise<void> {
    const qualityMetrics = results
      .map(r => r.metadata.qualityMetrics)
      .filter(m => m);

    const aggregatedMetrics = this.aggregateQualityMetrics(qualityMetrics);

    // Alert if quality drops below thresholds
    if (aggregatedMetrics.overallScore < 0.85) {
      await this.alertQualityTeam(sourceSystem, aggregatedMetrics);
    }
  }
}
```

### Business Impact

- **Data Quality**: 40% improvement in cross-system data consistency
- **Integration Speed**: 80% faster data integration across sources
- **Compliance**: 100% HIPAA compliance with automated validation
- **Patient Safety**: 60% reduction in medical errors from data quality issues

## Use Case 3: E-commerce Platform - Dynamic Product Validation

### Business Context

A global e-commerce platform with 50M+ products needs dynamic validation rules
that adapt to product categories, geographic regions, and seasonal requirements.
Validation rules change frequently based on regulatory updates and business
requirements.

### Implementation with @vytches/ddd-validation

```typescript
class DynamicProductValidator {
  private policyEngine: PolicyValidationEngine;
  private ruleRegistry: ValidationRuleRegistry;
  private batchProcessor: BatchValidationOptimizer<Product>;

  constructor(policyService: IPolicyService, ruleService: IRuleService) {
    this.policyEngine = new PolicyValidationEngine(policyService);
    this.ruleRegistry = new ValidationRuleRegistry(ruleService);

    this.batchProcessor = new BatchValidationOptimizer(this, {
      batchSize: 10000,
      maxConcurrency: 12,
      enableCaching: true,
      cacheSize: 200000,
      cacheTtl: 300000, // 5 minutes for product data
      enableStreaming: true,
    });
  }

  async validateProducts(
    products: Product[],
    region: string,
    category: string
  ): Promise<BatchValidationResult<Product>> {
    // Get dynamic rules for region and category
    const validationRules = await this.ruleRegistry.getRules(region, category);
    const validationPolicies = await this.policyEngine.getPolicies(
      region,
      category
    );

    return await this.batchProcessor.validateBatch({
      entities: products,
      context: {
        operationType: 'bulk_import',
        environment: 'production',
        validationLevel: 'standard',
        businessRules: {
          region,
          category,
          dynamicRules: validationRules.map(r => r.id),
          activePolicies: validationPolicies.map(p => p.id),
        },
      },
      parallelProcessing: true,
      continueOnError: true,
    });
  }

  async validate(
    product: Product,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const region = context?.businessRules?.region || 'global';
    const category = product.category || 'general';

    // Get applicable rules and policies
    const [rules, policies] = await Promise.all([
      this.ruleRegistry.getRules(region, category),
      this.policyEngine.getPolicies(region, category),
    ]);

    // Execute field-level validation with dynamic rules
    const fieldResults = await this.validateProductFields(product, rules);

    // Execute policy validation
    const policyResults = await this.validateProductPolicies(
      product,
      policies,
      context
    );

    // Combine results
    return this.combineValidationResults(fieldResults, policyResults, context);
  }

  private async validateProductFields(
    product: Product,
    rules: BusinessRule[]
  ): Promise<ValidationResult[]> {
    const fieldValidator = new FieldValidator(rules);

    return await Promise.all([
      fieldValidator.validateField(product, 'name', product.name?.length),
      fieldValidator.validateField(product, 'price', product.price),
      fieldValidator.validateField(product, 'category', product.category),
      fieldValidator.validateField(product, 'weight', product.weight),
      fieldValidator.validateField(
        product,
        'description',
        product.description?.length
      ),
    ]);
  }

  private async validateProductPolicies(
    product: Product,
    policies: ValidationPolicy[],
    context?: ValidationContext
  ): Promise<ValidationResult[]> {
    return await Promise.all(
      policies.map(policy =>
        this.policyEngine.validatePolicy(policy, product, context)
      )
    );
  }
}
```

### Business Impact

- **Flexibility**: 90% reduction in time to deploy new validation rules
- **Compliance**: 100% adherence to regional regulations across 40+ countries
- **Product Quality**: 85% improvement in product listing quality scores
- **Operational Efficiency**: 70% reduction in manual validation overhead

## Use Case 4: Manufacturing Quality Control - IoT Sensor Validation

### Business Context

A smart manufacturing facility uses 10,000+ IoT sensors to monitor production
quality. Sensor data must be validated in real-time to detect anomalies, prevent
defects, and maintain production efficiency. Data validation includes temporal
patterns, cross-sensor correlations, and predictive quality indicators.

### Implementation with @vytches/ddd-validation

```typescript
class IoTSensorValidator {
  private streamingValidator: StreamingValidationProcessor<SensorReading>;
  private temporalValidator: TemporalPatternValidator;
  private correlationValidator: CrossSensorCorrelationValidator;

  constructor(
    sensorService: ISensorService,
    predictiveService: IPredictiveService
  ) {
    this.streamingValidator = new StreamingValidationProcessor({
      bufferSize: 50000,
      processingInterval: 1000, // 1 second
      enableAnomalyDetection: true,
      enablePredictiveValidation: true,
    });

    this.temporalValidator = new TemporalPatternValidator(sensorService);
    this.correlationValidator = new CrossSensorCorrelationValidator(
      predictiveService
    );
  }

  async validateSensorStream(
    sensorReadings: AsyncIterable<SensorReading>
  ): Promise<AsyncIterable<ValidationResult>> {
    return this.streamingValidator.processStream(
      sensorReadings,
      async reading => await this.validateSensorReading(reading)
    );
  }

  private async validateSensorReading(
    reading: SensorReading
  ): Promise<ValidationResult> {
    const [
      rangeValidation,
      temporalValidation,
      correlationValidation,
      anomalyValidation,
    ] = await Promise.all([
      this.validateSensorRange(reading),
      this.temporalValidator.validatePattern(reading),
      this.correlationValidator.validateCorrelations(reading),
      this.detectAnomalies(reading),
    ]);

    return this.combineValidationResults([
      rangeValidation,
      temporalValidation,
      correlationValidation,
      anomalyValidation,
    ]);
  }

  private async validateSensorRange(
    reading: SensorReading
  ): Promise<ValidationResult> {
    const spec = new SensorRangeSpecification(reading.sensorType);
    const result = await spec.isSatisfiedByAsync(reading);

    return {
      isValid: result.isSatisfied,
      errors: result.isSatisfied
        ? []
        : [
            {
              field: 'value',
              code: 'SENSOR_OUT_OF_RANGE',
              message:
                result.reason || 'Sensor reading outside acceptable range',
              severity: 'error',
              details: result.metadata,
            },
          ],
      warnings: [],
      metadata: {
        validatedAt: new Date(),
        validationDuration: 0,
        rulesApplied: ['sensor-range'],
        skippedRules: [],
        validatorVersion: '3.0.0',
        context: {
          operationType: 'create',
          environment: 'production',
          validationLevel: 'strict',
        },
      },
    };
  }
}
```

### Business Impact

- **Quality Improvement**: 45% reduction in defective products through early
  detection
- **Downtime Prevention**: 80% reduction in unplanned maintenance through
  predictive validation
- **Production Efficiency**: 25% improvement in overall equipment effectiveness
  (OEE)
- **Cost Savings**: $5M annual savings from prevented quality issues

## Use Case 5: SaaS Multi-Tenant Configuration Validation

### Business Context

A multi-tenant SaaS platform serves 10,000+ organizations with varying
configuration requirements. Each tenant has custom validation rules, compliance
requirements, and business logic that must be enforced consistently across all
users within the tenant.

### Implementation with @vytches/ddd-validation

```typescript
class TenantConfigurationValidator {
  private tenantValidators: Map<string, IValidator<any>>;
  private configurationCache: Map<string, TenantValidationConfig>;
  private policyEngine: MultiTenantPolicyEngine;

  constructor(
    configService: IConfigurationService,
    policyService: IPolicyService
  ) {
    this.tenantValidators = new Map();
    this.configurationCache = new Map();
    this.policyEngine = new MultiTenantPolicyEngine(policyService);
  }

  async validateForTenant<T>(
    entity: T,
    tenantId: string,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    // Get or create tenant-specific validator
    let validator = this.tenantValidators.get(tenantId);
    if (!validator) {
      validator = await this.createTenantValidator(tenantId);
      this.tenantValidators.set(tenantId, validator);
    }

    // Add tenant context
    const tenantContext: ValidationContext = {
      ...context,
      tenantId,
      businessRules: {
        ...context?.businessRules,
        tenantSpecific: true,
        complianceLevel: await this.getTenantComplianceLevel(tenantId),
      },
    };

    return await validator.validate(entity, tenantContext);
  }

  private async createTenantValidator(
    tenantId: string
  ): Promise<IValidator<any>> {
    const config = await this.getTenantValidationConfig(tenantId);

    return new CompositeValidator([
      new FieldValidator(config.businessRules),
      new PolicyValidator(config.policies),
      new ComplianceValidator(config.complianceRequirements),
      new CustomRuleValidator(config.customRules),
    ]);
  }

  private async getTenantValidationConfig(
    tenantId: string
  ): Promise<TenantValidationConfig> {
    // Check cache first
    let config = this.configurationCache.get(tenantId);
    if (!config || this.isConfigExpired(config)) {
      config = await this.loadTenantConfig(tenantId);
      this.configurationCache.set(tenantId, config);
    }
    return config;
  }

  async validateBatchForTenant<T>(
    entities: T[],
    tenantId: string,
    context?: ValidationContext
  ): Promise<BatchValidationResult<T>> {
    const validator = await this.createTenantValidator(tenantId);
    const batchOptimizer = new BatchValidationOptimizer(validator, {
      batchSize: 5000,
      maxConcurrency: 8,
      enableCaching: true,
      cacheSize: 50000,
      cacheTtl: 600000, // 10 minutes for tenant config
    });

    return await batchOptimizer.validateBatch({
      entities,
      context: {
        ...context,
        tenantId,
        operationType: 'bulk_import',
        validationLevel: 'strict',
      },
      parallelProcessing: true,
      continueOnError: true,
    });
  }
}
```

### Business Impact

- **Tenant Satisfaction**: 95% tenant satisfaction with customizable validation
- **Compliance**: 100% compliance across different regulatory requirements
- **Performance**: 90% consistent validation performance across all tenants
- **Scalability**: Support 10x tenant growth with same infrastructure

## Common Architectural Patterns

### Performance Optimization

1. **Intelligent Caching**: Cache validation results with appropriate TTL based
   on data volatility
2. **Parallel Processing**: Use batch processing with concurrency control for
   large datasets
3. **Memory Management**: Implement streaming for large datasets to prevent
   memory issues
4. **Progressive Validation**: Start with fast validations and escalate to
   complex ones

### Integration Patterns

1. **Async Specifications**: Handle external service calls with proper timeout
   and error handling
2. **Policy Integration**: Combine specifications with business policies for
   flexibility
3. **Dynamic Rule Loading**: Load validation rules at runtime based on context
4. **Multi-Source Validation**: Adapt validation based on data source
   characteristics

### Quality Assurance

1. **Comprehensive Metrics**: Track data quality across multiple dimensions
2. **Automated Reporting**: Generate quality reports with actionable
   recommendations
3. **Threshold Management**: Set and monitor quality thresholds based on
   business requirements
4. **Continuous Improvement**: Use validation metrics to improve data quality
   over time

## Next Steps

- Explore [Basic Validation Patterns](../basic/example-1.md)
- Review [Advanced Enterprise Validation](../advanced/example-1.md)
- Study [NestJS Integration Patterns](../frameworks/nestjs/basic/example-1.md)
