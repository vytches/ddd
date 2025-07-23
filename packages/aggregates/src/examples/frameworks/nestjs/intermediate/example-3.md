# Multi-Tenant Loan Application - NestJS Integration

**Focus**: Multi-tenant loan workflow management in NestJS **Base Example**:
[Multi-Tenant Loan Application](../../intermediate/example-3.md)
**Dependencies**: @nestjs/common, @vytches-ddd/aggregates, @vytches-ddd/di

## Service Implementation

```typescript
// loan-application.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { EntityId } from '@vytches-ddd/domain-primitives';
import {
  LoanApplication,
  CreateLoanData,
  ApprovalStep,
  DocumentUpload,
  RiskAssessment,
  TenantConfig,
  WorkflowStatus,
} from './types'; // From your application

@Injectable()
export class LoanApplicationService {
  private readonly logger = new Logger(LoanApplicationService.name);

  // ✅ FOCUS: Multi-tenant loan application creation
  async createLoanApplication(
    tenantId: string,
    loanData: CreateLoanData,
    tenantConfig: TenantConfig
  ): Promise<LoanApplication> {
    try {
      const LoanApplicationAggregateClass = VytchesDDD.resolve<any>(
        'MultiTenantLoanApplicationAggregate'
      );

      // Use library factory with tenant configuration
      const loanAggregate = LoanApplicationAggregateClass.create(
        tenantId,
        loanData.applicantId,
        loanData,
        tenantConfig
      );

      const loan = loanAggregate.toSnapshot();

      this.logger.log(
        `Loan application created: ${loan.applicationNumber} for tenant ${tenantId}`
      );
      return loan;
    } catch (error) {
      this.logger.error(`Failed to create loan application: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Document management
  async uploadDocument(
    applicationId: string,
    documentType: string,
    documentId: string,
    uploadedBy: string
  ): Promise<LoanApplication> {
    try {
      const LoanApplicationAggregateClass = VytchesDDD.resolve<any>(
        'MultiTenantLoanApplicationAggregate'
      );
      const loanAggregate = await this.loadLoanApplication(
        applicationId,
        LoanApplicationAggregateClass
      );

      // Use library document management method
      loanAggregate.uploadDocument(documentType, documentId, uploadedBy);

      const updatedLoan = loanAggregate.toSnapshot();

      this.logger.log(
        `Document uploaded for application ${applicationId}: ${documentType}`
      );
      return updatedLoan;
    } catch (error) {
      this.logger.error(`Failed to upload document: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Workflow progression
  async processApprovalStep(
    applicationId: string,
    stepName: string,
    approver: string,
    decision: 'approved' | 'rejected' | 'conditional' | 'escalated',
    comments: string,
    conditions?: string[]
  ): Promise<LoanApplication> {
    try {
      const LoanApplicationAggregateClass = VytchesDDD.resolve<any>(
        'MultiTenantLoanApplicationAggregate'
      );
      const loanAggregate = await this.loadLoanApplication(
        applicationId,
        LoanApplicationAggregateClass
      );

      // Use library workflow method
      loanAggregate.processApprovalStep(
        stepName,
        approver,
        decision,
        comments,
        conditions
      );

      const updatedLoan = loanAggregate.toSnapshot();

      this.logger.log(
        `Approval step processed for ${applicationId}: ${stepName} -> ${decision}`
      );
      return updatedLoan;
    } catch (error) {
      this.logger.error(`Failed to process approval step: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Risk assessment integration
  async updateRiskAssessment(
    applicationId: string,
    assessmentType: string,
    score: number,
    factors: string[],
    assessedBy: string
  ): Promise<LoanApplication> {
    try {
      const LoanApplicationAggregateClass = VytchesDDD.resolve<any>(
        'MultiTenantLoanApplicationAggregate'
      );
      const loanAggregate = await this.loadLoanApplication(
        applicationId,
        LoanApplicationAggregateClass
      );

      // Use library risk assessment method
      loanAggregate.updateRiskAssessment(
        assessmentType,
        score,
        factors,
        assessedBy
      );

      const updatedLoan = loanAggregate.toSnapshot();

      this.logger.log(
        `Risk assessment updated for ${applicationId}: score ${score}`
      );
      return updatedLoan;
    } catch (error) {
      this.logger.error(`Failed to update risk assessment: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Final approval/rejection
  async approveLoan(
    applicationId: string,
    approver: string,
    approvedAmount: number,
    interestRate: number,
    conditions: string[] = []
  ): Promise<LoanApplication> {
    try {
      const LoanApplicationAggregateClass = VytchesDDD.resolve<any>(
        'MultiTenantLoanApplicationAggregate'
      );
      const loanAggregate = await this.loadLoanApplication(
        applicationId,
        LoanApplicationAggregateClass
      );

      // Use library final approval method
      loanAggregate.finalApproval(
        approver,
        approvedAmount,
        interestRate,
        conditions
      );

      const updatedLoan = loanAggregate.toSnapshot();

      this.logger.log(
        `Loan approved: ${applicationId}, amount: ${approvedAmount}`
      );
      return updatedLoan;
    } catch (error) {
      this.logger.error(`Failed to approve loan: ${error.message}`);
      throw error;
    }
  }

  async rejectLoan(
    applicationId: string,
    rejectedBy: string,
    reasons: string[]
  ): Promise<LoanApplication> {
    try {
      const LoanApplicationAggregateClass = VytchesDDD.resolve<any>(
        'MultiTenantLoanApplicationAggregate'
      );
      const loanAggregate = await this.loadLoanApplication(
        applicationId,
        LoanApplicationAggregateClass
      );

      // Use library rejection method
      loanAggregate.reject(rejectedBy, reasons);

      const updatedLoan = loanAggregate.toSnapshot();

      this.logger.log(
        `Loan rejected: ${applicationId}, reasons: ${reasons.join(', ')}`
      );
      return updatedLoan;
    } catch (error) {
      this.logger.error(`Failed to reject loan: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Query operations
  async getLoanApplication(
    applicationId: string
  ): Promise<LoanApplication | null> {
    try {
      const LoanApplicationAggregateClass = VytchesDDD.resolve<any>(
        'MultiTenantLoanApplicationAggregate'
      );
      const loanAggregate = await this.loadLoanApplication(
        applicationId,
        LoanApplicationAggregateClass
      );

      return loanAggregate.toSnapshot();
    } catch (error) {
      this.logger.warn(`Loan application not found: ${applicationId}`);
      return null;
    }
  }

  async getWorkflowStatus(applicationId: string): Promise<WorkflowStatus> {
    try {
      const LoanApplicationAggregateClass = VytchesDDD.resolve<any>(
        'MultiTenantLoanApplicationAggregate'
      );
      const loanAggregate = await this.loadLoanApplication(
        applicationId,
        LoanApplicationAggregateClass
      );

      // Use library workflow status method
      return loanAggregate.getWorkflowStatus();
    } catch (error) {
      this.logger.error(`Failed to get workflow status: ${error.message}`);
      throw error;
    }
  }

  async getApprovalChain(applicationId: string): Promise<ApprovalStep[]> {
    try {
      const LoanApplicationAggregateClass = VytchesDDD.resolve<any>(
        'MultiTenantLoanApplicationAggregate'
      );
      const loanAggregate = await this.loadLoanApplication(
        applicationId,
        LoanApplicationAggregateClass
      );

      // Use library approval chain method
      return loanAggregate.getApprovalChain();
    } catch (error) {
      this.logger.error(`Failed to get approval chain: ${error.message}`);
      return [];
    }
  }

  // Helper method for aggregate loading
  private async loadLoanApplication(
    applicationId: string,
    LoanApplicationAggregateClass: any
  ): Promise<any> {
    // Mock implementation - in reality would load from repository
    return LoanApplicationAggregateClass.fromSnapshot({
      id: applicationId,
      applicationNumber: `APP-${applicationId}`,
      tenantId: 'bank-001',
      applicantId: 'applicant-123',
      loanType: 'personal',
      requestedAmount: 50000,
      status: 'under_review',
      currentWorkflowStep: 'initial-review',
      approvalHistory: [],
      uploadedDocuments: new Map(),
      riskAssessments: [],
      conditions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// loan-application.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { LoanApplicationService } from './loan-application.service';

@Module({
  providers: [LoanApplicationService],
  exports: [LoanApplicationService],
})
export class LoanApplicationModule implements OnModuleInit {
  async onModuleInit() {
    const container = new SimpleContainer();
    await VytchesDDD.configure(container);
  }
}
```

**Key Points:**

- Multi-tenant workflow management with tenant-specific configurations
- Document upload and management integrated with workflow progression
- Risk assessment integration with automated workflow decisions
- Approval chain tracking with complete audit history

**Usage Example:**

```typescript
@Controller('loan-applications')
export class LoanApplicationController {
  constructor(private readonly loanService: LoanApplicationService) {}

  @Post()
  async createApplication(@Body() data: CreateLoanData & { tenantId: string }) {
    const tenantConfig = await this.getTenantConfig(data.tenantId);
    return await this.loanService.createLoanApplication(
      data.tenantId,
      data,
      tenantConfig
    );
  }

  @Put(':id/documents')
  async uploadDocument(
    @Param('id') id: string,
    @Body() doc: { type: string; documentId: string; uploadedBy: string }
  ) {
    return await this.loanService.uploadDocument(
      id,
      doc.type,
      doc.documentId,
      doc.uploadedBy
    );
  }

  @Put(':id/approve')
  async approveStep(
    @Param('id') id: string,
    @Body()
    approval: {
      stepName: string;
      approver: string;
      decision: string;
      comments: string;
    }
  ) {
    return await this.loanService.processApprovalStep(
      id,
      approval.stepName,
      approval.approver,
      approval.decision as any,
      approval.comments
    );
  }
}
```
