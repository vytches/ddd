# Aggregate with Advanced Capabilities - Banking Account Management

**Version**: 1.0.0
**Package**: @vytches-ddd/aggregates
**Complexity**: Intermediate
**Domain**: Banking & Financial Services
**Patterns**: Capability Pattern, Command-Query Separation, Optimistic Locking, Transaction History
**Dependencies**: @vytches-ddd/aggregates, @vytches-ddd/domain-primitives, @vytches-ddd/contracts

## Description

This example demonstrates an advanced banking account aggregate that uses the capability pattern to separate concerns, implements sophisticated business rules for financial transactions, and maintains detailed audit trails with optimistic locking for concurrent operations.

## Business Context

A digital banking platform requires robust account management with features like transaction limits, automatic categorization, fraud detection triggers, and regulatory compliance. The aggregate must handle high-volume concurrent transactions while maintaining data integrity and providing comprehensive audit capabilities.

## Code Example

```typescript
// banking-account.aggregate.ts
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { DomainEvent } from '@vytches-ddd/contracts';
import { BaseError, EntityId } from '@vytches-ddd/domain-primitives';
import { 
  BankAccountData, 
  Transaction, 
  TransactionType,
  AccountStatus,
  AccountCapability,
  RiskAssessment 
} from './types'; // From your application

// Capability Interfaces
interface ITransactionCapability {
  processTransaction(transaction: Omit<Transaction, 'id' | 'balance'>): Promise<string>;
  validateTransaction(transaction: Omit<Transaction, 'id' | 'balance'>): void;
  categorizeTransaction(description: string, amount: number): string;
}

interface IRiskCapability {
  assessRisk(transaction: Omit<Transaction, 'id' | 'balance'>): RiskAssessment;
  checkFraudPatterns(transactions: Transaction[]): boolean;
  updateRiskProfile(transaction: Transaction): void;
}

interface IComplianceCapability {
  validateCompliance(transaction: Omit<Transaction, 'id' | 'balance'>): void;
  reportSuspiciousActivity(transaction: Transaction): void;
  ensureRegulatory(amount: number, type: TransactionType): void;
}

interface IAuditCapability {
  recordTransaction(transaction: Transaction): void;
  generateAuditTrail(fromDate: Date, toDate: Date): any[];
  trackBalanceChanges(): any[];
}

// Domain Events
export class AccountCreatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly customerId: string,
    public readonly accountType: string,
    public readonly initialBalance: number
  ) {
    super();
  }
}

export class TransactionProcessedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly transactionId: string,
    public readonly type: TransactionType,
    public readonly amount: number,
    public readonly newBalance: number,
    public readonly category: string
  ) {
    super();
  }
}

export class FraudAlertTriggeredEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly transactionId: string,
    public readonly riskScore: number,
    public readonly alertType: string
  ) {
    super();
  }
}

export class AccountFrozenEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly reason: string,
    public readonly frozenBy: string,
    public readonly frozenAt: Date
  ) {
    super();
  }
}

export class LimitExceededEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly limitType: string,
    public readonly attemptedAmount: number,
    public readonly limitAmount: number
  ) {
    super();
  }
}

export class ComplianceViolationEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly violationType: string,
    public readonly transactionDetails: any,
    public readonly severity: 'low' | 'medium' | 'high' | 'critical'
  ) {
    super();
  }
}

// Domain Errors
export class InsufficientFundsError extends BaseError {
  constructor(available: number, requested: number) {
    super(
      'INSUFFICIENT_FUNDS',
      `Insufficient funds: ${available} available, ${requested} requested`
    );
  }
}

export class LimitExceededError extends BaseError {
  constructor(limitType: string, limit: number, attempted: number) {
    super(
      'LIMIT_EXCEEDED',
      `${limitType} limit exceeded: ${limit} limit, ${attempted} attempted`
    );
  }
}

export class FraudSuspicionError extends BaseError {
  constructor(riskScore: number) {
    super(
      'FRAUD_SUSPICION',
      `Transaction blocked due to fraud suspicion (risk score: ${riskScore})`
    );
  }
}

export class AccountFrozenError extends BaseError {
  constructor(reason: string) {
    super('ACCOUNT_FROZEN', `Account is frozen: ${reason}`);
  }
}

// Capability Implementations
export class TransactionCapability implements ITransactionCapability {
  constructor(private aggregate: AdvancedBankingAccountAggregate) {}

  async processTransaction(transaction: Omit<Transaction, 'id' | 'balance'>): Promise<string> {
    // Validate transaction
    this.validateTransaction(transaction);
    
    // Create transaction ID
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create full transaction
    const fullTransaction: Transaction = {
      id: transactionId,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      timestamp: transaction.timestamp || new Date(),
      balance: this.aggregate.getCurrentBalance() + (transaction.type === 'deposit' ? transaction.amount : -transaction.amount),
      metadata: transaction.metadata || {}
    };
    
    // Categorize transaction
    const category = this.categorizeTransaction(transaction.description, transaction.amount);
    fullTransaction.metadata.category = category;
    
    return transactionId;
  }

  validateTransaction(transaction: Omit<Transaction, 'id' | 'balance'>): void {
    if (transaction.amount <= 0) {
      throw new BaseError('INVALID_AMOUNT', 'Transaction amount must be positive');
    }
    
    if (!transaction.currency) {
      throw new BaseError('MISSING_CURRENCY', 'Transaction currency is required');
    }
    
    if (!transaction.description || transaction.description.trim().length === 0) {
      throw new BaseError('MISSING_DESCRIPTION', 'Transaction description is required');
    }
  }

  categorizeTransaction(description: string, amount: number): string {
    const desc = description.toLowerCase();
    
    // Simple categorization logic (in real system, this might use ML)
    if (desc.includes('grocery') || desc.includes('supermarket')) return 'groceries';
    if (desc.includes('gas') || desc.includes('fuel')) return 'transportation';
    if (desc.includes('restaurant') || desc.includes('food')) return 'dining';
    if (desc.includes('atm') || desc.includes('withdrawal')) return 'cash';
    if (desc.includes('transfer')) return 'transfer';
    if (desc.includes('salary') || desc.includes('payroll')) return 'income';
    if (amount > 1000) return 'large-transaction';
    
    return 'other';
  }
}

export class RiskCapability implements IRiskCapability {
  private riskProfile: any = { score: 0, factors: [] };

  constructor(private aggregate: AdvancedBankingAccountAggregate) {}

  assessRisk(transaction: Omit<Transaction, 'id' | 'balance'>): RiskAssessment {
    let riskScore = 0;
    const riskFactors: string[] = [];
    
    // Amount-based risk
    if (transaction.amount > 10000) {
      riskScore += 30;
      riskFactors.push('large-amount');
    } else if (transaction.amount > 5000) {
      riskScore += 15;
      riskFactors.push('medium-amount');
    }
    
    // Time-based risk
    const hour = transaction.timestamp?.getHours() || new Date().getHours();
    if (hour < 6 || hour > 23) {
      riskScore += 20;
      riskFactors.push('unusual-time');
    }
    
    // Pattern-based risk
    const recentTransactions = this.aggregate.getRecentTransactions(24); // Last 24 hours
    if (recentTransactions.length > 20) {
      riskScore += 25;
      riskFactors.push('high-frequency');
    }
    
    // Location risk (if metadata includes location)
    if (transaction.metadata?.location && this.isUnusualLocation(transaction.metadata.location)) {
      riskScore += 40;
      riskFactors.push('unusual-location');
    }
    
    return {
      score: Math.min(riskScore, 100),
      level: riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low',
      factors: riskFactors,
      recommendation: riskScore > 70 ? 'block' : riskScore > 40 ? 'review' : 'approve'
    };
  }

  checkFraudPatterns(transactions: Transaction[]): boolean {
    // Check for suspicious patterns
    const amounts = transactions.map(t => t.amount);
    const descriptions = transactions.map(t => t.description);
    
    // Pattern 1: Multiple identical amounts in short time
    const identicalAmounts = amounts.filter((amount, index) => 
      amounts.indexOf(amount) !== index
    );
    if (identicalAmounts.length > 3) return true;
    
    // Pattern 2: Round number transactions
    const roundNumbers = amounts.filter(amount => amount % 100 === 0);
    if (roundNumbers.length > transactions.length * 0.8) return true;
    
    // Pattern 3: Rapid succession transactions
    const timestamps = transactions.map(t => t.timestamp.getTime());
    const intervals = timestamps.slice(1).map((time, index) => time - timestamps[index]);
    const rapidTransactions = intervals.filter(interval => interval < 60000); // < 1 minute
    if (rapidTransactions.length > 5) return true;
    
    return false;
  }

  updateRiskProfile(transaction: Transaction): void {
    const assessment = this.assessRisk(transaction);
    this.riskProfile.score = (this.riskProfile.score + assessment.score) / 2;
    this.riskProfile.factors = [...new Set([...this.riskProfile.factors, ...assessment.factors])];
  }

  private isUnusualLocation(location: any): boolean {
    // Simple location risk check (in real system, use geolocation services)
    return location.country !== 'US' || location.state !== 'CA';
  }
}

export class ComplianceCapability implements IComplianceCapability {
  constructor(private aggregate: AdvancedBankingAccountAggregate) {}

  validateCompliance(transaction: Omit<Transaction, 'id' | 'balance'>): void {
    // BSA/AML compliance check
    if (transaction.amount >= 10000) {
      this.ensureRegulatory(transaction.amount, transaction.type);
    }
    
    // OFAC sanctions check (simplified)
    if (transaction.metadata?.recipient) {
      this.checkSanctionsList(transaction.metadata.recipient);
    }
    
    // Suspicious activity patterns
    const dailyTotal = this.aggregate.getDailyTransactionTotal();
    if (dailyTotal > 50000) {
      // Potential structuring
      throw new BaseError('COMPLIANCE_VIOLATION', 'Daily transaction limit exceeded - potential structuring');
    }
  }

  reportSuspiciousActivity(transaction: Transaction): void {
    // File suspicious activity report (SAR)
    console.log(`SAR filed for transaction ${transaction.id}: ${transaction.description}`);
  }

  ensureRegulatory(amount: number, type: TransactionType): void {
    // Currency Transaction Report (CTR) for amounts >= $10,000
    if (amount >= 10000) {
      console.log(`CTR required for ${type} of $${amount}`);
    }
  }

  private checkSanctionsList(recipient: string): void {
    // Simplified sanctions check
    const sanctionedEntities = ['SANCTIONED_ENTITY_1', 'SANCTIONED_ENTITY_2'];
    if (sanctionedEntities.some(entity => recipient.includes(entity))) {
      throw new BaseError('SANCTIONS_VIOLATION', 'Transaction with sanctioned entity blocked');
    }
  }
}

export class AuditCapability implements IAuditCapability {
  private auditLog: any[] = [];

  constructor(private aggregate: AdvancedBankingAccountAggregate) {}

  recordTransaction(transaction: Transaction): void {
    const auditEntry = {
      timestamp: new Date(),
      transactionId: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      balanceBefore: transaction.balance - (transaction.type === 'deposit' ? transaction.amount : -transaction.amount),
      balanceAfter: transaction.balance,
      description: transaction.description,
      metadata: transaction.metadata
    };
    
    this.auditLog.push(auditEntry);
    
    // Keep only last 1000 entries in memory
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  generateAuditTrail(fromDate: Date, toDate: Date): any[] {
    return this.auditLog.filter(entry => 
      entry.timestamp >= fromDate && entry.timestamp <= toDate
    );
  }

  trackBalanceChanges(): any[] {
    return this.auditLog.map(entry => ({
      timestamp: entry.timestamp,
      transactionId: entry.transactionId,
      balanceBefore: entry.balanceBefore,
      balanceAfter: entry.balanceAfter,
      change: entry.balanceAfter - entry.balanceBefore
    }));
  }
}

// Main Aggregate
export class AdvancedBankingAccountAggregate extends AggregateRoot {
  private customerId: string;
  private accountNumber: string;
  private accountType: string;
  private balance: number;
  private currency: string;
  private status: AccountStatus;
  private dailyWithdrawalLimit: number;
  private monthlyTransferLimit: number;
  private transactions: Transaction[];
  private version: number; // For optimistic locking
  private createdAt: Date;
  private updatedAt: Date;
  
  // Capabilities
  private transactionCapability: ITransactionCapability;
  private riskCapability: IRiskCapability;
  private complianceCapability: IComplianceCapability;
  private auditCapability: IAuditCapability;

  private constructor(id: EntityId) {
    super(id);
    this.balance = 0;
    this.currency = 'USD';
    this.status = 'active';
    this.dailyWithdrawalLimit = 1000;
    this.monthlyTransferLimit = 50000;
    this.transactions = [];
    this.version = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    
    // Initialize capabilities
    this.transactionCapability = new TransactionCapability(this);
    this.riskCapability = new RiskCapability(this);
    this.complianceCapability = new ComplianceCapability(this);
    this.auditCapability = new AuditCapability(this);
  }

  // ⭐ Factory method
  static create(data: CreateBankAccountData): AdvancedBankingAccountAggregate {
    const account = new AdvancedBankingAccountAggregate(EntityId.generate());
    
    account.customerId = data.customerId;
    account.accountNumber = account.generateAccountNumber();
    account.accountType = data.accountType;
    account.currency = data.currency || 'USD';
    
    // Set custom limits if provided
    if (data.dailyWithdrawalLimit) {
      account.dailyWithdrawalLimit = data.dailyWithdrawalLimit;
    }
    if (data.monthlyTransferLimit) {
      account.monthlyTransferLimit = data.monthlyTransferLimit;
    }
    
    // Initial deposit if provided
    if (data.initialDeposit && data.initialDeposit > 0) {
      account.balance = data.initialDeposit;
    }
    
    account.addDomainEvent(new AccountCreatedEvent(
      account.id.value,
      account.customerId,
      account.accountType,
      account.balance
    ));
    
    return account;
  }

  // ⭐ Main business operations
  async deposit(amount: number, description: string, reference?: string): Promise<string> {
    this.ensureAccountActive();
    
    const transaction: Omit<Transaction, 'id' | 'balance'> = {
      type: 'deposit',
      amount,
      currency: this.currency,
      description,
      timestamp: new Date(),
      metadata: { reference }
    };
    
    // Use capabilities for processing
    const transactionId = await this.transactionCapability.processTransaction(transaction);
    
    // Compliance check
    this.complianceCapability.validateCompliance(transaction);
    
    // Risk assessment
    const riskAssessment = this.riskCapability.assessRisk(transaction);
    
    // Process transaction
    this.balance += amount;
    this.version++;
    
    const fullTransaction: Transaction = {
      id: transactionId,
      type: 'deposit',
      amount,
      currency: this.currency,
      description,
      timestamp: new Date(),
      balance: this.balance,
      metadata: { reference, category: 'income', riskScore: riskAssessment.score }
    };
    
    this.transactions.push(fullTransaction);
    
    // Audit logging
    this.auditCapability.recordTransaction(fullTransaction);
    
    // Update risk profile
    this.riskCapability.updateRiskProfile(fullTransaction);
    
    this.updatedAt = new Date();
    
    this.addDomainEvent(new TransactionProcessedEvent(
      this.id.value,
      transactionId,
      'deposit',
      amount,
      this.balance,
      'income'
    ));
    
    return transactionId;
  }

  async withdraw(amount: number, description: string, reference?: string): Promise<string> {
    this.ensureAccountActive();
    
    // Check balance
    if (this.balance < amount) {
      throw new InsufficientFundsError(this.balance, amount);
    }
    
    // Check daily limits
    const dailyWithdrawals = this.getDailyWithdrawalTotal();
    if (dailyWithdrawals + amount > this.dailyWithdrawalLimit) {
      throw new LimitExceededError('Daily withdrawal', this.dailyWithdrawalLimit, dailyWithdrawals + amount);
    }
    
    const transaction: Omit<Transaction, 'id' | 'balance'> = {
      type: 'withdrawal',
      amount,
      currency: this.currency,
      description,
      timestamp: new Date(),
      metadata: { reference }
    };
    
    // Risk assessment
    const riskAssessment = this.riskCapability.assessRisk(transaction);
    
    // Fraud detection
    if (riskAssessment.score > 70) {
      this.addDomainEvent(new FraudAlertTriggeredEvent(
        this.id.value,
        'pending',
        riskAssessment.score,
        'withdrawal-risk'
      ));
      
      if (riskAssessment.recommendation === 'block') {
        throw new FraudSuspicionError(riskAssessment.score);
      }
    }
    
    // Compliance check
    this.complianceCapability.validateCompliance(transaction);
    
    // Process transaction
    const transactionId = await this.transactionCapability.processTransaction(transaction);
    
    this.balance -= amount;
    this.version++;
    
    const fullTransaction: Transaction = {
      id: transactionId,
      type: 'withdrawal',
      amount,
      currency: this.currency,
      description,
      timestamp: new Date(),
      balance: this.balance,
      metadata: { reference, category: 'cash', riskScore: riskAssessment.score }
    };
    
    this.transactions.push(fullTransaction);
    
    // Audit logging
    this.auditCapability.recordTransaction(fullTransaction);
    
    this.updatedAt = new Date();
    
    this.addDomainEvent(new TransactionProcessedEvent(
      this.id.value,
      transactionId,
      'withdrawal',
      amount,
      this.balance,
      'cash'
    ));
    
    return transactionId;
  }

  async transfer(amount: number, toAccount: string, description: string): Promise<string> {
    this.ensureAccountActive();
    
    // Check balance
    if (this.balance < amount) {
      throw new InsufficientFundsError(this.balance, amount);
    }
    
    // Check monthly transfer limits
    const monthlyTransfers = this.getMonthlyTransferTotal();
    if (monthlyTransfers + amount > this.monthlyTransferLimit) {
      throw new LimitExceededError('Monthly transfer', this.monthlyTransferLimit, monthlyTransfers + amount);
    }
    
    const transaction: Omit<Transaction, 'id' | 'balance'> = {
      type: 'transfer',
      amount,
      currency: this.currency,
      description,
      timestamp: new Date(),
      metadata: { toAccount }
    };
    
    // Enhanced compliance for transfers
    this.complianceCapability.validateCompliance(transaction);
    
    // Risk assessment
    const riskAssessment = this.riskCapability.assessRisk(transaction);
    
    const transactionId = await this.transactionCapability.processTransaction(transaction);
    
    this.balance -= amount;
    this.version++;
    
    const fullTransaction: Transaction = {
      id: transactionId,
      type: 'transfer',
      amount,
      currency: this.currency,
      description,
      timestamp: new Date(),
      balance: this.balance,
      metadata: { toAccount, category: 'transfer', riskScore: riskAssessment.score }
    };
    
    this.transactions.push(fullTransaction);
    this.auditCapability.recordTransaction(fullTransaction);
    this.updatedAt = new Date();
    
    this.addDomainEvent(new TransactionProcessedEvent(
      this.id.value,
      transactionId,
      'transfer',
      amount,
      this.balance,
      'transfer'
    ));
    
    return transactionId;
  }

  freezeAccount(reason: string, frozenBy: string): void {
    if (this.status === 'frozen') {
      return; // Already frozen
    }
    
    this.status = 'frozen';
    this.version++;
    this.updatedAt = new Date();
    
    this.addDomainEvent(new AccountFrozenEvent(
      this.id.value,
      reason,
      frozenBy,
      new Date()
    ));
  }

  unfreezeAccount(unfrozenBy: string): void {
    if (this.status !== 'frozen') {
      return; // Not frozen
    }
    
    this.status = 'active';
    this.version++;
    this.updatedAt = new Date();
  }

  // ⭐ Query methods (using capabilities)
  getAccountSummary(): any {
    const recentTransactions = this.getRecentTransactions(30); // Last 30 days
    const fraudPatterns = this.riskCapability.checkFraudPatterns(recentTransactions);
    
    return {
      accountId: this.id.value,
      accountNumber: this.accountNumber,
      balance: this.balance,
      status: this.status,
      transactionCount: this.transactions.length,
      dailyWithdrawalUsed: this.getDailyWithdrawalTotal(),
      dailyWithdrawalLimit: this.dailyWithdrawalLimit,
      monthlyTransferUsed: this.getMonthlyTransferTotal(),
      monthlyTransferLimit: this.monthlyTransferLimit,
      hasFraudRisk: fraudPatterns,
      lastTransactionDate: this.transactions.length > 0 
        ? this.transactions[this.transactions.length - 1].timestamp
        : null,
      version: this.version
    };
  }

  getTransactionsByCategory(days: number = 30): Record<string, Transaction[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentTransactions = this.transactions.filter(t => t.timestamp >= cutoff);
    
    return recentTransactions.reduce((groups, transaction) => {
      const category = transaction.metadata?.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(transaction);
      return groups;
    }, {} as Record<string, Transaction[]>);
  }

  generateAuditReport(fromDate: Date, toDate: Date): any {
    return this.auditCapability.generateAuditTrail(fromDate, toDate);
  }

  // ⭐ Helper methods
  private ensureAccountActive(): void {
    if (this.status === 'frozen') {
      throw new AccountFrozenError('Account operations suspended');
    }
    
    if (this.status === 'closed') {
      throw new BaseError('ACCOUNT_CLOSED', 'Account is closed');
    }
  }

  private generateAccountNumber(): string {
    return `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  getDailyWithdrawalTotal(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.transactions
      .filter(t => t.type === 'withdrawal' && t.timestamp >= today)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getMonthlyTransferTotal(): number {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    return this.transactions
      .filter(t => t.type === 'transfer' && t.timestamp >= startOfMonth)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getDailyTransactionTotal(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.transactions
      .filter(t => t.timestamp >= today)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getRecentTransactions(hours: number): Transaction[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.transactions.filter(t => t.timestamp >= cutoff);
  }

  getCurrentBalance(): number {
    return this.balance;
  }

  // ⭐ Snapshot
  toSnapshot(): BankAccountData {
    return {
      id: this.id.value,
      customerId: this.customerId,
      accountNumber: this.accountNumber,
      accountType: this.accountType,
      balance: this.balance,
      currency: this.currency,
      status: this.status,
      dailyWithdrawalLimit: this.dailyWithdrawalLimit,
      monthlyTransferLimit: this.monthlyTransferLimit,
      transactions: this.transactions.slice(-100), // Keep last 100 transactions in snapshot
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version
    };
  }

  get accountVersion(): number {
    return this.version;
  }
}

// Usage example
export function advancedBankingExample(): void {
  // Create bank account
  const account = AdvancedBankingAccountAggregate.create({
    customerId: 'CUST-001',
    accountType: 'checking',
    currency: 'USD',
    initialDeposit: 5000,
    dailyWithdrawalLimit: 1500,
    monthlyTransferLimit: 25000
  });

  console.log('Account created:', account.getAccountSummary());

  // Process various transactions
  account.deposit(1000, 'Salary deposit', 'PAY-001')
    .then(txnId => console.log('Deposit completed:', txnId));

  account.withdraw(200, 'ATM withdrawal', 'ATM-123')
    .then(txnId => console.log('Withdrawal completed:', txnId));

  account.transfer(500, 'ACC-789', 'Transfer to savings')
    .then(txnId => console.log('Transfer completed:', txnId));

  // Check account summary
  console.log('Updated summary:', account.getAccountSummary());

  // Get transactions by category
  console.log('Transactions by category:', account.getTransactionsByCategory());

  // Generate audit report
  const auditReport = account.generateAuditReport(
    new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    new Date()
  );
  console.log('Audit report:', auditReport);

  // Demonstrate fraud detection
  try {
    // Simulate suspicious activity
    for (let i = 0; i < 10; i++) {
      account.withdraw(999, `Suspicious withdrawal ${i}`, `SUS-${i}`);
    }
  } catch (error) {
    console.log('Fraud detection triggered:', error.message);
  }

  console.log('Final events:', account.getUncommittedEvents().length);
}
```

## Key Features

- **Capability Pattern**: Separation of concerns with dedicated capability classes
- **Advanced Risk Assessment**: Multi-factor fraud detection and risk scoring
- **Regulatory Compliance**: BSA/AML, OFAC sanctions, and CTR requirements
- **Comprehensive Audit Trail**: Complete transaction history with metadata
- **Optimistic Locking**: Version tracking for concurrent operation handling
- **Business Rule Enforcement**: Transaction limits, status validation, and constraints

## Capability Benefits

1. **Single Responsibility**: Each capability handles one concern
2. **Testability**: Capabilities can be tested independently
3. **Extensibility**: Easy to add new capabilities without changing aggregate
4. **Maintainability**: Clear separation makes code easier to understand

## Risk Assessment Factors

- **Amount-based**: Large transactions trigger higher risk scores
- **Time-based**: Unusual transaction times increase risk
- **Pattern-based**: High frequency transactions are flagged
- **Location-based**: Transactions from unusual locations

## Compliance Features

- **CTR Filing**: Automatic reporting for transactions ≥ $10,000
- **SAR Generation**: Suspicious activity report filing
- **Sanctions Screening**: OFAC sanctions list checking
- **Structuring Detection**: Pattern analysis for potential structuring

## Common Pitfalls

- **Capability Coupling**: Keep capabilities loosely coupled to aggregate
- **Memory Management**: Limit transaction history to prevent memory issues
- **Version Management**: Always increment version for optimistic locking
- **Regulatory Updates**: Keep compliance rules current with regulations

## Related Examples

- [Event Sourced Shopping Cart](./example-1.md)
- [Basic User Aggregate](../basic/example-1.md)
- [Advanced Process Management](../advanced/example-1.md)