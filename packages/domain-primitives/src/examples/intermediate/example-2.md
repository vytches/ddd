# Domain Error Hierarchies - Intermediate Example

**Version**: 1.0.0 **Package**: @vytches/ddd-domain-primitives **Complexity**:
intermediate **Domain**: Error Management **Patterns**: Domain Error Hierarchy,
Error Context, Error Classification **Dependencies**: BaseError, IDomainError,
Error Enums

## Description

Demonstrates creating sophisticated domain error hierarchies with contextual
information, error classification systems, and advanced error handling patterns
using the domain primitives error foundation.

## Business Context

Enterprise applications require comprehensive error classification systems for
different business domains (customer management, order processing, payment
handling) with proper context propagation, error correlation, and support for
audit trails and regulatory compliance.

## Code Example

```typescript
// customer-management-errors.ts
import {
  BaseError,
  IDomainError,
  DomainErrorCode,
  type DomainErrorOptions,
} from '@vytches/ddd-domain-primitives';
import { Customer, CustomerValidationContext } from './types'; // From your app

/**
 * Base error for all customer management domain errors
 */
export abstract class CustomerManagementError
  extends BaseError
  implements IDomainError
{
  public readonly domain = 'CustomerManagement';
  public readonly customerId?: string;
  public readonly correlationId?: string;
  public readonly businessContext: Record<string, any>;

  constructor(
    message: string,
    code: DomainErrorCode,
    options: DomainErrorOptions & {
      customerId?: string;
      correlationId?: string;
      businessContext?: Record<string, any>;
    } = {}
  ) {
    super(message, { code, ...options });
    this.customerId = options.customerId;
    this.correlationId = options.correlationId;
    this.businessContext = options.businessContext || {};
  }

  /**
   * Get customer-specific error context
   */
  getCustomerContext(): CustomerErrorContext {
    return {
      customerId: this.customerId,
      domain: this.domain,
      correlationId: this.correlationId,
      businessContext: this.businessContext,
      timestamp: new Date(),
      errorCode: this.code,
    };
  }

  /**
   * Check if error is customer-specific
   */
  isCustomerSpecific(): boolean {
    return Boolean(this.customerId);
  }

  /**
   * Get error severity for business context
   */
  abstract getSeverity(): 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Customer validation errors with enhanced context
 */
export class CustomerValidationError extends CustomerManagementError {
  public readonly validationContext: CustomerValidationContext;
  public readonly failedFields: string[];

  constructor(
    message: string,
    customerId: string,
    validationContext: CustomerValidationContext,
    failedFields: string[] = [],
    options: DomainErrorOptions = {}
  ) {
    super(message, DomainErrorCode.VALIDATION_FAILED, {
      customerId,
      businessContext: {
        validationType: validationContext.type,
        validationRules: validationContext.rules,
        failedFields,
      },
      ...options,
    });

    this.validationContext = validationContext;
    this.failedFields = failedFields;
  }

  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    // Critical validation errors for sensitive data
    if (
      this.failedFields.some(field =>
        ['ssn', 'taxId', 'paymentInfo'].includes(field)
      )
    ) {
      return 'critical';
    }

    // High severity for required business fields
    if (
      this.failedFields.some(field =>
        ['email', 'name', 'address'].includes(field)
      )
    ) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Get detailed validation report
   */
  getValidationReport(): CustomerValidationReport {
    return {
      customerId: this.customerId!,
      validationType: this.validationContext.type,
      failedFields: this.failedFields,
      validationRules: this.validationContext.rules,
      severity: this.getSeverity(),
      timestamp: new Date(),
      requiresManualReview: this.getSeverity() === 'critical',
    };
  }

  /**
   * Check if validation failure requires immediate attention
   */
  requiresImmediateAttention(): boolean {
    return (
      this.getSeverity() === 'critical' ||
      this.failedFields.includes('complianceFlags')
    );
  }
}

/**
 * Customer business rule violation errors
 */
export class CustomerBusinessRuleError extends CustomerManagementError {
  public readonly ruleId: string;
  public readonly ruleContext: BusinessRuleContext;
  public readonly violationType:
    | 'policy'
    | 'regulation'
    | 'business'
    | 'compliance';

  constructor(
    message: string,
    customerId: string,
    ruleId: string,
    ruleContext: BusinessRuleContext,
    violationType:
      | 'policy'
      | 'regulation'
      | 'business'
      | 'compliance' = 'business',
    options: DomainErrorOptions = {}
  ) {
    super(message, DomainErrorCode.BUSINESS_RULE_VIOLATION, {
      customerId,
      businessContext: {
        ruleId,
        violationType,
        ruleContext,
      },
      ...options,
    });

    this.ruleId = ruleId;
    this.ruleContext = ruleContext;
    this.violationType = violationType;
  }

  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.violationType) {
      case 'compliance':
      case 'regulation':
        return 'critical';
      case 'policy':
        return 'high';
      case 'business':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Get regulatory compliance context
   */
  getComplianceContext(): ComplianceErrorContext | null {
    if (
      this.violationType !== 'compliance' &&
      this.violationType !== 'regulation'
    ) {
      return null;
    }

    return {
      customerId: this.customerId!,
      ruleId: this.ruleId,
      violationType: this.violationType,
      regulatoryFramework: this.ruleContext.regulatoryFramework,
      requiresReporting: true,
      reportingDeadline: this.calculateReportingDeadline(),
      auditTrail: this.getAuditTrail(),
    };
  }

  private calculateReportingDeadline(): Date {
    // Calculate reporting deadline based on violation type
    const now = new Date();
    const daysToAdd = this.violationType === 'compliance' ? 7 : 30;
    return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  }

  private getAuditTrail(): AuditTrailEntry[] {
    return [
      {
        timestamp: new Date(),
        action: 'RULE_VIOLATION_DETECTED',
        ruleId: this.ruleId,
        customerId: this.customerId!,
        severity: this.getSeverity(),
        details: this.businessContext,
      },
    ];
  }
}

/**
 * Customer access control errors
 */
export class CustomerAccessError extends CustomerManagementError {
  public readonly attemptedAction: string;
  public readonly requiredPermissions: string[];
  public readonly currentPermissions: string[];
  public readonly accessContext: AccessControlContext;

  constructor(
    message: string,
    customerId: string,
    attemptedAction: string,
    requiredPermissions: string[],
    currentPermissions: string[],
    accessContext: AccessControlContext,
    options: DomainErrorOptions = {}
  ) {
    super(message, DomainErrorCode.ACCESS_DENIED, {
      customerId,
      businessContext: {
        attemptedAction,
        requiredPermissions,
        currentPermissions,
        accessContext,
      },
      ...options,
    });

    this.attemptedAction = attemptedAction;
    this.requiredPermissions = requiredPermissions;
    this.currentPermissions = currentPermissions;
    this.accessContext = accessContext;
  }

  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    // Critical if attempting to access sensitive operations
    if (
      this.attemptedAction.includes('delete') ||
      this.attemptedAction.includes('admin') ||
      this.requiredPermissions.some(p => p.includes('SENSITIVE'))
    ) {
      return 'critical';
    }

    // High if attempting privileged operations
    if (
      this.requiredPermissions.some(
        p => p.includes('WRITE') || p.includes('MODIFY')
      )
    ) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Get missing permissions analysis
   */
  getMissingPermissions(): string[] {
    return this.requiredPermissions.filter(
      required => !this.currentPermissions.includes(required)
    );
  }

  /**
   * Check if access violation requires security review
   */
  requiresSecurityReview(): boolean {
    return (
      this.getSeverity() === 'critical' ||
      this.getMissingPermissions().some(p => p.includes('ADMIN'))
    );
  }

  /**
   * Generate security incident report
   */
  generateSecurityIncident(): SecurityIncidentReport {
    return {
      incidentId: `SECURITY-${Date.now()}-${this.customerId}`,
      customerId: this.customerId!,
      attemptedAction: this.attemptedAction,
      timestamp: new Date(),
      severity: this.getSeverity(),
      requiresInvestigation: this.requiresSecurityReview(),
      accessContext: this.accessContext,
      missingPermissions: this.getMissingPermissions(),
      recommendedActions: this.getRecommendedActions(),
    };
  }

  private getRecommendedActions(): string[] {
    const actions = ['LOG_ACCESS_ATTEMPT', 'NOTIFY_SECURITY_TEAM'];

    if (this.requiresSecurityReview()) {
      actions.push('INITIATE_SECURITY_REVIEW', 'TEMPORARY_ACCESS_RESTRICTION');
    }

    return actions;
  }
}
```

```typescript
// order-processing-errors.ts
import {
  BaseError,
  IDomainError,
  DomainErrorCode,
  type DomainErrorOptions,
} from '@vytches/ddd-domain-primitives';
import { Order, PaymentContext, InventoryContext } from './types'; // From your app

/**
 * Base error for order processing domain
 */
export abstract class OrderProcessingError
  extends BaseError
  implements IDomainError
{
  public readonly domain = 'OrderProcessing';
  public readonly orderId: string;
  public readonly customerContext?: CustomerContext;
  public readonly orderStage: OrderStage;

  constructor(
    message: string,
    code: DomainErrorCode,
    orderId: string,
    orderStage: OrderStage,
    options: DomainErrorOptions & {
      customerContext?: CustomerContext;
    } = {}
  ) {
    super(message, { code, ...options });
    this.orderId = orderId;
    this.orderStage = orderStage;
    this.customerContext = options.customerContext;
  }

  /**
   * Get order-specific error context
   */
  getOrderContext(): OrderErrorContext {
    return {
      orderId: this.orderId,
      orderStage: this.orderStage,
      domain: this.domain,
      timestamp: new Date(),
      errorCode: this.code,
      customerContext: this.customerContext,
    };
  }

  /**
   * Check if error affects customer experience
   */
  abstract affectsCustomerExperience(): boolean;

  /**
   * Get recovery actions for this error
   */
  abstract getRecoveryActions(): RecoveryAction[];
}

/**
 * Payment processing errors with financial context
 */
export class PaymentProcessingError extends OrderProcessingError {
  public readonly paymentContext: PaymentContext;
  public readonly financialImpact: FinancialImpact;
  public readonly paymentMethod: PaymentMethod;

  constructor(
    message: string,
    orderId: string,
    paymentContext: PaymentContext,
    financialImpact: FinancialImpact,
    paymentMethod: PaymentMethod,
    options: DomainErrorOptions = {}
  ) {
    super(message, DomainErrorCode.PAYMENT_FAILED, orderId, 'payment', options);

    this.paymentContext = paymentContext;
    this.financialImpact = financialImpact;
    this.paymentMethod = paymentMethod;
  }

  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    // Critical for high-value transactions or fraud indicators
    if (
      this.financialImpact.amount > 10000 ||
      this.paymentContext.fraudRiskScore > 0.8
    ) {
      return 'critical';
    }

    // High for payment method failures affecting customer
    if (
      this.paymentMethod.type === 'credit_card' &&
      this.paymentContext.attemptCount > 2
    ) {
      return 'high';
    }

    return 'medium';
  }

  affectsCustomerExperience(): boolean {
    // Payment errors always affect customer experience
    return true;
  }

  getRecoveryActions(): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    // Automatic retry for transient failures
    if (this.isTransientFailure()) {
      actions.push({
        type: 'AUTOMATIC_RETRY',
        priority: 'high',
        delayMinutes: this.calculateRetryDelay(),
        maxAttempts: 3,
      });
    }

    // Alternative payment method suggestion
    if (this.paymentMethod.hasAlternatives) {
      actions.push({
        type: 'SUGGEST_ALTERNATIVE_PAYMENT',
        priority: 'medium',
        delayMinutes: 0,
        maxAttempts: 1,
      });
    }

    // Customer notification for high-impact failures
    if (this.getSeverity() === 'critical') {
      actions.push({
        type: 'NOTIFY_CUSTOMER_SERVICE',
        priority: 'critical',
        delayMinutes: 5,
        maxAttempts: 1,
      });
    }

    return actions;
  }

  /**
   * Generate financial incident report
   */
  generateFinancialIncident(): FinancialIncidentReport {
    return {
      incidentId: `FIN-${Date.now()}-${this.orderId}`,
      orderId: this.orderId,
      amount: this.financialImpact.amount,
      currency: this.financialImpact.currency,
      paymentMethod: this.paymentMethod.type,
      timestamp: new Date(),
      severity: this.getSeverity(),
      requiresManualReview: this.requiresManualReview(),
      fraudRiskScore: this.paymentContext.fraudRiskScore,
      recommendedActions: this.getRecoveryActions(),
    };
  }

  private isTransientFailure(): boolean {
    return ['NETWORK_ERROR', 'TIMEOUT', 'TEMPORARY_UNAVAILABLE'].includes(
      this.paymentContext.failureReason
    );
  }

  private calculateRetryDelay(): number {
    // Exponential backoff based on attempt count
    return Math.min(Math.pow(2, this.paymentContext.attemptCount) * 60, 1800); // Max 30 minutes
  }

  private requiresManualReview(): boolean {
    return (
      this.getSeverity() === 'critical' ||
      this.paymentContext.fraudRiskScore > 0.7
    );
  }
}

/**
 * Inventory management errors with supply chain context
 */
export class InventoryError extends OrderProcessingError {
  public readonly inventoryContext: InventoryContext;
  public readonly affectedItems: InventoryItem[];
  public readonly supplyChainImpact: SupplyChainImpact;

  constructor(
    message: string,
    orderId: string,
    inventoryContext: InventoryContext,
    affectedItems: InventoryItem[],
    supplyChainImpact: SupplyChainImpact,
    options: DomainErrorOptions = {}
  ) {
    super(
      message,
      DomainErrorCode.INVENTORY_INSUFFICIENT,
      orderId,
      'inventory',
      options
    );

    this.inventoryContext = inventoryContext;
    this.affectedItems = affectedItems;
    this.supplyChainImpact = supplyChainImpact;
  }

  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    // Critical for high-value items or supply chain disruption
    if (
      this.supplyChainImpact.severity === 'major' ||
      this.affectedItems.some(item => item.value > 5000)
    ) {
      return 'critical';
    }

    // High for popular items or customer priority orders
    if (
      this.inventoryContext.isPopularItem ||
      this.customerContext?.priority === 'high'
    ) {
      return 'high';
    }

    return 'medium';
  }

  affectsCustomerExperience(): boolean {
    // Inventory errors affect customer experience if items are unavailable
    return this.affectedItems.some(
      item => item.availability === 'out_of_stock'
    );
  }

  getRecoveryActions(): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    // Automatic substitution for similar items
    if (this.hasAvailableSubstitutes()) {
      actions.push({
        type: 'SUGGEST_SUBSTITUTION',
        priority: 'high',
        delayMinutes: 0,
        maxAttempts: 1,
      });
    }

    // Backorder for high-demand items
    if (this.inventoryContext.allowsBackorder) {
      actions.push({
        type: 'OFFER_BACKORDER',
        priority: 'medium',
        delayMinutes: 0,
        maxAttempts: 1,
      });
    }

    // Supply chain escalation for critical items
    if (this.getSeverity() === 'critical') {
      actions.push({
        type: 'ESCALATE_TO_SUPPLY_CHAIN',
        priority: 'critical',
        delayMinutes: 10,
        maxAttempts: 1,
      });
    }

    return actions;
  }

  /**
   * Generate supply chain impact report
   */
  generateSupplyChainReport(): SupplyChainIncidentReport {
    return {
      incidentId: `SUPPLY-${Date.now()}-${this.orderId}`,
      orderId: this.orderId,
      affectedItems: this.affectedItems.map(item => ({
        sku: item.sku,
        name: item.name,
        shortage: item.shortage,
        estimatedRestockDate: item.estimatedRestockDate,
      })),
      supplyChainImpact: this.supplyChainImpact,
      timestamp: new Date(),
      severity: this.getSeverity(),
      requiresSupplierContact: this.requiresSupplierContact(),
      estimatedResolution: this.estimateResolutionTime(),
      recommendedActions: this.getRecoveryActions(),
    };
  }

  private hasAvailableSubstitutes(): boolean {
    return this.affectedItems.some(
      item => item.substitutes && item.substitutes.length > 0
    );
  }

  private requiresSupplierContact(): boolean {
    return (
      this.getSeverity() === 'critical' ||
      this.supplyChainImpact.severity === 'major'
    );
  }

  private estimateResolutionTime(): Date {
    const now = new Date();
    const daysToAdd = this.getSeverity() === 'critical' ? 1 : 7;
    return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  }
}
```

```typescript
// error-management-service.ts
import {
  CustomerManagementError,
  CustomerValidationError,
  CustomerBusinessRuleError,
  CustomerAccessError,
  OrderProcessingError,
  PaymentProcessingError,
  InventoryError,
} from './domain-errors';
import { ErrorAnalytics, ErrorResolution, ComplianceReporting } from './types'; // From your app

/**
 * Centralized error management service for domain error analysis and resolution
 */
export class DomainErrorManagementService {
  private errorAnalytics: ErrorAnalytics;
  private errorResolution: ErrorResolution;
  private complianceReporting: ComplianceReporting;

  constructor(
    errorAnalytics: ErrorAnalytics,
    errorResolution: ErrorResolution,
    complianceReporting: ComplianceReporting
  ) {
    this.errorAnalytics = errorAnalytics;
    this.errorResolution = errorResolution;
    this.complianceReporting = complianceReporting;
  }

  /**
   * Analyze domain error and determine appropriate response
   */
  async analyzeError(
    error: CustomerManagementError | OrderProcessingError
  ): Promise<ErrorAnalysisResult> {
    const analysis: ErrorAnalysisResult = {
      errorId: `ERR-${Date.now()}`,
      errorType: error.constructor.name,
      domain: error.domain,
      severity: error.getSeverity(),
      timestamp: new Date(),
      requiresImmediateAction: this.requiresImmediateAction(error),
      businessImpact: await this.assessBusinessImpact(error),
      recommendedActions: this.getRecommendedActions(error),
      complianceImplications: this.assessComplianceImplications(error),
    };

    // Track error for analytics
    await this.errorAnalytics.trackError(analysis);

    return analysis;
  }

  /**
   * Handle customer management errors with domain-specific logic
   */
  async handleCustomerError(
    error: CustomerManagementError
  ): Promise<CustomerErrorResolution> {
    const analysis = await this.analyzeError(error);

    const resolution: CustomerErrorResolution = {
      analysisResult: analysis,
      resolutionStrategy: this.determineCustomerResolutionStrategy(error),
      automatedActions: [],
      manualActions: [],
      customerCommunication: null,
      complianceActions: [],
    };

    // Handle specific customer error types
    if (error instanceof CustomerValidationError) {
      resolution.automatedActions.push(
        ...this.getValidationRecoveryActions(error)
      );

      if (error.requiresImmediateAttention()) {
        resolution.manualActions.push({
          type: 'MANUAL_REVIEW',
          assignee: 'compliance-team',
          priority: 'critical',
          deadline: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        });
      }
    }

    if (error instanceof CustomerBusinessRuleError) {
      const complianceContext = error.getComplianceContext();
      if (complianceContext) {
        resolution.complianceActions.push({
          type: 'REGULATORY_REPORTING',
          framework: complianceContext.regulatoryFramework,
          deadline: complianceContext.reportingDeadline,
          auditTrail: complianceContext.auditTrail,
        });

        // Auto-submit compliance reports
        await this.complianceReporting.submitReport(complianceContext);
      }
    }

    if (error instanceof CustomerAccessError) {
      const securityIncident = error.generateSecurityIncident();
      resolution.automatedActions.push({
        type: 'SECURITY_INCIDENT_CREATED',
        incidentId: securityIncident.incidentId,
        severity: securityIncident.severity,
      });

      if (error.requiresSecurityReview()) {
        resolution.manualActions.push({
          type: 'SECURITY_REVIEW',
          assignee: 'security-team',
          priority: 'high',
          deadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
        });
      }
    }

    // Execute resolution
    await this.errorResolution.executeCustomerResolution(resolution);

    return resolution;
  }

  /**
   * Handle order processing errors with business continuity focus
   */
  async handleOrderError(
    error: OrderProcessingError
  ): Promise<OrderErrorResolution> {
    const analysis = await this.analyzeError(error);

    const resolution: OrderErrorResolution = {
      analysisResult: analysis,
      resolutionStrategy: this.determineOrderResolutionStrategy(error),
      recoveryActions: error.getRecoveryActions(),
      customerNotification: error.affectsCustomerExperience(),
      financialActions: [],
      inventoryActions: [],
    };

    // Handle payment processing errors
    if (error instanceof PaymentProcessingError) {
      const financialIncident = error.generateFinancialIncident();

      resolution.financialActions.push({
        type: 'FINANCIAL_INCIDENT_CREATED',
        incidentId: financialIncident.incidentId,
        amount: financialIncident.amount,
        requiresReview: financialIncident.requiresManualReview,
      });

      if (financialIncident.requiresManualReview) {
        resolution.financialActions.push({
          type: 'MANUAL_FINANCIAL_REVIEW',
          assignee: 'finance-team',
          priority: error.getSeverity(),
          orderId: error.orderId,
        });
      }
    }

    // Handle inventory errors
    if (error instanceof InventoryError) {
      const supplyChainReport = error.generateSupplyChainReport();

      resolution.inventoryActions.push({
        type: 'SUPPLY_CHAIN_INCIDENT_CREATED',
        incidentId: supplyChainReport.incidentId,
        affectedItems: supplyChainReport.affectedItems,
        severity: supplyChainReport.severity,
      });

      if (supplyChainReport.requiresSupplierContact) {
        resolution.inventoryActions.push({
          type: 'CONTACT_SUPPLIERS',
          priority: 'high',
          estimatedResolution: supplyChainReport.estimatedResolution,
        });
      }
    }

    // Execute resolution
    await this.errorResolution.executeOrderResolution(resolution);

    return resolution;
  }

  /**
   * Generate comprehensive error analytics report
   */
  async generateErrorReport(
    domain: string,
    timeframe: { start: Date; end: Date }
  ): Promise<DomainErrorReport> {
    const errors = await this.errorAnalytics.getErrorsByDomain(
      domain,
      timeframe
    );

    const report: DomainErrorReport = {
      domain,
      timeframe,
      totalErrors: errors.length,
      errorDistribution: this.calculateErrorDistribution(errors),
      severityBreakdown: this.calculateSeverityBreakdown(errors),
      resolutionMetrics: await this.calculateResolutionMetrics(errors),
      complianceMetrics: await this.calculateComplianceMetrics(errors),
      trends: this.analyzeErrorTrends(errors),
      recommendations: this.generateRecommendations(errors),
    };

    return report;
  }

  private requiresImmediateAction(
    error: CustomerManagementError | OrderProcessingError
  ): boolean {
    return (
      error.getSeverity() === 'critical' ||
      (error instanceof CustomerValidationError &&
        error.requiresImmediateAttention()) ||
      (error instanceof CustomerAccessError && error.requiresSecurityReview())
    );
  }

  private async assessBusinessImpact(
    error: CustomerManagementError | OrderProcessingError
  ): Promise<BusinessImpact> {
    // Assess business impact based on error type and context
    return {
      financialImpact: await this.calculateFinancialImpact(error),
      customerImpact: this.assessCustomerImpact(error),
      operationalImpact: this.assessOperationalImpact(error),
      complianceRisk: this.assessComplianceRisk(error),
    };
  }

  private getRecommendedActions(
    error: CustomerManagementError | OrderProcessingError
  ): string[] {
    const actions: string[] = [];

    if (error.getSeverity() === 'critical') {
      actions.push('IMMEDIATE_ESCALATION', 'INCIDENT_RESPONSE');
    }

    if (
      error instanceof OrderProcessingError &&
      error.affectsCustomerExperience()
    ) {
      actions.push('CUSTOMER_NOTIFICATION', 'SERVICE_RECOVERY');
    }

    return actions;
  }

  private assessComplianceImplications(
    error: CustomerManagementError | OrderProcessingError
  ): ComplianceImplication[] {
    const implications: ComplianceImplication[] = [];

    if (
      error instanceof CustomerBusinessRuleError &&
      (error.violationType === 'compliance' ||
        error.violationType === 'regulation')
    ) {
      implications.push({
        framework: error.ruleContext.regulatoryFramework,
        severity: 'high',
        reportingRequired: true,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
    }

    return implications;
  }

  private determineCustomerResolutionStrategy(
    error: CustomerManagementError
  ): ResolutionStrategy {
    if (error instanceof CustomerValidationError) {
      return error.getSeverity() === 'critical'
        ? 'IMMEDIATE_MANUAL'
        : 'AUTOMATED_WITH_REVIEW';
    }

    if (error instanceof CustomerBusinessRuleError) {
      return error.violationType === 'compliance'
        ? 'COMPLIANCE_WORKFLOW'
        : 'STANDARD_ESCALATION';
    }

    if (error instanceof CustomerAccessError) {
      return error.requiresSecurityReview()
        ? 'SECURITY_PROTOCOL'
        : 'ACCESS_REVIEW';
    }

    return 'STANDARD_ESCALATION';
  }

  private determineOrderResolutionStrategy(
    error: OrderProcessingError
  ): ResolutionStrategy {
    if (error instanceof PaymentProcessingError) {
      return error.getSeverity() === 'critical'
        ? 'FINANCIAL_ESCALATION'
        : 'PAYMENT_RETRY';
    }

    if (error instanceof InventoryError) {
      return error.getSeverity() === 'critical'
        ? 'SUPPLY_CHAIN_ESCALATION'
        : 'INVENTORY_SUBSTITUTION';
    }

    return 'STANDARD_RECOVERY';
  }

  private getValidationRecoveryActions(
    error: CustomerValidationError
  ): AutomatedAction[] {
    return [
      {
        type: 'DATA_VALIDATION_RETRY',
        priority: 'high',
        config: {
          failedFields: error.failedFields,
          validationRules: error.validationContext.rules,
        },
      },
      {
        type: 'CUSTOMER_DATA_REQUEST',
        priority: 'medium',
        config: {
          customerId: error.customerId,
          requiredFields: error.failedFields,
        },
      },
    ];
  }

  private calculateErrorDistribution(
    errors: ErrorAnalysisResult[]
  ): Record<string, number> {
    return errors.reduce(
      (acc, error) => {
        acc[error.errorType] = (acc[error.errorType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private calculateSeverityBreakdown(
    errors: ErrorAnalysisResult[]
  ): Record<string, number> {
    return errors.reduce(
      (acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private async calculateResolutionMetrics(
    errors: ErrorAnalysisResult[]
  ): Promise<ResolutionMetrics> {
    // Calculate metrics like average resolution time, success rate, etc.
    const resolutions = await Promise.all(
      errors.map(error =>
        this.errorResolution.getResolutionDetails(error.errorId)
      )
    );

    return {
      averageResolutionTime: this.calculateAverageResolutionTime(resolutions),
      successRate: this.calculateSuccessRate(resolutions),
      automationRate: this.calculateAutomationRate(resolutions),
    };
  }

  private async calculateComplianceMetrics(
    errors: ErrorAnalysisResult[]
  ): Promise<ComplianceMetrics> {
    const complianceErrors = errors.filter(
      error =>
        error.complianceImplications && error.complianceImplications.length > 0
    );

    return {
      totalComplianceErrors: complianceErrors.length,
      reportingDeadlinesMet:
        await this.calculateReportingCompliance(complianceErrors),
      regulatoryFrameworkBreakdown:
        this.calculateRegulatoryBreakdown(complianceErrors),
    };
  }

  private analyzeErrorTrends(errors: ErrorAnalysisResult[]): ErrorTrend[] {
    // Analyze error trends over time
    return [];
  }

  private generateRecommendations(errors: ErrorAnalysisResult[]): string[] {
    const recommendations: string[] = [];

    const criticalErrors = errors.filter(e => e.severity === 'critical');
    if (criticalErrors.length > 5) {
      recommendations.push('IMPLEMENT_PROACTIVE_MONITORING');
      recommendations.push('REVIEW_BUSINESS_RULES');
    }

    return recommendations;
  }

  private async calculateFinancialImpact(
    error: CustomerManagementError | OrderProcessingError
  ): Promise<number> {
    // Calculate estimated financial impact
    return 0;
  }

  private assessCustomerImpact(
    error: CustomerManagementError | OrderProcessingError
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (
      error instanceof OrderProcessingError &&
      error.affectsCustomerExperience()
    ) {
      return error.getSeverity() as any;
    }
    return 'low';
  }

  private assessOperationalImpact(
    error: CustomerManagementError | OrderProcessingError
  ): 'low' | 'medium' | 'high' | 'critical' {
    return error.getSeverity() as any;
  }

  private assessComplianceRisk(
    error: CustomerManagementError | OrderProcessingError
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (
      error instanceof CustomerBusinessRuleError &&
      (error.violationType === 'compliance' ||
        error.violationType === 'regulation')
    ) {
      return 'critical';
    }
    return 'low';
  }

  private calculateAverageResolutionTime(resolutions: any[]): number {
    return 0; // Implementation details
  }

  private calculateSuccessRate(resolutions: any[]): number {
    return 0; // Implementation details
  }

  private calculateAutomationRate(resolutions: any[]): number {
    return 0; // Implementation details
  }

  private async calculateReportingCompliance(
    complianceErrors: ErrorAnalysisResult[]
  ): Promise<number> {
    return 0; // Implementation details
  }

  private calculateRegulatoryBreakdown(
    complianceErrors: ErrorAnalysisResult[]
  ): Record<string, number> {
    return {}; // Implementation details
  }
}
```

## Usage Example

```typescript
// domain-error-usage.ts
import {
  CustomerValidationError,
  CustomerBusinessRuleError,
  CustomerAccessError,
  PaymentProcessingError,
  InventoryError,
  DomainErrorManagementService,
} from './domain-errors';
import {
  CustomerValidationContext,
  BusinessRuleContext,
  AccessControlContext,
  PaymentContext,
  InventoryContext,
} from './types'; // From your app

export class DomainErrorDemo {
  private errorManagementService: DomainErrorManagementService;

  constructor(errorManagementService: DomainErrorManagementService) {
    this.errorManagementService = errorManagementService;
  }

  async demonstrateCustomerValidationError(): Promise<void> {
    try {
      // Simulate customer validation failure
      const validationError = new CustomerValidationError(
        'Customer data validation failed for critical fields',
        'CUSTOMER-123',
        {
          type: 'KYC_VALIDATION',
          rules: ['SSN_REQUIRED', 'ADDRESS_VERIFICATION', 'ID_VERIFICATION'],
          regulatoryFramework: 'KYC-AML',
        } as CustomerValidationContext,
        ['ssn', 'addressVerification'],
        {
          correlationId: 'CORR-456',
          cause: new Error('SSN format invalid'),
        }
      );

      console.log(
        'Validation Error Context:',
        validationError.getCustomerContext()
      );
      console.log('Validation Report:', validationError.getValidationReport());
      console.log(
        'Requires Immediate Attention:',
        validationError.requiresImmediateAttention()
      );

      // Handle error through management service
      const resolution =
        await this.errorManagementService.handleCustomerError(validationError);
      console.log('Customer Error Resolution:', resolution);
    } catch (error) {
      console.error('Error in validation demo:', error);
    }
  }

  async demonstrateBusinessRuleError(): Promise<void> {
    try {
      // Simulate business rule violation
      const ruleError = new CustomerBusinessRuleError(
        'Customer exceeds credit limit for regulated transaction',
        'CUSTOMER-789',
        'CREDIT_LIMIT_RULE_001',
        {
          ruleType: 'CREDIT_LIMIT',
          threshold: 50000,
          currentValue: 75000,
          regulatoryFramework: 'BASEL_III',
        } as BusinessRuleContext,
        'compliance',
        {
          correlationId: 'CORR-789',
        }
      );

      console.log('Business Rule Context:', ruleError.getCustomerContext());
      console.log('Compliance Context:', ruleError.getComplianceContext());
      console.log('Severity:', ruleError.getSeverity());

      // Handle error with compliance workflow
      const resolution =
        await this.errorManagementService.handleCustomerError(ruleError);
      console.log('Business Rule Resolution:', resolution);
    } catch (error) {
      console.error('Error in business rule demo:', error);
    }
  }

  async demonstratePaymentError(): Promise<void> {
    try {
      // Simulate payment processing error
      const paymentError = new PaymentProcessingError(
        'High-value payment failed due to fraud detection',
        'ORDER-456',
        {
          attemptCount: 3,
          failureReason: 'FRAUD_DETECTION',
          fraudRiskScore: 0.85,
          transactionId: 'TXN-789',
        } as PaymentContext,
        {
          amount: 25000,
          currency: 'USD',
          impact: 'HIGH_VALUE_TRANSACTION',
        },
        {
          type: 'credit_card',
          hasAlternatives: true,
          provider: 'VISA',
        },
        {
          correlationId: 'CORR-PAY-123',
        }
      );

      console.log('Payment Error Context:', paymentError.getOrderContext());
      console.log('Recovery Actions:', paymentError.getRecoveryActions());
      console.log(
        'Financial Incident:',
        paymentError.generateFinancialIncident()
      );

      // Handle error with financial protocols
      const resolution =
        await this.errorManagementService.handleOrderError(paymentError);
      console.log('Payment Error Resolution:', resolution);
    } catch (error) {
      console.error('Error in payment demo:', error);
    }
  }

  async generateComprehensiveErrorReport(): Promise<void> {
    try {
      // Generate domain error analytics report
      const report = await this.errorManagementService.generateErrorReport(
        'CustomerManagement',
        {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date(),
        }
      );

      console.log('Domain Error Report:');
      console.log('Total Errors:', report.totalErrors);
      console.log('Error Distribution:', report.errorDistribution);
      console.log('Severity Breakdown:', report.severityBreakdown);
      console.log('Resolution Metrics:', report.resolutionMetrics);
      console.log('Compliance Metrics:', report.complianceMetrics);
      console.log('Recommendations:', report.recommendations);
    } catch (error) {
      console.error('Error generating report:', error);
    }
  }
}
```

## Key Features

- **Domain Error Hierarchies**: Structured error inheritance with
  domain-specific context and business logic
- **Contextual Information**: Rich error context including business data,
  correlation IDs, and audit trails
- **Severity Classification**: Automatic severity assessment based on business
  impact and regulatory requirements
- **Recovery Actions**: Actionable recovery strategies with automated and manual
  resolution paths
- **Compliance Integration**: Built-in compliance reporting and regulatory
  framework support
- **Analytics and Reporting**: Comprehensive error analytics with trends,
  metrics, and recommendations
- **Error Management Service**: Centralized error handling with domain-specific
  resolution strategies

## Common Pitfalls

- **Over-Engineering**: Avoid creating too many error sub-classes; focus on
  meaningful business distinctions
- **Context Overload**: Include relevant context but avoid excessive data that
  impacts performance
- **Severity Consistency**: Ensure severity levels are consistent across domains
  and business rules
- **Recovery Logic**: Test recovery actions thoroughly to prevent cascading
  failures
- **Compliance Deadlines**: Implement proper deadline tracking and notification
  systems

## Related Examples

- [Basic Domain Errors](../basic/example-1.md) - Foundation error concepts and
  simple patterns
- [Advanced Error Orchestration](../advanced/example-1.md) - Complex error
  workflows and enterprise patterns
- [Actor Error Management](../basic/example-2.md) - Actor-specific error
  handling patterns
- [NestJS Error Integration](../frameworks/nestjs/basic/example-1.md) -
  Framework-specific error handling
