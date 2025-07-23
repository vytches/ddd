# CQRS with Policy-Based Authorization

**Version**: 1.0.0 **Package**: @vytches-ddd/cqrs **Complexity**: Intermediate
**Domain**: Architecture **Patterns**: CQRS, Policy-based authorization, Command
validation, Query security **Dependencies**: @vytches-ddd/cqrs,
@vytches-ddd/policies, @vytches-ddd/di, @vytches-ddd/utils

## Description

This example demonstrates integrating policy-based authorization with CQRS
patterns. It shows how to implement sophisticated security policies for commands
and queries, including role-based access control, context-aware permissions, and
dynamic authorization rules for enterprise applications.

## Business Context

In enterprise applications, security is paramount. This pattern addresses:

- Complex authorization requirements that go beyond simple role checks
- Context-aware permissions based on resource ownership or business rules
- Audit trails for sensitive operations
- Dynamic authorization rules that can change based on business context
- Compliance requirements for data access and modifications

## Code Example

```typescript
// policy-secured-commands.ts
import { Command, CommandHandler, CommandBus } from '@vytches-ddd/cqrs';
import { PolicyBuilder, PolicyContext } from '@vytches-ddd/policies';
import { Result } from '@vytches-ddd/utils';
import { Injectable } from '@vytches-ddd/di';
import type { User, Account, TransferCommand, SecurityContext } from '../types'; // From your application

// ✅ FOCUS: Command with security metadata
export class SecureTransferCommand extends Command {
  constructor(
    public readonly fromAccountId: string,
    public readonly toAccountId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly securityContext: SecurityContext
  ) {
    super();
  }

  // Security metadata for audit trails
  get auditMetadata() {
    return {
      operation: 'FINANCIAL_TRANSFER',
      userId: this.securityContext.userId,
      sessionId: this.securityContext.sessionId,
      riskLevel: this.amount > 10000 ? 'HIGH' : 'NORMAL',
      timestamp: new Date(),
    };
  }
}

// ✅ FOCUS: Policy-secured command handler
@Injectable()
@CommandHandler(SecureTransferCommand)
export class SecureTransferCommandHandler {
  private readonly transferPolicy = PolicyBuilder.create<TransferCommand>()
    .withId('secure-transfer-policy')
    .withDomain('financial')
    .withName('Secure Transfer Authorization')
    // Basic authentication check
    .must(cmd => !!cmd.securityContext.userId)
    .withCode('UNAUTHENTICATED')
    .withMessage('User must be authenticated')
    .withSeverity('ERROR')
    .and()
    // Amount limits based on user role
    .when(cmd => cmd.securityContext.userRole === 'STANDARD')
    .then()
    .must(cmd => cmd.amount <= 5000)
    .withCode('AMOUNT_LIMIT_EXCEEDED')
    .withMessage('Standard users can transfer up to $5,000')
    .withSeverity('ERROR')
    .when(cmd => cmd.securityContext.userRole === 'PREMIUM')
    .then()
    .must(cmd => cmd.amount <= 50000)
    .withCode('AMOUNT_LIMIT_EXCEEDED')
    .withMessage('Premium users can transfer up to $50,000')
    .withSeverity('ERROR')
    // Multi-factor authentication for high-value transfers
    .when(cmd => cmd.amount > 10000)
    .then()
    .must(cmd => cmd.securityContext.mfaVerified === true)
    .withCode('MFA_REQUIRED')
    .withMessage(
      'Multi-factor authentication required for transfers over $10,000'
    )
    .withSeverity('ERROR')
    // Business hours restriction for large transfers
    .when(cmd => cmd.amount > 25000)
    .then()
    .mustSatisfy(cmd => {
      const hour = new Date().getHours();
      return hour >= 9 && hour <= 17;
    })
    .withCode('BUSINESS_HOURS_REQUIRED')
    .withMessage(
      'Large transfers must be made during business hours (9 AM - 5 PM)'
    )
    .withSeverity('WARNING')
    .build();

  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly auditService: IAuditService
  ) {}

  async execute(
    command: SecureTransferCommand
  ): Promise<Result<TransferResult, SecurityError>> {
    // ✅ FOCUS: Policy validation with context
    const policyContext = PolicyContext.create()
      .withUserId(command.securityContext.userId)
      .withSessionId(command.securityContext.sessionId)
      .withRequestId(command.commandId)
      .withMetadata({
        ipAddress: command.securityContext.ipAddress,
        userAgent: command.securityContext.userAgent,
      })
      .build();

    const policyResult = await this.transferPolicy.check({
      entity: command,
      context: policyContext,
    });

    if (policyResult.isFailure()) {
      // Audit failed authorization attempt
      await this.auditService.logSecurityViolation({
        ...command.auditMetadata,
        violations: policyResult.error.violations,
        result: 'DENIED',
      });

      return Result.fail({
        type: 'AUTHORIZATION_FAILED',
        violations: policyResult.error.violations,
        message: 'Transfer not authorized',
      });
    }

    // Additional ownership validation
    const ownershipResult = await this.validateAccountOwnership(
      command.fromAccountId,
      command.securityContext.userId
    );

    if (ownershipResult.isFailure()) {
      return Result.fail(ownershipResult.error);
    }

    // Execute the transfer
    try {
      const result = await this.performTransfer(command);

      // Audit successful operation
      await this.auditService.logSuccessfulOperation({
        ...command.auditMetadata,
        result: 'SUCCESS',
        transferId: result.transferId,
      });

      return Result.ok(result);
    } catch (error) {
      return Result.fail({
        type: 'TRANSFER_FAILED',
        message: (error as Error).message,
      });
    }
  }

  private async validateAccountOwnership(
    accountId: string,
    userId: string
  ): Promise<Result<void, SecurityError>> {
    const account = await this.accountRepository.findById(accountId);

    if (!account || account.ownerId !== userId) {
      return Result.fail({
        type: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'User does not own the source account',
      });
    }

    return Result.ok(undefined);
  }

  private async performTransfer(
    command: SecureTransferCommand
  ): Promise<TransferResult> {
    // Transfer implementation
    return {
      transferId: `transfer-${Date.now()}`,
      status: 'COMPLETED',
      timestamp: new Date(),
    };
  }
}

// ✅ FOCUS: Query with row-level security
export class SecureAccountQuery extends Query<AccountQueryResult[]> {
  constructor(
    public readonly filters: AccountFilters,
    public readonly securityContext: SecurityContext
  ) {
    super();
  }
}

// ✅ FOCUS: Policy-secured query handler
@Injectable()
@QueryHandler(SecureAccountQuery)
export class SecureAccountQueryHandler {
  private readonly queryPolicy = PolicyBuilder.create<SecureAccountQuery>()
    .withId('account-query-policy')
    .withDomain('financial')
    // Must be authenticated
    .must(query => !!query.securityContext.userId)
    .withCode('UNAUTHENTICATED')
    .withMessage('Authentication required')
    .and()
    // Admin can query all accounts
    .when(query => query.securityContext.userRole !== 'ADMIN')
    .then()
    // Non-admins can only query their own accounts
    .must(query => query.filters.ownerId === query.securityContext.userId)
    .withCode('UNAUTHORIZED_ACCESS')
    .withMessage('You can only query your own accounts')
    .build();

  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly dataProtectionService: IDataProtectionService
  ) {}

  async execute(
    query: SecureAccountQuery
  ): Promise<Result<AccountQueryResult[], SecurityError>> {
    // Validate query permissions
    const policyResult = await this.queryPolicy.check({
      entity: query,
      context: PolicyContext.create()
        .withUserId(query.securityContext.userId)
        .build(),
    });

    if (policyResult.isFailure()) {
      return Result.fail({
        type: 'QUERY_AUTHORIZATION_FAILED',
        violations: policyResult.error.violations,
      });
    }

    // Apply row-level security filters
    const securedFilters = this.applySecurityFilters(query);

    // Execute query with secured filters
    const accounts = await this.accountRepository.find(securedFilters);

    // Apply data masking based on permissions
    const maskedAccounts = await this.applyDataMasking(
      accounts,
      query.securityContext
    );

    return Result.ok(maskedAccounts);
  }

  private applySecurityFilters(query: SecureAccountQuery): AccountFilters {
    const filters = { ...query.filters };

    // Non-admins can only see their own accounts
    if (query.securityContext.userRole !== 'ADMIN') {
      filters.ownerId = query.securityContext.userId;
    }

    // Apply additional security filters
    if (query.securityContext.userRole === 'AUDITOR') {
      // Auditors can see accounts but not modify
      filters.includeInactive = true;
    }

    return filters;
  }

  private async applyDataMasking(
    accounts: Account[],
    context: SecurityContext
  ): Promise<AccountQueryResult[]> {
    return accounts.map(account => ({
      id: account.id,
      // Mask sensitive data for non-owners
      accountNumber:
        context.userId === account.ownerId
          ? account.accountNumber
          : this.dataProtectionService.maskAccountNumber(account.accountNumber),
      balance: context.userId === account.ownerId ? account.balance : null, // Hide balance from non-owners
      currency: account.currency,
      status: account.status,
      createdAt: account.createdAt,
    }));
  }
}

// ✅ FOCUS: Middleware for centralized security
export class SecurityPolicyMiddleware implements ICommandMiddleware {
  async execute<T extends Command>(
    command: T,
    next: () => Promise<any>
  ): Promise<any> {
    // Extract security context
    const securityContext = (command as any).securityContext;

    if (!securityContext) {
      throw new Error('Security context required for all commands');
    }

    // Check rate limiting
    const rateLimitResult = await this.checkRateLimit(
      securityContext.userId,
      command.constructor.name
    );

    if (rateLimitResult.isFailure()) {
      throw new Error('Rate limit exceeded');
    }

    // Check IP whitelist for sensitive operations
    if (this.isSensitiveOperation(command)) {
      const ipCheckResult = await this.checkIpWhitelist(
        securityContext.ipAddress,
        securityContext.userId
      );

      if (ipCheckResult.isFailure()) {
        throw new Error('Operation not allowed from this IP address');
      }
    }

    // Continue with command execution
    return next();
  }

  private async checkRateLimit(
    userId: string,
    commandType: string
  ): Promise<Result<void, Error>> {
    // Rate limiting implementation
    return Result.ok(undefined);
  }

  private isSensitiveOperation(command: Command): boolean {
    // Define sensitive operations
    const sensitiveCommands = [
      'SecureTransferCommand',
      'DeleteAccountCommand',
      'UpdateSecuritySettingsCommand',
    ];

    return sensitiveCommands.includes(command.constructor.name);
  }

  private async checkIpWhitelist(
    ipAddress: string,
    userId: string
  ): Promise<Result<void, Error>> {
    // IP whitelist validation
    return Result.ok(undefined);
  }
}
```

## Key Features

- **Policy-Based Authorization**: Comprehensive security policies using
  @vytches-ddd/policies
- **Context-Aware Permissions**: Dynamic authorization based on user context and
  business rules
- **Role-Based Limits**: Different transaction limits for different user roles
- **Multi-Factor Authentication**: Enhanced security for high-value operations
- **Row-Level Security**: Automatic filtering of query results based on
  permissions
- **Data Masking**: Sensitive data protection in query results
- **Audit Trails**: Comprehensive logging of security-sensitive operations
- **Rate Limiting**: Protection against abuse through middleware

## Usage Examples

```typescript
// Configure command bus with security middleware
const commandBus = new CommandBus();
commandBus.use(new SecurityPolicyMiddleware());
commandBus.use(new AuditMiddleware());

// Execute secure transfer
const transferCommand = new SecureTransferCommand(
  'account-123',
  'account-456',
  15000,
  'USD',
  {
    userId: 'user-789',
    userRole: 'PREMIUM',
    sessionId: 'session-123',
    mfaVerified: true,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
  }
);

const result = await commandBus.execute(transferCommand);

if (result.isFailure()) {
  console.error('Transfer failed:', result.error.violations);
} else {
  console.log('Transfer completed:', result.value.transferId);
}

// Execute secure query
const queryBus = new QueryBus();
const accountQuery = new SecureAccountQuery(
  {
    status: 'ACTIVE',
    minBalance: 1000,
  },
  {
    userId: 'user-789',
    userRole: 'STANDARD',
    sessionId: 'session-123',
  }
);

const queryResult = await queryBus.execute(accountQuery);
```

## Common Pitfalls

- **Missing Security Context**: Always ensure commands/queries include security
  context
- **Policy Bypass**: Never skip policy validation for "trusted" operations
- **Insufficient Audit Logging**: Log both successful and failed authorization
  attempts
- **Hardcoded Permissions**: Use dynamic policies instead of hardcoded role
  checks
- **Forgetting Data Masking**: Always mask sensitive data in query results
- **Rate Limit Bypass**: Apply rate limiting at the middleware level, not
  handler level

## Related Examples

- [Basic Command Handlers](../basic/example-1.md) - Foundation command patterns
- [Middleware Pipeline](../basic/example-3.md) - Middleware implementation
- [Event Integration](./example-1.md) - CQRS with event sourcing
- [Enterprise Patterns](../advanced/example-1.md) - Advanced security patterns
