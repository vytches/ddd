// Advanced Domain Service Implementation with Saga Pattern import {
BaseDomainService } from '@vytches/ddd-domain-services'; import { Result } from
'@vytches/ddd-utils'; import { DomainError } from
'@vytches/ddd-domain-primitives'; import { IUnitOfWork } from
'@vytches/ddd-repositories'; import { DomainEvent, IEventBus } from
'@vytches/ddd-events'; import { Logger } from '@vytches/ddd-logging'; import {
LoanApplication, LoanApprovalCommand, CreditCheckService, CollateralService,
RiskAssessmentService, ComplianceService, LoanRepository, ApprovalWorkflow,
LoanApprovedEvent, LoanRejectedEvent } from '../types';

export class LoanApprovalService extends BaseDomainService { private logger =
Logger.forContext('LoanApprovalService');

constructor( private unitOfWork: IUnitOfWork, private eventBus: IEventBus,
private creditCheckService: CreditCheckService, private collateralService:
CollateralService, private riskAssessmentService: RiskAssessmentService, private
complianceService: ComplianceService ) { super('LoanApprovalService'); }

async processLoanApproval( command: LoanApprovalCommand ):
Promise<Result<LoanApplication, DomainError>> { const workflow = new
ApprovalWorkflow(command.applicationId);

    try {
      // Start unit of work for transactional consistency
      await this.unitOfWork.begin();

      // Step 1: Load loan application
      const loanRepo = this.unitOfWork.getRepository<LoanRepository>('loans');
      const application = await loanRepo.findById(command.applicationId);

      if (!application) {
        return Result.failure(
          new DomainError(
            'LOAN_NOT_FOUND',
            `Loan application ${command.applicationId} not found`
          )
        );
      }

      workflow.recordStep('application_loaded');

      // Step 2: Credit check with compensation
      const creditResult = await this.performCreditCheck(application, workflow);
      if (creditResult.isFailure()) {
        await this.compensate(workflow);
        await this.unitOfWork.rollback();
        return creditResult;
      }

      // Step 3: Collateral valuation
      const collateralResult = await this.evaluateCollateral(application, workflow);
      if (collateralResult.isFailure()) {
        await this.compensate(workflow);
        await this.unitOfWork.rollback();
        return collateralResult;
      }

      // Step 4: Risk assessment
      const riskResult = await this.assessRisk(application, workflow);
      if (riskResult.isFailure()) {
        await this.compensate(workflow);
        await this.unitOfWork.rollback();
        return riskResult;
      }

      // Step 5: Compliance check
      const complianceResult = await this.checkCompliance(application, workflow);
      if (complianceResult.isFailure()) {
        await this.compensate(workflow);
        await this.unitOfWork.rollback();
        return complianceResult;
      }

      // Step 6: Make final decision
      const decision = this.makeApprovalDecision(
        creditResult.value!,
        collateralResult.value!,
        riskResult.value!,
        complianceResult.value!
      );

      // Update application
      application.status = decision.approved ? 'approved' : 'rejected';
      application.approvalDetails = decision;
      application.processedAt = new Date();

      // Save changes
      await loanRepo.save(application);

      // Publish appropriate event
      const event = decision.approved
        ? new LoanApprovedEvent(application)
        : new LoanRejectedEvent(application, decision.rejectionReasons);

      await this.eventBus.publish(event);

      // Commit transaction
      await this.unitOfWork.commit();

      this.logger.info('Loan approval processed', {
        applicationId: application.id,
        decision: decision.approved ? 'approved' : 'rejected'
      });

      return Result.success(application);

    } catch (error) {
      await this.compensate(workflow);
      await this.unitOfWork.rollback();

      this.logger.error('Loan approval failed', {
        applicationId: command.applicationId,
        error: error.message,
        workflowState: workflow.getState()
      });

      return Result.failure(
        new DomainError(
          'LOAN_APPROVAL_FAILED',
          `Failed to process loan approval: ${error.message}`,
          { workflow: workflow.getState() }
        )
      );
    }

}

private async performCreditCheck( application: LoanApplication, workflow:
ApprovalWorkflow ): Promise<Result<CreditCheckResult, DomainError>> { try {
const result = await this.creditCheckService.checkCredit(
application.applicantId, { includeHistory: true } );

      workflow.recordStep('credit_check_completed', {
        score: result.score,
        rating: result.rating
      });

      if (result.score < application.minimumCreditScore) {
        return Result.failure(
          new DomainError(
            'CREDIT_SCORE_TOO_LOW',
            `Credit score ${result.score} below minimum ${application.minimumCreditScore}`
          )
        );
      }

      return Result.success(result);
    } catch (error) {
      return Result.failure(
        new DomainError('CREDIT_CHECK_FAILED', error.message)
      );
    }

}

private async evaluateCollateral( application: LoanApplication, workflow:
ApprovalWorkflow ): Promise<Result<CollateralValuation, DomainError>> { if
(!application.requiresCollateral) { return Result.success({ value: 0, ratio: 0
}); }

    try {
      const valuation = await this.collateralService.evaluate(
        application.collateralIds
      );

      workflow.recordStep('collateral_evaluated', {
        totalValue: valuation.totalValue,
        ratio: valuation.loanToValueRatio
      });

      if (valuation.loanToValueRatio > 0.8) {
        return Result.failure(
          new DomainError(
            'INSUFFICIENT_COLLATERAL',
            `LTV ratio ${valuation.loanToValueRatio} exceeds maximum 0.8`
          )
        );
      }

      return Result.success(valuation);
    } catch (error) {
      return Result.failure(
        new DomainError('COLLATERAL_EVALUATION_FAILED', error.message)
      );
    }

}

private async assessRisk( application: LoanApplication, workflow:
ApprovalWorkflow ): Promise<Result<RiskAssessment, DomainError>> { try { const
assessment = await this.riskAssessmentService.assess({ applicantId:
application.applicantId, loanAmount: application.requestedAmount, loanTerm:
application.termMonths, purpose: application.purpose });

      workflow.recordStep('risk_assessed', {
        riskLevel: assessment.level,
        score: assessment.score
      });

      if (assessment.level === 'high' && !application.allowHighRisk) {
        return Result.failure(
          new DomainError(
            'RISK_TOO_HIGH',
            `Risk level ${assessment.level} not acceptable for this loan type`
          )
        );
      }

      return Result.success(assessment);
    } catch (error) {
      return Result.failure(
        new DomainError('RISK_ASSESSMENT_FAILED', error.message)
      );
    }

}

private async checkCompliance( application: LoanApplication, workflow:
ApprovalWorkflow ): Promise<Result<ComplianceCheck, DomainError>> { try { const
compliance = await this.complianceService.verify({ applicantId:
application.applicantId, loanType: application.type, amount:
application.requestedAmount });

      workflow.recordStep('compliance_checked', {
        passed: compliance.passed,
        flags: compliance.flags
      });

      if (!compliance.passed) {
        return Result.failure(
          new DomainError(
            'COMPLIANCE_CHECK_FAILED',
            `Compliance issues: ${compliance.flags.join(', ')}`
          )
        );
      }

      return Result.success(compliance);
    } catch (error) {
      return Result.failure(
        new DomainError('COMPLIANCE_CHECK_FAILED', error.message)
      );
    }

}

private makeApprovalDecision( credit: CreditCheckResult, collateral:
CollateralValuation, risk: RiskAssessment, compliance: ComplianceCheck ):
ApprovalDecision { // Complex business rules for approval const approved =
credit.score >= 700 && risk.level !== 'high' && compliance.passed &&
(collateral.ratio <= 0.8 || collateral.value === 0);

    const rejectionReasons = [];
    if (credit.score < 700) rejectionReasons.push('Insufficient credit score');
    if (risk.level === 'high') rejectionReasons.push('High risk assessment');
    if (!compliance.passed) rejectionReasons.push('Compliance issues');
    if (collateral.ratio > 0.8) rejectionReasons.push('Insufficient collateral');

    return {
      approved,
      rejectionReasons,
      approvedAmount: approved ? this.calculateApprovedAmount(credit, risk) : 0,
      interestRate: approved ? this.calculateInterestRate(credit, risk) : 0,
      conditions: this.determineConditions(credit, risk, collateral)
    };

}

private calculateApprovedAmount(credit: CreditCheckResult, risk:
RiskAssessment): number { // Business logic for amount calculation return
100000; // Simplified }

private calculateInterestRate(credit: CreditCheckResult, risk: RiskAssessment):
number { // Business logic for rate calculation return 5.5; // Simplified }

private determineConditions( credit: CreditCheckResult, risk: RiskAssessment,
collateral: CollateralValuation ): string[] { const conditions = []; if
(credit.score < 750) conditions.push('Quarterly financial reviews required'); if
(risk.score > 50) conditions.push('Additional guarantor required'); return
conditions; }

private async compensate(workflow: ApprovalWorkflow): Promise<void> { //
Compensate completed steps in reverse order const steps =
workflow.getCompletedSteps().reverse();

    for (const step of steps) {
      try {
        switch (step.name) {
          case 'credit_check_completed':
            await this.creditCheckService.cancelCheck(step.data.checkId);
            break;
          case 'collateral_evaluated':
            await this.collateralService.releaseValuation(step.data.valuationId);
            break;
          case 'risk_assessed':
            await this.riskAssessmentService.cancelAssessment(step.data.assessmentId);
            break;
        }

        this.logger.info('Compensated step', { step: step.name });
      } catch (error) {
        this.logger.error('Compensation failed', {
          step: step.name,
          error: error.message
        });
      }
    }

} }
