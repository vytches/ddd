# Domain-Driven Design Foundation - NestJS Intermediate Integration

**Version**: 2.1.0
**Package**: @vytches-ddd/domain-primitives
**Complexity**: Intermediate
**Framework**: NestJS
**Base Example**: [Enterprise Domain Management](../../intermediate/example-1.md)
**Dependencies**: @nestjs/common, @vytches-ddd/domain-primitives, @vytches-ddd/di

## Business Context

This example demonstrates advanced VytchesDDD DI integration for domain-driven design foundations in enterprise applications. It shows how to leverage the dependency injection container for automatic service discovery and context-aware domain management, particularly useful for large-scale financial services platforms requiring sophisticated error handling and actor management.

## Service Implementation

```typescript
// domain-foundation.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import type { 
  IDomainContext,
  IEnterpriseActor,
  DomainValidationResult,
  ComplianceValidationRequest
} from '../types'; // From your application
import { 
  BaseError, 
  DomainValidationError,
  ActorContext 
} from '@vytches-ddd/domain-primitives';

@Injectable()
export class DomainFoundationService {
  private readonly domainManager: IDomainManager;
  private readonly actorManager: IActorManager;
  private readonly errorOrchestrator: IErrorOrchestrator;

  constructor() {
    // ⭐ FOCUS: @vytches-ddd/di integration for domain services
    this.domainManager = VytchesDDD.resolve<IDomainManager>('domainManager');
    this.actorManager = VytchesDDD.resolve<IActorManager>('actorManager');
    this.errorOrchestrator = VytchesDDD.resolve<IErrorOrchestrator>('errorOrchestrator');
  }

  // ✅ FOCUS: Enterprise domain validation with actor context
  async validateDomainOperation(
    request: ComplianceValidationRequest,
    actorContext: ActorContext
  ): Promise<DomainValidationResult> {
    try {
      // Resolve actor from VytchesDDD container with context
      const actor = await this.actorManager.resolveActor(
        actorContext.actorId,
        actorContext.tenantId
      );

      // Validate domain operation with actor permissions
      return await this.domainManager.validateOperation(request, actor);
    } catch (error) {
      // Enhanced error handling with orchestration
      const orchestratedError = await this.errorOrchestrator.handleDomainError(
        error as BaseError,
        { actor: actorContext, operation: 'validateDomainOperation' }
      );
      throw orchestratedError;
    }
  }

  // ✅ FOCUS: Context-aware actor management
  async switchActorContext(
    currentActor: IEnterpriseActor,
    newContext: IDomainContext
  ): Promise<IEnterpriseActor> {
    try {
      // Use VytchesDDD services for context switching
      const contextValidator = VytchesDDD.resolve<IContextValidator>('contextValidator');
      
      await contextValidator.validateContextSwitch(currentActor, newContext);
      return await this.actorManager.switchContext(currentActor, newContext);
    } catch (error) {
      throw new DomainValidationError(
        'Context switch validation failed',
        'CONTEXT_SWITCH_FAILED',
        { 
          currentActor: currentActor.id,
          targetContext: newContext.contextId 
        }
      );
    }
  }

  // ✅ FOCUS: Enterprise error recovery coordination
  async orchestrateErrorRecovery(
    error: BaseError,
    recoveryContext: IDomainContext
  ): Promise<void> {
    try {
      // Advanced error orchestration through DI
      await this.errorOrchestrator.initiateRecovery(error, recoveryContext);
    } catch (recoveryError) {
      // Escalate to emergency protocols
      const emergencyManager = VytchesDDD.resolve<IEmergencyManager>('emergencyManager');
      await emergencyManager.initiateEmergencyProtocol(recoveryError as BaseError);
    }
  }
}
```

## Module Configuration

```typescript
// domain-foundation.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { DomainFoundationService } from './domain-foundation.service';

@Module({
  providers: [DomainFoundationService],
  exports: [DomainFoundationService],
})
export class DomainFoundationModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD before using services
    await VytchesDDD.configure();
  }
}
```

## Usage Example

```typescript
// Example usage in a controller or service
export class FinancialTransactionController {
  constructor(
    private readonly domainFoundationService: DomainFoundationService
  ) {}

  async processTransaction(transactionData: TransactionData, actor: IEnterpriseActor) {
    const validationRequest: ComplianceValidationRequest = {
      operation: 'FINANCIAL_TRANSACTION',
      data: transactionData,
      complianceLevel: 'CRITICAL',
      regulatoryFramework: ['SOX', 'PCI_DSS']
    };

    const actorContext = ActorContext.create({
      actorId: actor.id,
      tenantId: actor.tenantId,
      sessionId: 'transaction-session-123'
    });

    const validationResult = await this.domainFoundationService.validateDomainOperation(
      validationRequest,
      actorContext
    );

    if (!validationResult.isValid) {
      throw new DomainValidationError(
        'Transaction validation failed',
        'TRANSACTION_VALIDATION_FAILED',
        { violations: validationResult.violations }
      );
    }

    // Proceed with transaction processing...
  }
}
```

## Key Features

- **VytchesDDD DI Integration**: Advanced dependency injection with service locator pattern
- **Context-Aware Services**: Domain services with tenant and organizational context
- **Actor Management**: Enterprise actor resolution and context switching
- **Error Orchestration**: Sophisticated error handling with recovery coordination
- **Compliance Integration**: Built-in regulatory compliance validation
- **Emergency Protocols**: Automatic escalation for critical system failures

## Common Pitfalls

- **Missing Container Initialization**: Always call `VytchesDDD.configure()` in `OnModuleInit`
- **Service Resolution Timing**: Ensure services are resolved after container configuration
- **Context Validation**: Always validate actor context before domain operations
- **Error Swallowing**: Don't catch and ignore domain errors without proper handling
- **Circular Dependencies**: Be careful with complex domain service interdependencies

## Related Examples

- [Enterprise Domain Management](../../intermediate/example-1.md) - Base domain implementation
- [Multi-Tenant Actor Management](../../intermediate/example-3.md) - Advanced actor patterns
- [Basic NestJS Integration](../basic/example-1.md) - Simple manual setup approach
- [Enterprise Platform Integration](../advanced/example-1.md) - Complete platform setup