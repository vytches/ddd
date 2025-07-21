# Intermediate Repository Implementation Patterns

This document provides comprehensive guidance on implementing advanced repository patterns using the @vytches-ddd/repositories package, focusing on enterprise-grade patterns and sophisticated data access scenarios.

## Advanced Unit of Work Implementation

### Core Unit of Work Architecture

The Unit of Work pattern coordinates multiple repositories within transaction boundaries while maintaining consistency and providing rollback capabilities.

```typescript
import { UnitOfWork, IRepository, TransactionContext } from '@vytches-ddd/repositories';
import { EntityId, DomainEvent } from '@vytches-ddd/domain-primitives';

export abstract class EnterpriseUnitOfWork extends UnitOfWork {
  protected repositories = new Map<string, IRepository<any>>();
  protected domainEvents: DomainEvent[] = [];
  protected transactionContext: TransactionContext;
  
  constructor() {
    super();
    this.transactionContext = this.createTransactionContext();
  }

  // ✅ FOCUS: Repository registration with type safety
  protected registerRepository<T>(name: string, repository: IRepository<T>): void {
    this.repositories.set(name, repository);
    
    // Configure repository for UoW participation
    if (repository.supportsTransactions) {
      repository.setTransactionContext(this.transactionContext);
    }
  }

  // ✅ FOCUS: Advanced transaction management
  async begin(isolationLevel: TransactionIsolationLevel = 'READ_COMMITTED'): Promise<void> {
    try {
      await super.begin();
      
      // Set isolation level
      await this.setIsolationLevel(isolationLevel);
      
      // Initialize transaction tracking
      this.startTransactionTracking();
      
      // Prepare all registered repositories
      for (const [name, repository] of this.repositories) {
        await repository.prepareForTransaction(this.transactionContext);
      }
      
    } catch (error) {
      throw new Error(`Failed to begin transaction: ${error.message}`);
    }
  }

  // ✅ FOCUS: Sophisticated commit process
  async commit(): Promise<void> {
    try {
      // Pre-commit validation
      await this.validatePreCommitConditions();
      
      // Flush all repository changes
      const flushPromises = Array.from(this.repositories.values())
        .map(repo => repo.flush());
      await Promise.all(flushPromises);
      
      // Commit database transaction
      await super.commit();
      
      // Post-commit actions
      await this.executePostCommitActions();
      
      // Publish domain events
      await this.publishDomainEvents();
      
    } catch (error) {
      // Compensate for partial commit failure
      await this.executeCompensationActions();
      throw new Error(`Transaction commit failed: ${error.message}`);
    } finally {
      this.clearTransactionState();
    }
  }

  // ✅ FOCUS: Comprehensive rollback with compensation
  async rollback(): Promise<void> {
    try {
      // Execute compensation logic before rollback
      await this.executeCompensationActions();
      
      // Rollback database changes
      await super.rollback();
      
      // Reset repository states
      for (const repository of this.repositories.values()) {
        await repository.resetState();
      }
      
    } catch (error) {
      console.error('Rollback failed:', error.message);
      // Log critical error but don't throw to prevent masking original error
    } finally {
      this.clearTransactionState();
    }
  }

  // ✅ FOCUS: Savepoint management for nested transactions
  async createSavepoint(name: string): Promise<void> {
    await this.executeSql(`SAVEPOINT ${name}`);
    this.addSavepointToTracking(name);
  }

  async rollbackToSavepoint(name: string): Promise<void> {
    await this.executeSql(`ROLLBACK TO SAVEPOINT ${name}`);
    this.removeSavepointFromTracking(name);
  }

  async releaseSavepoint(name: string): Promise<void> {
    await this.executeSql(`RELEASE SAVEPOINT ${name}`);
    this.removeSavepointFromTracking(name);
  }

  // ✅ FOCUS: Domain event coordination
  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push({
      ...event,
      transactionId: this.transactionContext.transactionId,
      timestamp: new Date()
    });
  }

  protected async publishDomainEvents(): Promise<void> {
    if (this.domainEvents.length === 0) return;
    
    try {
      const eventBus = this.getEventBus();
      await eventBus.publishMany(this.domainEvents);
      
    } catch (error) {
      console.error('Failed to publish domain events:', error.message);
      // Consider if this should cause transaction rollback
    } finally {
      this.domainEvents = [];
    }
  }

  // ✅ FOCUS: Transaction state tracking
  getTransactionStatistics(): TransactionStatistics {
    return {
      transactionId: this.transactionContext.transactionId,
      startTime: this.transactionStartTime,
      duration: Date.now() - this.transactionStartTime.getTime(),
      repositoriesInvolved: Array.from(this.repositories.keys()),
      operationsCount: this.getOperationsCount(),
      domainEventsCount: this.domainEvents.length,
      savepointsUsed: this.getSavepointCount()
    };
  }

  // Abstract methods for subclasses
  protected abstract validatePreCommitConditions(): Promise<void>;
  protected abstract executePostCommitActions(): Promise<void>;
  protected abstract executeCompensationActions(): Promise<void>;
  
  // Private implementation methods
  private createTransactionContext(): TransactionContext {
    return {
      transactionId: EntityId.generate().value,
      correlationId: EntityId.generate().value,
      startTime: new Date(),
      metadata: {}
    };
  }
  
  private startTransactionTracking(): void {
    this.transactionStartTime = new Date();
    this.operationsCount = 0;
    this.savepointStack = [];
  }
  
  private clearTransactionState(): void {
    this.domainEvents = [];
    this.transactionContext = this.createTransactionContext();
  }
}
```

### Unit of Work Factory Pattern

```typescript
export class UnitOfWorkFactory {
  constructor(
    private connectionManager: ConnectionManager,
    private eventBus: IEventBus,
    private logger: ILogger
  ) {}

  createFinancialUoW(): FinancialUnitOfWork {
    const accountRepo = new AccountRepository(this.connectionManager);
    const transactionRepo = new TransactionRepository(this.connectionManager);
    const auditRepo = new AuditLogRepository(this.connectionManager);
    
    return new FinancialUnitOfWork(accountRepo, transactionRepo, auditRepo, {
      eventBus: this.eventBus,
      logger: this.logger,
      timeout: 30000 // 30 seconds
    });
  }

  createInventoryUoW(): InventoryUnitOfWork {
    return new InventoryUnitOfWork(
      new ProductRepository(this.connectionManager),
      new StockLocationRepository(this.connectionManager),
      new ReservationRepository(this.connectionManager)
    );
  }

  createCustomUoW(repositories: { [name: string]: IRepository<any> }): EnterpriseUnitOfWork {
    return new GenericUnitOfWork(repositories, {
      eventBus: this.eventBus,
      logger: this.logger
    });
  }
}
```

---

## Advanced Specification Pattern Implementation

### Specification Composition Engine

```typescript
import { BaseSpecification, CompositeSpecification, QueryOptions } from '@vytches-ddd/repositories';

export abstract class EnterpriseSpecification<T> extends BaseSpecification<T> {
  protected cacheKey?: string;
  protected executionMetrics: SpecificationMetrics;
  
  constructor() {
    super();
    this.executionMetrics = {
      executionCount: 0,
      averageExecutionTime: 0,
      cacheHitRate: 0
    };
  }

  // ✅ FOCUS: Performance-aware specification execution
  async executeWithMetrics(entities: T[]): Promise<{ results: T[]; metrics: SpecificationMetrics }> {
    const startTime = performance.now();
    
    const results = entities.filter(entity => this.isSatisfiedBy(entity));
    
    const executionTime = performance.now() - startTime;
    this.updateMetrics(executionTime);
    
    return {
      results,
      metrics: { ...this.executionMetrics }
    };
  }

  // ✅ FOCUS: Query optimization for database specifications
  toOptimizedQueryOptions(): QueryOptions {
    const baseOptions = this.toQueryOptions();
    
    return {
      ...baseOptions,
      // Add database-specific optimizations
      hints: this.getDatabaseHints(),
      indexes: this.getPreferredIndexes(),
      // Add query caching instructions
      cacheStrategy: this.getCacheStrategy()
    };
  }

  // ✅ FOCUS: Specification caching
  getCacheKey(): string {
    if (!this.cacheKey) {
      this.cacheKey = this.generateCacheKey();
    }
    return this.cacheKey;
  }

  // Template methods for subclasses
  protected abstract generateCacheKey(): string;
  protected getDatabaseHints(): string[] { return []; }
  protected getPreferredIndexes(): string[] { return []; }
  protected getCacheStrategy(): CacheStrategy { return 'default'; }

  private updateMetrics(executionTime: number): void {
    this.executionMetrics.executionCount++;
    
    const total = this.executionMetrics.averageExecutionTime * 
                  (this.executionMetrics.executionCount - 1);
    this.executionMetrics.averageExecutionTime = 
      (total + executionTime) / this.executionMetrics.executionCount;
  }
}

// ✅ FOCUS: Specification builder for complex business rules
export class SpecificationBuilder<T> {
  private specifications: BaseSpecification<T>[] = [];
  private logicalOperators: LogicalOperator[] = [];
  
  where(specification: BaseSpecification<T>): SpecificationBuilder<T> {
    this.specifications.push(specification);
    return this;
  }
  
  and(specification: BaseSpecification<T>): SpecificationBuilder<T> {
    if (this.specifications.length > 0) {
      this.logicalOperators.push('AND');
    }
    this.specifications.push(specification);
    return this;
  }
  
  or(specification: BaseSpecification<T>): SpecificationBuilder<T> {
    if (this.specifications.length > 0) {
      this.logicalOperators.push('OR');
    }
    this.specifications.push(specification);
    return this;
  }
  
  not(): SpecificationBuilder<T> {
    if (this.specifications.length > 0) {
      const lastSpec = this.specifications.pop()!;
      this.specifications.push(lastSpec.not());
    }
    return this;
  }
  
  build(): CompositeSpecification<T> {
    if (this.specifications.length === 0) {
      throw new Error('Specification builder requires at least one specification');
    }
    
    if (this.specifications.length === 1) {
      return this.specifications[0] as CompositeSpecification<T>;
    }
    
    return this.buildCompositeSpecification();
  }
  
  private buildCompositeSpecification(): CompositeSpecification<T> {
    let result = this.specifications[0];
    
    for (let i = 1; i < this.specifications.length; i++) {
      const operator = this.logicalOperators[i - 1];
      const nextSpec = this.specifications[i];
      
      if (operator === 'AND') {
        result = result.and(nextSpec);
      } else if (operator === 'OR') {
        result = result.or(nextSpec);
      }
    }
    
    return result as CompositeSpecification<T>;
  }
}
```

### Specification Registry and Management

```typescript
export class SpecificationRegistry<T> {
  private specifications = new Map<string, BaseSpecification<T>>();
  private specificationCache = new Map<string, { spec: BaseSpecification<T>; timestamp: number }>();
  
  register(name: string, specification: BaseSpecification<T>): void {
    this.specifications.set(name, specification);
  }
  
  get(name: string): BaseSpecification<T> | undefined {
    return this.specifications.get(name);
  }
  
  // ✅ FOCUS: Dynamic specification composition
  compose(specificationNames: string[], operator: 'AND' | 'OR' = 'AND'): CompositeSpecification<T> {
    const specs = specificationNames
      .map(name => this.get(name))
      .filter(spec => spec !== undefined) as BaseSpecification<T>[];
    
    if (specs.length === 0) {
      throw new Error('No valid specifications found for composition');
    }
    
    return operator === 'AND' 
      ? specs.reduce((acc, spec) => acc.and(spec))
      : specs.reduce((acc, spec) => acc.or(spec));
  }
  
  // ✅ FOCUS: Specification caching with TTL
  getCached(name: string, ttl: number = 300000): BaseSpecification<T> | undefined {
    const cached = this.specificationCache.get(name);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.spec;
    }
    
    const fresh = this.get(name);
    if (fresh) {
      this.specificationCache.set(name, { spec: fresh, timestamp: Date.now() });
    }
    
    return fresh;
  }
}
```

---

## Multi-Tenant Repository Advanced Implementation

### Tenant Context Management

```typescript
export class TenantContextManager {
  private static instance: TenantContextManager;
  private currentContext: TenantContext | null = null;
  private contextStack: TenantContext[] = [];
  
  static getInstance(): TenantContextManager {
    if (!TenantContextManager.instance) {
      TenantContextManager.instance = new TenantContextManager();
    }
    return TenantContextManager.instance;
  }
  
  // ✅ FOCUS: Context switching with stack management
  setContext(context: TenantContext): void {
    if (this.currentContext) {
      this.contextStack.push(this.currentContext);
    }
    this.currentContext = context;
  }
  
  getCurrentContext(): TenantContext | null {
    return this.currentContext;
  }
  
  restorePreviousContext(): TenantContext | null {
    if (this.contextStack.length > 0) {
      this.currentContext = this.contextStack.pop()!;
    } else {
      this.currentContext = null;
    }
    return this.currentContext;
  }
  
  // ✅ FOCUS: Context validation
  validateContext(context: TenantContext): void {
    if (!context.tenantId) {
      throw new Error('Tenant ID is required');
    }
    
    if (!this.isValidTenant(context.tenantId)) {
      throw new Error(`Invalid tenant: ${context.tenantId}`);
    }
    
    if (context.isolationLevel && !this.isValidIsolationLevel(context.isolationLevel)) {
      throw new Error(`Invalid isolation level: ${context.isolationLevel}`);
    }
  }
  
  private isValidTenant(tenantId: string): boolean {
    // Implementation would check against tenant registry
    return tenantId.length > 0;
  }
  
  private isValidIsolationLevel(level: TenantIsolationLevel): boolean {
    return ['SHARED', 'ISOLATED', 'DEDICATED'].includes(level);
  }
}
```

### Advanced Multi-Tenant Repository

```typescript
export class AdvancedMultiTenantRepository<T extends { tenantId: string }> 
  extends MultiTenantRepository<T> {
  
  constructor(
    tableName: string,
    private tenantConfig: MultiTenantConfiguration,
    private tenantContextManager: TenantContextManager,
    private auditService: IAuditService
  ) {
    super(tableName, tenantConfig);
  }

  // ✅ FOCUS: Tenant-aware query execution with automatic context injection
  async find(queryOptions: QueryOptions, tenantContext?: TenantContext): Promise<T[]> {
    const effectiveContext = tenantContext || this.tenantContextManager.getCurrentContext();
    
    if (!effectiveContext) {
      throw new Error('No tenant context available');
    }

    // Add tenant filtering
    const tenantAwareOptions = this.addTenantFiltering(queryOptions, effectiveContext);
    
    // Execute query with tenant context
    const startTime = Date.now();
    const results = await super.find(tenantAwareOptions, effectiveContext);
    const duration = Date.now() - startTime;
    
    // Audit tenant data access
    await this.auditDataAccess(effectiveContext, 'READ', results.length, duration);
    
    return results;
  }

  // ✅ FOCUS: Cross-tenant operation with permission validation
  async findAcrossTenantsWithPermission(
    queryOptions: QueryOptions,
    adminContext: TenantContext,
    targetTenantIds: string[]
  ): Promise<{ tenantId: string; data: T[] }[]> {
    
    // Validate cross-tenant permissions
    await this.validateCrossTenantPermissions(adminContext, targetTenantIds);
    
    const results: { tenantId: string; data: T[] }[] = [];
    
    for (const tenantId of targetTenantIds) {
      const tenantContext = { ...adminContext, tenantId };
      const tenantData = await this.find(queryOptions, tenantContext);
      
      results.push({ tenantId, data: tenantData });
    }
    
    return results;
  }

  // ✅ FOCUS: Tenant data migration with validation
  async migrateTenantData(
    sourceContext: TenantContext,
    targetContext: TenantContext,
    migrationOptions: TenantMigrationOptions
  ): Promise<TenantMigrationResult> {
    
    const migration = new TenantDataMigration(this, migrationOptions);
    
    try {
      // Validate migration prerequisites
      await migration.validateMigration(sourceContext, targetContext);
      
      // Execute migration
      const result = await migration.executeMigration(sourceContext, targetContext);
      
      // Audit migration
      await this.auditTenantMigration(sourceContext, targetContext, result);
      
      return result;
      
    } catch (error) {
      await this.auditMigrationFailure(sourceContext, targetContext, error);
      throw error;
    }
  }

  // ✅ FOCUS: Tenant-specific performance monitoring
  async getTenantPerformanceMetrics(
    tenantContext: TenantContext,
    timeRange: DateRange
  ): Promise<TenantPerformanceMetrics> {
    
    const metrics = await this.performanceMonitor.getTenantMetrics(
      tenantContext.tenantId,
      timeRange
    );
    
    return {
      tenantId: tenantContext.tenantId,
      queryCount: metrics.queryCount,
      averageQueryTime: metrics.averageQueryTime,
      slowQueryCount: metrics.slowQueryCount,
      cacheHitRate: metrics.cacheHitRate,
      dataVolume: metrics.dataVolume,
      timeRange
    };
  }

  // ✅ FOCUS: Tenant data archival
  async archiveTenantData(
    tenantContext: TenantContext,
    archivalCriteria: ArchivalCriteria
  ): Promise<ArchivalResult> {
    
    const archival = new TenantDataArchival(this, archivalCriteria);
    
    // Identify data for archival
    const dataToArchive = await archival.identifyArchivalCandidates(tenantContext);
    
    if (dataToArchive.length === 0) {
      return { success: true, archivedCount: 0, message: 'No data meets archival criteria' };
    }
    
    // Execute archival process
    return await archival.executeArchival(tenantContext, dataToArchive);
  }

  // Private helper methods
  private addTenantFiltering(
    options: QueryOptions, 
    context: TenantContext
  ): QueryOptions {
    const tenantFilter = { 
      field: this.tenantConfig.tenantIdField, 
      operator: 'eq', 
      value: context.tenantId 
    };
    
    return {
      ...options,
      where: [tenantFilter, ...(options.where || [])]
    };
  }
  
  private async validateCrossTenantPermissions(
    context: TenantContext,
    tenantIds: string[]
  ): Promise<void> {
    if (!context.userRoles?.includes('system_admin')) {
      throw new Error('Cross-tenant operations require system admin privileges');
    }
    
    // Additional validation logic...
  }
  
  private async auditDataAccess(
    context: TenantContext,
    operation: string,
    recordCount: number,
    duration: number
  ): Promise<void> {
    if (this.tenantConfig.enableAuditing) {
      await this.auditService.logDataAccess({
        tenantId: context.tenantId,
        userId: context.userId,
        operation,
        tableName: this.tableName,
        recordCount,
        duration,
        timestamp: new Date()
      });
    }
  }
}
```

---

## Performance Optimization Strategies

### Query Optimization

```typescript
export class RepositoryQueryOptimizer {
  constructor(
    private databaseAnalyzer: DatabaseAnalyzer,
    private queryCache: IQueryCache
  ) {}

  // ✅ FOCUS: Specification query optimization
  async optimizeSpecificationQuery<T>(
    specification: BaseSpecification<T>,
    repository: IRepository<T>
  ): Promise<QueryOptions> {
    
    const baseQuery = specification.toQueryOptions();
    
    // Analyze query performance
    const analysis = await this.databaseAnalyzer.analyzeQuery(baseQuery);
    
    // Apply optimizations based on analysis
    let optimizedQuery = baseQuery;
    
    if (analysis.needsIndexOptimization) {
      optimizedQuery = this.addIndexHints(optimizedQuery);
    }
    
    if (analysis.isComplexJoin) {
      optimizedQuery = this.optimizeJoinOrder(optimizedQuery);
    }
    
    if (analysis.isCacheable) {
      await this.queryCache.set(specification.getCacheKey(), optimizedQuery);
    }
    
    return optimizedQuery;
  }
  
  private addIndexHints(query: QueryOptions): QueryOptions {
    // Add database-specific index hints
    return {
      ...query,
      hints: ['USE INDEX (idx_tenant_id_created_at)', 'FORCE INDEX (idx_status)']
    };
  }
  
  private optimizeJoinOrder(query: QueryOptions): QueryOptions {
    // Optimize join order based on table statistics
    return query; // Simplified implementation
  }
}
```

### Connection Pool Management

```typescript
export class AdvancedConnectionManager {
  private connectionPools = new Map<string, ConnectionPool>();
  
  constructor(private config: DatabaseConfiguration) {}
  
  // ✅ FOCUS: Tenant-specific connection pooling
  async getConnectionForTenant(tenantId: string): Promise<DatabaseConnection> {
    let pool = this.connectionPools.get(tenantId);
    
    if (!pool) {
      const tenantConfig = await this.getTenantDatabaseConfig(tenantId);
      pool = this.createConnectionPool(tenantConfig);
      this.connectionPools.set(tenantId, pool);
    }
    
    return await pool.acquire();
  }
  
  // ✅ FOCUS: Performance monitoring and scaling
  async monitorAndScale(): Promise<void> {
    for (const [tenantId, pool] of this.connectionPools) {
      const metrics = pool.getMetrics();
      
      if (metrics.utilizationRate > 0.8) {
        await this.scaleUpPool(tenantId, pool);
      } else if (metrics.utilizationRate < 0.2) {
        await this.scaleDownPool(tenantId, pool);
      }
    }
  }
  
  private async getTenantDatabaseConfig(tenantId: string): Promise<DatabaseConfiguration> {
    // Retrieve tenant-specific database configuration
    return { ...this.config, database: `tenant_${tenantId}` };
  }
}
```

These intermediate implementation patterns provide the foundation for building robust, scalable, and maintainable repository layers that can handle complex enterprise scenarios while maintaining performance and data integrity.