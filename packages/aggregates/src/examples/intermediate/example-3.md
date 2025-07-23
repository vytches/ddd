# Multi-Tenant Loan Application - Complex Workflow Aggregate

**Version**: 1.0.0 **Package**: @vytches-ddd/aggregates **Complexity**:
Intermediate **Domain**: Financial Services & Multi-Tenancy **Patterns**:
Workflow Management, Multi-Tenant Architecture, Approval Chain, Document
Management **Dependencies**: @vytches-ddd/aggregates,
@vytches-ddd/domain-primitives, @vytches-ddd/contracts

## Description

This example demonstrates a sophisticated loan application aggregate that
manages complex approval workflows across multiple tenants. It handles document
collection, multi-step approval processes, risk assessment integration, and
maintains detailed audit trails for regulatory compliance.

## Business Context

A multi-tenant lending platform serves multiple financial institutions, each
with their own approval processes, risk criteria, and compliance requirements.
The system must handle various loan types, coordinate approval workflows, manage
document requirements, and provide complete audit trails for regulatory
compliance.

## Code Example

```typescript
// loan-application.aggregate.ts
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { DomainEvent } from '@vytches-ddd/contracts';
import { BaseError, EntityId } from '@vytches-ddd/domain-primitives';
import {
  LoanApplicationData,
  LoanType,
  LoanStatus,
  ApprovalStep,
  DocumentRequirement,
  RiskAssessment,
  TenantConfig,
} from './types'; // From your application

// Domain Events
export class LoanApplicationSubmittedEvent extends DomainEvent {
  constructor(
    public readonly applicationId: string,
    public readonly applicantId: string,
    public readonly tenantId: string,
    public readonly loanType: LoanType,
    public readonly requestedAmount: number,
    public readonly submittedAt: Date
  ) {
    super();
  }
}

export class DocumentUploadedEvent extends DomainEvent {
  constructor(
    public readonly applicationId: string,
    public readonly documentType: string,
    public readonly documentId: string,
    public readonly uploadedBy: string,
    public readonly uploadedAt: Date
  ) {
    super();
  }
}

export class ApprovalStepCompletedEvent extends DomainEvent {
  constructor(
    public readonly applicationId: string,
    public readonly stepName: string,
    public readonly approver: string,
    public readonly decision: 'approved' | 'rejected' | 'conditional',
    public readonly comments: string,
    public readonly completedAt: Date
  ) {
    super();
  }
}

export class RiskAssessmentUpdatedEvent extends DomainEvent {
  constructor(
    public readonly applicationId: string,
    public readonly previousScore: number,
    public readonly newScore: number,
    public readonly assessmentType: string,
    public readonly updatedAt: Date
  ) {
    super();
  }
}

export class LoanApprovedEvent extends DomainEvent {
  constructor(
    public readonly applicationId: string,
    public readonly approvedAmount: number,
    public readonly interestRate: number,
    public readonly term: number,
    public readonly conditions: string[],
    public readonly approvedAt: Date
  ) {
    super();
  }
}

export class LoanRejectedEvent extends DomainEvent {
  constructor(
    public readonly applicationId: string,
    public readonly rejectionReasons: string[],
    public readonly rejectedBy: string,
    public readonly rejectedAt: Date
  ) {
    super();
  }
}

export class WorkflowProgressedEvent extends DomainEvent {
  constructor(
    public readonly applicationId: string,
    public readonly fromStep: string,
    public readonly toStep: string,
    public readonly triggeredBy: string,
    public readonly progressedAt: Date
  ) {
    super();
  }
}

export class ConditionalApprovalIssuedEvent extends DomainEvent {
  constructor(
    public readonly applicationId: string,
    public readonly conditions: string[],
    public readonly expiresAt: Date,
    public readonly issuedBy: string
  ) {
    super();
  }
}

// Domain Errors
export class InvalidWorkflowTransitionError extends BaseError {
  constructor(currentStep: string, targetStep: string) {
    super(
      'INVALID_WORKFLOW_TRANSITION',
      `Cannot transition from ${currentStep} to ${targetStep}`
    );
  }
}

export class MissingDocumentError extends BaseError {
  constructor(documentType: string) {
    super('MISSING_DOCUMENT', `Required document missing: ${documentType}`);
  }
}

export class InsufficientApprovalAuthorityError extends BaseError {
  constructor(approver: string, requiredAmount: number) {
    super(
      'INSUFFICIENT_APPROVAL_AUTHORITY',
      `${approver} cannot approve amounts above ${requiredAmount}`
    );
  }
}

export class LoanAmountExceedsLimitError extends BaseError {
  constructor(requested: number, limit: number) {
    super(
      'LOAN_AMOUNT_EXCEEDS_LIMIT',
      `Requested amount ${requested} exceeds tenant limit ${limit}`
    );
  }
}

// Workflow Management
interface IWorkflowEngine {
  getNextStep(currentStep: string, decision: string): string | null;
  validateTransition(from: string, to: string): boolean;
  getRequiredDocuments(step: string): string[];
  getApprovalAuthority(step: string): number;
}

export class LoanWorkflowEngine implements IWorkflowEngine {
  private tenantConfig: TenantConfig;

  constructor(tenantConfig: TenantConfig) {
    this.tenantConfig = tenantConfig;
  }

  getNextStep(currentStep: string, decision: string): string | null {
    const workflows = {
      submitted: {
        'auto-approved': 'document-collection',
        'requires-review': 'initial-review',
      },
      'initial-review': {
        approved: 'document-collection',
        rejected: 'rejected',
        escalated: 'senior-review',
      },
      'senior-review': {
        approved: 'document-collection',
        rejected: 'rejected',
        conditional: 'conditional-approval',
      },
      'document-collection': {
        complete: 'credit-check',
        incomplete: 'document-collection',
      },
      'credit-check': {
        passed: 'risk-assessment',
        failed: 'rejected',
      },
      'risk-assessment': {
        'low-risk': 'final-approval',
        'medium-risk': 'manager-approval',
        'high-risk': 'committee-review',
      },
      'manager-approval': {
        approved: 'final-approval',
        rejected: 'rejected',
        escalated: 'committee-review',
      },
      'committee-review': {
        approved: 'final-approval',
        rejected: 'rejected',
        conditional: 'conditional-approval',
      },
      'conditional-approval': {
        'conditions-met': 'final-approval',
        'conditions-failed': 'rejected',
      },
      'final-approval': {
        approved: 'approved',
        rejected: 'rejected',
      },
    };

    return workflows[currentStep]?.[decision] || null;
  }

  validateTransition(from: string, to: string): boolean {
    const validTransitions = {
      submitted: ['initial-review', 'document-collection'],
      'initial-review': ['document-collection', 'senior-review', 'rejected'],
      'senior-review': [
        'document-collection',
        'conditional-approval',
        'rejected',
      ],
      'document-collection': ['credit-check'],
      'credit-check': ['risk-assessment', 'rejected'],
      'risk-assessment': [
        'final-approval',
        'manager-approval',
        'committee-review',
      ],
      'manager-approval': ['final-approval', 'committee-review', 'rejected'],
      'committee-review': [
        'final-approval',
        'conditional-approval',
        'rejected',
      ],
      'conditional-approval': ['final-approval', 'rejected'],
      'final-approval': ['approved', 'rejected'],
    };

    return validTransitions[from]?.includes(to) || false;
  }

  getRequiredDocuments(step: string): string[] {
    const documentRequirements = {
      'document-collection': [
        'identity-verification',
        'income-verification',
        'employment-verification',
        'bank-statements',
      ],
      'credit-check': ['credit-authorization'],
      'risk-assessment': ['financial-statements', 'collateral-valuation'],
    };

    return documentRequirements[step] || [];
  }

  getApprovalAuthority(step: string): number {
    const authorityLimits = {
      'initial-review':
        this.tenantConfig.approvalLimits?.initialReview || 50000,
      'manager-approval': this.tenantConfig.approvalLimits?.manager || 250000,
      'senior-review': this.tenantConfig.approvalLimits?.senior || 500000,
      'committee-review':
        this.tenantConfig.approvalLimits?.committee || 1000000,
    };

    return authorityLimits[step] || 0;
  }
}

// Main Loan Application Aggregate
export class MultiTenantLoanApplicationAggregate extends AggregateRoot {
  private tenantId: string;
  private applicantId: string;
  private applicationNumber: string;
  private loanType: LoanType;
  private requestedAmount: number;
  private approvedAmount?: number;
  private currency: string;
  private term: number; // months
  private interestRate?: number;
  private status: LoanStatus;
  private currentWorkflowStep: string;
  private approvalHistory: ApprovalStep[];
  private uploadedDocuments: Map<string, any>;
  private riskAssessments: RiskAssessment[];
  private conditions: string[];
  private rejectionReasons: string[];
  private submittedAt: Date;
  private updatedAt: Date;
  private expiresAt?: Date;

  // Multi-tenant configuration
  private workflowEngine: IWorkflowEngine;
  private tenantConfig: TenantConfig;

  private constructor(id: EntityId, tenantConfig: TenantConfig) {
    super(id);
    this.status = 'draft';
    this.currentWorkflowStep = 'submitted';
    this.approvalHistory = [];
    this.uploadedDocuments = new Map();
    this.riskAssessments = [];
    this.conditions = [];
    this.rejectionReasons = [];
    this.currency = 'USD';

    this.tenantConfig = tenantConfig;
    this.workflowEngine = new LoanWorkflowEngine(tenantConfig);
  }

  // ⭐ Factory method with tenant awareness
  static create(
    tenantId: string,
    applicantId: string,
    loanData: {
      loanType: LoanType;
      requestedAmount: number;
      currency?: string;
      term: number;
    },
    tenantConfig: TenantConfig
  ): MultiTenantLoanApplicationAggregate {
    const application = new MultiTenantLoanApplicationAggregate(
      EntityId.generate(),
      tenantConfig
    );

    // Validate tenant limits
    if (loanData.requestedAmount > tenantConfig.maxLoanAmount) {
      throw new LoanAmountExceedsLimitError(
        loanData.requestedAmount,
        tenantConfig.maxLoanAmount
      );
    }

    application.tenantId = tenantId;
    application.applicantId = applicantId;
    application.applicationNumber =
      application.generateApplicationNumber(tenantId);
    application.loanType = loanData.loanType;
    application.requestedAmount = loanData.requestedAmount;
    application.currency = loanData.currency || 'USD';
    application.term = loanData.term;
    application.submittedAt = new Date();
    application.updatedAt = new Date();

    application.addDomainEvent(
      new LoanApplicationSubmittedEvent(
        application.id.value,
        applicantId,
        tenantId,
        loanData.loanType,
        loanData.requestedAmount,
        application.submittedAt
      )
    );

    return application;
  }

  // ⭐ Document management
  uploadDocument(
    documentType: string,
    documentId: string,
    uploadedBy: string,
    metadata?: any
  ): void {
    this.ensureApplicationActive();

    // Store document reference
    this.uploadedDocuments.set(documentType, {
      documentId,
      documentType,
      uploadedBy,
      uploadedAt: new Date(),
      metadata: metadata || {},
    });

    this.updatedAt = new Date();

    this.addDomainEvent(
      new DocumentUploadedEvent(
        this.id.value,
        documentType,
        documentId,
        uploadedBy,
        new Date()
      )
    );

    // Check if this completes document collection step
    if (this.currentWorkflowStep === 'document-collection') {
      this.checkDocumentCompleteness();
    }
  }

  // ⭐ Approval workflow management
  processApprovalStep(
    stepName: string,
    approver: string,
    decision: 'approved' | 'rejected' | 'conditional' | 'escalated',
    comments: string,
    conditions?: string[]
  ): void {
    this.ensureApplicationActive();

    if (stepName !== this.currentWorkflowStep) {
      throw new BaseError(
        'INVALID_APPROVAL_STEP',
        `Expected ${this.currentWorkflowStep}, got ${stepName}`
      );
    }

    // Check approver authority
    const requiredAuthority =
      this.workflowEngine.getApprovalAuthority(stepName);
    if (this.requestedAmount > requiredAuthority && decision === 'approved') {
      throw new InsufficientApprovalAuthorityError(approver, requiredAuthority);
    }

    // Record approval step
    const approvalStep: ApprovalStep = {
      step: stepName,
      status: decision,
      reviewer: approver,
      comments,
      timestamp: new Date(),
      conditions: conditions || [],
    };

    this.approvalHistory.push(approvalStep);

    // Handle conditions for conditional approval
    if (decision === 'conditional' && conditions && conditions.length > 0) {
      this.conditions.push(...conditions);
    }

    this.updatedAt = new Date();

    this.addDomainEvent(
      new ApprovalStepCompletedEvent(
        this.id.value,
        stepName,
        approver,
        decision,
        comments,
        new Date()
      )
    );

    // Progress workflow
    this.progressWorkflow(decision);
  }

  // ⭐ Risk assessment integration
  updateRiskAssessment(
    assessmentType: string,
    score: number,
    factors: string[],
    assessedBy: string
  ): void {
    this.ensureApplicationActive();

    const previousScore = this.getCurrentRiskScore();

    const riskAssessment: RiskAssessment = {
      type: assessmentType,
      score,
      factors,
      assessedBy,
      assessedAt: new Date(),
      recommendation: this.determineRiskRecommendation(score),
    };

    this.riskAssessments.push(riskAssessment);
    this.updatedAt = new Date();

    this.addDomainEvent(
      new RiskAssessmentUpdatedEvent(
        this.id.value,
        previousScore,
        score,
        assessmentType,
        new Date()
      )
    );

    // Auto-progress workflow based on risk score
    if (this.currentWorkflowStep === 'risk-assessment') {
      this.autoProgressBasedOnRisk(score);
    }
  }

  // ⭐ Final approval/rejection
  finalApproval(
    approver: string,
    approvedAmount: number,
    interestRate: number,
    finalConditions: string[] = []
  ): void {
    this.ensureApplicationActive();

    if (this.currentWorkflowStep !== 'final-approval') {
      throw new BaseError(
        'INVALID_WORKFLOW_STATE',
        'Application not ready for final approval'
      );
    }

    this.status = 'approved';
    this.approvedAmount = approvedAmount;
    this.interestRate = interestRate;
    this.conditions = finalConditions;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new LoanApprovedEvent(
        this.id.value,
        approvedAmount,
        interestRate,
        this.term,
        finalConditions,
        new Date()
      )
    );
  }

  reject(rejectedBy: string, reasons: string[]): void {
    this.ensureApplicationActive();

    this.status = 'rejected';
    this.rejectionReasons = reasons;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new LoanRejectedEvent(this.id.value, reasons, rejectedBy, new Date())
    );
  }

  // ⭐ Conditional approval handling
  issueConditionalApproval(
    conditions: string[],
    expirationDays: number,
    issuedBy: string
  ): void {
    this.ensureApplicationActive();

    this.status = 'conditional';
    this.conditions = conditions;
    this.expiresAt = new Date(
      Date.now() + expirationDays * 24 * 60 * 60 * 1000
    );
    this.currentWorkflowStep = 'conditional-approval';
    this.updatedAt = new Date();

    this.addDomainEvent(
      new ConditionalApprovalIssuedEvent(
        this.id.value,
        conditions,
        this.expiresAt,
        issuedBy
      )
    );
  }

  meetConditions(conditionsMet: string[], verifiedBy: string): void {
    if (this.status !== 'conditional') {
      throw new BaseError(
        'NOT_CONDITIONAL',
        'Application is not in conditional status'
      );
    }

    // Check if all conditions are met
    const remainingConditions = this.conditions.filter(
      c => !conditionsMet.includes(c)
    );

    if (remainingConditions.length === 0) {
      // All conditions met, progress to final approval
      this.currentWorkflowStep = 'final-approval';
      this.status = 'under_review';
      this.progressWorkflow('conditions-met');
    }

    this.updatedAt = new Date();
  }

  // ⭐ Private workflow methods
  private progressWorkflow(decision: string): void {
    const nextStep = this.workflowEngine.getNextStep(
      this.currentWorkflowStep,
      decision
    );

    if (!nextStep) {
      return; // No transition available
    }

    if (
      !this.workflowEngine.validateTransition(
        this.currentWorkflowStep,
        nextStep
      )
    ) {
      throw new InvalidWorkflowTransitionError(
        this.currentWorkflowStep,
        nextStep
      );
    }

    const previousStep = this.currentWorkflowStep;
    this.currentWorkflowStep = nextStep;

    // Update status based on workflow step
    this.updateStatusFromWorkflowStep(nextStep);

    this.addDomainEvent(
      new WorkflowProgressedEvent(
        this.id.value,
        previousStep,
        nextStep,
        'system',
        new Date()
      )
    );
  }

  private checkDocumentCompleteness(): void {
    const requiredDocs = this.workflowEngine.getRequiredDocuments(
      'document-collection'
    );
    const uploadedTypes = Array.from(this.uploadedDocuments.keys());

    const missingDocs = requiredDocs.filter(
      doc => !uploadedTypes.includes(doc)
    );

    if (missingDocs.length === 0) {
      // All documents uploaded, progress to next step
      this.progressWorkflow('complete');
    }
  }

  private autoProgressBasedOnRisk(riskScore: number): void {
    let decision: string;

    if (riskScore <= 30) {
      decision = 'low-risk';
    } else if (riskScore <= 70) {
      decision = 'medium-risk';
    } else {
      decision = 'high-risk';
    }

    this.progressWorkflow(decision);
  }

  private determineRiskRecommendation(score: number): string {
    if (score <= 30) return 'approve';
    if (score <= 50) return 'review';
    if (score <= 70) return 'escalate';
    return 'reject';
  }

  private updateStatusFromWorkflowStep(step: string): void {
    const statusMap = {
      rejected: 'rejected',
      approved: 'approved',
      'conditional-approval': 'conditional',
      'final-approval': 'under_review',
    };

    if (statusMap[step]) {
      this.status = statusMap[step];
    } else {
      this.status = 'under_review';
    }
  }

  private ensureApplicationActive(): void {
    if (this.status === 'approved') {
      throw new BaseError(
        'APPLICATION_APPROVED',
        'Cannot modify approved application'
      );
    }

    if (this.status === 'rejected') {
      throw new BaseError(
        'APPLICATION_REJECTED',
        'Cannot modify rejected application'
      );
    }

    if (this.expiresAt && new Date() > this.expiresAt) {
      throw new BaseError(
        'APPLICATION_EXPIRED',
        'Conditional approval has expired'
      );
    }
  }

  private generateApplicationNumber(tenantId: string): string {
    const prefix = this.tenantConfig.applicationPrefix || 'APP';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `${prefix}-${tenantId.slice(-3).toUpperCase()}-${timestamp}-${random}`;
  }

  private getCurrentRiskScore(): number {
    return this.riskAssessments.length > 0
      ? this.riskAssessments[this.riskAssessments.length - 1].score
      : 0;
  }

  // ⭐ Query methods
  getApplicationSummary(): any {
    return {
      applicationId: this.id.value,
      applicationNumber: this.applicationNumber,
      tenantId: this.tenantId,
      applicantId: this.applicantId,
      loanType: this.loanType,
      requestedAmount: this.requestedAmount,
      approvedAmount: this.approvedAmount,
      status: this.status,
      currentStep: this.currentWorkflowStep,
      interestRate: this.interestRate,
      term: this.term,
      riskScore: this.getCurrentRiskScore(),
      documentsUploaded: this.uploadedDocuments.size,
      approvalSteps: this.approvalHistory.length,
      conditions: this.conditions,
      submittedAt: this.submittedAt,
      updatedAt: this.updatedAt,
      expiresAt: this.expiresAt,
    };
  }

  getWorkflowStatus(): any {
    const requiredDocs = this.workflowEngine.getRequiredDocuments(
      this.currentWorkflowStep
    );
    const uploadedTypes = Array.from(this.uploadedDocuments.keys());
    const missingDocs = requiredDocs.filter(
      doc => !uploadedTypes.includes(doc)
    );

    return {
      currentStep: this.currentWorkflowStep,
      status: this.status,
      requiredDocuments: requiredDocs,
      uploadedDocuments: uploadedTypes,
      missingDocuments: missingDocs,
      completedApprovals: this.approvalHistory.length,
      nextPossibleActions: this.getNextPossibleActions(),
    };
  }

  getApprovalChain(): ApprovalStep[] {
    return [...this.approvalHistory];
  }

  getRiskProfile(): any {
    return {
      currentScore: this.getCurrentRiskScore(),
      assessmentHistory: this.riskAssessments,
      riskFactors: this.riskAssessments.flatMap(r => r.factors),
      recommendation:
        this.riskAssessments.length > 0
          ? this.riskAssessments[this.riskAssessments.length - 1].recommendation
          : 'pending',
    };
  }

  private getNextPossibleActions(): string[] {
    const actions = [];

    if (this.currentWorkflowStep === 'document-collection') {
      const requiredDocs = this.workflowEngine.getRequiredDocuments(
        this.currentWorkflowStep
      );
      const missingDocs = requiredDocs.filter(
        doc => !this.uploadedDocuments.has(doc)
      );
      if (missingDocs.length > 0) {
        actions.push('upload-documents');
      } else {
        actions.push('progress-to-credit-check');
      }
    }

    if (
      [
        'initial-review',
        'senior-review',
        'manager-approval',
        'committee-review',
        'final-approval',
      ].includes(this.currentWorkflowStep)
    ) {
      actions.push('approve', 'reject', 'request-more-info');
    }

    if (this.status === 'conditional') {
      actions.push('meet-conditions', 'extend-deadline');
    }

    return actions;
  }

  // ⭐ Snapshot
  toSnapshot(): LoanApplicationData {
    return {
      id: this.id.value,
      tenantId: this.tenantId,
      applicantId: this.applicantId,
      applicationNumber: this.applicationNumber,
      loanType: this.loanType,
      requestedAmount: this.requestedAmount,
      approvedAmount: this.approvedAmount,
      currency: this.currency,
      term: this.term,
      interestRate: this.interestRate,
      status: this.status,
      currentWorkflowStep: this.currentWorkflowStep,
      approvalHistory: this.approvalHistory,
      uploadedDocuments: Array.from(this.uploadedDocuments.entries()),
      riskAssessments: this.riskAssessments,
      conditions: this.conditions,
      rejectionReasons: this.rejectionReasons,
      submittedAt: this.submittedAt,
      updatedAt: this.updatedAt,
      expiresAt: this.expiresAt,
    };
  }
}

// Usage example
export function multiTenantLoanExample(): void {
  // Tenant configuration
  const tenantConfig: TenantConfig = {
    tenantId: 'BANK-001',
    maxLoanAmount: 500000,
    applicationPrefix: 'LOAN',
    approvalLimits: {
      initialReview: 50000,
      manager: 200000,
      senior: 500000,
      committee: 1000000,
    },
    requiredDocuments: ['identity', 'income', 'employment'],
    workflowSteps: [
      'submitted',
      'initial-review',
      'document-collection',
      'risk-assessment',
      'final-approval',
    ],
  };

  // Create loan application
  const application = MultiTenantLoanApplicationAggregate.create(
    'BANK-001',
    'CUSTOMER-123',
    {
      loanType: 'personal',
      requestedAmount: 75000,
      currency: 'USD',
      term: 60,
    },
    tenantConfig
  );

  console.log('Application created:', application.getApplicationSummary());

  // Upload required documents
  application.uploadDocument(
    'identity-verification',
    'DOC-001',
    'CUSTOMER-123',
    { verified: true }
  );
  application.uploadDocument('income-verification', 'DOC-002', 'CUSTOMER-123', {
    annualIncome: 85000,
  });
  application.uploadDocument(
    'employment-verification',
    'DOC-003',
    'CUSTOMER-123',
    { employer: 'Tech Corp' }
  );

  console.log('Workflow status:', application.getWorkflowStatus());

  // Process approval steps
  application.processApprovalStep(
    'initial-review',
    'MANAGER-001',
    'approved',
    'Documentation looks good, proceeding to next step'
  );

  // Add risk assessment
  application.updateRiskAssessment(
    'credit-score',
    25, // Low risk score
    ['good-credit-history', 'stable-employment', 'adequate-income'],
    'RISK-ENGINE-001'
  );

  // Final approval
  application.finalApproval('SENIOR-001', 70000, 4.5, ['Insurance required']);

  console.log('Final application state:', application.getApplicationSummary());
  console.log('Approval chain:', application.getApprovalChain());
  console.log('Risk profile:', application.getRiskProfile());
  console.log('Domain events:', application.getUncommittedEvents().length);
}
```

## Key Features

- **Multi-Tenant Architecture**: Configurable workflows per tenant
- **Complex Workflow Management**: Multi-step approval processes with validation
- **Document Management**: Required document tracking and completion
  verification
- **Risk Assessment Integration**: Automated risk scoring with workflow
  progression
- **Approval Authority Validation**: Hierarchical approval limits enforcement
- **Conditional Approvals**: Time-limited conditional approval with condition
  tracking
- **Comprehensive Audit Trail**: Complete history of all application changes

## Workflow Engine Benefits

1. **Flexibility**: Each tenant can configure their own approval process
2. **Compliance**: Enforces required steps and documentation
3. **Automation**: Automatic progression based on risk scores and document
   completion
4. **Validation**: Prevents invalid workflow transitions

## Multi-Tenant Features

- **Tenant Isolation**: Each tenant has separate configuration and limits
- **Configurable Workflows**: Custom approval steps per tenant
- **Authority Limits**: Tenant-specific approval authority levels
- **Document Requirements**: Customizable document requirements

## Risk Assessment Integration

- **Multiple Assessment Types**: Credit score, income verification, collateral
  valuation
- **Automatic Workflow Progression**: Low-risk applications fast-track to
  approval
- **Historical Tracking**: Complete risk assessment history maintained

## Common Pitfalls

- **Workflow Complexity**: Keep workflow rules manageable and well-documented
- **Document Management**: Ensure proper document validation and storage
- **Authority Validation**: Always verify approver authority before processing
- **Tenant Isolation**: Maintain strict separation between tenant configurations

## Related Examples

- [Event Sourced Shopping Cart](./example-1.md)
- [Banking Account with Capabilities](./example-2.md)
- [Advanced Process Orchestration](../advanced/example-1.md)
