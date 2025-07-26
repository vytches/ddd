# Intermediate Repository - NestJS DI Integration

**Focus**: Advanced repository patterns with @vytches/ddd-di integration **Base
Example**: [Unit of Work Pattern](../../intermediate/example-1.md)
**Dependencies**: @nestjs/common, @nestjs/typeorm, @vytches/ddd-repositories,
@vytches/ddd-di

## Service Implementation

```typescript
// financial.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import {
  UnitOfWork,
  BaseRepository,
  SpecificationRegistry,
} from '@vytches/ddd-repositories';
import {
  Account,
  Transaction,
  AuditLog,
  TransferRequest,
  AccountSpecification,
} from './types'; // From your app

@Injectable()
export class FinancialService {
  private readonly accountRepository: BaseRepository<Account>;
  private readonly transactionRepository: BaseRepository<Transaction>;
  private readonly auditRepository: BaseRepository<AuditLog>;
  private readonly specificationRegistry: SpecificationRegistry<Account>;
  private readonly unitOfWorkFactory: UnitOfWorkFactory;

  constructor() {
    // ⭐ FOCUS: @vytches/ddd-di integration for advanced scenarios
    this.accountRepository =
      VytchesDDD.resolve<BaseRepository<Account>>('accountRepository');
    this.transactionRepository = VytchesDDD.resolve<
      BaseRepository<Transaction>
    >('transactionRepository');
    this.auditRepository =
      VytchesDDD.resolve<BaseRepository<AuditLog>>('auditRepository');
    this.specificationRegistry = VytchesDDD.resolve<
      SpecificationRegistry<Account>
    >('accountSpecificationRegistry');
    this.unitOfWorkFactory =
      VytchesDDD.resolve<UnitOfWorkFactory>('unitOfWorkFactory');
  }

  // ✅ FOCUS: Complex financial transaction with DI-managed UoW
  async processTransfer(request: TransferRequest): Promise<TransferResult> {
    const uow = this.unitOfWorkFactory.createFinancialUoW();

    try {
      await uow.begin();

      // All repositories are pre-configured through DI
      const fromAccount = await this.accountRepository.findById(
        request.fromAccountId
      );
      const toAccount = await this.accountRepository.findById(
        request.toAccountId
      );

      if (!fromAccount || !toAccount) {
        throw new Error('Account not found');
      }

      // Use DI-managed specifications
      const transferValidation = this.specificationRegistry.compose(
        ['sufficient-balance', 'account-active'],
        'AND'
      );

      if (!transferValidation.isSatisfiedBy(fromAccount)) {
        throw new Error('Transfer validation failed');
      }

      // Update balances
      fromAccount.balance -= request.amount;
      toAccount.balance += request.amount;

      // UoW automatically coordinates all repository saves
      await uow.registerDirty(this.accountRepository, fromAccount);
      await uow.registerDirty(this.accountRepository, toAccount);

      // Transaction record
      const transaction = {
        id: generateId(),
        fromAccountId: request.fromAccountId,
        toAccountId: request.toAccountId,
        amount: request.amount,
        type: 'TRANSFER',
        status: 'COMPLETED',
        timestamp: new Date(),
      };

      await uow.registerNew(this.transactionRepository, transaction);

      // Audit log
      await uow.registerNew(this.auditRepository, {
        id: generateId(),
        action: 'TRANSFER_PROCESSED',
        userId: request.userId,
        details: {
          fromAccount: fromAccount.id,
          toAccount: toAccount.id,
          amount: request.amount,
        },
        timestamp: new Date(),
      });

      await uow.commit();

      return {
        success: true,
        transactionId: transaction.id,
        fromBalance: fromAccount.balance,
        toBalance: toAccount.balance,
      };
    } catch (error) {
      await uow.rollback();
      throw error;
    }
  }

  // ✅ FOCUS: DI-managed specification composition
  async findAccountsByDynamicCriteria(
    criteria: AccountSearchCriteria
  ): Promise<Account[]> {
    const specificationNames: string[] = ['account-active']; // Base requirement

    // Build specification list based on criteria
    if (criteria.minBalance !== undefined) {
      specificationNames.push('minimum-balance');
    }

    if (criteria.accountType) {
      specificationNames.push('account-type');
    }

    if (criteria.hasRecentActivity) {
      specificationNames.push('recent-activity');
    }

    // Compose specifications through DI-managed registry
    const compositeSpec = this.specificationRegistry.compose(
      specificationNames,
      criteria.operator || 'AND'
    );

    const queryOptions = compositeSpec.toOptimizedQueryOptions();
    return await this.accountRepository.find(queryOptions);
  }

  // ✅ FOCUS: Enterprise batch processing with DI coordination
  async processEnterpriseTransferBatch(
    requests: TransferRequest[]
  ): Promise<BatchProcessingResult> {
    // Get enterprise-grade UoW from DI container
    const enterpriseUoW = this.unitOfWorkFactory.createEnterpriseUoW({
      enableMetrics: true,
      enableAuditing: true,
      maxBatchSize: 1000,
      enableParallelProcessing: true,
    });

    try {
      await enterpriseUoW.begin();

      const processor = VytchesDDD.resolve<BatchTransactionProcessor>(
        'batchTransactionProcessor'
      );

      // Process with enterprise features
      const result = await processor.processBatch(requests, {
        uow: enterpriseUoW,
        enableValidation: true,
        enableFraudDetection: true,
        parallelism: 10,
      });

      // Enterprise UoW automatically handles metrics and auditing
      await enterpriseUoW.commit();

      return result;
    } catch (error) {
      await enterpriseUoW.rollback();
      throw error;
    }
  }

  // ✅ FOCUS: AI-enhanced financial analysis
  async generateIntelligentAccountInsights(
    accountId: string
  ): Promise<AccountInsights> {
    const aiAnalyzer = VytchesDDD.resolve<AIFinancialAnalyzer>(
      'aiFinancialAnalyzer'
    );

    // Get account data
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    // Get transaction history
    const transactions = await this.transactionRepository.find({
      where: [
        { field: 'fromAccountId', operator: 'eq', value: accountId },
        { field: 'toAccountId', operator: 'eq', value: accountId },
      ],
      orderBy: [{ field: 'timestamp', direction: 'DESC' }],
      limit: 1000,
    });

    // AI analysis through DI
    const insights = await aiAnalyzer.analyzeAccountBehavior({
      account,
      transactions,
      analysisTypes: [
        'spending_patterns',
        'risk_assessment',
        'fraud_detection',
        'cash_flow_prediction',
      ],
    });

    return insights;
  }

  // ✅ FOCUS: Multi-tenant financial operations
  async processMultiTenantOperation(
    request: MultiTenantRequest
  ): Promise<MultiTenantResult> {
    // Get tenant-aware repositories from DI
    const tenantRepo = VytchesDDD.resolve<BaseRepository<Account>>(
      'tenantAccountRepository',
      request.tenantContext
    );

    const tenantUoW = this.unitOfWorkFactory.createTenantUoW(
      request.tenantContext
    );

    try {
      await tenantUoW.begin();

      // All operations automatically scoped to tenant
      const results = await this.processTenantSpecificLogic(
        request,
        tenantRepo
      );

      await tenantUoW.commit();
      return results;
    } catch (error) {
      await tenantUoW.rollback();
      throw error;
    }
  }

  private async processTenantSpecificLogic(
    request: MultiTenantRequest,
    repository: BaseRepository<Account>
  ): Promise<MultiTenantResult> {
    // Implementation would use tenant-scoped repository
    return {
      success: true,
      tenantId: request.tenantContext,
      processedCount: 1,
    };
  }
}
```

## DI Configuration Setup

```typescript
// financial-di.setup.ts
import { VytchesDDD, DomainService } from '@vytches/ddd-di';
import {
  BaseRepository,
  SpecificationRegistry,
  UnitOfWorkFactory,
} from '@vytches/ddd-repositories';

// Repository configurations with DI
@DomainService('accountRepository')
export class AccountRepositoryConfig {
  static create(): BaseRepository<Account> {
    return new BaseRepository<Account>('accounts', {
      enableOptimisticLocking: true,
      enableCaching: true,
      cacheTTL: 300000,
      enableAuditing: true,
      enableMetrics: true,
    });
  }
}

@DomainService('transactionRepository')
export class TransactionRepositoryConfig {
  static create(): BaseRepository<Transaction> {
    return new BaseRepository<Transaction>('transactions', {
      enableEventSourcing: true,
      enableBatching: true,
      batchSize: 1000,
      enableCompression: true,
    });
  }
}

@DomainService('auditRepository')
export class AuditRepositoryConfig {
  static create(): BaseRepository<AuditLog> {
    return new BaseRepository<AuditLog>('audit_logs', {
      enableCompression: true,
      enableArchiving: true,
      retentionPeriod: 2555, // 7 years in days
    });
  }
}

// Specification registry with DI
@DomainService('accountSpecificationRegistry')
export class AccountSpecificationRegistryConfig {
  static create(): SpecificationRegistry<Account> {
    const registry = new SpecificationRegistry<Account>();

    // Pre-register all specifications
    registry.register(
      'sufficient-balance',
      new AccountSpecification.SufficientBalance()
    );
    registry.register(
      'account-active',
      new AccountSpecification.AccountActive()
    );
    registry.register(
      'minimum-balance',
      new AccountSpecification.MinimumBalance()
    );
    registry.register('account-type', new AccountSpecification.AccountType());
    registry.register(
      'recent-activity',
      new AccountSpecification.RecentActivity()
    );

    return registry;
  }
}

// Unit of Work factory with DI
@DomainService('unitOfWorkFactory')
export class UnitOfWorkFactoryConfig {
  static create(): UnitOfWorkFactory {
    return new UnitOfWorkFactory({
      enableMetrics: true,
      enableAuditing: true,
      defaultTimeout: 30000,
      enableDistributedTransactions: true,
    });
  }
}

// AI analyzer with DI
@DomainService('aiFinancialAnalyzer')
export class AIFinancialAnalyzerConfig {
  static create(): AIFinancialAnalyzer {
    return new AIFinancialAnalyzer({
      modelEndpoint: process.env.AI_MODEL_ENDPOINT,
      enableCaching: true,
      confidenceThreshold: 0.8,
    });
  }
}

// Batch processor with DI
@DomainService('batchTransactionProcessor')
export class BatchTransactionProcessorConfig {
  static create(): BatchTransactionProcessor {
    return new BatchTransactionProcessor({
      maxBatchSize: 1000,
      enableParallelProcessing: true,
      enableValidation: true,
      enableFraudDetection: true,
    });
  }
}
```

## Module Configuration

```typescript
// financial.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { FinancialService } from './financial.service';
import { FinancialController } from './financial.controller';

@Module({
  providers: [FinancialService],
  controllers: [FinancialController],
  exports: [FinancialService],
})
export class FinancialModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD BEFORE framework DI
    await VytchesDDD.configure();
  }
}
```

## Key Points

- Advanced @vytches/ddd-di integration for enterprise scenarios
- Service locator pattern for sophisticated repository coordination
- Enterprise-grade Unit of Work with DI-managed dependencies
- AI integration through DI container for intelligent analysis
- Multi-tenant support with context-aware dependency resolution
- Specification composition through DI-managed registry
- Clean separation between business logic and DI infrastructure
- Pre-configured components for consistent behavior across application
