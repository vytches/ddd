# Banking Account with Capabilities - NestJS Integration

**Focus**: Banking account with capability separation in NestJS **Base
Example**: [Banking Account with Capabilities](../../intermediate/example-2.md)
**Dependencies**: @nestjs/common, @vytches/ddd-aggregates, @vytches/ddd-di

## Service Implementation

```typescript
// banking-account.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { EntityId } from '@vytches/ddd-domain-primitives';
import {
  BankingAccount,
  CreateAccountData,
  Transaction,
  RiskAssessment,
  ComplianceCheck,
  AccountBalance,
} from './types'; // From your application

@Injectable()
export class BankingAccountService {
  private readonly logger = new Logger(BankingAccountService.name);

  // ✅ FOCUS: Account creation with capability initialization
  async createBankingAccount(
    accountData: CreateAccountData
  ): Promise<BankingAccount> {
    try {
      const BankingAccountAggregateClass = VytchesDDD.resolve<any>(
        'BankingAccountAggregate'
      );

      // Use library factory method with capabilities
      const accountAggregate = BankingAccountAggregateClass.create(
        accountData.customerId,
        accountData.accountType,
        accountData.initialDeposit,
        accountData.currency
      );

      const account = accountAggregate.toSnapshot();

      this.logger.log(
        `Banking account created: ${account.accountNumber} for customer ${accountData.customerId}`
      );
      return account;
    } catch (error) {
      this.logger.error(`Failed to create banking account: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Transaction processing with risk and compliance capabilities
  async processTransaction(
    accountId: string,
    transaction: Transaction
  ): Promise<BankingAccount> {
    try {
      const BankingAccountAggregateClass = VytchesDDD.resolve<any>(
        'BankingAccountAggregate'
      );
      const accountAggregate = await this.loadBankingAccount(
        accountId,
        BankingAccountAggregateClass
      );

      // Use library method with integrated capabilities
      await accountAggregate.processTransaction(transaction);

      const updatedAccount = accountAggregate.toSnapshot();

      this.logger.log(
        `Transaction processed for account ${accountId}: ${transaction.amount} ${transaction.type}`
      );
      return updatedAccount;
    } catch (error) {
      this.logger.error(`Failed to process transaction: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Risk assessment through capability
  async assessTransactionRisk(
    accountId: string,
    transaction: Transaction
  ): Promise<RiskAssessment> {
    try {
      const BankingAccountAggregateClass = VytchesDDD.resolve<any>(
        'BankingAccountAggregate'
      );
      const accountAggregate = await this.loadBankingAccount(
        accountId,
        BankingAccountAggregateClass
      );

      // Use library risk capability
      const riskAssessment =
        await accountAggregate.assessTransactionRisk(transaction);

      this.logger.log(
        `Risk assessment completed for account ${accountId}: ${riskAssessment.riskLevel}`
      );
      return riskAssessment;
    } catch (error) {
      this.logger.error(`Failed to assess transaction risk: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Compliance validation through capability
  async validateCompliance(
    accountId: string,
    transaction: Transaction
  ): Promise<ComplianceCheck> {
    try {
      const BankingAccountAggregateClass = VytchesDDD.resolve<any>(
        'BankingAccountAggregate'
      );
      const accountAggregate = await this.loadBankingAccount(
        accountId,
        BankingAccountAggregateClass
      );

      // Use library compliance capability
      const complianceCheck =
        await accountAggregate.validateCompliance(transaction);

      this.logger.log(
        `Compliance validation completed for account ${accountId}: ${complianceCheck.status}`
      );
      return complianceCheck;
    } catch (error) {
      this.logger.error(`Failed to validate compliance: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Account balance operations
  async getAccountBalance(accountId: string): Promise<AccountBalance> {
    try {
      const BankingAccountAggregateClass = VytchesDDD.resolve<any>(
        'BankingAccountAggregate'
      );
      const accountAggregate = await this.loadBankingAccount(
        accountId,
        BankingAccountAggregateClass
      );

      const balance = accountAggregate.getBalance();

      return balance;
    } catch (error) {
      this.logger.error(`Failed to get account balance: ${error.message}`);
      throw error;
    }
  }

  async freezeAccount(
    accountId: string,
    reason: string
  ): Promise<BankingAccount> {
    try {
      const BankingAccountAggregateClass = VytchesDDD.resolve<any>(
        'BankingAccountAggregate'
      );
      const accountAggregate = await this.loadBankingAccount(
        accountId,
        BankingAccountAggregateClass
      );

      // Use library method
      accountAggregate.freeze(reason);

      const updatedAccount = accountAggregate.toSnapshot();

      this.logger.log(`Account frozen: ${accountId}, reason: ${reason}`);
      return updatedAccount;
    } catch (error) {
      this.logger.error(`Failed to freeze account: ${error.message}`);
      throw error;
    }
  }

  // Helper method for aggregate loading
  private async loadBankingAccount(
    accountId: string,
    BankingAccountAggregateClass: any
  ): Promise<any> {
    // Mock implementation - in reality would load from repository
    return BankingAccountAggregateClass.fromSnapshot({
      id: accountId,
      accountNumber: `ACC-${accountId}`,
      customerId: 'customer-123',
      balance: 10000,
      currency: 'USD',
      accountType: 'savings',
      status: 'active',
      transactionHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// banking-account.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';
import { BankingAccountService } from './banking-account.service';

@Module({
  providers: [BankingAccountService],
  exports: [BankingAccountService],
})
export class BankingAccountModule implements OnModuleInit {
  async onModuleInit() {
    const container = new SimpleContainer();
    await VytchesDDD.configure(container);
  }
}
```

**Key Points:**

- Capability-based architecture with separated concerns
- Risk assessment and compliance validation through dedicated capabilities
- Transaction processing with integrated business rule validation
- Clean separation between NestJS service and domain logic

**Usage Example:**

```typescript
@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: BankingAccountService) {}

  @Post(':id/transactions')
  async processTransaction(
    @Param('id') id: string,
    @Body() transaction: Transaction
  ) {
    return await this.accountService.processTransaction(id, transaction);
  }

  @Get(':id/risk/:transactionId')
  async assessRisk(@Param('id') id: string, @Body() transaction: Transaction) {
    return await this.accountService.assessTransactionRisk(id, transaction);
  }
}
```
