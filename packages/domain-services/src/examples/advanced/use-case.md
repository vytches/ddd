## Advanced Use Case: Financial Services Loan Approval

This example shows a complex domain service managing a multi-step loan approval
process with compensating transactions:

```typescript
// loan-approval-workflow.ts
import { LoanApprovalService } from './services/loan-approval.service';
import { UnitOfWork } from '@vytches/ddd-repositories';
import { EventBus } from '@vytches/ddd-events';
import { Logger } from '@vytches/ddd-logging';
import {
  LoanApprovalCommand,
  CreditCheckService,
  CollateralService,
  RiskAssessmentService,
  ComplianceService,
} from './domain';

class LoanApplicationProcessor {
  private logger = Logger.forContext('LoanApplicationProcessor');
  private approvalService: LoanApprovalService;

  constructor(
    private unitOfWork: UnitOfWork,
    private eventBus: EventBus
  ) {
    // Initialize external services
    const creditCheck = new CreditCheckService();
    const collateral = new CollateralService();
    const riskAssessment = new RiskAssessmentService();
    const compliance = new ComplianceService();

    this.approvalService = new LoanApprovalService(
      unitOfWork,
      eventBus,
      creditCheck,
      collateral,
      riskAssessment,
      compliance
    );
  }

  async processApplication(applicationId: string): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Create approval command
      const command: LoanApprovalCommand = {
        applicationId,
        requestedBy: 'system',
        priority: await this.determinePriority(applicationId),
        options: {
          fastTrack: false,
          requireManualReview: false,
        },
      };

      // Process with monitoring
      this.logger.info('Starting loan approval', {
        applicationId,
        priority: command.priority,
      });

      const result = await this.approvalService.processLoanApproval(command);

      const processingTime = Date.now() - startTime;

      if (result.isSuccess()) {
        this.logger.info('Loan approval completed', {
          applicationId,
          status: result.value.status,
          processingTime,
        });

        // Trigger post-approval workflows
        if (result.value.status === 'approved') {
          await this.initiatePostApprovalWorkflow(result.value);
        }

        return {
          success: true,
          application: result.value,
          processingTime,
        };
      } else {
        this.logger.error('Loan approval failed', {
          applicationId,
          error: result.error,
          processingTime,
        });

        return {
          success: false,
          error: result.error,
          processingTime,
        };
      }
    } catch (error) {
      this.logger.error('Unexpected error in loan processing', {
        applicationId,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: new Error(`System error: ${error.message}`),
        processingTime: Date.now() - startTime,
      };
    }
  }

  private async determinePriority(
    applicationId: string
  ): Promise<'low' | 'normal' | 'high'> {
    // Business logic to determine priority
    const application = await this.loadApplication(applicationId);

    if (application.amount > 1000000) return 'high';
    if (application.customerTier === 'premium') return 'high';
    if (application.processingDeadline < new Date()) return 'high';

    return 'normal';
  }

  private async initiatePostApprovalWorkflow(
    application: LoanApplication
  ): Promise<void> {
    // Create loan account
    await this.createLoanAccount(application);

    // Schedule disbursement
    await this.scheduleDisbursement(application);

    // Set up payment schedule
    await this.createPaymentSchedule(application);

    // Notify relevant parties
    await this.sendApprovalNotifications(application);
  }
}
```

## Saga Pattern Implementation

```typescript
// Complex multi-step process with compensation
class LoanApprovalSaga {
  private steps: SagaStep[] = [];
  private completedSteps: string[] = [];

  async execute(
    applicationId: string
  ): Promise<Result<LoanApplication, Error>> {
    try {
      // Step 1: Lock application
      await this.executeStep(
        'lockApplication',
        async () => {
          await this.lockApplication(applicationId);
        },
        async () => {
          await this.unlockApplication(applicationId);
        }
      );

      // Step 2: Perform credit check
      const creditScore = await this.executeStep(
        'creditCheck',
        async () => {
          return await this.performCreditCheck(applicationId);
        },
        async () => {
          await this.cancelCreditCheck(applicationId);
        }
      );

      // Step 3: Evaluate collateral
      const collateralValue = await this.executeStep(
        'collateralEvaluation',
        async () => {
          return await this.evaluateCollateral(applicationId);
        },
        async () => {
          await this.releaseCollateralEvaluation(applicationId);
        }
      );

      // Step 4: Assess risk
      const riskLevel = await this.executeStep(
        'riskAssessment',
        async () => {
          return await this.assessRisk(
            applicationId,
            creditScore,
            collateralValue
          );
        },
        async () => {
          await this.cancelRiskAssessment(applicationId);
        }
      );

      // Step 5: Final approval
      const approval = await this.executeStep('finalApproval', async () => {
        return await this.makeApprovalDecision(
          applicationId,
          creditScore,
          collateralValue,
          riskLevel
        );
      });

      return Result.success(approval);
    } catch (error) {
      // Compensate in reverse order
      await this.compensate();
      return Result.failure(error);
    }
  }

  private async executeStep<T>(
    name: string,
    action: () => Promise<T>,
    compensator?: () => Promise<void>
  ): Promise<T> {
    try {
      const result = await action();
      this.completedSteps.push(name);

      if (compensator) {
        this.steps.push({ name, compensator });
      }

      return result;
    } catch (error) {
      throw new Error(`Step ${name} failed: ${error.message}`);
    }
  }

  private async compensate(): Promise<void> {
    // Execute compensators in reverse order
    const stepsToCompensate = [...this.steps].reverse();

    for (const step of stepsToCompensate) {
      try {
        console.log(`Compensating step: ${step.name}`);
        await step.compensator();
      } catch (error) {
        console.error(`Failed to compensate ${step.name}:`, error);
        // Continue with other compensations
      }
    }
  }
}
```

## Event Sourcing Integration

```typescript
// Track all state changes for audit
class AuditedLoanApprovalService extends LoanApprovalService {
  async processLoanApproval(
    command: LoanApprovalCommand
  ): Promise<Result<LoanApplication, DomainError>> {
    // Record command
    await this.eventStore.append({
      streamId: `loan-${command.applicationId}`,
      eventType: 'LoanApprovalStarted',
      payload: command,
      metadata: {
        userId: command.requestedBy,
        timestamp: new Date(),
      },
    });

    // Execute with event tracking
    const result = await super.processLoanApproval(command);

    // Record result
    await this.eventStore.append({
      streamId: `loan-${command.applicationId}`,
      eventType: result.isSuccess()
        ? 'LoanApprovalCompleted'
        : 'LoanApprovalFailed',
      payload: result.isSuccess() ? result.value : result.error,
      metadata: {
        userId: command.requestedBy,
        timestamp: new Date(),
      },
    });

    return result;
  }
}
```
