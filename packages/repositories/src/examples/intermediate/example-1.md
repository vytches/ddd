# Unit of Work Pattern - Transaction Management

**Version**: 1.0.0
**Package**: @vytches-ddd/repositories
**Complexity**: intermediate
**Domain**: financial-transactions
**Patterns**: unit-of-work, transaction-management, multi-repository-coordination
**Dependencies**: @vytches-ddd/repositories, @vytches-ddd/domain-primitives

## Description
Advanced transaction management using the Unit of Work pattern to coordinate multiple repositories within a single transaction boundary. Demonstrates cross-aggregate consistency, rollback scenarios, and transaction isolation.

## Business Context
Financial system requiring atomic operations across multiple entities (accounts, transactions, audit logs). Ensures data consistency when multiple repositories need to participate in a single business transaction.

## Code Example

```typescript
// financial-unit-of-work.ts
import { UnitOfWork, IRepository } from '@vytches-ddd/repositories';
import { EntityId } from '@vytches-ddd/domain-primitives';
import { 
  Account, 
  Transaction, 
  AuditLog, 
  TransferRequest,
  TransactionResult,
  TransactionContext
} from './types'; // From your application

// ✅ FOCUS: Unit of Work coordinating multiple repositories
export class FinancialUnitOfWork extends UnitOfWork {
  constructor(
    private accountRepo: IRepository<Account>,
    private transactionRepo: IRepository<Transaction>,
    private auditRepo: IRepository<AuditLog>
  ) {
    super();
    
    // Register repositories with UoW
    this.registerRepository('accounts', accountRepo);
    this.registerRepository('transactions', transactionRepo);
    this.registerRepository('audits', auditRepo);
  }

  // ✅ FOCUS: Complex business transaction with multiple operations
  async processMoneyTransfer(transferRequest: TransferRequest): Promise<TransactionResult> {
    // Start transaction context
    const transactionId = EntityId.generate().value;
    const context = this.createTransactionContext(transferRequest.userId, transactionId);
    
    try {
      // ✅ FOCUS: Begin UoW transaction
      await this.begin();
      
      // 1. Load and validate accounts
      const sourceAccount = await this.accountRepo.findById(
        EntityId.fromString(transferRequest.sourceAccountId)
      );
      const targetAccount = await this.accountRepo.findById(
        EntityId.fromString(transferRequest.targetAccountId)
      );
      
      if (!sourceAccount || !targetAccount) {
        throw new Error('One or more accounts not found');
      }
      
      // 2. Validate business rules
      await this.validateTransfer(sourceAccount, targetAccount, transferRequest);
      
      // 3. Create debit transaction
      const debitTransaction = await this.createDebitTransaction(
        sourceAccount,
        transferRequest,
        context
      );
      
      // 4. Create credit transaction
      const creditTransaction = await this.createCreditTransaction(
        targetAccount,
        transferRequest,
        context
      );
      
      // 5. Update account balances
      const updatedSourceAccount = await this.updateAccountBalance(
        sourceAccount,
        -transferRequest.amount,
        context
      );
      const updatedTargetAccount = await this.updateAccountBalance(
        targetAccount,
        transferRequest.amount,
        context
      );
      
      // 6. Create audit logs
      await this.createTransferAuditLogs(
        transferRequest,
        debitTransaction,
        creditTransaction,
        context
      );
      
      // ✅ FOCUS: Commit all changes atomically
      await this.commit();
      
      return {
        success: true,
        transactionId,
        debitTransactionId: debitTransaction.id,
        creditTransactionId: creditTransaction.id,
        sourceAccountBalance: updatedSourceAccount.balance,
        targetAccountBalance: updatedTargetAccount.balance,
        processedAt: new Date()
      };
      
    } catch (error) {
      // ✅ FOCUS: Rollback on any error
      await this.rollback();
      
      // Create error audit log outside transaction
      await this.createErrorAuditLog(transferRequest, error.message, context);
      
      return {
        success: false,
        error: error.message,
        transactionId,
        processedAt: new Date()
      };
    }
  }

  // ✅ FOCUS: Multi-account batch operations
  async processBatchPayments(payments: TransferRequest[]): Promise<TransactionResult[]> {
    const results: TransactionResult[] = [];
    const batchId = EntityId.generate().value;
    
    try {
      await this.begin();
      
      // Process each payment within the same transaction
      for (const payment of payments) {
        try {
          const result = await this.processIndividualPayment(payment, batchId);
          results.push(result);
          
          // If any payment fails, rollback entire batch
          if (!result.success) {
            throw new Error(`Payment failed: ${result.error}`);
          }
          
        } catch (error) {
          throw new Error(`Batch processing failed at payment ${payment.id}: ${error.message}`);
        }
      }
      
      // ✅ FOCUS: All payments successful - commit batch
      await this.commit();
      
      // Log successful batch completion
      await this.createBatchAuditLog(batchId, payments.length, true);
      
      return results;
      
    } catch (error) {
      await this.rollback();
      
      // Log failed batch
      await this.createBatchAuditLog(batchId, payments.length, false, error.message);
      
      // Return error results for all payments
      return payments.map(payment => ({
        success: false,
        error: `Batch failed: ${error.message}`,
        transactionId: payment.id,
        processedAt: new Date()
      }));
    }
  }

  // ✅ FOCUS: Account closure with cleanup operations
  async closeAccount(accountId: string, reason: string, userId: string): Promise<boolean> {
    try {
      await this.begin();
      
      // 1. Load account with pending transactions
      const account = await this.accountRepo.findById(EntityId.fromString(accountId));
      if (!account) {
        throw new Error('Account not found');
      }
      
      // 2. Check for pending transactions
      const pendingTransactions = await this.transactionRepo.find({
        where: [
          { field: 'accountId', operator: 'eq', value: accountId },
          { field: 'status', operator: 'eq', value: 'pending', logical: 'AND' }
        ]
      });
      
      if (pendingTransactions.length > 0) {
        throw new Error('Cannot close account with pending transactions');
      }
      
      // 3. Zero out account balance if not zero
      if (account.balance !== 0) {
        const zeroingTransaction = {
          id: EntityId.generate().value,
          accountId: account.id,
          type: account.balance > 0 ? 'debit' : 'credit',
          amount: Math.abs(account.balance),
          description: `Account closure balance adjustment: ${reason}`,
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1
        } as Transaction;
        
        await this.transactionRepo.create(zeroingTransaction);
        
        // Update account balance to zero
        await this.accountRepo.update(EntityId.fromString(accountId), {
          balance: 0,
          updatedAt: new Date()
        });
      }
      
      // 4. Mark account as closed
      await this.accountRepo.update(EntityId.fromString(accountId), {
        status: 'closed',
        closedAt: new Date(),
        closureReason: reason,
        closedBy: userId,
        isActive: false,
        updatedAt: new Date()
      });
      
      // 5. Create closure audit log
      await this.auditRepo.create({
        id: EntityId.generate().value,
        entityType: 'Account',
        entityId: accountId,
        action: 'ARCHIVE',
        userId,
        changes: [
          { field: 'status', oldValue: account.status, newValue: 'closed', changeType: 'UPDATE' },
          { field: 'closureReason', oldValue: null, newValue: reason, changeType: 'ADD' }
        ],
        metadata: {
          source: 'account-closure-process',
          reason,
          finalBalance: account.balance
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      });
      
      await this.commit();
      return true;
      
    } catch (error) {
      await this.rollback();
      console.error('Account closure failed:', error.message);
      return false;
    }
  }

  // ✅ FOCUS: Transaction savepoints for nested operations
  async processComplexTransaction(operations: any[]): Promise<any> {
    try {
      await this.begin();
      
      const results = [];
      let savepointCount = 0;
      
      for (const operation of operations) {
        const savepointName = `sp_${++savepointCount}`;
        
        try {
          // ✅ FOCUS: Create savepoint for nested transaction
          await this.createSavepoint(savepointName);
          
          // Process individual operation
          const result = await this.processOperation(operation);
          results.push(result);
          
          // Release savepoint on success
          await this.releaseSavepoint(savepointName);
          
        } catch (operationError) {
          // ✅ FOCUS: Rollback to savepoint on operation failure
          await this.rollbackToSavepoint(savepointName);
          
          // Decide whether to continue or fail entire transaction
          if (operation.critical) {
            throw operationError;
          } else {
            results.push({ error: operationError.message, skipped: true });
          }
        }
      }
      
      await this.commit();
      return { success: true, results };
      
    } catch (error) {
      await this.rollback();
      return { success: false, error: error.message };
    }
  }

  // ✅ FOCUS: Repository coordination methods
  async getModifiedEntities(): Promise<{ [repositoryName: string]: any[] }> {
    const modifiedEntities = {};
    
    for (const [name, repository] of this.repositories) {
      const modifications = await this.getRepositoryModifications(name);
      if (modifications.length > 0) {
        modifiedEntities[name] = modifications;
      }
    }
    
    return modifiedEntities;
  }

  async getTransactionStatistics(): Promise<any> {
    return {
      transactionId: this.getCurrentTransactionId(),
      startTime: this.getTransactionStartTime(),
      repositoriesInvolved: Array.from(this.repositories.keys()),
      operationsCount: await this.getOperationsCount(),
      modifiedEntitiesCount: await this.getTotalModifiedEntitiesCount()
    };
  }

  // Private helper methods
  private async validateTransfer(
    sourceAccount: Account,
    targetAccount: Account,
    request: TransferRequest
  ): Promise<void> {
    if (sourceAccount.balance < request.amount) {
      throw new Error('Insufficient funds');
    }
    
    if (!sourceAccount.isActive || !targetAccount.isActive) {
      throw new Error('One or more accounts are inactive');
    }
    
    if (sourceAccount.id === targetAccount.id) {
      throw new Error('Cannot transfer to the same account');
    }
  }

  private async createDebitTransaction(
    account: Account,
    request: TransferRequest,
    context: TransactionContext
  ): Promise<Transaction> {
    const transaction: Transaction = {
      id: EntityId.generate().value,
      accountId: account.id,
      type: 'debit',
      amount: request.amount,
      description: request.description || 'Money transfer - debit',
      status: 'completed',
      relatedTransactionId: null, // Will be set after credit transaction creation
      metadata: {
        transferId: context.transactionId,
        targetAccountId: request.targetAccountId,
        initiatedBy: context.userId
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };

    return await this.transactionRepo.create(transaction);
  }

  private async createCreditTransaction(
    account: Account,
    request: TransferRequest,
    context: TransactionContext
  ): Promise<Transaction> {
    const transaction: Transaction = {
      id: EntityId.generate().value,
      accountId: account.id,
      type: 'credit',
      amount: request.amount,
      description: request.description || 'Money transfer - credit',
      status: 'completed',
      relatedTransactionId: null, // Will be linked to debit transaction
      metadata: {
        transferId: context.transactionId,
        sourceAccountId: request.sourceAccountId,
        initiatedBy: context.userId
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };

    return await this.transactionRepo.create(transaction);
  }

  private async updateAccountBalance(
    account: Account,
    amount: number,
    context: TransactionContext
  ): Promise<Account> {
    const newBalance = account.balance + amount;
    
    const updated = await this.accountRepo.update(EntityId.fromString(account.id), {
      balance: newBalance,
      lastTransactionAt: new Date(),
      updatedAt: new Date()
    });

    if (!updated) {
      throw new Error(`Failed to update account balance: ${account.id}`);
    }

    return updated;
  }

  private createTransactionContext(userId?: string, transactionId?: string): TransactionContext {
    return {
      transactionId: transactionId || EntityId.generate().value,
      userId,
      sessionId: `session_${Date.now()}`,
      correlationId: `corr_${Date.now()}`,
      metadata: {
        source: 'financial-uow',
        timestamp: new Date().toISOString()
      }
    };
  }

  private async createTransferAuditLogs(
    request: TransferRequest,
    debitTx: Transaction,
    creditTx: Transaction,
    context: TransactionContext
  ): Promise<void> {
    // Create audit logs for both accounts
    await Promise.all([
      this.auditRepo.create({
        id: EntityId.generate().value,
        entityType: 'Account',
        entityId: request.sourceAccountId,
        action: 'UPDATE',
        userId: context.userId || 'system',
        changes: [
          { field: 'balance', oldValue: null, newValue: 'decreased', changeType: 'UPDATE' }
        ],
        metadata: {
          transactionId: debitTx.id,
          transferId: context.transactionId,
          amount: request.amount,
          direction: 'outbound'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      }),
      
      this.auditRepo.create({
        id: EntityId.generate().value,
        entityType: 'Account',
        entityId: request.targetAccountId,
        action: 'UPDATE',
        userId: context.userId || 'system',
        changes: [
          { field: 'balance', oldValue: null, newValue: 'increased', changeType: 'UPDATE' }
        ],
        metadata: {
          transactionId: creditTx.id,
          transferId: context.transactionId,
          amount: request.amount,
          direction: 'inbound'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      })
    ]);
  }

  private async processIndividualPayment(payment: TransferRequest, batchId: string): Promise<TransactionResult> {
    // Implementation similar to processMoneyTransfer but optimized for batch processing
    // Returns individual payment result
    return {
      success: true,
      transactionId: payment.id,
      batchId,
      processedAt: new Date()
    };
  }

  private async processOperation(operation: any): Promise<any> {
    // Process individual operation based on type
    switch (operation.type) {
      case 'transfer':
        return await this.processMoneyTransfer(operation.data);
      case 'update_account':
        return await this.updateAccountInfo(operation.data);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }
}

// Usage Example
async function demonstrateUnitOfWork() {
  const accountRepo = new AccountRepository();
  const transactionRepo = new TransactionRepository();
  const auditRepo = new AuditLogRepository();
  
  const uow = new FinancialUnitOfWork(accountRepo, transactionRepo, auditRepo);

  // Money transfer example
  const transferRequest: TransferRequest = {
    id: 'transfer-123',
    sourceAccountId: 'account-1',
    targetAccountId: 'account-2',
    amount: 1000.00,
    description: 'Salary payment',
    userId: 'user-123'
  };

  const result = await uow.processMoneyTransfer(transferRequest);
  
  if (result.success) {
    console.log('Transfer completed:', result.transactionId);
    console.log('Source balance:', result.sourceAccountBalance);
    console.log('Target balance:', result.targetAccountBalance);
  } else {
    console.error('Transfer failed:', result.error);
  }

  // Batch payments example
  const batchPayments: TransferRequest[] = [
    { id: '1', sourceAccountId: 'company-account', targetAccountId: 'emp-1', amount: 5000, description: 'Salary', userId: 'hr-system' },
    { id: '2', sourceAccountId: 'company-account', targetAccountId: 'emp-2', amount: 4500, description: 'Salary', userId: 'hr-system' },
    { id: '3', sourceAccountId: 'company-account', targetAccountId: 'emp-3', amount: 6000, description: 'Salary', userId: 'hr-system' }
  ];

  const batchResults = await uow.processBatchPayments(batchPayments);
  console.log('Batch processing results:', batchResults.length);
}
```

## Key Features
- Atomic operations across multiple repositories and aggregates
- Transaction savepoint management for complex nested operations  
- Comprehensive error handling with automatic rollback
- Audit trail integration within transaction boundaries
- Batch processing with all-or-nothing semantics
- Repository coordination and modification tracking

## Common Pitfalls
- Not properly handling partial failures in batch operations
- Forgetting to rollback on errors, leading to inconsistent state
- Creating too large transaction scopes (long-running transactions)
- Not considering deadlock scenarios in concurrent environments

## Related Examples
- [Specification Pattern](example-2.md) - Advanced querying with specifications
- [Multi-Tenant Repository](example-3.md) - Tenant-aware data access patterns