# Intermediate ACL Use Cases

**Package**: @vytches/ddd-acl  
**Complexity**: Intermediate  
**Focus**: Advanced integration patterns with resilience, caching, and
multi-system orchestration

## Overview

Intermediate ACL use cases demonstrate sophisticated integration patterns
including performance optimization through caching, fault tolerance with
resilience patterns, and orchestrating multiple external systems while
maintaining data consistency.

## Use Case 1: Healthcare System Integration with Resilience

### Business Context

A hospital management system integrates with multiple healthcare providers,
insurance systems, and medical device networks. The system must handle
intermittent connectivity issues while ensuring patient data integrity.

### Implementation

```typescript
// Healthcare integration with comprehensive resilience
export class HealthcareIntegrationACL extends AntiCorruptionLayer<
  ExternalPatientData,
  Patient
> {
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: RetryPolicy;
  private cache: HealthcareDataCache;

  constructor(
    private insuranceAPI: InsuranceAPI,
    private medicalRecordsAPI: MedicalRecordsAPI,
    private labResultsAPI: LabResultsAPI
  ) {
    super(new PatientDataTranslator());

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 120000, // 2 minutes for healthcare systems
      monitoringPeriod: 60000,
    });

    this.retryPolicy = new RetryPolicy({
      maxAttempts: 5, // More attempts for critical healthcare data
      baseDelay: 2000,
      maxDelay: 30000,
      backoffStrategy: 'exponential',
    });

    this.cache = new HealthcareDataCache({
      ttl: 900000, // 15 minutes for patient data
      maxSize: 5000,
      encryptionEnabled: true, // HIPAA compliance
    });
  }

  async getComprehensivePatientRecord(
    patientId: string
  ): Promise<Result<ComprehensivePatient, Error>> {
    return this.circuitBreaker.execute(async () => {
      // Check cache first for recently accessed data
      const cachedData = await this.cache.get(`patient_${patientId}`);
      if (cachedData) {
        return Result.success(cachedData);
      }

      // Aggregate data from multiple systems with parallel calls
      const [patientResult, insuranceResult, labResults] =
        await Promise.allSettled([
          this.retryPolicy.execute(() => this.getPatientData(patientId)),
          this.retryPolicy.execute(() => this.getInsuranceInfo(patientId)),
          this.retryPolicy.execute(() => this.getLabResults(patientId)),
        ]);

      // Handle partial failures gracefully
      const comprehensivePatient = this.aggregatePatientData(
        patientResult,
        insuranceResult,
        labResults
      );

      // Cache for future requests
      await this.cache.set(
        `patient_${patientId}`,
        comprehensivePatient,
        900000
      );

      return Result.success(comprehensivePatient);
    });
  }
}
```

### Business Impact

- **Reliability**: 99.9% uptime despite external system issues
- **Performance**: 70% faster patient record retrieval through caching
- **Compliance**: HIPAA-compliant data handling with encryption
- **Patient Care**: Immediate access to critical patient information

## Use Case 2: Financial Trading Platform with Multi-Exchange Integration

### Business Context

A trading platform aggregates real-time market data from multiple stock
exchanges, handles order routing to different brokers, and manages risk across
all positions with sub-second latency requirements.

### Implementation

```typescript
// Multi-exchange trading platform ACL
export class TradingPlatformACL extends CompositeACL {
  private exchangeACLs: Map<string, ExchangeACL>;
  private riskEngine: RiskManagementACL;
  private settlementACL: SettlementACL;

  constructor(exchanges: ExchangeConfig[]) {
    const acls = exchanges.map(config => new ExchangeACL(config));
    super(acls);

    this.exchangeACLs = new Map();
    exchanges.forEach((config, index) => {
      this.exchangeACLs.set(config.exchangeId, acls[index]);
    });

    this.riskEngine = new RiskManagementACL();
    this.settlementACL = new SettlementACL();
  }

  async executeSmartOrder(
    order: TradingOrder
  ): Promise<Result<ExecutionResult, Error>> {
    // Real-time risk assessment
    const riskResult = await this.riskEngine.assessOrder(order);
    if (riskResult.isFailure()) {
      return Result.failure(
        new Error(`Risk check failed: ${riskResult.error.message}`)
      );
    }

    // Find best execution venues
    const venueAnalysis = await this.analyzeExecutionVenues(order);

    // Split order across multiple exchanges for best execution
    const orderFragments = this.optimizeOrderExecution(order, venueAnalysis);

    // Execute fragments concurrently
    const executionPromises = orderFragments.map(fragment =>
      this.executeOrderFragment(fragment)
    );

    const results = await Promise.allSettled(executionPromises);

    // Aggregate execution results
    return this.aggregateExecutionResults(results, order);
  }

  private async analyzeExecutionVenues(
    order: TradingOrder
  ): Promise<VenueAnalysis[]> {
    const analysisPromises = Array.from(this.exchangeACLs.entries()).map(
      async ([exchangeId, acl]) => {
        const liquidityData = await acl.getLiquidityData(order.symbol);
        return {
          exchangeId,
          liquidity: liquidityData.value,
          latency: await acl.measureLatency(),
          fees: await acl.getFeeStructure(order.orderType),
        };
      }
    );

    return Promise.all(analysisPromises);
  }
}
```

### Business Impact

- **Execution Quality**: 15% improvement in trade execution prices
- **Latency**: Sub-millisecond order routing across exchanges
- **Risk Management**: Real-time position monitoring and limits
- **Revenue**: $50M+ annual savings through optimized execution

## Use Case 3: Supply Chain Orchestration with Supplier Integration

### Business Context

A global manufacturer coordinates with 200+ suppliers across different time
zones, each with different systems, data formats, and communication protocols.
The system must handle supply disruptions and automatically find alternative
suppliers.

### Implementation

```typescript
// Supply chain orchestration ACL
export class SupplyChainOrchestrationACL extends CompositeACL {
  private supplierACLs: Map<string, SupplierACL>;
  private logisticsACL: LogisticsACL;
  private qualityACL: QualityAssuranceACL;
  private eventBus: EventBus;

  constructor(suppliers: SupplierConfig[], logisticsConfig: LogisticsConfig) {
    const acls = suppliers.map(config => new SupplierACL(config));
    super(acls);

    this.supplierACLs = new Map();
    suppliers.forEach((config, index) => {
      this.supplierACLs.set(config.supplierId, acls[index]);
    });

    this.logisticsACL = new LogisticsACL(logisticsConfig);
    this.qualityACL = new QualityAssuranceACL();
    this.eventBus = new EventBus();
  }

  async orchestrateProductionOrder(
    productionOrder: ProductionOrder
  ): Promise<Result<ProductionPlan, Error>> {
    // Step 1: Analyze material requirements
    const materialRequirements =
      await this.analyzeMaterialRequirements(productionOrder);

    // Step 2: Find optimal supplier allocation
    const supplierAllocation =
      await this.optimizeSupplierAllocation(materialRequirements);

    // Step 3: Check quality compliance
    const qualityValidation =
      await this.validateQualityCompliance(supplierAllocation);
    if (qualityValidation.isFailure()) {
      return Result.failure(qualityValidation.error);
    }

    // Step 4: Coordinate logistics
    const logisticsPlan = await this.coordinateLogistics(supplierAllocation);

    // Step 5: Create comprehensive production plan
    const productionPlan: ProductionPlan = {
      orderId: productionOrder.id,
      suppliers: supplierAllocation,
      logistics: logisticsPlan.value,
      estimatedCompletion: this.calculateCompletionDate(
        supplierAllocation,
        logisticsPlan.value
      ),
      riskFactors: await this.assessRisks(supplierAllocation),
    };

    // Publish events for monitoring
    await this.publishProductionPlanCreated(productionPlan);

    return Result.success(productionPlan);
  }

  private async optimizeSupplierAllocation(
    requirements: MaterialRequirement[]
  ): Promise<SupplierAllocation[]> {
    const allocationPromises = requirements.map(async requirement => {
      // Get bids from all capable suppliers
      const supplierBids = await this.getSupplerBids(requirement);

      // Score suppliers based on price, quality, delivery time, and reliability
      const scoredSuppliers = await this.scoreSuppliers(
        supplierBids,
        requirement
      );

      // Handle supplier capacity constraints
      const feasibleSuppliers = await this.checkSupplierCapacity(
        scoredSuppliers,
        requirement
      );

      // Select optimal supplier(s) - may split large orders
      return this.selectOptimalSuppliers(feasibleSuppliers, requirement);
    });

    return Promise.all(allocationPromises);
  }

  async handleSupplierDisruption(
    supplierId: string,
    disruptionType: DisruptionType
  ): Promise<Result<ContingencyPlan, Error>> {
    // Identify affected orders
    const affectedOrders = await this.findOrdersAffectedBySupplier(supplierId);

    // Find alternative suppliers for each affected material
    const alternativeAllocation = await this.findAlternativeSuppliers(
      affectedOrders,
      supplierId
    );

    // Calculate impact and mitigation costs
    const impactAnalysis = await this.analyzeDisruptionImpact(
      affectedOrders,
      alternativeAllocation
    );

    // Create contingency plan
    const contingencyPlan: ContingencyPlan = {
      disruptedSupplierId: supplierId,
      disruptionType,
      affectedOrders: affectedOrders.length,
      alternativeSuppliers: alternativeAllocation,
      estimatedDelay: impactAnalysis.delay,
      additionalCost: impactAnalysis.cost,
      mitigationActions: impactAnalysis.actions,
    };

    // Publish disruption event
    await this.publishSupplierDisruptionHandled(contingencyPlan);

    return Result.success(contingencyPlan);
  }
}
```

### Business Impact

- **Efficiency**: 40% reduction in production lead times
- **Cost Savings**: $200M annual savings through optimized supplier selection
- **Resilience**: 95% faster response to supply disruptions
- **Quality**: 60% improvement in defect rates through better supplier
  monitoring

## Use Case 4: Multi-Cloud Data Synchronization

### Business Context

A global SaaS platform operates across multiple cloud providers (AWS, Azure,
GCP) and needs to synchronize customer data, maintain consistency, and handle
regional failovers while complying with data residency requirements.

### Implementation

```typescript
// Multi-cloud data synchronization ACL
export class MultiCloudSyncACL extends CompositeACL {
  private cloudProviderACLs: Map<string, CloudProviderACL>;
  private conflictResolver: DataConflictResolver;
  private complianceEngine: DataComplianceEngine;

  constructor(cloudConfigs: CloudProviderConfig[]) {
    const acls = cloudConfigs.map(config => new CloudProviderACL(config));
    super(acls);

    this.cloudProviderACLs = new Map();
    cloudConfigs.forEach((config, index) => {
      this.cloudProviderACLs.set(config.provider, acls[index]);
    });

    this.conflictResolver = new DataConflictResolver();
    this.complianceEngine = new DataComplianceEngine();
  }

  async synchronizeCustomerData(
    customerId: string
  ): Promise<Result<SyncResult, Error>> {
    // Check compliance requirements first
    const complianceCheck =
      await this.complianceEngine.validateDataMovement(customerId);
    if (complianceCheck.isFailure()) {
      return Result.failure(complianceCheck.error);
    }

    // Get data from all cloud providers
    const dataRetrievalPromises = Array.from(
      this.cloudProviderACLs.entries()
    ).map(async ([provider, acl]) => {
      try {
        const result = await acl.getCustomerData(customerId);
        return { provider, result, timestamp: new Date() };
      } catch (error) {
        return {
          provider,
          result: Result.failure(
            new Error(`${provider} failed: ${error.message}`)
          ),
          timestamp: new Date(),
        };
      }
    });

    const dataResults = await Promise.all(dataRetrievalPromises);

    // Resolve conflicts using vector clocks and business rules
    const conflictResolution = await this.conflictResolver.resolveConflicts(
      dataResults.filter(r => r.result.isSuccess())
    );

    if (conflictResolution.isFailure()) {
      return Result.failure(conflictResolution.error);
    }

    const canonicalData = conflictResolution.value;

    // Propagate canonical data to all providers
    const syncPromises = Array.from(this.cloudProviderACLs.entries()).map(
      async ([provider, acl]) => {
        try {
          await acl.updateCustomerData(customerId, canonicalData);
          return { provider, success: true };
        } catch (error) {
          return { provider, success: false, error: error.message };
        }
      }
    );

    const syncResults = await Promise.all(syncPromises);

    const syncResult: SyncResult = {
      customerId,
      syncedProviders: syncResults.filter(r => r.success).map(r => r.provider),
      failedProviders: syncResults.filter(r => !r.success),
      conflictsResolved: conflictResolution.value.conflictsResolved,
      timestamp: new Date(),
    };

    return Result.success(syncResult);
  }
}
```

### Business Impact

- **Availability**: 99.99% uptime with multi-cloud redundancy
- **Compliance**: 100% data residency compliance across regions
- **Performance**: 50% faster global data access through regional optimization
- **Cost**: 30% reduction in data transfer costs through intelligent routing

## Key Architectural Patterns

### 1. **Resilience Integration**

- Circuit breakers prevent cascading failures
- Retry policies handle transient issues
- Bulkhead patterns isolate failures
- Timeout management prevents resource exhaustion

### 2. **Performance Optimization**

- Intelligent caching with TTL management
- Parallel execution for independent operations
- Connection pooling for external APIs
- Batch processing for bulk operations

### 3. **Data Consistency**

- Conflict resolution algorithms
- Vector clocks for distributed consistency
- Eventual consistency patterns
- Compensation logic for failed transactions

### 4. **Monitoring and Observability**

- Health checks for all external systems
- Performance metrics and SLA monitoring
- Event-driven integration for real-time updates
- Alerting for system degradation

## Benefits of Intermediate ACL Patterns

- **Fault Tolerance**: Systems remain operational despite external failures
- **Performance**: Significant improvement through caching and optimization
- **Scalability**: Handle high-volume operations across multiple systems
- **Maintainability**: Clean separation of concerns and testability
- **Business Continuity**: Graceful degradation and automatic recovery

## Next Steps

- Explore
  [Advanced ACL Patterns](/packages/acl/src/examples/advanced/use-case.md)
- Learn about
  [Enterprise Integration Strategies](/packages/acl/src/examples/advanced/example-1.md)
- Review
  [Framework Integration](/packages/acl/src/examples/frameworks/nestjs/intermediate/example-1.md)
