# Intermediate Repository - NestJS Manual Setup

**Focus**: Advanced repository patterns in NestJS with manual instantiation
**Base Example**: [Unit of Work Pattern](../../intermediate/example-1.md)
**Dependencies**: @nestjs/common, @nestjs/typeorm, @vytches-ddd/repositories

## Service Implementation

```typescript
// financial.service.ts
import { Injectable } from '@nestjs/common';
import {
  UnitOfWork,
  BaseRepository,
  SpecificationRegistry,
} from '@vytches-ddd/repositories';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
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

  constructor(@InjectConnection() private connection: Connection) {
    // ⭐ FOCUS: Manual repository setup with advanced features
    this.accountRepository = new BaseRepository<Account>('accounts', {
      connection: this.connection,
      enableOptimisticLocking: true,
      enableAuditing: true,
    });

    this.transactionRepository = new BaseRepository<Transaction>(
      'transactions',
      {
        connection: this.connection,
        enableEventSourcing: true,
        batchSize: 1000,
      }
    );

    this.auditRepository = new BaseRepository<AuditLog>('audit_logs', {
      connection: this.connection,
      enableCompression: true,
    });

    // Initialize specifications
    this.specificationRegistry = new SpecificationRegistry<Account>();
    this.registerAccountSpecifications();
  }

  // ✅ FOCUS: Complex financial transaction with UoW
  async processTransfer(request: TransferRequest): Promise<TransferResult> {
    const uow = new UnitOfWork(this.connection);

    try {
      await uow.begin();

      // Get accounts within transaction
      const fromAccount = await this.accountRepository.findById(
        request.fromAccountId,
        { transaction: uow.getTransaction() }
      );
      const toAccount = await this.accountRepository.findById(
        request.toAccountId,
        { transaction: uow.getTransaction() }
      );

      if (!fromAccount || !toAccount) {
        throw new Error('Account not found');
      }

      // Validate transfer using specifications
      const transferValidation = this.specificationRegistry
        .get('sufficient-balance')!
        .and(this.specificationRegistry.get('account-active')!);

      if (!transferValidation.isSatisfiedBy(fromAccount)) {
        throw new Error('Transfer validation failed');
      }

      // Update account balances
      fromAccount.balance -= request.amount;
      toAccount.balance += request.amount;

      // Save changes within transaction
      await this.accountRepository.save(fromAccount, {
        transaction: uow.getTransaction(),
      });
      await this.accountRepository.save(toAccount, {
        transaction: uow.getTransaction(),
      });

      // Create transaction records
      const transaction = {
        id: generateId(),
        fromAccountId: request.fromAccountId,
        toAccountId: request.toAccountId,
        amount: request.amount,
        type: 'TRANSFER',
        status: 'COMPLETED',
        timestamp: new Date(),
      };

      await this.transactionRepository.save(transaction, {
        transaction: uow.getTransaction(),
      });

      // Create audit log
      await this.auditRepository.save(
        {
          id: generateId(),
          action: 'TRANSFER_PROCESSED',
          userId: request.userId,
          details: {
            fromAccount: fromAccount.id,
            toAccount: toAccount.id,
            amount: request.amount,
          },
          timestamp: new Date(),
        },
        { transaction: uow.getTransaction() }
      );

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

  // ✅ FOCUS: Specification-based querying
  async findAccountsBySpecification(
    specificationName: string,
    additionalCriteria?: any
  ): Promise<Account[]> {
    const specification = this.specificationRegistry.get(specificationName);
    if (!specification) {
      throw new Error(`Specification '${specificationName}' not found`);
    }

    const queryOptions = specification.toQueryOptions();

    // Add additional criteria if provided
    if (additionalCriteria) {
      queryOptions.where = [
        ...(queryOptions.where || []),
        ...additionalCriteria,
      ];
    }

    return await this.accountRepository.find(queryOptions);
  }

  // ✅ FOCUS: Batch operations for high performance
  async processBatchTransactions(
    transactions: TransferRequest[]
  ): Promise<BatchProcessingResult> {
    const uow = new UnitOfWork(this.connection);
    const results: TransferResult[] = [];
    const batchSize = 100;

    try {
      await uow.begin();

      // Process in batches to manage memory and performance
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);

        for (const request of batch) {
          try {
            const result = await this.processTransferInBatch(request, uow);
            results.push(result);
          } catch (error) {
            results.push({
              success: false,
              error: error.message,
              transactionId: null,
            });
          }
        }

        // Periodic flush to manage transaction size
        if (i % (batchSize * 5) === 0) {
          await uow.flush();
        }
      }

      await uow.commit();

      return {
        totalProcessed: transactions.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };
    } catch (error) {
      await uow.rollback();
      throw error;
    }
  }

  // ✅ FOCUS: Advanced querying with multiple specifications
  async generateAccountReport(
    criteria: ReportCriteria
  ): Promise<AccountReport> {
    // Build composite specification
    let specification = this.specificationRegistry.get('account-active')!;

    if (criteria.minBalance) {
      specification = specification.and(
        this.specificationRegistry.get('minimum-balance')!
      );
    }

    if (criteria.accountType) {
      specification = specification.and(
        this.specificationRegistry.get('account-type')!
      );
    }

    const accounts = await this.findAccountsBySpecification(
      'composite-report',
      specification.toQueryOptions().where
    );

    // Generate report metrics
    return {
      totalAccounts: accounts.length,
      totalBalance: accounts.reduce((sum, acc) => sum + acc.balance, 0),
      averageBalance:
        accounts.length > 0
          ? accounts.reduce((sum, acc) => sum + acc.balance, 0) /
            accounts.length
          : 0,
      accountsByType: this.groupAccountsByType(accounts),
      generatedAt: new Date(),
    };
  }

  private registerAccountSpecifications(): void {
    this.specificationRegistry.register(
      'sufficient-balance',
      new AccountSpecification.SufficientBalance()
    );

    this.specificationRegistry.register(
      'account-active',
      new AccountSpecification.AccountActive()
    );

    this.specificationRegistry.register(
      'minimum-balance',
      new AccountSpecification.MinimumBalance()
    );

    this.specificationRegistry.register(
      'account-type',
      new AccountSpecification.AccountType()
    );
  }

  private async processTransferInBatch(
    request: TransferRequest,
    uow: UnitOfWork
  ): Promise<TransferResult> {
    // Simplified batch processing logic
    // Similar to processTransfer but optimized for batch execution
    return {
      success: true,
      transactionId: generateId(),
      fromBalance: 0,
      toBalance: 0,
    };
  }

  private groupAccountsByType(accounts: Account[]): Record<string, number> {
    return accounts.reduce(
      (groups, account) => {
        groups[account.type] = (groups[account.type] || 0) + 1;
        return groups;
      },
      {} as Record<string, number>
    );
  }
}
```

## Module Configuration

```typescript
// financial.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialService } from './financial.service';
import { FinancialController } from './financial.controller';
import { AccountEntity, TransactionEntity, AuditLogEntity } from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      TransactionEntity,
      AuditLogEntity,
    ]),
  ],
  providers: [FinancialService],
  controllers: [FinancialController],
  exports: [FinancialService],
})
export class FinancialModule {}
```

## Controller Integration

```typescript
// financial.controller.ts
import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { TransferRequest, ReportCriteria } from './types';

@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Post('transfer')
  async processTransfer(@Body() request: TransferRequest) {
    return await this.financialService.processTransfer(request);
  }

  @Post('batch-transfer')
  async processBatchTransfers(@Body() requests: TransferRequest[]) {
    return await this.financialService.processBatchTransactions(requests);
  }

  @Get('accounts')
  async findAccounts(@Query('specification') specification: string) {
    return await this.financialService.findAccountsBySpecification(
      specification
    );
  }

  @Get('report')
  async generateReport(@Query() criteria: ReportCriteria) {
    return await this.financialService.generateAccountReport(criteria);
  }
}
```

## Key Points

- Manual setup showcasing advanced repository patterns
- Unit of Work for transaction management across multiple repositories
- Specification Pattern for complex business rule validation
- Batch processing for high-performance scenarios
- All business logic uses @vytches-ddd/repositories capabilities
- Clean integration with NestJS transaction management
- Demonstrates repository coordination without complex DI setup
