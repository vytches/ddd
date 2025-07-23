# Actor Pattern Implementation - Intermediate Example

**Version**: 1.0.0
**Package**: @vytches-ddd/domain-primitives
**Complexity**: intermediate
**Domain**: Actor Management
**Patterns**: Actor Pattern, Context Propagation, Identity Management
**Dependencies**: IActor, ActorError, DefaultActorType

## Description

Demonstrates comprehensive actor pattern implementation with context propagation, identity management, and sophisticated actor hierarchies for multi-tenant enterprise applications with role-based access control.

## Business Context

Enterprise multi-tenant SaaS platform requiring sophisticated actor management with hierarchical permissions, context switching, delegation patterns, and comprehensive audit trails for regulatory compliance and security monitoring.

## Code Example

```typescript
// actor-hierarchy.ts
import { 
  IActor, 
  ActorError, 
  DefaultActorType 
} from '@vytches-ddd/domain-primitives';
import { 
  TenantContext, 
  OrganizationContext, 
  RolePermissions, 
  ActorCapabilities 
} from './types'; // From your app

/**
 * Enhanced actor interface with enterprise capabilities
 */
export interface IEnterpriseActor extends IActor {
  readonly tenantId: string;
  readonly organizationId?: string;
  readonly roles: EnterpriseRole[];
  readonly permissions: Permission[];
  readonly capabilities: ActorCapabilities;
  readonly parentActor?: IEnterpriseActor;
  readonly delegatedActors: IEnterpriseActor[];
  readonly contextStack: ActorContext[];
  readonly sessionMetadata: SessionMetadata;

  // Context management
  switchContext(newContext: ActorContext): Promise<IEnterpriseActor>;
  pushContext(context: ActorContext): Promise<void>;
  popContext(): Promise<ActorContext | null>;
  getCurrentContext(): ActorContext;

  // Permission checks
  hasPermission(permission: string, resource?: string): boolean;
  hasRole(roleName: string): boolean;
  canDelegate(permission: string): boolean;
  canImpersonate(targetActor: IEnterpriseActor): boolean;

  // Delegation management
  delegatePermission(targetActor: IEnterpriseActor, permission: string, duration?: number): Promise<void>;
  revokeDelegation(targetActor: IEnterpriseActor, permission: string): Promise<void>;
  impersonate(targetActor: IEnterpriseActor, reason: string): Promise<IEnterpriseActor>;
  stopImpersonation(): Promise<void>;

  // Audit and compliance
  getAuditTrail(): AuditTrailEntry[];
  recordActivity(activity: ActorActivity): Promise<void>;
  generateComplianceReport(): Promise<ComplianceReport>;
}

/**
 * Base enterprise actor implementation
 */
export abstract class BaseEnterpriseActor implements IEnterpriseActor {
  public readonly id: string;
  public readonly type: string;
  public readonly tenantId: string;
  public readonly organizationId?: string;
  public readonly roles: EnterpriseRole[];
  public readonly permissions: Permission[];
  public readonly capabilities: ActorCapabilities;
  public readonly parentActor?: IEnterpriseActor;
  public readonly delegatedActors: IEnterpriseActor[] = [];
  public readonly contextStack: ActorContext[] = [];
  public readonly sessionMetadata: SessionMetadata;
  
  private auditTrail: AuditTrailEntry[] = [];
  private currentContext: ActorContext;
  private impersonationContext?: ImpersonationContext;

  constructor(
    id: string,
    type: string,
    tenantId: string,
    roles: EnterpriseRole[],
    options: {
      organizationId?: string;
      parentActor?: IEnterpriseActor;
      sessionMetadata?: SessionMetadata;
      initialContext?: ActorContext;
    } = {}
  ) {
    this.id = id;
    this.type = type;
    this.tenantId = tenantId;
    this.organizationId = options.organizationId;
    this.roles = roles;
    this.parentActor = options.parentActor;
    this.sessionMetadata = options.sessionMetadata || this.createDefaultSessionMetadata();
    
    // Calculate permissions from roles
    this.permissions = this.calculatePermissions(roles);
    this.capabilities = this.calculateCapabilities(roles, this.permissions);
    
    // Set initial context
    this.currentContext = options.initialContext || this.createDefaultContext();
    this.contextStack.push(this.currentContext);

    // Record actor creation
    this.recordActivity({
      type: 'ACTOR_CREATED',
      timestamp: new Date(),
      details: {
        actorId: this.id,
        actorType: this.type,
        tenantId: this.tenantId,
        roles: this.roles.map(r => r.name)
      }
    });
  }

  /**
   * Switch to a new context (replaces current context)
   */
  async switchContext(newContext: ActorContext): Promise<IEnterpriseActor> {
    try {
      // Validate context switch permission
      if (!this.canSwitchToContext(newContext)) {
        throw new ActorError(
          `Actor ${this.id} does not have permission to switch to context: ${newContext.name}`,
          'CONTEXT_SWITCH_DENIED',
          { actorId: this.id, targetContext: newContext.name }
        );
      }

      const previousContext = this.currentContext;
      
      // Update context stack
      this.contextStack.pop();
      this.contextStack.push(newContext);
      this.currentContext = newContext;

      await this.recordActivity({
        type: 'CONTEXT_SWITCHED',
        timestamp: new Date(),
        details: {
          previousContext: previousContext.name,
          newContext: newContext.name,
          reason: newContext.switchReason
        }
      });

      // Return new actor instance with updated context
      return this.createContextualizedActor(newContext);

    } catch (error) {
      await this.recordActivity({
        type: 'CONTEXT_SWITCH_FAILED',
        timestamp: new Date(),
        details: {
          targetContext: newContext.name,
          error: error.message
        }
      });
      throw error;
    }
  }

  /**
   * Push a new context onto the stack
   */
  async pushContext(context: ActorContext): Promise<void> {
    if (!this.canSwitchToContext(context)) {
      throw new ActorError(
        `Actor ${this.id} cannot push context: ${context.name}`,
        'CONTEXT_PUSH_DENIED',
        { actorId: this.id, targetContext: context.name }
      );
    }

    this.contextStack.push(context);
    this.currentContext = context;

    await this.recordActivity({
      type: 'CONTEXT_PUSHED',
      timestamp: new Date(),
      details: {
        contextName: context.name,
        stackDepth: this.contextStack.length
      }
    });
  }

  /**
   * Pop the current context from the stack
   */
  async popContext(): Promise<ActorContext | null> {
    if (this.contextStack.length <= 1) {
      return null; // Cannot pop the base context
    }

    const poppedContext = this.contextStack.pop()!;
    this.currentContext = this.contextStack[this.contextStack.length - 1];

    await this.recordActivity({
      type: 'CONTEXT_POPPED',
      timestamp: new Date(),
      details: {
        poppedContext: poppedContext.name,
        currentContext: this.currentContext.name,
        stackDepth: this.contextStack.length
      }
    });

    return poppedContext;
  }

  /**
   * Get current context
   */
  getCurrentContext(): ActorContext {
    return this.currentContext;
  }

  /**
   * Check if actor has specific permission
   */
  hasPermission(permission: string, resource?: string): boolean {
    // Check direct permissions
    const hasDirectPermission = this.permissions.some(p => 
      p.name === permission && 
      (!resource || p.resources.includes(resource) || p.resources.includes('*'))
    );

    if (hasDirectPermission) {
      return true;
    }

    // Check context-specific permissions
    const contextPermissions = this.currentContext.additionalPermissions || [];
    const hasContextPermission = contextPermissions.some(p => 
      p.name === permission && 
      (!resource || p.resources.includes(resource) || p.resources.includes('*'))
    );

    if (hasContextPermission) {
      return true;
    }

    // Check delegated permissions
    return this.hasDelegatedPermission(permission, resource);
  }

  /**
   * Check if actor has specific role
   */
  hasRole(roleName: string): boolean {
    return this.roles.some(role => role.name === roleName) ||
           this.currentContext.temporaryRoles?.some(role => role.name === roleName) || false;
  }

  /**
   * Check if actor can delegate specific permission
   */
  canDelegate(permission: string): boolean {
    const permissionObj = this.permissions.find(p => p.name === permission);
    return permissionObj?.delegatable || false;
  }

  /**
   * Check if actor can impersonate target actor
   */
  canImpersonate(targetActor: IEnterpriseActor): boolean {
    // Must have impersonation capability
    if (!this.capabilities.canImpersonate) {
      return false;
    }

    // Cannot impersonate actors in different tenants
    if (targetActor.tenantId !== this.tenantId) {
      return false;
    }

    // Cannot impersonate actors with higher privileges
    if (this.hasHigherPrivileges(targetActor)) {
      return false;
    }

    // Check organization boundaries
    if (this.organizationId && targetActor.organizationId && 
        this.organizationId !== targetActor.organizationId) {
      return this.hasPermission('CROSS_ORGANIZATION_IMPERSONATE');
    }

    return true;
  }

  /**
   * Delegate permission to target actor
   */
  async delegatePermission(
    targetActor: IEnterpriseActor, 
    permission: string, 
    duration?: number
  ): Promise<void> {
    if (!this.canDelegate(permission)) {
      throw new ActorError(
        `Actor ${this.id} cannot delegate permission: ${permission}`,
        'DELEGATION_NOT_ALLOWED',
        { actorId: this.id, permission, targetActorId: targetActor.id }
      );
    }

    if (!this.hasPermission(permission)) {
      throw new ActorError(
        `Actor ${this.id} does not have permission to delegate: ${permission}`,
        'PERMISSION_NOT_HELD',
        { actorId: this.id, permission }
      );
    }

    const delegation: PermissionDelegation = {
      id: `DEL-${Date.now()}-${this.id}-${targetActor.id}`,
      fromActor: this.id,
      toActor: targetActor.id,
      permission,
      grantedAt: new Date(),
      expiresAt: duration ? new Date(Date.now() + duration) : undefined,
      tenantId: this.tenantId
    };

    // Add to target actor's delegated permissions
    targetActor.delegatedActors.push(this);

    await this.recordActivity({
      type: 'PERMISSION_DELEGATED',
      timestamp: new Date(),
      details: {
        targetActor: targetActor.id,
        permission,
        delegationId: delegation.id,
        duration
      }
    });

    await targetActor.recordActivity({
      type: 'PERMISSION_RECEIVED',
      timestamp: new Date(),
      details: {
        sourceActor: this.id,
        permission,
        delegationId: delegation.id
      }
    });
  }

  /**
   * Revoke delegated permission
   */
  async revokeDelegation(targetActor: IEnterpriseActor, permission: string): Promise<void> {
    const delegationIndex = targetActor.delegatedActors.findIndex(actor => actor.id === this.id);
    
    if (delegationIndex === -1) {
      throw new ActorError(
        `No delegation found from ${this.id} to ${targetActor.id} for permission: ${permission}`,
        'DELEGATION_NOT_FOUND',
        { sourceActor: this.id, targetActor: targetActor.id, permission }
      );
    }

    // Remove delegation
    targetActor.delegatedActors.splice(delegationIndex, 1);

    await this.recordActivity({
      type: 'PERMISSION_DELEGATION_REVOKED',
      timestamp: new Date(),
      details: {
        targetActor: targetActor.id,
        permission
      }
    });

    await targetActor.recordActivity({
      type: 'PERMISSION_REVOKED',
      timestamp: new Date(),
      details: {
        sourceActor: this.id,
        permission
      }
    });
  }

  /**
   * Start impersonating target actor
   */
  async impersonate(targetActor: IEnterpriseActor, reason: string): Promise<IEnterpriseActor> {
    if (!this.canImpersonate(targetActor)) {
      throw new ActorError(
        `Actor ${this.id} cannot impersonate ${targetActor.id}`,
        'IMPERSONATION_DENIED',
        { actorId: this.id, targetActorId: targetActor.id }
      );
    }

    if (this.impersonationContext) {
      throw new ActorError(
        `Actor ${this.id} is already impersonating another actor`,
        'ALREADY_IMPERSONATING',
        { actorId: this.id, currentTarget: this.impersonationContext.targetActorId }
      );
    }

    this.impersonationContext = {
      originalActorId: this.id,
      targetActorId: targetActor.id,
      startTime: new Date(),
      reason,
      sessionId: `IMP-${Date.now()}-${this.id}-${targetActor.id}`
    };

    await this.recordActivity({
      type: 'IMPERSONATION_STARTED',
      timestamp: new Date(),
      details: {
        targetActor: targetActor.id,
        reason,
        sessionId: this.impersonationContext.sessionId
      }
    });

    await targetActor.recordActivity({
      type: 'IMPERSONATION_RECEIVED',
      timestamp: new Date(),
      details: {
        sourceActor: this.id,
        reason,
        sessionId: this.impersonationContext.sessionId
      }
    });

    // Return impersonated actor instance
    return this.createImpersonatedActor(targetActor);
  }

  /**
   * Stop current impersonation
   */
  async stopImpersonation(): Promise<void> {
    if (!this.impersonationContext) {
      throw new ActorError(
        `Actor ${this.id} is not currently impersonating anyone`,
        'NOT_IMPERSONATING',
        { actorId: this.id }
      );
    }

    const impersonationContext = this.impersonationContext;
    this.impersonationContext = undefined;

    await this.recordActivity({
      type: 'IMPERSONATION_STOPPED',
      timestamp: new Date(),
      details: {
        targetActor: impersonationContext.targetActorId,
        duration: Date.now() - impersonationContext.startTime.getTime(),
        sessionId: impersonationContext.sessionId
      }
    });
  }

  /**
   * Get complete audit trail for this actor
   */
  getAuditTrail(): AuditTrailEntry[] {
    return [...this.auditTrail].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Record actor activity for audit purposes
   */
  async recordActivity(activity: ActorActivity): Promise<void> {
    const auditEntry: AuditTrailEntry = {
      id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actorId: this.id,
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      timestamp: activity.timestamp,
      activityType: activity.type,
      details: activity.details,
      contextName: this.currentContext.name,
      sessionId: this.sessionMetadata.sessionId,
      ipAddress: this.sessionMetadata.ipAddress,
      userAgent: this.sessionMetadata.userAgent,
      impersonationContext: this.impersonationContext
    };

    this.auditTrail.push(auditEntry);

    // Emit audit event for external systems
    await this.emitAuditEvent(auditEntry);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(): Promise<ComplianceReport> {
    const report: ComplianceReport = {
      actorId: this.id,
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      reportGeneratedAt: new Date(),
      reportingPeriod: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
      },
      actorSummary: {
        type: this.type,
        roles: this.roles.map(r => r.name),
        permissions: this.permissions.map(p => p.name),
        capabilities: this.capabilities
      },
      activitySummary: this.generateActivitySummary(),
      securityEvents: this.getSecurityEvents(),
      impersonationSummary: this.getImpersonationSummary(),
      delegationSummary: this.getDelegationSummary(),
      complianceViolations: await this.detectComplianceViolations(),
      recommendations: this.generateSecurityRecommendations()
    };

    return report;
  }

  /**
   * Create contextualized actor instance
   */
  protected createContextualizedActor(context: ActorContext): IEnterpriseActor {
    // Implementation would create a new actor instance with the given context
    // This is a simplified representation
    return this;
  }

  /**
   * Create impersonated actor instance
   */
  protected createImpersonatedActor(targetActor: IEnterpriseActor): IEnterpriseActor {
    // Implementation would create an actor instance that combines
    // the original actor's identity with the target actor's permissions
    return targetActor;
  }

  private canSwitchToContext(context: ActorContext): boolean {
    // Check if actor has permission to switch to the target context
    return this.hasPermission('CONTEXT_SWITCH', context.name) ||
           context.allowedActorTypes.includes(this.type);
  }

  private hasDelegatedPermission(permission: string, resource?: string): boolean {
    return this.delegatedActors.some(actor => 
      actor.hasPermission(permission, resource)
    );
  }

  private hasHigherPrivileges(targetActor: IEnterpriseActor): boolean {
    // Simple privilege comparison - in real implementation this would be more sophisticated
    const myRoleLevel = Math.max(...this.roles.map(r => r.level));
    const targetRoleLevel = Math.max(...targetActor.roles.map(r => r.level));
    return targetRoleLevel > myRoleLevel;
  }

  private calculatePermissions(roles: EnterpriseRole[]): Permission[] {
    return roles.reduce((permissions, role) => {
      return [...permissions, ...role.permissions];
    }, [] as Permission[]);
  }

  private calculateCapabilities(roles: EnterpriseRole[], permissions: Permission[]): ActorCapabilities {
    return {
      canImpersonate: roles.some(r => r.capabilities.includes('IMPERSONATE')),
      canDelegate: roles.some(r => r.capabilities.includes('DELEGATE')),
      canCreateActors: roles.some(r => r.capabilities.includes('CREATE_ACTORS')),
      canModifyRoles: roles.some(r => r.capabilities.includes('MODIFY_ROLES')),
      canViewAuditLogs: roles.some(r => r.capabilities.includes('VIEW_AUDIT_LOGS')),
      maxDelegationDepth: Math.max(...roles.map(r => r.maxDelegationDepth), 0),
      maxImpersonationDuration: Math.max(...roles.map(r => r.maxImpersonationDuration), 3600000) // 1 hour default
    };
  }

  private createDefaultContext(): ActorContext {
    return {
      name: 'DEFAULT',
      type: 'PRIMARY',
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      allowedActorTypes: [this.type],
      createdAt: new Date()
    };
  }

  private createDefaultSessionMetadata(): SessionMetadata {
    return {
      sessionId: `SESSION-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      ipAddress: 'unknown',
      userAgent: 'unknown'
    };
  }

  private async emitAuditEvent(auditEntry: AuditTrailEntry): Promise<void> {
    // Emit audit event to external systems (event bus, SIEM, etc.)
  }

  private generateActivitySummary(): ActivitySummary {
    const activities = this.auditTrail;
    return {
      totalActivities: activities.length,
      loginCount: activities.filter(a => a.activityType === 'ACTOR_LOGIN').length,
      permissionChanges: activities.filter(a => a.activityType.includes('PERMISSION')).length,
      contextSwitches: activities.filter(a => a.activityType.includes('CONTEXT')).length,
      impersonationCount: activities.filter(a => a.activityType.includes('IMPERSONATION')).length,
      lastActivity: activities.length > 0 ? activities[0].timestamp : null
    };
  }

  private getSecurityEvents(): SecurityEvent[] {
    return this.auditTrail
      .filter(entry => this.isSecurityEvent(entry.activityType))
      .map(entry => ({
        id: entry.id,
        type: entry.activityType,
        timestamp: entry.timestamp,
        severity: this.getSecurityEventSeverity(entry.activityType),
        details: entry.details
      }));
  }

  private getImpersonationSummary(): ImpersonationSummary {
    const impersonationEvents = this.auditTrail.filter(a => 
      a.activityType === 'IMPERSONATION_STARTED' || a.activityType === 'IMPERSONATION_RECEIVED'
    );

    return {
      totalImpersonations: impersonationEvents.filter(a => a.activityType === 'IMPERSONATION_STARTED').length,
      totalImpersonatedBy: impersonationEvents.filter(a => a.activityType === 'IMPERSONATION_RECEIVED').length,
      recentImpersonations: impersonationEvents.slice(0, 10)
    };
  }

  private getDelegationSummary(): DelegationSummary {
    const delegationEvents = this.auditTrail.filter(a => 
      a.activityType === 'PERMISSION_DELEGATED' || a.activityType === 'PERMISSION_RECEIVED'
    );

    return {
      totalDelegatedOut: delegationEvents.filter(a => a.activityType === 'PERMISSION_DELEGATED').length,
      totalDelegatedIn: delegationEvents.filter(a => a.activityType === 'PERMISSION_RECEIVED').length,
      activeDelegations: this.delegatedActors.length
    };
  }

  private async detectComplianceViolations(): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check for excessive privilege escalations
    const escalationCount = this.auditTrail.filter(a => 
      a.activityType === 'PERMISSION_RECEIVED'
    ).length;

    if (escalationCount > 10) {
      violations.push({
        type: 'EXCESSIVE_PRIVILEGE_ESCALATION',
        severity: 'HIGH',
        description: `Actor has received ${escalationCount} privilege delegations`,
        detectedAt: new Date()
      });
    }

    // Check for unusual access patterns
    const contextSwitchCount = this.auditTrail.filter(a => 
      a.activityType === 'CONTEXT_SWITCHED'
    ).length;

    if (contextSwitchCount > 50) {
      violations.push({
        type: 'UNUSUAL_ACCESS_PATTERN',
        severity: 'MEDIUM',
        description: `Actor has switched contexts ${contextSwitchCount} times`,
        detectedAt: new Date()
      });
    }

    return violations;
  }

  private generateSecurityRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const recentActivities = this.auditTrail.filter(a => 
      Date.now() - a.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // 7 days
    );

    if (recentActivities.length === 0) {
      recommendations.push('REVIEW_INACTIVE_ACCOUNT');
    }

    if (this.delegatedActors.length > 5) {
      recommendations.push('REVIEW_EXCESSIVE_DELEGATIONS');
    }

    return recommendations;
  }

  private isSecurityEvent(activityType: string): boolean {
    return ['IMPERSONATION_STARTED', 'PERMISSION_DELEGATED', 'CONTEXT_SWITCHED', 
            'ACCESS_DENIED', 'SECURITY_VIOLATION'].includes(activityType);
  }

  private getSecurityEventSeverity(activityType: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (activityType) {
      case 'IMPERSONATION_STARTED':
        return 'HIGH';
      case 'PERMISSION_DELEGATED':
        return 'MEDIUM';
      case 'CONTEXT_SWITCHED':
        return 'LOW';
      case 'ACCESS_DENIED':
        return 'MEDIUM';
      case 'SECURITY_VIOLATION':
        return 'CRITICAL';
      default:
        return 'LOW';
    }
  }
}
```

```typescript
// concrete-actors.ts
import { BaseEnterpriseActor } from './actor-hierarchy';
import { 
  SystemAdministrator, 
  TenantAdministrator, 
  OrganizationManager, 
  RegularUser,
  ServiceAccount 
} from './types'; // From your app

/**
 * System Administrator Actor - Highest privilege level
 */
export class SystemAdministratorActor extends BaseEnterpriseActor {
  constructor(
    id: string,
    tenantId: string,
    options: {
      sessionMetadata?: SessionMetadata;
      initialContext?: ActorContext;
    } = {}
  ) {
    super(id, 'SYSTEM_ADMIN', tenantId, [
      {
        name: 'SYSTEM_ADMINISTRATOR',
        level: 100,
        permissions: [
          { name: 'SYSTEM_MANAGE', resources: ['*'], delegatable: false },
          { name: 'TENANT_MANAGE', resources: ['*'], delegatable: true },
          { name: 'USER_MANAGE', resources: ['*'], delegatable: true },
          { name: 'SECURITY_MANAGE', resources: ['*'], delegatable: false },
          { name: 'AUDIT_VIEW', resources: ['*'], delegatable: false }
        ],
        capabilities: ['IMPERSONATE', 'DELEGATE', 'CREATE_ACTORS', 'MODIFY_ROLES', 'VIEW_AUDIT_LOGS'],
        maxDelegationDepth: 3,
        maxImpersonationDuration: 7200000 // 2 hours
      }
    ], options);
  }

  /**
   * Create new tenant with full setup
   */
  async createTenant(tenantData: TenantCreationData): Promise<string> {
    if (!this.hasPermission('TENANT_MANAGE', 'CREATE')) {
      throw new ActorError(
        'Insufficient permissions to create tenant',
        'PERMISSION_DENIED',
        { actorId: this.id, requiredPermission: 'TENANT_MANAGE:CREATE' }
      );
    }

    const tenantId = `TENANT-${Date.now()}`;

    await this.recordActivity({
      type: 'TENANT_CREATED',
      timestamp: new Date(),
      details: {
        tenantId,
        tenantName: tenantData.name,
        createdBy: this.id
      }
    });

    return tenantId;
  }

  /**
   * Emergency access override for critical situations
   */
  async emergencyAccessOverride(
    targetResource: string, 
    reason: string, 
    duration: number
  ): Promise<EmergencyAccessToken> {
    const token: EmergencyAccessToken = {
      id: `EMERGENCY-${Date.now()}-${this.id}`,
      actorId: this.id,
      resource: targetResource,
      reason,
      grantedAt: new Date(),
      expiresAt: new Date(Date.now() + duration),
      usageCount: 0,
      maxUsage: 1
    };

    await this.recordActivity({
      type: 'EMERGENCY_ACCESS_GRANTED',
      timestamp: new Date(),
      details: {
        tokenId: token.id,
        resource: targetResource,
        reason,
        duration
      }
    });

    return token;
  }
}

/**
 * Tenant Administrator Actor - Manages single tenant
 */
export class TenantAdministratorActor extends BaseEnterpriseActor {
  constructor(
    id: string,
    tenantId: string,
    organizationId?: string,
    options: {
      sessionMetadata?: SessionMetadata;
      initialContext?: ActorContext;
    } = {}
  ) {
    super(id, 'TENANT_ADMIN', tenantId, [
      {
        name: 'TENANT_ADMINISTRATOR',
        level: 80,
        permissions: [
          { name: 'ORGANIZATION_MANAGE', resources: [tenantId], delegatable: true },
          { name: 'USER_MANAGE', resources: [tenantId], delegatable: true },
          { name: 'ROLE_MANAGE', resources: [tenantId], delegatable: true },
          { name: 'BILLING_MANAGE', resources: [tenantId], delegatable: false },
          { name: 'AUDIT_VIEW', resources: [tenantId], delegatable: false }
        ],
        capabilities: ['IMPERSONATE', 'DELEGATE', 'CREATE_ACTORS', 'MODIFY_ROLES', 'VIEW_AUDIT_LOGS'],
        maxDelegationDepth: 2,
        maxImpersonationDuration: 3600000 // 1 hour
      }
    ], { ...options, organizationId });
  }

  /**
   * Manage organization within tenant
   */
  async createOrganization(orgData: OrganizationCreationData): Promise<string> {
    if (!this.hasPermission('ORGANIZATION_MANAGE', this.tenantId)) {
      throw new ActorError(
        'Insufficient permissions to create organization',
        'PERMISSION_DENIED',
        { actorId: this.id, tenantId: this.tenantId }
      );
    }

    const orgId = `ORG-${Date.now()}-${this.tenantId}`;

    await this.recordActivity({
      type: 'ORGANIZATION_CREATED',
      timestamp: new Date(),
      details: {
        organizationId: orgId,
        organizationName: orgData.name,
        tenantId: this.tenantId,
        createdBy: this.id
      }
    });

    return orgId;
  }

  /**
   * Bulk user management operations
   */
  async bulkUserOperation(
    operation: 'CREATE' | 'ACTIVATE' | 'DEACTIVATE' | 'DELETE',
    userIds: string[],
    reason?: string
  ): Promise<BulkOperationResult> {
    const results: BulkOperationResult = {
      successful: [],
      failed: [],
      totalProcessed: userIds.length
    };

    for (const userId of userIds) {
      try {
        await this.singleUserOperation(operation, userId, reason);
        results.successful.push(userId);
      } catch (error) {
        results.failed.push({ userId, error: error.message });
      }
    }

    await this.recordActivity({
      type: 'BULK_USER_OPERATION',
      timestamp: new Date(),
      details: {
        operation,
        totalUsers: userIds.length,
        successful: results.successful.length,
        failed: results.failed.length,
        reason
      }
    });

    return results;
  }

  private async singleUserOperation(
    operation: 'CREATE' | 'ACTIVATE' | 'DEACTIVATE' | 'DELETE',
    userId: string,
    reason?: string
  ): Promise<void> {
    // Implementation for individual user operations
    await this.recordActivity({
      type: `USER_${operation}`,
      timestamp: new Date(),
      details: { userId, reason }
    });
  }
}

/**
 * Service Account Actor - For automated processes
 */
export class ServiceAccountActor extends BaseEnterpriseActor {
  public readonly serviceName: string;
  public readonly serviceType: 'API' | 'BATCH' | 'INTEGRATION' | 'MONITORING';
  
  constructor(
    id: string,
    tenantId: string,
    serviceName: string,
    serviceType: 'API' | 'BATCH' | 'INTEGRATION' | 'MONITORING',
    permissions: Permission[],
    options: {
      organizationId?: string;
      sessionMetadata?: SessionMetadata;
    } = {}
  ) {
    super(id, 'SERVICE_ACCOUNT', tenantId, [
      {
        name: 'SERVICE_ACCOUNT',
        level: 10,
        permissions,
        capabilities: ['DELEGATE'], // Service accounts can delegate but not impersonate
        maxDelegationDepth: 1,
        maxImpersonationDuration: 0
      }
    ], options);

    this.serviceName = serviceName;
    this.serviceType = serviceType;
  }

  /**
   * Service accounts cannot impersonate (override)
   */
  async impersonate(targetActor: IEnterpriseActor, reason: string): Promise<IEnterpriseActor> {
    throw new ActorError(
      'Service accounts cannot impersonate other actors',
      'IMPERSONATION_NOT_ALLOWED',
      { actorId: this.id, actorType: this.type }
    );
  }

  /**
   * Execute automated process with tracking
   */
  async executeAutomatedProcess(
    processName: string,
    processData: any,
    requiredPermission: string
  ): Promise<AutomatedProcessResult> {
    if (!this.hasPermission(requiredPermission)) {
      throw new ActorError(
        `Service account lacks permission for process: ${processName}`,
        'INSUFFICIENT_PERMISSIONS',
        { actorId: this.id, processName, requiredPermission }
      );
    }

    const executionId = `PROC-${Date.now()}-${this.id}`;

    await this.recordActivity({
      type: 'AUTOMATED_PROCESS_STARTED',
      timestamp: new Date(),
      details: {
        processName,
        executionId,
        serviceName: this.serviceName,
        serviceType: this.serviceType
      }
    });

    try {
      // Execute the actual process (implementation specific)
      const result = await this.performProcessExecution(processName, processData);

      await this.recordActivity({
        type: 'AUTOMATED_PROCESS_COMPLETED',
        timestamp: new Date(),
        details: {
          processName,
          executionId,
          result: result.summary,
          duration: result.duration
        }
      });

      return result;

    } catch (error) {
      await this.recordActivity({
        type: 'AUTOMATED_PROCESS_FAILED',
        timestamp: new Date(),
        details: {
          processName,
          executionId,
          error: error.message
        }
      });
      throw error;
    }
  }

  private async performProcessExecution(processName: string, processData: any): Promise<AutomatedProcessResult> {
    // Implementation specific to the automated process
    return {
      executionId: `PROC-${Date.now()}-${this.id}`,
      success: true,
      summary: `Process ${processName} completed successfully`,
      duration: 1000,
      processedItems: 1,
      errors: []
    };
  }
}
```

```typescript
// actor-management-service.ts
import { 
  BaseEnterpriseActor,
  SystemAdministratorActor,
  TenantAdministratorActor,
  ServiceAccountActor
} from './concrete-actors';
import { IEnterpriseActor } from './actor-hierarchy';
import { ActorRepository, PermissionService, AuditService } from './types'; // From your app

/**
 * Centralized service for managing enterprise actors
 */
export class ActorManagementService {
  private actorRepository: ActorRepository;
  private permissionService: PermissionService;
  private auditService: AuditService;
  private activeActors: Map<string, IEnterpriseActor> = new Map();

  constructor(
    actorRepository: ActorRepository,
    permissionService: PermissionService,
    auditService: AuditService
  ) {
    this.actorRepository = actorRepository;
    this.permissionService = permissionService;
    this.auditService = auditService;
  }

  /**
   * Create new enterprise actor
   */
  async createActor(
    actorType: 'SYSTEM_ADMIN' | 'TENANT_ADMIN' | 'ORG_MANAGER' | 'REGULAR_USER' | 'SERVICE_ACCOUNT',
    tenantId: string,
    actorData: ActorCreationData,
    createdBy: IEnterpriseActor
  ): Promise<IEnterpriseActor> {
    // Verify creator has permission to create actors
    if (!createdBy.capabilities.canCreateActors) {
      throw new ActorError(
        `Actor ${createdBy.id} does not have permission to create actors`,
        'INSUFFICIENT_CAPABILITIES',
        { actorId: createdBy.id, requiredCapability: 'canCreateActors' }
      );
    }

    const actorId = `${actorType}-${Date.now()}-${tenantId}`;
    let newActor: IEnterpriseActor;

    switch (actorType) {
      case 'SYSTEM_ADMIN':
        newActor = new SystemAdministratorActor(actorId, tenantId, {
          sessionMetadata: actorData.sessionMetadata
        });
        break;

      case 'TENANT_ADMIN':
        newActor = new TenantAdministratorActor(actorId, tenantId, actorData.organizationId, {
          sessionMetadata: actorData.sessionMetadata
        });
        break;

      case 'SERVICE_ACCOUNT':
        if (!actorData.serviceName || !actorData.serviceType) {
          throw new ActorError(
            'Service name and type required for service account creation',
            'MISSING_SERVICE_DATA',
            { actorType }
          );
        }
        
        newActor = new ServiceAccountActor(
          actorId,
          tenantId,
          actorData.serviceName,
          actorData.serviceType,
          actorData.permissions || [],
          {
            organizationId: actorData.organizationId,
            sessionMetadata: actorData.sessionMetadata
          }
        );
        break;

      default:
        throw new ActorError(
          `Unsupported actor type: ${actorType}`,
          'UNSUPPORTED_ACTOR_TYPE',
          { actorType }
        );
    }

    // Store in repository
    await this.actorRepository.save(newActor);
    
    // Add to active actors
    this.activeActors.set(actorId, newActor);

    // Record creation in creator's audit trail
    await createdBy.recordActivity({
      type: 'ACTOR_CREATED',
      timestamp: new Date(),
      details: {
        createdActorId: actorId,
        createdActorType: actorType,
        tenantId
      }
    });

    return newActor;
  }

  /**
   * Get actor by ID with context loading
   */
  async getActor(actorId: string, loadFullContext: boolean = true): Promise<IEnterpriseActor | null> {
    // Check active actors first
    if (this.activeActors.has(actorId)) {
      return this.activeActors.get(actorId)!;
    }

    // Load from repository
    const actor = await this.actorRepository.findById(actorId);
    
    if (actor && loadFullContext) {
      // Load additional context data
      await this.loadActorContext(actor);
      this.activeActors.set(actorId, actor);
    }

    return actor;
  }

  /**
   * Establish delegation between actors
   */
  async establishDelegation(
    sourceActorId: string,
    targetActorId: string,
    permissions: string[],
    duration?: number,
    establishedBy?: IEnterpriseActor
  ): Promise<DelegationResult> {
    const sourceActor = await this.getActor(sourceActorId);
    const targetActor = await this.getActor(targetActorId);

    if (!sourceActor || !targetActor) {
      throw new ActorError(
        'Source or target actor not found',
        'ACTOR_NOT_FOUND',
        { sourceActorId, targetActorId }
      );
    }

    const delegationResults: DelegationResult = {
      successful: [],
      failed: [],
      delegationId: `DEL-${Date.now()}-${sourceActorId}-${targetActorId}`
    };

    for (const permission of permissions) {
      try {
        await sourceActor.delegatePermission(targetActor, permission, duration);
        delegationResults.successful.push(permission);
      } catch (error) {
        delegationResults.failed.push({
          permission,
          error: error.message
        });
      }
    }

    // Record delegation establishment
    if (establishedBy) {
      await establishedBy.recordActivity({
        type: 'DELEGATION_ESTABLISHED',
        timestamp: new Date(),
        details: {
          delegationId: delegationResults.delegationId,
          sourceActor: sourceActorId,
          targetActor: targetActorId,
          permissions,
          successful: delegationResults.successful,
          failed: delegationResults.failed
        }
      });
    }

    return delegationResults;
  }

  /**
   * Get comprehensive actor analytics
   */
  async getActorAnalytics(
    tenantId: string,
    timeframe: { start: Date; end: Date }
  ): Promise<ActorAnalytics> {
    const actors = await this.actorRepository.findByTenant(tenantId);
    
    const analytics: ActorAnalytics = {
      tenantId,
      timeframe,
      totalActors: actors.length,
      actorTypeBreakdown: this.calculateActorTypeBreakdown(actors),
      activitySummary: await this.calculateActivitySummary(actors, timeframe),
      securityMetrics: await this.calculateSecurityMetrics(actors, timeframe),
      delegationMetrics: await this.calculateDelegationMetrics(actors, timeframe),
      impersonationMetrics: await this.calculateImpersonationMetrics(actors, timeframe),
      complianceStatus: await this.assessComplianceStatus(actors),
      recommendations: this.generateActorRecommendations(actors)
    };

    return analytics;
  }

  /**
   * Perform security audit across all actors
   */
  async performSecurityAudit(
    tenantId: string,
    auditScope: 'FULL' | 'PERMISSIONS' | 'DELEGATIONS' | 'IMPERSONATIONS' = 'FULL'
  ): Promise<SecurityAuditReport> {
    const actors = await this.actorRepository.findByTenant(tenantId);
    
    const auditReport: SecurityAuditReport = {
      auditId: `AUDIT-${Date.now()}-${tenantId}`,
      tenantId,
      auditScope,
      auditedAt: new Date(),
      totalActorsAudited: actors.length,
      securityFindings: [],
      complianceViolations: [],
      recommendations: [],
      riskScore: 0
    };

    for (const actor of actors) {
      const actorFindings = await this.auditActor(actor, auditScope);
      auditReport.securityFindings.push(...actorFindings.securityFindings);
      auditReport.complianceViolations.push(...actorFindings.complianceViolations);
    }

    auditReport.riskScore = this.calculateRiskScore(auditReport.securityFindings);
    auditReport.recommendations = this.generateSecurityRecommendations(auditReport);

    return auditReport;
  }

  private async loadActorContext(actor: IEnterpriseActor): Promise<void> {
    // Load additional context data like recent activities, delegations, etc.
    // Implementation specific
  }

  private calculateActorTypeBreakdown(actors: IEnterpriseActor[]): Record<string, number> {
    return actors.reduce((acc, actor) => {
      acc[actor.type] = (acc[actor.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private async calculateActivitySummary(
    actors: IEnterpriseActor[], 
    timeframe: { start: Date; end: Date }
  ): Promise<ActivitySummary> {
    let totalActivities = 0;
    let activeActorsCount = 0;

    for (const actor of actors) {
      const actorActivities = actor.getAuditTrail().filter(entry =>
        entry.timestamp >= timeframe.start && entry.timestamp <= timeframe.end
      );
      
      totalActivities += actorActivities.length;
      if (actorActivities.length > 0) {
        activeActorsCount++;
      }
    }

    return {
      totalActivities,
      activeActorsCount,
      averageActivitiesPerActor: totalActivities / actors.length,
      lastActivity: new Date() // Implementation specific
    };
  }

  private async calculateSecurityMetrics(
    actors: IEnterpriseActor[], 
    timeframe: { start: Date; end: Date }
  ): Promise<SecurityMetrics> {
    // Implementation for security metrics calculation
    return {
      totalSecurityEvents: 0,
      highRiskEvents: 0,
      failedAccessAttempts: 0,
      suspiciousActivity: 0
    };
  }

  private async calculateDelegationMetrics(
    actors: IEnterpriseActor[], 
    timeframe: { start: Date; end: Date }
  ): Promise<DelegationMetrics> {
    // Implementation for delegation metrics calculation
    return {
      totalDelegations: 0,
      activeDelegations: 0,
      averageDelegationDuration: 0,
      mostDelegatedPermissions: []
    };
  }

  private async calculateImpersonationMetrics(
    actors: IEnterpriseActor[], 
    timeframe: { start: Date; end: Date }
  ): Promise<ImpersonationMetrics> {
    // Implementation for impersonation metrics calculation
    return {
      totalImpersonations: 0,
      activeImpersonations: 0,
      averageImpersonationDuration: 0,
      mostImpersonatedActors: []
    };
  }

  private async assessComplianceStatus(actors: IEnterpriseActor[]): Promise<ComplianceStatus> {
    // Implementation for compliance assessment
    return {
      overallScore: 85,
      violations: [],
      recommendations: []
    };
  }

  private generateActorRecommendations(actors: IEnterpriseActor[]): string[] {
    const recommendations: string[] = [];

    // Analyze actor patterns and generate recommendations
    const inactiveActors = actors.filter(actor => 
      actor.getAuditTrail().length === 0 || 
      actor.getAuditTrail()[0].timestamp < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    );

    if (inactiveActors.length > actors.length * 0.2) {
      recommendations.push('REVIEW_INACTIVE_ACTORS');
    }

    return recommendations;
  }

  private async auditActor(
    actor: IEnterpriseActor, 
    auditScope: 'FULL' | 'PERMISSIONS' | 'DELEGATIONS' | 'IMPERSONATIONS'
  ): Promise<ActorAuditResult> {
    return {
      actorId: actor.id,
      securityFindings: [],
      complianceViolations: []
    };
  }

  private calculateRiskScore(findings: SecurityFinding[]): number {
    return findings.reduce((score, finding) => {
      switch (finding.severity) {
        case 'CRITICAL': return score + 10;
        case 'HIGH': return score + 5;
        case 'MEDIUM': return score + 2;
        case 'LOW': return score + 1;
        default: return score;
      }
    }, 0);
  }

  private generateSecurityRecommendations(auditReport: SecurityAuditReport): string[] {
    const recommendations: string[] = [];

    if (auditReport.riskScore > 50) {
      recommendations.push('IMMEDIATE_SECURITY_REVIEW_REQUIRED');
    }

    return recommendations;
  }
}
```

## Usage Example

```typescript
// actor-pattern-demo.ts
import { 
  SystemAdministratorActor,
  TenantAdministratorActor,
  ServiceAccountActor,
  ActorManagementService
} from './actor-implementation';
import { ActorError } from '@vytches-ddd/domain-primitives';

export class ActorPatternDemo {
  private actorManagementService: ActorManagementService;

  constructor(actorManagementService: ActorManagementService) {
    this.actorManagementService = actorManagementService;
  }

  async demonstrateActorHierarchy(): Promise<void> {
    try {
      // Create system administrator
      const sysAdmin = new SystemAdministratorActor('SYSADMIN-001', 'SYSTEM', {
        sessionMetadata: {
          sessionId: 'SESSION-DEMO-001',
          createdAt: new Date(),
          ipAddress: '10.0.0.1',
          userAgent: 'Demo/1.0'
        }
      });

      console.log('System Admin created:', sysAdmin.id);
      console.log('System Admin permissions:', sysAdmin.permissions.map(p => p.name));

      // Create tenant using system admin
      const tenantId = await sysAdmin.createTenant({
        name: 'Acme Corporation',
        plan: 'enterprise'
      });

      console.log('Tenant created:', tenantId);

      // Create tenant administrator
      const tenantAdmin = await this.actorManagementService.createActor(
        'TENANT_ADMIN',
        tenantId,
        {
          name: 'John Doe',
          email: 'john.doe@acme.com',
          sessionMetadata: {
            sessionId: 'SESSION-DEMO-002',
            createdAt: new Date(),
            ipAddress: '10.0.0.2',
            userAgent: 'WebApp/2.0'
          }
        },
        sysAdmin
      );

      console.log('Tenant Admin created:', tenantAdmin.id);

      // Demonstrate context switching
      const newContext = {
        name: 'BILLING_CONTEXT',
        type: 'FUNCTIONAL' as const,
        tenantId: tenantId,
        allowedActorTypes: ['TENANT_ADMIN'],
        createdAt: new Date(),
        additionalPermissions: [
          { name: 'BILLING_VIEW', resources: ['*'], delegatable: false }
        ]
      };

      const contextualizedAdmin = await tenantAdmin.switchContext(newContext);
      console.log('Context switched to:', contextualizedAdmin.getCurrentContext().name);

      // Demonstrate permission delegation
      const serviceAccount = await this.actorManagementService.createActor(
        'SERVICE_ACCOUNT',
        tenantId,
        {
          serviceName: 'Billing Processor',
          serviceType: 'BATCH',
          permissions: []
        },
        tenantAdmin
      );

      await tenantAdmin.delegatePermission(serviceAccount, 'BILLING_VIEW', 3600000); // 1 hour
      console.log('Permission delegated to service account');

      // Demonstrate impersonation
      if (tenantAdmin.canImpersonate(serviceAccount)) {
        const impersonatedActor = await tenantAdmin.impersonate(
          serviceAccount, 
          'Debugging billing issue #12345'
        );
        console.log('Impersonation started');

        // Stop impersonation after some operations
        await tenantAdmin.stopImpersonation();
        console.log('Impersonation stopped');
      }

      // Generate audit trails
      console.log('\n=== System Admin Audit Trail ===');
      sysAdmin.getAuditTrail().slice(0, 5).forEach(entry => {
        console.log(`${entry.timestamp.toISOString()}: ${entry.activityType}`);
      });

      console.log('\n=== Tenant Admin Audit Trail ===');
      tenantAdmin.getAuditTrail().slice(0, 5).forEach(entry => {
        console.log(`${entry.timestamp.toISOString()}: ${entry.activityType}`);
      });

    } catch (error) {
      if (error instanceof ActorError) {
        console.error('Actor Error:', error.message);
        console.error('Error Code:', error.code);
        console.error('Context:', error.context);
      } else {
        console.error('Unexpected error:', error);
      }
    }
  }

  async demonstrateServiceAccountAutomation(): Promise<void> {
    try {
      // Create service account for automated processes
      const serviceAccount = new ServiceAccountActor(
        'SVC-BILLING-001',
        'TENANT-ACME',
        'Billing Automation Service',
        'BATCH',
        [
          { name: 'BILLING_PROCESS', resources: ['invoices', 'payments'], delegatable: false },
          { name: 'NOTIFICATION_SEND', resources: ['email', 'sms'], delegatable: false }
        ],
        {
          sessionMetadata: {
            sessionId: 'SESSION-SVC-001',
            createdAt: new Date(),
            ipAddress: '10.0.1.100',
            userAgent: 'ServiceAccount/1.0'
          }
        }
      );

      console.log('Service Account created:', serviceAccount.id);

      // Execute automated billing process
      const processResult = await serviceAccount.executeAutomatedProcess(
        'Monthly Invoice Generation',
        {
          billingPeriod: '2024-01',
          customerCount: 150
        },
        'BILLING_PROCESS'
      );

      console.log('Automated process completed:', processResult.summary);
      console.log('Processing duration:', processResult.duration, 'ms');

      // Generate compliance report
      const complianceReport = await serviceAccount.generateComplianceReport();
      console.log('\n=== Service Account Compliance Report ===');
      console.log('Activity Summary:', complianceReport.activitySummary);
      console.log('Security Events:', complianceReport.securityEvents.length);

    } catch (error) {
      if (error instanceof ActorError) {
        console.error('Service Account Error:', error.message);
      } else {
        console.error('Unexpected error:', error);
      }
    }
  }

  async demonstrateActorAnalytics(): Promise<void> {
    try {
      // Get comprehensive actor analytics
      const analytics = await this.actorManagementService.getActorAnalytics(
        'TENANT-ACME',
        {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date()
        }
      );

      console.log('\n=== Actor Analytics Report ===');
      console.log('Total Actors:', analytics.totalActors);
      console.log('Actor Type Breakdown:', analytics.actorTypeBreakdown);
      console.log('Activity Summary:', analytics.activitySummary);
      console.log('Security Metrics:', analytics.securityMetrics);
      console.log('Recommendations:', analytics.recommendations);

      // Perform security audit
      const securityAudit = await this.actorManagementService.performSecurityAudit(
        'TENANT-ACME',
        'FULL'
      );

      console.log('\n=== Security Audit Report ===');
      console.log('Audit ID:', securityAudit.auditId);
      console.log('Risk Score:', securityAudit.riskScore);
      console.log('Security Findings:', securityAudit.securityFindings.length);
      console.log('Compliance Violations:', securityAudit.complianceViolations.length);
      console.log('Recommendations:', securityAudit.recommendations);

    } catch (error) {
      console.error('Analytics error:', error);
    }
  }
}
```

## Key Features

- **Actor Hierarchies**: Sophisticated actor types with inheritance and role-based capabilities
- **Context Management**: Dynamic context switching with stack-based context management
- **Permission System**: Granular permissions with resource-based access control and delegation
- **Impersonation**: Secure impersonation with audit trails and time limits
- **Delegation**: Permission delegation with configurable duration and revocation
- **Audit Trails**: Comprehensive activity tracking with compliance reporting
- **Service Accounts**: Specialized actors for automated processes with restricted capabilities
- **Analytics**: Actor behavior analysis and security metrics
- **Compliance**: Built-in compliance reporting and violation detection

## Common Pitfalls

- **Context Stack Management**: Ensure proper context stack cleanup to prevent memory leaks
- **Permission Explosion**: Avoid creating too many granular permissions; group logically
- **Impersonation Security**: Implement proper checks and time limits for impersonation
- **Audit Volume**: Monitor audit trail growth and implement retention policies
- **Delegation Chains**: Prevent excessive delegation chains that could create security risks

## Related Examples

- [Basic Actor Implementation](../basic/example-2.md) - Foundation actor concepts and simple patterns  
- [Advanced Actor Orchestration](../advanced/example-1.md) - Complex actor workflows and enterprise patterns
- [Domain Error Management](../intermediate/example-2.md) - Error handling in actor contexts
- [NestJS Actor Integration](../frameworks/nestjs/intermediate/example-1.md) - Framework-specific actor patterns