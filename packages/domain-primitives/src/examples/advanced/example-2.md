# Multi-Tenant Domain Security - Advanced Example

**Version**: 1.0.0 **Package**: @vytches/ddd-domain-primitives **Complexity**:
advanced **Domain**: Multi-Tenant Security **Patterns**: Multi-Tenancy, Security
Contexts, Isolation Boundaries, Compliance Frameworks **Dependencies**:
BaseError, IDomainError, IActor, ActorError, Error Enums

## Description

Demonstrates sophisticated multi-tenant domain security architecture using
domain primitives as the foundation for tenant isolation, security context
management, compliance frameworks, and advanced threat detection with
comprehensive audit trails.

## Business Context

Enterprise SaaS platform serving multiple regulated industries (healthcare,
finance, government) requiring strict tenant isolation, comprehensive security
controls, compliance monitoring, threat detection, and detailed audit trails for
regulatory requirements (SOC2, HIPAA, PCI-DSS, FedRAMP).

## Code Example

```typescript
// multi-tenant-security.ts
import {
  BaseError,
  IDomainError,
  IActor,
  ActorError,
  DomainErrorCode,
  type DomainErrorOptions,
} from '@vytches/ddd-domain-primitives';
import {
  TenantSecurityContext,
  ComplianceFramework,
  SecurityThreat,
  IsolationBoundary,
  SecurityPolicy,
} from './types'; // From your app

/**
 * Multi-tenant security error hierarchy
 */
export abstract class MultiTenantSecurityError
  extends BaseError
  implements IDomainError
{
  public readonly domain = 'MultiTenantSecurity';
  public readonly tenantId: string;
  public readonly securityContext: string;
  public readonly threatLevel: ThreatLevel;
  public readonly complianceImpact: ComplianceImpact[];
  public readonly isolationBreach: boolean;

  constructor(
    message: string,
    code: DomainErrorCode,
    tenantId: string,
    securityContext: string,
    threatLevel: ThreatLevel,
    options: DomainErrorOptions & {
      complianceImpact?: ComplianceImpact[];
      isolationBreach?: boolean;
    } = {}
  ) {
    super(message, { code, ...options });
    this.tenantId = tenantId;
    this.securityContext = securityContext;
    this.threatLevel = threatLevel;
    this.complianceImpact = options.complianceImpact || [];
    this.isolationBreach = options.isolationBreach || false;
  }

  /**
   * Get security incident context
   */
  getSecurityIncidentContext(): SecurityIncidentContext {
    return {
      domain: this.domain,
      tenantId: this.tenantId,
      securityContext: this.securityContext,
      threatLevel: this.threatLevel,
      complianceImpact: this.complianceImpact,
      isolationBreach: this.isolationBreach,
      timestamp: new Date(),
      errorCode: this.code,
      requiresImmediateResponse: this.requiresImmediateResponse(),
      affectedCompliance: this.complianceImpact.map(c => c.framework),
    };
  }

  /**
   * Determine if security incident requires immediate response
   */
  abstract requiresImmediateResponse(): boolean;

  /**
   * Get required security actions for this incident
   */
  abstract getRequiredSecurityActions(): SecurityAction[];

  /**
   * Check if incident affects compliance posture
   */
  hasComplianceImpact(): boolean {
    return this.complianceImpact.length > 0;
  }

  /**
   * Get severity for compliance reporting
   */
  abstract getComplianceSeverity(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Tenant isolation breach error
 */
export class TenantIsolationBreachError extends MultiTenantSecurityError {
  public readonly breachType: IsolationBreachType;
  public readonly affectedTenants: string[];
  public readonly dataExposureRisk: DataExposureRisk;
  public readonly breachVector: BreachVector;

  constructor(
    message: string,
    sourceTenantId: string,
    securityContext: string,
    breachType: IsolationBreachType,
    affectedTenants: string[],
    dataExposureRisk: DataExposureRisk,
    breachVector: BreachVector,
    options: DomainErrorOptions & {
      complianceImpact?: ComplianceImpact[];
    } = {}
  ) {
    super(
      message,
      DomainErrorCode.ISOLATION_BREACH,
      sourceTenantId,
      securityContext,
      'CRITICAL',
      {
        isolationBreach: true,
        complianceImpact: options.complianceImpact || [],
        ...options,
      }
    );

    this.breachType = breachType;
    this.affectedTenants = affectedTenants;
    this.dataExposureRisk = dataExposureRisk;
    this.breachVector = breachVector;
  }

  requiresImmediateResponse(): boolean {
    return (
      this.breachType === 'DATA_LEAKAGE' ||
      this.dataExposureRisk.level === 'CRITICAL' ||
      this.affectedTenants.length > 1
    );
  }

  getRequiredSecurityActions(): SecurityAction[] {
    const actions: SecurityAction[] = [];

    // Immediate containment
    actions.push({
      type: 'IMMEDIATE_CONTAINMENT',
      priority: 'CRITICAL',
      target: 'AFFECTED_RESOURCES',
      description: 'Isolate affected tenant resources immediately',
      timeoutMinutes: 5,
      autoExecute: true,
    });

    // Tenant notification
    if (this.affectedTenants.length > 1) {
      actions.push({
        type: 'TENANT_NOTIFICATION',
        priority: 'HIGH',
        target: 'AFFECTED_TENANTS',
        description: 'Notify affected tenants of potential breach',
        timeoutMinutes: 15,
        autoExecute: false,
        requiresApproval: true,
      });
    }

    // Data exposure assessment
    if (
      this.dataExposureRisk.level === 'HIGH' ||
      this.dataExposureRisk.level === 'CRITICAL'
    ) {
      actions.push({
        type: 'DATA_EXPOSURE_ASSESSMENT',
        priority: 'HIGH',
        target: 'EXPOSED_DATA',
        description: 'Assess scope and impact of data exposure',
        timeoutMinutes: 30,
        autoExecute: false,
      });
    }

    // Compliance reporting
    if (this.hasComplianceImpact()) {
      actions.push({
        type: 'COMPLIANCE_INCIDENT_REPORT',
        priority: 'HIGH',
        target: 'COMPLIANCE_FRAMEWORKS',
        description: 'Generate compliance incident reports',
        timeoutMinutes: 60,
        autoExecute: true,
      });
    }

    // Forensic analysis
    actions.push({
      type: 'FORENSIC_ANALYSIS',
      priority: 'MEDIUM',
      target: 'BREACH_ARTIFACTS',
      description: 'Conduct forensic analysis of breach',
      timeoutMinutes: 240, // 4 hours
      autoExecute: false,
    });

    return actions;
  }

  getComplianceSeverity(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (
      this.dataExposureRisk.level === 'CRITICAL' ||
      this.affectedTenants.length > 5
    ) {
      return 'CRITICAL';
    }

    if (
      this.dataExposureRisk.level === 'HIGH' ||
      this.breachType === 'DATA_LEAKAGE'
    ) {
      return 'HIGH';
    }

    return 'MEDIUM';
  }

  /**
   * Generate detailed breach analysis
   */
  generateBreachAnalysis(): TenantIsolationBreachAnalysis {
    return {
      breachId: `BREACH-${Date.now()}-${this.tenantId}`,
      sourceTenant: this.tenantId,
      affectedTenants: this.affectedTenants,
      breachType: this.breachType,
      breachVector: this.breachVector,
      dataExposureRisk: this.dataExposureRisk,
      securityContext: this.securityContext,
      detectedAt: new Date(),
      threatLevel: this.threatLevel,
      complianceFrameworksAffected: this.complianceImpact.map(c => c.framework),
      estimatedImpact: this.calculateEstimatedImpact(),
      containmentStrategy: this.getContainmentStrategy(),
      recoveryTimeEstimate: this.estimateRecoveryTime(),
      forensicRequirements: this.getForensicRequirements(),
    };
  }

  private calculateEstimatedImpact(): SecurityImpactAssessment {
    return {
      businessImpact: this.assessBusinessImpact(),
      reputationalImpact: this.assessReputationalImpact(),
      financialImpact: this.assessFinancialImpact(),
      legalImpact: this.assessLegalImpact(),
      operationalImpact: this.assessOperationalImpact(),
    };
  }

  private getContainmentStrategy(): ContainmentStrategy {
    return {
      immediateActions: this.getRequiredSecurityActions().filter(
        a => a.priority === 'CRITICAL'
      ),
      isolationMeasures: this.generateIsolationMeasures(),
      communicationPlan: this.generateCommunicationPlan(),
      escalationPath: this.generateEscalationPath(),
    };
  }

  private estimateRecoveryTime(): RecoveryTimeEstimate {
    const baseTime = this.affectedTenants.length * 30; // 30 minutes per tenant
    const complexityMultiplier =
      this.breachType === 'DATA_LEAKAGE'
        ? 3.0
        : this.dataExposureRisk.level === 'CRITICAL'
          ? 2.0
          : 1.5;

    return {
      estimatedMinutes: Math.round(baseTime * complexityMultiplier),
      confidence: this.affectedTenants.length <= 2 ? 'HIGH' : 'MEDIUM',
      factors: [
        `Affected tenants: ${this.affectedTenants.length}`,
        `Breach type: ${this.breachType}`,
        `Data exposure risk: ${this.dataExposureRisk.level}`,
      ],
    };
  }

  private getForensicRequirements(): ForensicRequirements {
    return {
      evidencePreservation: this.dataExposureRisk.level === 'CRITICAL',
      logAnalysisRequired: true,
      externalForensics:
        this.hasComplianceImpact() &&
        this.getComplianceSeverity() === 'CRITICAL',
      retentionPeriod: this.hasComplianceImpact() ? 2555 : 365, // 7 years for compliance, 1 year standard
      complianceRequirements: this.complianceImpact.map(c => ({
        framework: c.framework,
        reportingDeadline: c.reportingDeadline,
        evidenceRequirements: c.evidenceRequirements,
      })),
    };
  }

  private assessBusinessImpact(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (this.affectedTenants.length > 10) return 'CRITICAL';
    if (
      this.affectedTenants.length > 5 ||
      this.dataExposureRisk.level === 'CRITICAL'
    )
      return 'HIGH';
    if (this.affectedTenants.length > 2) return 'MEDIUM';
    return 'LOW';
  }

  private assessReputationalImpact(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    return this.breachType === 'DATA_LEAKAGE' ? 'CRITICAL' : 'HIGH';
  }

  private assessFinancialImpact(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const compliancePenalties = this.complianceImpact.some(c =>
      ['GDPR', 'HIPAA', 'PCI_DSS'].includes(c.framework)
    );
    return compliancePenalties ? 'CRITICAL' : 'MEDIUM';
  }

  private assessLegalImpact(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    return this.hasComplianceImpact() ? 'HIGH' : 'MEDIUM';
  }

  private assessOperationalImpact(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    return this.affectedTenants.length > 5 ? 'HIGH' : 'MEDIUM';
  }

  private generateIsolationMeasures(): IsolationMeasure[] {
    return [
      {
        type: 'NETWORK_ISOLATION',
        target: this.tenantId,
        description: 'Isolate tenant network traffic',
        priority: 'CRITICAL',
      },
      {
        type: 'DATA_ACCESS_REVOCATION',
        target: 'AFFECTED_RESOURCES',
        description: 'Revoke access to affected data resources',
        priority: 'CRITICAL',
      },
    ];
  }

  private generateCommunicationPlan(): CommunicationPlan {
    return {
      internalNotifications: [
        { team: 'SECURITY_TEAM', priority: 'IMMEDIATE' },
        { team: 'LEGAL_TEAM', priority: 'HIGH' },
        { team: 'EXECUTIVE_TEAM', priority: 'HIGH' },
      ],
      externalNotifications: this.affectedTenants.map(tenantId => ({
        recipient: tenantId,
        type: 'TENANT_NOTIFICATION',
        priority: 'HIGH',
        timeline: '15 minutes',
      })),
      regulatoryNotifications: this.complianceImpact
        .filter(c => c.requiresNotification)
        .map(c => ({
          regulator: c.framework,
          deadline: c.reportingDeadline,
          priority: 'HIGH',
        })),
    };
  }

  private generateEscalationPath(): EscalationPath {
    return {
      level1: 'SECURITY_MANAGER',
      level2: 'CISO',
      level3: 'CEO_CTO',
      timeToEscalation: {
        level1To2: 30, // 30 minutes
        level2To3: 60, // 60 minutes
      },
    };
  }
}

/**
 * Compliance violation security error
 */
export class ComplianceViolationSecurityError extends MultiTenantSecurityError {
  public readonly violatedFrameworks: ComplianceFramework[];
  public readonly violationType: ComplianceViolationType;
  public readonly regulatoryRisk: RegulatoryRisk;
  public readonly auditTrailImpact: AuditTrailImpact;

  constructor(
    message: string,
    tenantId: string,
    securityContext: string,
    violatedFrameworks: ComplianceFramework[],
    violationType: ComplianceViolationType,
    regulatoryRisk: RegulatoryRisk,
    auditTrailImpact: AuditTrailImpact,
    options: DomainErrorOptions = {}
  ) {
    super(
      message,
      DomainErrorCode.COMPLIANCE_VIOLATION,
      tenantId,
      securityContext,
      regulatoryRisk.level as ThreatLevel,
      {
        complianceImpact: violatedFrameworks.map(framework => ({
          framework: framework.name,
          severity: regulatoryRisk.level,
          reportingDeadline: framework.reportingDeadline,
          evidenceRequirements: framework.evidenceRequirements,
          requiresNotification: framework.requiresImmediateNotification,
        })),
        ...options,
      }
    );

    this.violatedFrameworks = violatedFrameworks;
    this.violationType = violationType;
    this.regulatoryRisk = regulatoryRisk;
    this.auditTrailImpact = auditTrailImpact;
  }

  requiresImmediateResponse(): boolean {
    return (
      this.regulatoryRisk.level === 'CRITICAL' ||
      this.violatedFrameworks.some(f => f.requiresImmediateNotification) ||
      this.violationType === 'DATA_RETENTION_VIOLATION'
    );
  }

  getRequiredSecurityActions(): SecurityAction[] {
    const actions: SecurityAction[] = [];

    // Compliance remediation
    actions.push({
      type: 'COMPLIANCE_REMEDIATION',
      priority: this.regulatoryRisk.level === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      target: 'VIOLATION_SOURCE',
      description: 'Remediate compliance violation at source',
      timeoutMinutes: this.calculateRemediationTimeout(),
      autoExecute: false,
      requiresApproval: true,
    });

    // Regulatory reporting
    if (this.violatedFrameworks.some(f => f.requiresImmediateNotification)) {
      actions.push({
        type: 'REGULATORY_NOTIFICATION',
        priority: 'CRITICAL',
        target: 'REGULATORY_BODIES',
        description: 'Notify relevant regulatory bodies',
        timeoutMinutes: this.getNotificationDeadline(),
        autoExecute: false,
        requiresApproval: true,
      });
    }

    // Audit trail preservation
    if (this.auditTrailImpact.preservationRequired) {
      actions.push({
        type: 'AUDIT_PRESERVATION',
        priority: 'HIGH',
        target: 'AUDIT_LOGS',
        description: 'Preserve audit trail for compliance investigation',
        timeoutMinutes: 60,
        autoExecute: true,
      });
    }

    // Legal review
    if (this.regulatoryRisk.litigationRisk === 'HIGH') {
      actions.push({
        type: 'LEGAL_REVIEW',
        priority: 'HIGH',
        target: 'VIOLATION_DOCUMENTATION',
        description: 'Legal review of compliance violation',
        timeoutMinutes: 240, // 4 hours
        autoExecute: false,
      });
    }

    return actions;
  }

  getComplianceSeverity(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (
      this.regulatoryRisk.level === 'CRITICAL' ||
      this.regulatoryRisk.potentialFine > 1000000
    ) {
      // $1M+
      return 'CRITICAL';
    }

    if (
      this.regulatoryRisk.level === 'HIGH' ||
      this.violatedFrameworks.some(f =>
        ['GDPR', 'HIPAA', 'SOX'].includes(f.name)
      )
    ) {
      return 'HIGH';
    }

    return 'MEDIUM';
  }

  /**
   * Generate compliance violation report
   */
  generateComplianceViolationReport(): ComplianceViolationReport {
    return {
      violationId: `COMP-VIO-${Date.now()}-${this.tenantId}`,
      tenantId: this.tenantId,
      violatedFrameworks: this.violatedFrameworks.map(f => f.name),
      violationType: this.violationType,
      detectedAt: new Date(),
      securityContext: this.securityContext,
      regulatoryRisk: this.regulatoryRisk,
      auditTrailImpact: this.auditTrailImpact,
      remediationPlan: this.generateRemediationPlan(),
      reportingRequirements: this.generateReportingRequirements(),
      estimatedFinancialImpact: this.calculateFinancialImpact(),
      recommendedActions: this.getRequiredSecurityActions(),
      complianceOfficerNotified: false,
      legalCounselNotified: this.regulatoryRisk.litigationRisk === 'HIGH',
    };
  }

  private calculateRemediationTimeout(): number {
    // Calculate based on violation severity and framework requirements
    const baseTimeout = this.violatedFrameworks.reduce((min, framework) => {
      const frameworkTimeout = framework.remediationTimelineDays * 24 * 60; // Convert to minutes
      return Math.min(min, frameworkTimeout);
    }, 72 * 60); // 72 hours default

    return Math.max(baseTimeout, 60); // Minimum 1 hour
  }

  private getNotificationDeadline(): number {
    // Get shortest notification deadline from violated frameworks
    return this.violatedFrameworks.reduce((min, framework) => {
      if (framework.requiresImmediateNotification) {
        const deadlineMinutes = framework.notificationDeadlineHours * 60;
        return Math.min(min, deadlineMinutes);
      }
      return min;
    }, 72 * 60); // 72 hours default
  }

  private generateRemediationPlan(): RemediationPlan {
    return {
      immediateActions: this.getRequiredSecurityActions().filter(
        a => a.priority === 'CRITICAL'
      ),
      shortTermActions: this.generateShortTermActions(),
      longTermActions: this.generateLongTermActions(),
      timeline: this.calculateRemediationTimeline(),
      responsibleParties: this.identifyResponsibleParties(),
      successCriteria: this.defineSuccessCriteria(),
    };
  }

  private generateReportingRequirements(): ReportingRequirement[] {
    return this.violatedFrameworks.map(framework => ({
      framework: framework.name,
      reportingDeadline: framework.reportingDeadline,
      requiredDocumentation: framework.evidenceRequirements,
      regulatoryBody: framework.regulatoryBody,
      contactInformation: framework.contactInformation,
      templateRequired: framework.templateRequired,
    }));
  }

  private calculateFinancialImpact(): FinancialImpact {
    const totalPotentialFine = this.violatedFrameworks.reduce(
      (sum, framework) => {
        return sum + (framework.maximumPenalty || 0);
      },
      0
    );

    return {
      potentialFines: Math.min(
        totalPotentialFine,
        this.regulatoryRisk.potentialFine
      ),
      legalCosts: this.estimateLegalCosts(),
      operationalImpact: this.estimateOperationalImpact(),
      reputationalImpact: this.estimateReputationalCost(),
      totalEstimatedImpact: 0, // Calculated as sum of above
    };
  }

  private generateShortTermActions(): SecurityAction[] {
    return [
      {
        type: 'POLICY_UPDATE',
        priority: 'HIGH',
        target: 'SECURITY_POLICIES',
        description: 'Update security policies to address violation',
        timeoutMinutes: 48 * 60, // 48 hours
        autoExecute: false,
      },
    ];
  }

  private generateLongTermActions(): SecurityAction[] {
    return [
      {
        type: 'COMPLIANCE_MONITORING',
        priority: 'MEDIUM',
        target: 'MONITORING_SYSTEMS',
        description: 'Implement enhanced compliance monitoring',
        timeoutMinutes: 30 * 24 * 60, // 30 days
        autoExecute: false,
      },
    ];
  }

  private calculateRemediationTimeline(): RemediationTimeline {
    const urgentDeadline = Math.min(
      ...this.violatedFrameworks.map(f => f.remediationTimelineDays)
    );

    return {
      immediate: '24 hours',
      shortTerm: '7 days',
      longTerm: `${urgentDeadline} days`,
      complianceDeadline: new Date(
        Date.now() + urgentDeadline * 24 * 60 * 60 * 1000
      ),
    };
  }

  private identifyResponsibleParties(): ResponsibleParty[] {
    return [
      {
        role: 'COMPLIANCE_OFFICER',
        responsibility: 'Overall remediation oversight',
        contactInfo: 'compliance@company.com',
      },
      {
        role: 'SECURITY_MANAGER',
        responsibility: 'Technical remediation implementation',
        contactInfo: 'security@company.com',
      },
    ];
  }

  private defineSuccessCriteria(): SuccessCriteria[] {
    return [
      {
        criteria: 'Violation source remediated',
        measurable: true,
        timeline: '48 hours',
      },
      {
        criteria: 'Compliance monitoring implemented',
        measurable: true,
        timeline: '7 days',
      },
    ];
  }

  private estimateLegalCosts(): number {
    return this.regulatoryRisk.litigationRisk === 'HIGH' ? 100000 : 25000;
  }

  private estimateOperationalImpact(): number {
    return this.regulatoryRisk.level === 'CRITICAL' ? 50000 : 15000;
  }

  private estimateReputationalCost(): number {
    return this.violatedFrameworks.some(f => f.publicDisclosureRequired)
      ? 200000
      : 50000;
  }
}

/**
 * Multi-tenant security management service
 */
export class MultiTenantSecurityManager {
  private securityContexts: Map<string, TenantSecurityContext> = new Map();
  private threatDetectionEngine: ThreatDetectionEngine;
  private complianceMonitor: ComplianceMonitor;
  private auditLogger: SecurityAuditLogger;
  private isolationController: TenantIsolationController;
  private alertingService: SecurityAlertingService;

  constructor(
    threatDetectionEngine: ThreatDetectionEngine,
    complianceMonitor: ComplianceMonitor,
    auditLogger: SecurityAuditLogger,
    isolationController: TenantIsolationController,
    alertingService: SecurityAlertingService
  ) {
    this.threatDetectionEngine = threatDetectionEngine;
    this.complianceMonitor = complianceMonitor;
    this.auditLogger = auditLogger;
    this.isolationController = isolationController;
    this.alertingService = alertingService;
  }

  /**
   * Initialize tenant security context
   */
  async initializeTenantSecurity(
    tenantId: string,
    securityRequirements: TenantSecurityRequirements,
    complianceFrameworks: ComplianceFramework[],
    initializingActor: IActor
  ): Promise<TenantSecurityContext> {
    try {
      // Validate actor permissions
      if (!this.canInitializeTenantSecurity(initializingActor, tenantId)) {
        throw new ActorError(
          `Actor ${initializingActor.id} cannot initialize security for tenant ${tenantId}`,
          'TENANT_SECURITY_INITIALIZATION_DENIED',
          { actorId: initializingActor.id, tenantId }
        );
      }

      // Create security context
      const securityContext: TenantSecurityContext = {
        tenantId,
        securityLevel: securityRequirements.securityLevel,
        complianceFrameworks,
        isolationRequirements: securityRequirements.isolationRequirements,
        encryptionRequirements: securityRequirements.encryptionRequirements,
        auditRequirements: securityRequirements.auditRequirements,
        threatDetectionProfile:
          this.createThreatDetectionProfile(securityRequirements),
        securityPolicies: this.generateSecurityPolicies(securityRequirements),
        isolationBoundaries: await this.establishIsolationBoundaries(
          tenantId,
          securityRequirements
        ),
        createdAt: new Date(),
        createdBy: initializingActor.id,
        lastUpdated: new Date(),
        status: 'ACTIVE',
      };

      // Store security context
      this.securityContexts.set(tenantId, securityContext);

      // Initialize compliance monitoring
      await this.complianceMonitor.initializeTenantMonitoring(
        tenantId,
        complianceFrameworks
      );

      // Setup threat detection
      await this.threatDetectionEngine.initializeTenantProfile(
        tenantId,
        securityContext.threatDetectionProfile
      );

      // Log security initialization
      await this.auditLogger.logTenantSecurityInitialization(
        securityContext,
        initializingActor
      );

      return securityContext;
    } catch (error) {
      await this.auditLogger.logTenantSecurityInitializationFailure(
        tenantId,
        error,
        initializingActor
      );
      throw error;
    }
  }

  /**
   * Detect and handle security threats
   */
  async detectAndHandleThreats(
    tenantId: string,
    securityEvent: SecurityEvent,
    reportingActor?: IActor
  ): Promise<ThreatHandlingResult> {
    const securityContext = this.securityContexts.get(tenantId);
    if (!securityContext) {
      throw new MultiTenantSecurityError(
        `Security context not found for tenant: ${tenantId}`,
        DomainErrorCode.SECURITY_CONTEXT_NOT_FOUND,
        tenantId,
        'UNKNOWN',
        'HIGH'
      );
    }

    try {
      // Analyze threat using detection engine
      const threatAnalysis = await this.threatDetectionEngine.analyzeEvent(
        securityEvent,
        securityContext
      );

      const result: ThreatHandlingResult = {
        threatId: `THREAT-${Date.now()}-${tenantId}`,
        tenantId,
        threatLevel: threatAnalysis.threatLevel,
        threatType: threatAnalysis.threatType,
        detectedAt: new Date(),
        handled: false,
        actions: [],
        isolationRequired: false,
        complianceImpact: [],
      };

      // Handle based on threat level and type
      if (threatAnalysis.threatLevel === 'CRITICAL') {
        await this.handleCriticalThreat(
          tenantId,
          threatAnalysis,
          securityContext,
          result
        );
      } else if (threatAnalysis.threatLevel === 'HIGH') {
        await this.handleHighThreat(
          tenantId,
          threatAnalysis,
          securityContext,
          result
        );
      } else {
        await this.handleStandardThreat(
          tenantId,
          threatAnalysis,
          securityContext,
          result
        );
      }

      // Check for isolation breach
      if (threatAnalysis.isolationBreach) {
        await this.handleIsolationBreach(
          tenantId,
          threatAnalysis,
          securityContext
        );
        result.isolationRequired = true;
      }

      // Check compliance impact
      const complianceImpact = await this.assessComplianceImpact(
        threatAnalysis,
        securityContext
      );
      if (complianceImpact.length > 0) {
        result.complianceImpact = complianceImpact;
        await this.handleComplianceViolation(
          tenantId,
          complianceImpact,
          securityContext
        );
      }

      result.handled = true;
      await this.auditLogger.logThreatHandled(result, reportingActor);

      return result;
    } catch (error) {
      await this.auditLogger.logThreatHandlingFailure(
        tenantId,
        securityEvent,
        error,
        reportingActor
      );
      throw error;
    }
  }

  /**
   * Generate comprehensive security report
   */
  async generateSecurityReport(
    tenantId: string | 'ALL',
    reportType: SecurityReportType,
    timeframe: { start: Date; end: Date },
    requestingActor: IActor
  ): Promise<SecurityReport> {
    try {
      // Validate permissions
      if (
        !this.canGenerateSecurityReport(requestingActor, tenantId, reportType)
      ) {
        throw new ActorError(
          `Actor ${requestingActor.id} cannot generate ${reportType} security report for ${tenantId}`,
          'SECURITY_REPORT_ACCESS_DENIED',
          { actorId: requestingActor.id, tenantId, reportType }
        );
      }

      const report: SecurityReport = {
        reportId: `SEC-REPORT-${Date.now()}`,
        reportType,
        tenantId,
        timeframe,
        generatedAt: new Date(),
        generatedBy: requestingActor.id,
        executiveSummary: await this.generateExecutiveSummary(
          tenantId,
          timeframe
        ),
        threatAnalysis: await this.generateThreatAnalysis(tenantId, timeframe),
        complianceStatus: await this.generateComplianceStatus(
          tenantId,
          timeframe
        ),
        isolationMetrics: await this.generateIsolationMetrics(
          tenantId,
          timeframe
        ),
        securityIncidents: await this.getSecurityIncidents(tenantId, timeframe),
        recommendations: await this.generateSecurityRecommendations(
          tenantId,
          timeframe
        ),
        attachments: [],
      };

      // Add detailed sections based on report type
      if (reportType === 'COMPREHENSIVE' || reportType === 'COMPLIANCE') {
        report.complianceDetails =
          await this.generateDetailedComplianceAnalysis(tenantId, timeframe);
      }

      if (reportType === 'COMPREHENSIVE' || reportType === 'THREAT_ANALYSIS') {
        report.detailedThreatAnalysis =
          await this.generateDetailedThreatAnalysis(tenantId, timeframe);
      }

      if (reportType === 'FORENSIC') {
        report.forensicEvidence = await this.gatherForensicEvidence(
          tenantId,
          timeframe
        );
      }

      await this.auditLogger.logSecurityReportGenerated(
        report,
        requestingActor
      );

      return report;
    } catch (error) {
      await this.auditLogger.logSecurityReportGenerationFailure(
        tenantId,
        reportType,
        error,
        requestingActor
      );
      throw error;
    }
  }

  /**
   * Perform tenant isolation for security breach
   */
  async performTenantIsolation(
    tenantId: string,
    isolationLevel: IsolationLevel,
    reason: string,
    authorizingActor: IActor,
    duration?: number
  ): Promise<IsolationResult> {
    try {
      // Validate isolation permissions
      if (
        !this.canPerformIsolation(authorizingActor, tenantId, isolationLevel)
      ) {
        throw new ActorError(
          `Actor ${authorizingActor.id} cannot perform ${isolationLevel} isolation for tenant ${tenantId}`,
          'TENANT_ISOLATION_DENIED',
          { actorId: authorizingActor.id, tenantId, isolationLevel }
        );
      }

      const isolationId = `ISOLATION-${Date.now()}-${tenantId}`;
      const isolationResult: IsolationResult = {
        isolationId,
        tenantId,
        isolationLevel,
        reason,
        authorizedBy: authorizingActor.id,
        startedAt: new Date(),
        duration,
        expiresAt: duration ? new Date(Date.now() + duration) : undefined,
        status: 'IN_PROGRESS',
        actionsPerformed: [],
        affectedResources: [],
      };

      // Perform isolation actions based on level
      switch (isolationLevel) {
        case 'NETWORK_ONLY':
          await this.isolationController.isolateNetwork(tenantId);
          isolationResult.actionsPerformed.push('NETWORK_ISOLATION');
          break;

        case 'DATA_ACCESS':
          await this.isolationController.isolateDataAccess(tenantId);
          isolationResult.actionsPerformed.push('DATA_ACCESS_ISOLATION');
          break;

        case 'COMPLETE':
          await this.isolationController.performCompleteIsolation(tenantId);
          isolationResult.actionsPerformed.push('COMPLETE_ISOLATION');
          break;

        case 'QUARANTINE':
          await this.isolationController.quarantineTenant(tenantId);
          isolationResult.actionsPerformed.push('TENANT_QUARANTINE');
          break;
      }

      // Get affected resources
      isolationResult.affectedResources =
        await this.isolationController.getAffectedResources(tenantId);
      isolationResult.status = 'ACTIVE';
      isolationResult.completedAt = new Date();

      // Schedule automatic restoration if duration specified
      if (duration) {
        await this.scheduleIsolationRestoration(isolationId, duration);
      }

      await this.auditLogger.logTenantIsolationPerformed(
        isolationResult,
        authorizingActor
      );

      return isolationResult;
    } catch (error) {
      await this.auditLogger.logTenantIsolationFailure(
        tenantId,
        isolationLevel,
        error,
        authorizingActor
      );
      throw error;
    }
  }

  // Private helper methods
  private canInitializeTenantSecurity(
    actor: IActor,
    tenantId: string
  ): boolean {
    // Implementation for security initialization permission check
    return true; // Simplified for example
  }

  private createThreatDetectionProfile(
    requirements: TenantSecurityRequirements
  ): ThreatDetectionProfile {
    return {
      sensitivityLevel:
        requirements.securityLevel === 'MAXIMUM' ? 'HIGH' : 'MEDIUM',
      monitoringScope: ['NETWORK', 'DATA_ACCESS', 'USER_BEHAVIOR'],
      alertThresholds: this.calculateAlertThresholds(
        requirements.securityLevel
      ),
      complianceChecks: requirements.complianceFrameworks || [],
    };
  }

  private generateSecurityPolicies(
    requirements: TenantSecurityRequirements
  ): SecurityPolicy[] {
    return [
      {
        policyId: 'SEC-POL-001',
        name: 'Data Access Policy',
        type: 'DATA_ACCESS',
        enforcementLevel: requirements.securityLevel,
        rules: this.generateDataAccessRules(requirements),
      },
    ];
  }

  private async establishIsolationBoundaries(
    tenantId: string,
    requirements: TenantSecurityRequirements
  ): Promise<IsolationBoundary[]> {
    return [
      {
        boundaryId: `BOUNDARY-${tenantId}-NETWORK`,
        type: 'NETWORK',
        tenantId,
        configuration: requirements.isolationRequirements?.network || {},
      },
    ];
  }

  private async handleCriticalThreat(
    tenantId: string,
    threatAnalysis: ThreatAnalysis,
    securityContext: TenantSecurityContext,
    result: ThreatHandlingResult
  ): Promise<void> {
    // Immediate containment
    result.actions.push({
      type: 'IMMEDIATE_CONTAINMENT',
      priority: 'CRITICAL',
      target: 'AFFECTED_RESOURCES',
      description: 'Critical threat containment',
      timeoutMinutes: 5,
      autoExecute: true,
    });

    // Alert security team
    await this.alertingService.sendCriticalThreatAlert(
      tenantId,
      threatAnalysis
    );
  }

  private async handleHighThreat(
    tenantId: string,
    threatAnalysis: ThreatAnalysis,
    securityContext: TenantSecurityContext,
    result: ThreatHandlingResult
  ): Promise<void> {
    // Enhanced monitoring
    result.actions.push({
      type: 'ENHANCED_MONITORING',
      priority: 'HIGH',
      target: 'THREAT_SOURCE',
      description: 'Enhanced monitoring of threat source',
      timeoutMinutes: 15,
      autoExecute: true,
    });
  }

  private async handleStandardThreat(
    tenantId: string,
    threatAnalysis: ThreatAnalysis,
    securityContext: TenantSecurityContext,
    result: ThreatHandlingResult
  ): Promise<void> {
    // Standard logging and monitoring
    result.actions.push({
      type: 'STANDARD_MONITORING',
      priority: 'MEDIUM',
      target: 'THREAT_INDICATORS',
      description: 'Standard threat monitoring',
      timeoutMinutes: 60,
      autoExecute: true,
    });
  }

  private async handleIsolationBreach(
    tenantId: string,
    threatAnalysis: ThreatAnalysis,
    securityContext: TenantSecurityContext
  ): Promise<void> {
    // Handle isolation breach
    const breachError = new TenantIsolationBreachError(
      'Tenant isolation breach detected',
      tenantId,
      securityContext.tenantId,
      threatAnalysis.breachType!,
      threatAnalysis.affectedTenants || [tenantId],
      threatAnalysis.dataExposureRisk!,
      threatAnalysis.breachVector!
    );

    // Execute security actions
    const securityActions = breachError.getRequiredSecurityActions();
    for (const action of securityActions.filter(a => a.autoExecute)) {
      await this.executeSecurityAction(action, tenantId);
    }
  }

  private async assessComplianceImpact(
    threatAnalysis: ThreatAnalysis,
    securityContext: TenantSecurityContext
  ): Promise<ComplianceImpact[]> {
    return securityContext.complianceFrameworks.map(framework => ({
      framework: framework.name,
      severity: threatAnalysis.threatLevel,
      reportingDeadline: framework.reportingDeadline,
      evidenceRequirements: framework.evidenceRequirements,
      requiresNotification:
        framework.requiresImmediateNotification &&
        threatAnalysis.threatLevel === 'CRITICAL',
    }));
  }

  private async handleComplianceViolation(
    tenantId: string,
    complianceImpact: ComplianceImpact[],
    securityContext: TenantSecurityContext
  ): Promise<void> {
    // Implementation for handling compliance violations
  }

  private canGenerateSecurityReport(
    actor: IActor,
    tenantId: string | 'ALL',
    reportType: SecurityReportType
  ): boolean {
    // Implementation for report generation permission check
    return true; // Simplified for example
  }

  private canPerformIsolation(
    actor: IActor,
    tenantId: string,
    isolationLevel: IsolationLevel
  ): boolean {
    // Implementation for isolation permission check
    return true; // Simplified for example
  }

  private calculateAlertThresholds(
    securityLevel: SecurityLevel
  ): AlertThresholds {
    return {
      anomalyScore: securityLevel === 'MAXIMUM' ? 0.7 : 0.8,
      accessFailures: securityLevel === 'MAXIMUM' ? 3 : 5,
      dataVolumeThreshold: securityLevel === 'MAXIMUM' ? 100 : 500,
    };
  }

  private generateDataAccessRules(
    requirements: TenantSecurityRequirements
  ): SecurityRule[] {
    return [
      {
        ruleId: 'DAR-001',
        description: 'Tenant data isolation',
        condition: 'tenantId === currentUser.tenantId',
        action: 'ALLOW',
        priority: 1,
      },
    ];
  }

  private async executeSecurityAction(
    action: SecurityAction,
    tenantId: string
  ): Promise<void> {
    // Implementation for executing security actions
  }

  private async scheduleIsolationRestoration(
    isolationId: string,
    duration: number
  ): Promise<void> {
    // Implementation for scheduling automatic isolation restoration
  }

  // Report generation methods (simplified signatures)
  private async generateExecutiveSummary(
    tenantId: string | 'ALL',
    timeframe: { start: Date; end: Date }
  ): Promise<ExecutiveSummary> {
    return {} as ExecutiveSummary;
  }

  private async generateThreatAnalysis(
    tenantId: string | 'ALL',
    timeframe: { start: Date; end: Date }
  ): Promise<ThreatAnalysisSummary> {
    return {} as ThreatAnalysisSummary;
  }

  private async generateComplianceStatus(
    tenantId: string | 'ALL',
    timeframe: { start: Date; end: Date }
  ): Promise<ComplianceStatusSummary> {
    return {} as ComplianceStatusSummary;
  }

  private async generateIsolationMetrics(
    tenantId: string | 'ALL',
    timeframe: { start: Date; end: Date }
  ): Promise<IsolationMetrics> {
    return {} as IsolationMetrics;
  }

  private async getSecurityIncidents(
    tenantId: string | 'ALL',
    timeframe: { start: Date; end: Date }
  ): Promise<SecurityIncident[]> {
    return [];
  }

  private async generateSecurityRecommendations(
    tenantId: string | 'ALL',
    timeframe: { start: Date; end: Date }
  ): Promise<SecurityRecommendation[]> {
    return [];
  }

  private async generateDetailedComplianceAnalysis(
    tenantId: string | 'ALL',
    timeframe: { start: Date; end: Date }
  ): Promise<DetailedComplianceAnalysis> {
    return {} as DetailedComplianceAnalysis;
  }

  private async generateDetailedThreatAnalysis(
    tenantId: string | 'ALL',
    timeframe: { start: Date; end: Date }
  ): Promise<DetailedThreatAnalysis> {
    return {} as DetailedThreatAnalysis;
  }

  private async gatherForensicEvidence(
    tenantId: string | 'ALL',
    timeframe: { start: Date; end: Date }
  ): Promise<ForensicEvidence> {
    return {} as ForensicEvidence;
  }
}
```

## Usage Example

```typescript
// multi-tenant-security-demo.ts
import {
  MultiTenantSecurityManager,
  TenantIsolationBreachError,
  ComplianceViolationSecurityError,
} from './multi-tenant-security';
import { SystemAdministratorActor } from '../intermediate/example-3'; // Reference to actor example

export class MultiTenantSecurityDemo {
  private securityManager: MultiTenantSecurityManager;

  constructor(securityManager: MultiTenantSecurityManager) {
    this.securityManager = securityManager;
  }

  async demonstrateSecurityInitialization(): Promise<void> {
    try {
      // Create system admin for security operations
      const sysAdmin = new SystemAdministratorActor(
        'SYSADMIN-SEC-001',
        'ENTERPRISE',
        {
          sessionMetadata: {
            sessionId: 'SEC-SESSION-001',
            createdAt: new Date(),
            ipAddress: '10.0.0.1',
            userAgent: 'SecurityDemo/1.0',
          },
        }
      );

      // Initialize security for healthcare tenant (HIPAA compliance)
      const healthcareSecurityContext =
        await this.securityManager.initializeTenantSecurity(
          'TENANT-HEALTHCARE-001',
          {
            securityLevel: 'MAXIMUM',
            isolationRequirements: {
              network: { strictIsolation: true, encryptedTraffic: true },
              data: { encryptionAtRest: true, encryptionInTransit: true },
              compute: { dedicatedResources: true, secureEnclaves: true },
            },
            encryptionRequirements: {
              algorithm: 'AES-256',
              keyManagement: 'HSM',
              rotationPolicy: 'QUARTERLY',
            },
            auditRequirements: {
              logLevel: 'COMPREHENSIVE',
              retentionYears: 7,
              tamperProofing: true,
              realTimeMonitoring: true,
            },
            complianceFrameworks: ['HIPAA', 'SOC2_TYPE2'],
          },
          [
            {
              name: 'HIPAA',
              version: '2013',
              regulatoryBody: 'HHS',
              requiresImmediateNotification: true,
              notificationDeadlineHours: 60,
              reportingDeadline: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              ), // 30 days
              remediationTimelineDays: 30,
              maximumPenalty: 1900000, // $1.9M per HIPAA
              evidenceRequirements: [
                'AUDIT_LOGS',
                'ACCESS_RECORDS',
                'ENCRYPTION_CERTIFICATES',
              ],
              templateRequired: true,
              publicDisclosureRequired: true,
              contactInformation: 'hipaa-compliance@hhs.gov',
            },
          ],
          sysAdmin
        );

      console.log('Healthcare tenant security initialized:', {
        tenantId: healthcareSecurityContext.tenantId,
        securityLevel: healthcareSecurityContext.securityLevel,
        complianceFrameworks:
          healthcareSecurityContext.complianceFrameworks.map(f => f.name),
        isolationBoundaries:
          healthcareSecurityContext.isolationBoundaries.length,
      });

      // Initialize security for financial tenant (PCI-DSS compliance)
      const financialSecurityContext =
        await this.securityManager.initializeTenantSecurity(
          'TENANT-FINANCIAL-001',
          {
            securityLevel: 'HIGH',
            isolationRequirements: {
              network: { strictIsolation: true, encryptedTraffic: true },
              data: { encryptionAtRest: true, tokenization: true },
              compute: { isolatedProcessing: true },
            },
            encryptionRequirements: {
              algorithm: 'AES-256',
              keyManagement: 'DEDICATED_HSM',
              rotationPolicy: 'MONTHLY',
            },
            auditRequirements: {
              logLevel: 'DETAILED',
              retentionYears: 5,
              tamperProofing: true,
              realTimeMonitoring: true,
            },
            complianceFrameworks: ['PCI_DSS', 'SOC2_TYPE2', 'SOX'],
          },
          [
            {
              name: 'PCI_DSS',
              version: '4.0',
              regulatoryBody: 'PCI_SSC',
              requiresImmediateNotification: true,
              notificationDeadlineHours: 24,
              reportingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
              remediationTimelineDays: 90,
              maximumPenalty: 500000, // $500K typical fine
              evidenceRequirements: [
                'TRANSACTION_LOGS',
                'SECURITY_ASSESSMENTS',
                'COMPLIANCE_SCANS',
              ],
              templateRequired: false,
              publicDisclosureRequired: false,
              contactInformation: 'security@pcisecuritystandards.org',
            },
          ],
          sysAdmin
        );

      console.log('Financial tenant security initialized:', {
        tenantId: financialSecurityContext.tenantId,
        securityLevel: financialSecurityContext.securityLevel,
        complianceFrameworks: financialSecurityContext.complianceFrameworks.map(
          f => f.name
        ),
      });
    } catch (error) {
      console.error('Security initialization error:', error);
    }
  }

  async demonstrateIsolationBreachHandling(): Promise<void> {
    try {
      // Simulate isolation breach
      const isolationBreach = new TenantIsolationBreachError(
        'Cross-tenant data access detected in database query',
        'TENANT-HEALTHCARE-001',
        'DATABASE_ACCESS',
        'DATA_LEAKAGE',
        ['TENANT-HEALTHCARE-001', 'TENANT-FINANCIAL-001'],
        {
          level: 'CRITICAL',
          dataTypes: ['PHI', 'FINANCIAL_RECORDS'],
          estimatedRecordCount: 15000,
          sensitivityLevel: 'HIGHLY_SENSITIVE',
        },
        {
          type: 'DATABASE_MISCONFIGURATION',
          source: 'APPLICATION_QUERY',
          discoveredBy: 'AUTOMATED_MONITORING',
        },
        {
          complianceImpact: [
            {
              framework: 'HIPAA',
              severity: 'CRITICAL',
              reportingDeadline: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
              evidenceRequirements: [
                'QUERY_LOGS',
                'ACCESS_RECORDS',
                'DATA_CLASSIFICATION',
              ],
              requiresNotification: true,
            },
          ],
        }
      );

      console.log('\n=== Isolation Breach Analysis ===');
      console.log(
        'Breach Context:',
        isolationBreach.getSecurityIncidentContext()
      );
      console.log(
        'Requires Immediate Response:',
        isolationBreach.requiresImmediateResponse()
      );
      console.log(
        'Compliance Severity:',
        isolationBreach.getComplianceSeverity()
      );

      const breachAnalysis = isolationBreach.generateBreachAnalysis();
      console.log('\nBreach Analysis:', {
        breachId: breachAnalysis.breachId,
        affectedTenants: breachAnalysis.affectedTenants,
        dataExposureRisk: breachAnalysis.dataExposureRisk,
        estimatedImpact: breachAnalysis.estimatedImpact,
        recoveryTimeEstimate: breachAnalysis.recoveryTimeEstimate,
      });

      const requiredActions = isolationBreach.getRequiredSecurityActions();
      console.log(
        '\nRequired Security Actions:',
        requiredActions.map(action => ({
          type: action.type,
          priority: action.priority,
          timeoutMinutes: action.timeoutMinutes,
          autoExecute: action.autoExecute,
        }))
      );
    } catch (error) {
      console.error('Error in isolation breach demo:', error);
    }
  }

  async demonstrateComplianceViolation(): Promise<void> {
    try {
      // Simulate compliance violation
      const complianceViolation = new ComplianceViolationSecurityError(
        'PHI data retention period exceeded - automatic deletion failed',
        'TENANT-HEALTHCARE-001',
        'DATA_RETENTION',
        [
          {
            name: 'HIPAA',
            version: '2013',
            regulatoryBody: 'HHS',
            requiresImmediateNotification: true,
            notificationDeadlineHours: 60,
            reportingDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            remediationTimelineDays: 30,
            maximumPenalty: 1900000,
            evidenceRequirements: [
              'RETENTION_POLICIES',
              'DELETION_LOGS',
              'DATA_INVENTORY',
            ],
            templateRequired: true,
            publicDisclosureRequired: true,
            contactInformation: 'hipaa-compliance@hhs.gov',
          },
        ],
        'DATA_RETENTION_VIOLATION',
        {
          level: 'HIGH',
          potentialFine: 500000,
          litigationRisk: 'MEDIUM',
          reputationalImpact: 'HIGH',
        },
        {
          preservationRequired: true,
          retentionPeriodDays: 2555, // 7 years
          auditTrailCompleteness: 'PARTIAL',
          evidenceIntegrity: 'INTACT',
        }
      );

      console.log('\n=== Compliance Violation Analysis ===');
      console.log(
        'Violation Context:',
        complianceViolation.getSecurityIncidentContext()
      );
      console.log(
        'Compliance Severity:',
        complianceViolation.getComplianceSeverity()
      );

      const violationReport =
        complianceViolation.generateComplianceViolationReport();
      console.log('\nViolation Report:', {
        violationId: violationReport.violationId,
        violatedFrameworks: violationReport.violatedFrameworks,
        regulatoryRisk: violationReport.regulatoryRisk,
        estimatedFinancialImpact: violationReport.estimatedFinancialImpact,
        reportingRequirements: violationReport.reportingRequirements.map(
          req => ({
            framework: req.framework,
            reportingDeadline: req.reportingDeadline,
            regulatoryBody: req.regulatoryBody,
          })
        ),
      });

      const requiredActions = complianceViolation.getRequiredSecurityActions();
      console.log(
        '\nRequired Actions:',
        requiredActions.map(action => ({
          type: action.type,
          priority: action.priority,
          description: action.description,
        }))
      );
    } catch (error) {
      console.error('Error in compliance violation demo:', error);
    }
  }

  async demonstrateThreatDetectionAndResponse(): Promise<void> {
    try {
      const sysAdmin = new SystemAdministratorActor(
        'SYSADMIN-THREAT-001',
        'ENTERPRISE'
      );

      // Simulate threat detection and response
      const threatHandlingResult =
        await this.securityManager.detectAndHandleThreats(
          'TENANT-HEALTHCARE-001',
          {
            eventId: 'SEC-EVENT-001',
            eventType: 'ANOMALOUS_DATA_ACCESS',
            timestamp: new Date(),
            source: {
              userId: 'USER-SUSPICIOUS-001',
              ipAddress: '192.168.1.100',
              userAgent: 'SuspiciousBot/1.0',
              location: 'Unknown',
            },
            details: {
              accessedResources: ['PATIENT_RECORDS', 'BILLING_DATA'],
              accessPattern: 'BULK_DOWNLOAD',
              dataVolume: '50GB',
              timeOfDay: 'OFF_HOURS',
              anomalyScore: 0.95,
            },
            metadata: {
              correlationId: 'THREAT-CORR-001',
              sessionId: 'SESSION-SUSPICIOUS-001',
            },
          },
          sysAdmin
        );

      console.log('\n=== Threat Detection and Response ===');
      console.log('Threat Handling Result:', {
        threatId: threatHandlingResult.threatId,
        threatLevel: threatHandlingResult.threatLevel,
        threatType: threatHandlingResult.threatType,
        handled: threatHandlingResult.handled,
        isolationRequired: threatHandlingResult.isolationRequired,
        actionsPerformed: threatHandlingResult.actions.length,
      });

      if (threatHandlingResult.isolationRequired) {
        // Perform tenant isolation
        const isolationResult =
          await this.securityManager.performTenantIsolation(
            'TENANT-HEALTHCARE-001',
            'NETWORK_ONLY',
            'Suspicious bulk data access detected',
            sysAdmin,
            60 * 60 * 1000 // 1 hour
          );

        console.log('\nTenant Isolation Performed:', {
          isolationId: isolationResult.isolationId,
          isolationLevel: isolationResult.isolationLevel,
          actionsPerformed: isolationResult.actionsPerformed,
          expiresAt: isolationResult.expiresAt,
        });
      }
    } catch (error) {
      console.error('Error in threat detection demo:', error);
    }
  }

  async demonstrateSecurityReporting(): Promise<void> {
    try {
      const sysAdmin = new SystemAdministratorActor(
        'SYSADMIN-REPORT-001',
        'ENTERPRISE'
      );

      // Generate comprehensive security report
      const securityReport = await this.securityManager.generateSecurityReport(
        'TENANT-HEALTHCARE-001',
        'COMPREHENSIVE',
        {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date(),
        },
        sysAdmin
      );

      console.log('\n=== Security Report ===');
      console.log('Report Details:', {
        reportId: securityReport.reportId,
        reportType: securityReport.reportType,
        tenantId: securityReport.tenantId,
        generatedBy: securityReport.generatedBy,
        executiveSummary: securityReport.executiveSummary,
        threatAnalysis: securityReport.threatAnalysis,
        complianceStatus: securityReport.complianceStatus,
        isolationMetrics: securityReport.isolationMetrics,
        totalIncidents: securityReport.securityIncidents.length,
        recommendations: securityReport.recommendations.length,
      });

      // Generate compliance-specific report
      const complianceReport =
        await this.securityManager.generateSecurityReport(
          'ALL',
          'COMPLIANCE',
          {
            start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
            end: new Date(),
          },
          sysAdmin
        );

      console.log('\nCompliance Report Summary:', {
        reportId: complianceReport.reportId,
        scope: complianceReport.tenantId,
        complianceDetails: complianceReport.complianceDetails
          ? 'Included'
          : 'Not Included',
        timeframe: complianceReport.timeframe,
      });
    } catch (error) {
      console.error('Error in security reporting demo:', error);
    }
  }
}
```

## Key Features

- **Multi-Tenant Security Architecture**: Comprehensive tenant isolation and
  security context management
- **Advanced Threat Detection**: Sophisticated threat analysis with automated
  response capabilities
- **Compliance Framework Integration**: Built-in support for HIPAA, PCI-DSS,
  SOC2, GDPR, and other frameworks
- **Isolation Breach Management**: Advanced detection and handling of tenant
  isolation breaches
- **Compliance Violation Handling**: Automated compliance monitoring and
  violation response
- **Security Incident Management**: Complete incident lifecycle management with
  forensic capabilities
- **Regulatory Reporting**: Automated compliance reporting with
  framework-specific requirements
- **Tenant Isolation Controls**: Multiple isolation levels with automated
  restoration
- **Audit and Forensics**: Comprehensive audit trails and forensic evidence
  collection

## Common Pitfalls

- **Over-Isolation**: Balance security with operational efficiency to avoid
  excessive isolation
- **Compliance Complexity**: Ensure all framework requirements are properly
  mapped and tracked
- **Alert Fatigue**: Tune threat detection thresholds to minimize false
  positives
- **Performance Impact**: Monitor security overhead on system performance
- **Recovery Planning**: Ensure robust recovery procedures for isolation events

## Related Examples

- [Enterprise Domain Orchestration](../advanced/example-1.md) - Cross-domain
  security coordination
- [Actor Pattern Implementation](../intermediate/example-3.md) - Security actor
  patterns and contexts
- [Domain Error Hierarchies](../intermediate/example-2.md) - Security error
  management patterns
- [NestJS Security Integration](../frameworks/nestjs/advanced/example-1.md) -
  Framework-specific security implementations
