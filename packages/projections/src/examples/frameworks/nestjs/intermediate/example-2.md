# Multi-Tenant Projection System - NestJS DI Integration

**Version**: 1.0.0 **Package**: @vytches/ddd-projections + @vytches/ddd-di +
NestJS **Complexity**: intermediate **Framework**: NestJS **Integration**:
VytchesDDD DI integration with multi-tenancy **Dependencies**: @nestjs/common,
@vytches/ddd-projections, @vytches/ddd-di, @vytches/ddd-events, @vytches/ddd-acl

## Description

Advanced NestJS service implementing multi-tenant projections with
@vytches/ddd-di integration, tenant isolation, configuration-driven behavior,
and compliance support. This example demonstrates enterprise-grade multi-tenant
architecture with seamless NestJS integration.

## Business Context

SaaS platforms need sophisticated multi-tenant projection systems that provide
complete data isolation, tenant-specific business rules, compliance with data
sovereignty requirements, and scalable resource allocation while maintaining
high performance.

## Domain Service with Multi-Tenancy

```typescript
// multi-tenant-user-projection.domain-service.ts
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';
import {
  ProjectionBase,
  TenantIsolationCapability,
  TenantConfigurationCapability,
  CheckpointCapability,
  CircuitBreakerCapability,
} from '@vytches/ddd-projections';
import { TenantContextACL } from '@vytches/ddd-acl';
import { IDomainEvent } from '@vytches/ddd-events';
import {
  TenantContext,
  TenantConfiguration,
  TenantMetrics,
  UserData,
  TenantId,
  TenantIsolatedState,
  CrossTenantAnalytics,
  ServiceResponse,
} from '../types'; // From your application

// ⭐ FOCUS: Multi-Tenant Domain Service with VytchesDDD DI
@DomainService({
  serviceId: 'multiTenantUserProjection',
  lifetime: ServiceLifetime.Singleton,
  context: 'MultiTenantProjections',
  dependencies: ['tenantConfigService', 'eventBus'],
  autoRegister: true,
})
export class MultiTenantUserProjectionDomainService extends ProjectionBase<any> {
  private tenantIsolationCapability: TenantIsolationCapability;
  private tenantConfigCapability: TenantConfigurationCapability;
  private tenantContextACL: TenantContextACL;
  private tenantConfigurations: Map<TenantId, TenantConfiguration> = new Map();

  constructor() {
    super('MultiTenantUserProjection', 'v2.0');
    this.setupTenantCapabilities();
    this.initializeTenantState();
  }

  private setupTenantCapabilities(): void {
    // Tenant isolation capability
    this.tenantIsolationCapability = new TenantIsolationCapability({
      projectionName: this.projectionName,
      isolationStrategy: 'namespace',
      enableCrossTenantAnalytics: false,
      auditTenantAccess: true,
      enableDataEncryption: true,
      complianceMode: 'strict',
    });

    // Tenant configuration capability
    this.tenantConfigCapability = new TenantConfigurationCapability({
      projectionName: this.projectionName,
      configurationStorage: 'memory',
      enableHotReload: true,
      validateConfigurations: true,
      enableVersioning: true,
    });

    // Anti-corruption layer for tenant context
    this.tenantContextACL = new TenantContextACL({
      enableTenantValidation: true,
      enableContextEnrichment: true,
      enableAccessLogging: true,
      strictModeEnabled: true,
    });

    // Add production-ready capabilities
    this.addCapability(
      new CheckpointCapability({
        projectionName: this.projectionName + '-checkpoints',
        interval: 60000,
        storage: 'memory',
        tenantAware: true,
      })
    );

    this.addCapability(
      new CircuitBreakerCapability({
        projectionName: this.projectionName + '-circuit-breaker',
        failureThreshold: 10,
        resetTimeout: 300000, // 5 minutes
        tenantAware: true,
      })
    );

    this.setupTenantEventHandlers();
  }

  private setupTenantEventHandlers(): void {
    this.tenantConfigCapability.on(
      'configurationUpdated',
      (tenantId: TenantId, config: TenantConfiguration) => {
        this.handleTenantConfigurationUpdate(tenantId, config);
      }
    );

    this.tenantIsolationCapability.on(
      'tenantAccessViolation',
      (violation: any) => {
        this.handleTenantAccessViolation(violation);
      }
    );

    this.tenantConfigCapability.on('tenantAdded', (tenantId: TenantId) => {
      console.log(`Tenant auto-discovered: ${tenantId}`);
    });
  }

  private initializeTenantState(): void {
    this.setState({
      tenants: new Map<TenantId, TenantIsolatedState<any>>(),
      crossTenantMetrics: {
        totalTenants: 0,
        activeTenants: 0,
        processingMetrics: new Map<TenantId, any>(),
        complianceStatus: new Map<TenantId, any>(),
        lastUpdated: new Date(),
      },
      globalConfiguration: {
        enableCrossTenantAnalytics: false,
        maxTenantsPerNode: 1000,
        defaultRetentionDays: 365,
      },
    });
  }

  // ✅ FOCUS: Enhanced event handling with tenant isolation
  async handle(event: IDomainEvent): Promise<void> {
    try {
      // Extract and validate tenant context using ACL
      const tenantContext =
        await this.tenantContextACL.extractTenantContext(event);

      if (!tenantContext.isValid) {
        console.warn(
          `Invalid tenant context for event ${event.eventId}: ${tenantContext.error}`
        );
        await this.handleInvalidTenantContext(event, tenantContext);
        return;
      }

      // Validate tenant access permissions
      const hasAccess = await this.tenantIsolationCapability.checkTenantAccess(
        tenantContext.tenantId,
        event.eventType,
        {
          userId: tenantContext.userId,
          permissions: tenantContext.permissions,
          complianceRequirements: tenantContext.complianceRequirements,
        }
      );

      if (!hasAccess) {
        await this.handleTenantAccessViolation({
          tenantId: tenantContext.tenantId,
          eventId: event.eventId,
          eventType: event.eventType,
          reason: 'Access denied - insufficient permissions',
          userId: tenantContext.userId,
        });
        return;
      }

      // Process event with full tenant isolation
      await this.processTenantEvent(event, tenantContext);
    } catch (error) {
      console.error(`Error processing tenant event ${event.eventId}:`, error);
      await this.handleEventProcessingError(event, error);
      throw error;
    }
  }

  private async processTenantEvent(
    event: IDomainEvent,
    tenantContext: TenantContext
  ): Promise<void> {
    const tenantId = tenantContext.tenantId;

    // Ensure tenant state exists with isolation
    await this.ensureTenantState(tenantId, tenantContext);

    // Get tenant-specific configuration
    const tenantConfig = await this.getTenantConfiguration(tenantId);

    // Execute within tenant isolation context
    await this.tenantIsolationCapability.executeInTenantContext(
      tenantId,
      async () => {
        await this.handleTenantSpecificEvent(
          event,
          tenantContext,
          tenantConfig
        );
      }
    );

    // Update tenant metrics and compliance status
    await this.updateTenantMetrics(tenantId, event, tenantContext);
    await this.updateComplianceStatus(tenantId, tenantConfig);
  }

  private async handleTenantSpecificEvent(
    event: IDomainEvent,
    tenantContext: TenantContext,
    tenantConfig: TenantConfiguration
  ): Promise<void> {
    const tenantId = tenantContext.tenantId;

    switch (event.eventType) {
      case 'UserRegistered':
        await this.handleTenantUserRegistered(
          event,
          tenantId,
          tenantConfig,
          tenantContext
        );
        break;
      case 'UserProfileUpdated':
        await this.handleTenantUserProfileUpdated(
          event,
          tenantId,
          tenantConfig
        );
        break;
      case 'UserRoleChanged':
        await this.handleTenantUserRoleChanged(event, tenantId, tenantConfig);
        break;
      case 'UserDeactivated':
        await this.handleTenantUserDeactivated(event, tenantId, tenantConfig);
        break;
      default:
        console.log(
          `Unhandled tenant event: ${event.eventType} for tenant ${tenantId}`
        );
    }
  }

  private async handleTenantUserRegistered(
    event: IDomainEvent,
    tenantId: TenantId,
    tenantConfig: TenantConfiguration,
    tenantContext: TenantContext
  ): Promise<void> {
    const userData = event.payload;
    const tenantState = this.getTenantData(tenantId)!;

    // Apply tenant-specific business rules and compliance requirements
    const processedUserData = await this.applyTenantBusinessRules(
      userData,
      tenantConfig,
      tenantContext
    );

    // Create user with tenant-specific preferences
    const user: UserData = {
      id: processedUserData.userId,
      email: processedUserData.email,
      name: processedUserData.name,
      role:
        processedUserData.role ||
        tenantConfig.businessRules.defaultUserRole ||
        'user',
      createdAt: new Date(event.timestamp),
      tenantId: tenantId,
      preferences: {
        ...processedUserData.preferences,
        timezone: tenantConfig.businessRules.timezone,
        locale: tenantConfig.businessRules.locale,
        currency: tenantConfig.businessRules.currency,
      },
      complianceData: {
        dataResidency: tenantConfig.compliance.dataResidency,
        consentGiven: processedUserData.consentGiven || false,
        consentTimestamp: new Date(),
        privacyLevel: tenantConfig.compliance.defaultPrivacyLevel || 'standard',
      },
    };

    // Validate compliance requirements
    if (!this.validateUserCompliance(user, tenantConfig)) {
      throw new Error(
        `User registration failed compliance validation for tenant ${tenantId}`
      );
    }

    // Store user in tenant-isolated data with encryption if required
    if (tenantConfig.compliance.encryptionRequired) {
      user.encryptedData = await this.encryptUserData(user, tenantConfig);
    }

    tenantState.data.users.set(user.id, user);

    // Update tenant-specific indexes
    this.updateTenantIndexes(tenantState, user);

    // Update tenant statistics with compliance tracking
    this.updateTenantStatistics(tenantState, 'user_registered');

    // Apply tenant-specific custom logic (webhooks, integrations, etc.)
    await this.applyTenantCustomLogic(user, tenantConfig, tenantContext);

    console.log(
      `User registered for tenant ${tenantId}: ${user.name} (${user.id}) - Compliance: ${user.complianceData?.dataResidency}`
    );
  }

  // ✅ FOCUS: Advanced tenant-aware query methods
  getTenantUsers(
    tenantId: TenantId,
    includeDeactivated: boolean = false
  ): UserData[] {
    const tenantState = this.getTenantData(tenantId);
    if (!tenantState) return [];

    const users = Array.from(tenantState.data.users.values());

    if (!includeDeactivated) {
      return users.filter(user => user.isActive !== false);
    }

    return users;
  }

  getTenantUsersByRole(tenantId: TenantId, role: string): UserData[] {
    const tenantState = this.getTenantData(tenantId);
    if (!tenantState) return [];

    const userIds = tenantState.data.usersByRole.get(role) || new Set<string>();
    return Array.from(userIds)
      .map(id => tenantState.data.users.get(id))
      .filter(Boolean) as UserData[];
  }

  getTenantUserStats(tenantId: TenantId): TenantMetrics | null {
    const tenantState = this.getTenantData(tenantId);
    if (!tenantState) return null;

    const config = this.tenantConfigurations.get(tenantId);
    const complianceStatus =
      this.getState().crossTenantMetrics.complianceStatus.get(tenantId);

    return {
      tenantId,
      totalUsers: tenantState.data.userStats.totalUsers,
      activeUsers: tenantState.data.userStats.activeUsers,
      userGrowth: this.calculateUserGrowth(tenantState),
      complianceStatus: {
        ...complianceStatus,
        withinUserLimit:
          tenantState.data.userStats.totalUsers <
          (config?.features?.maxUsers || 1000),
        dataResidencyCompliant: this.validateDataResidencyCompliance(tenantId),
        encryptionCompliant: this.validateEncryptionCompliance(
          tenantId,
          config
        ),
        retentionCompliant: this.validateRetentionCompliance(tenantId, config),
      },
      performance: {
        averageProcessingTime: tenantState.metadata.averageProcessingTime || 0,
        errorRate: tenantState.metadata.errorRate || 0,
        lastHealthCheck: tenantState.metadata.lastHealthCheck || new Date(),
      },
      lastUpdated: tenantState.metadata.lastUpdated,
    };
  }

  // ✅ FOCUS: Enterprise tenant management
  async addTenant(
    tenantId: TenantId,
    initialConfig: TenantConfiguration,
    adminContext: TenantContext
  ): Promise<ServiceResponse<void>> {
    try {
      // Validate tenant addition permissions
      if (!this.canAddTenant(adminContext)) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Insufficient permissions to add tenant',
            details: { tenantId, adminUserId: adminContext.userId },
          },
          metadata: {
            timestamp: new Date(),
            requestId: 'add-tenant-' + Date.now(),
            duration: 0,
          },
        };
      }

      // Validate tenant configuration
      const validationResult =
        await this.validateTenantConfiguration(initialConfig);
      if (!validationResult.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_CONFIGURATION',
            message: 'Invalid tenant configuration',
            details: { tenantId, validationErrors: validationResult.errors },
          },
          metadata: {
            timestamp: new Date(),
            requestId: 'add-tenant-' + Date.now(),
            duration: 0,
          },
        };
      }

      // Ensure tenant state with compliance setup
      await this.ensureTenantState(tenantId, adminContext);

      // Store tenant configuration with versioning
      await this.tenantConfigCapability.saveTenantConfiguration(
        tenantId,
        initialConfig
      );
      this.tenantConfigurations.set(tenantId, initialConfig);

      // Initialize compliance tracking
      await this.initializeTenantCompliance(tenantId, initialConfig);

      // Setup tenant-specific monitoring
      await this.setupTenantMonitoring(tenantId, initialConfig);

      console.log(`Tenant added with enterprise features: ${tenantId}`);

      return {
        success: true,
        metadata: {
          timestamp: new Date(),
          requestId: 'add-tenant-' + Date.now(),
          duration: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ADD_TENANT_FAILED',
          message: 'Failed to add tenant',
          details: { error: (error as Error).message, tenantId },
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'add-tenant-' + Date.now(),
          duration: 0,
        },
      };
    }
  }

  // ✅ FOCUS: Cross-tenant analytics (with privacy controls)
  getCrossTenantAnalytics(): CrossTenantAnalytics {
    const state = this.getState();
    const anonymizedMetrics: any[] = [];

    for (const [tenantId, tenantState] of state.tenants) {
      const config = this.tenantConfigurations.get(tenantId);

      // Only include metrics if tenant allows cross-tenant analytics
      if (
        config?.features?.advancedAnalytics &&
        config?.privacy?.allowAnonymizedAnalytics
      ) {
        const stats = this.getTenantUserStats(tenantId);

        anonymizedMetrics.push({
          // No tenant-identifying information
          userCount: stats?.totalUsers || 0,
          activeUserCount: stats?.activeUsers || 0,
          growthRate: stats?.userGrowth?.last30Days || 0,
          complianceScore: this.calculateComplianceScore(
            stats?.complianceStatus
          ),
          performanceScore: this.calculatePerformanceScore(stats?.performance),
          region: config.compliance.dataResidency, // Allowed for aggregation
          industry: config.businessRules.industry || 'unknown',
        });
      }
    }

    return {
      totalTenants: state.crossTenantMetrics.totalTenants,
      activeTenants: state.crossTenantMetrics.activeTenants,
      anonymizedMetrics,
      industryBreakdown: this.calculateIndustryBreakdown(anonymizedMetrics),
      regionalBreakdown: this.calculateRegionalBreakdown(anonymizedMetrics),
      averageMetrics: {
        averageUsersPerTenant:
          this.calculateAverageUsersPerTenant(anonymizedMetrics),
        averageGrowthRate: this.calculateAverageGrowthRate(anonymizedMetrics),
        averageComplianceScore:
          this.calculateAverageComplianceScore(anonymizedMetrics),
      },
      lastUpdated: state.crossTenantMetrics.lastUpdated,
    };
  }

  // Private helper methods
  private getTenantData(
    tenantId: TenantId
  ): TenantIsolatedState<any> | undefined {
    return this.getState().tenants.get(tenantId);
  }

  private async ensureTenantState(
    tenantId: TenantId,
    context: TenantContext
  ): Promise<void> {
    const currentState = this.getState();

    if (!currentState.tenants.has(tenantId)) {
      const tenantState: TenantIsolatedState<any> = {
        tenantId,
        data: this.createInitialTenantData(tenantId, context),
        metadata: {
          createdAt: new Date(),
          lastUpdated: new Date(),
          eventCount: 0,
          version: 1,
          averageProcessingTime: 0,
          errorRate: 0,
          lastHealthCheck: new Date(),
        },
        complianceData: {
          dataResidency: context.complianceRequirements?.dataResidency || 'US',
          encryptionEnabled:
            context.complianceRequirements?.encryptionRequired || false,
          auditTrailEnabled: true,
          lastComplianceCheck: new Date(),
        },
      };

      currentState.tenants.set(tenantId, tenantState);
      currentState.crossTenantMetrics.totalTenants = currentState.tenants.size;
      currentState.crossTenantMetrics.lastUpdated = new Date();

      this.setState(currentState);

      console.log(`Initialized isolated state for tenant: ${tenantId}`);
    }
  }

  private createInitialTenantData(
    tenantId: TenantId,
    context: TenantContext
  ): any {
    return {
      users: new Map<string, UserData>(),
      usersByRole: new Map<string, Set<string>>(),
      userStats: {
        totalUsers: 0,
        activeUsers: 0,
        userGrowth: {
          daily: new Map<string, number>(),
          monthly: new Map<string, number>(),
        },
        roleDistribution: new Map<string, number>(),
      },
      tenantSpecificData: {
        customFields: new Map<string, any>(),
        businessLogicResults: new Map<string, any>(),
        integrationData: new Map<string, any>(),
      },
      complianceTracking: {
        consentRecords: new Map<string, any>(),
        dataProcessingActivities: [],
        privacyRequests: [],
      },
    };
  }

  // Additional helper methods would be implemented here...
  // (Validation, encryption, compliance checking, etc.)

  private validateUserCompliance(
    user: UserData,
    config: TenantConfiguration
  ): boolean {
    // Implement compliance validation logic
    return true; // Simplified for example
  }

  private async encryptUserData(
    user: UserData,
    config: TenantConfiguration
  ): Promise<string> {
    // Implement encryption logic
    return 'encrypted-data'; // Simplified for example
  }

  private updateTenantIndexes(tenantState: any, user: UserData): void {
    // Update role-based indexes
    const roleUsers =
      tenantState.data.usersByRole.get(user.role) || new Set<string>();
    roleUsers.add(user.id);
    tenantState.data.usersByRole.set(user.role, roleUsers);
  }

  private updateTenantStatistics(tenantState: any, eventType: string): void {
    tenantState.data.userStats.totalUsers = tenantState.data.users.size;
    tenantState.data.userStats.activeUsers = Array.from(
      tenantState.data.users.values()
    ).filter((user: UserData) => user.isActive !== false).length;

    // Update role distribution
    const roleDistribution = new Map<string, number>();
    for (const [role, userIds] of tenantState.data.usersByRole) {
      roleDistribution.set(role, userIds.size);
    }
    tenantState.data.userStats.roleDistribution = roleDistribution;
  }

  private async applyTenantCustomLogic(
    user: UserData,
    tenantConfig: TenantConfiguration,
    tenantContext: TenantContext
  ): Promise<void> {
    // Apply tenant-specific custom logic
    if (tenantConfig.integrations.webhooks.length > 0) {
      console.log(
        `Triggering ${tenantConfig.integrations.webhooks.length} webhooks for tenant ${tenantConfig.tenantId}`
      );
      // Implement webhook triggers
    }

    if (tenantConfig.integrations.externalServices.length > 0) {
      console.log(
        `Updating ${tenantConfig.integrations.externalServices.length} external services for tenant ${tenantConfig.tenantId}`
      );
      // Implement external service updates
    }
  }

  // Placeholder implementations for additional methods
  private async getTenantConfiguration(
    tenantId: TenantId
  ): Promise<TenantConfiguration> {
    let config = this.tenantConfigurations.get(tenantId);
    if (!config) {
      config =
        await this.tenantConfigCapability.loadTenantConfiguration(tenantId);
      if (config) {
        this.tenantConfigurations.set(tenantId, config);
      } else {
        config = this.createDefaultTenantConfiguration(tenantId);
        this.tenantConfigurations.set(tenantId, config);
      }
    }
    return config;
  }

  private createDefaultTenantConfiguration(
    tenantId: TenantId
  ): TenantConfiguration {
    return {
      tenantId,
      features: {
        advancedAnalytics: false,
        realTimeNotifications: true,
        dataRetentionDays: 365,
        maxUsers: 1000,
      },
      businessRules: {
        currency: 'USD',
        timezone: 'UTC',
        locale: 'en-US',
        customValidations: [],
        defaultUserRole: 'user',
        allowedRoles: ['user', 'admin', 'manager'],
        industry: 'general',
      },
      integrations: {
        webhooks: [],
        externalServices: [],
      },
      compliance: {
        dataResidency: 'US',
        encryptionRequired: true,
        auditLogRetention: 2555, // 7 years
        defaultPrivacyLevel: 'standard',
      },
      privacy: {
        allowAnonymizedAnalytics: false,
        dataSharingEnabled: false,
      },
    };
  }

  // Placeholder implementations for metric calculations
  private calculateUserGrowth(tenantState: any): any {
    return {
      last7Days: 0,
      last30Days: 0,
      last90Days: 0,
    };
  }

  private validateDataResidencyCompliance(tenantId: TenantId): boolean {
    return true; // Implement actual compliance check
  }

  private validateEncryptionCompliance(
    tenantId: TenantId,
    config?: TenantConfiguration
  ): boolean {
    return true; // Implement actual compliance check
  }

  private validateRetentionCompliance(
    tenantId: TenantId,
    config?: TenantConfiguration
  ): boolean {
    return true; // Implement actual compliance check
  }

  // Additional placeholder methods for the remaining functionality...
}
```

## NestJS Bridge Service

```typescript
// multi-tenant-user-projection.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { MultiTenantUserProjectionDomainService } from './multi-tenant-user-projection.domain-service';
import { IDomainEvent } from '@vytches/ddd-events';
import {
  TenantId,
  TenantConfiguration,
  ServiceResponse,
  TenantContext,
} from '../types';

@Injectable()
export class MultiTenantUserProjectionService implements OnModuleInit {
  private readonly projection: MultiTenantUserProjectionDomainService;

  constructor() {
    // ⭐ FOCUS: Bridge Pattern - Get existing instance from VytchesDDD
    this.projection =
      VytchesDDD.resolve<MultiTenantUserProjectionDomainService>(
        'multiTenantUserProjection'
      );
  }

  async onModuleInit(): Promise<void> {
    console.log(
      'MultiTenantUserProjectionService: Initializing multi-tenant projection'
    );
  }

  // ✅ FOCUS: Delegate to VytchesDDD instance
  async processEvent(event: IDomainEvent): Promise<void> {
    return await this.projection.handle(event);
  }

  getTenantUsers(tenantId: TenantId, includeDeactivated?: boolean) {
    return this.projection.getTenantUsers(tenantId, includeDeactivated);
  }

  getTenantUsersByRole(tenantId: TenantId, role: string) {
    return this.projection.getTenantUsersByRole(tenantId, role);
  }

  getTenantUserStats(tenantId: TenantId) {
    return this.projection.getTenantUserStats(tenantId);
  }

  getCrossTenantAnalytics() {
    return this.projection.getCrossTenantAnalytics();
  }

  async addTenant(
    tenantId: TenantId,
    config: TenantConfiguration,
    adminContext: TenantContext
  ): Promise<ServiceResponse<void>> {
    return await this.projection.addTenant(tenantId, config, adminContext);
  }
}
```

## Module Configuration

```typescript
// multi-tenant-projection.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';
import { MultiTenantUserProjectionService } from './multi-tenant-user-projection.service';
import { MultiTenantProjectionController } from './multi-tenant-projection.controller';

@Module({
  providers: [MultiTenantUserProjectionService],
  controllers: [MultiTenantProjectionController],
  exports: [MultiTenantUserProjectionService],
})
export class MultiTenantProjectionModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD BEFORE framework DI
    const container = new SimpleContainer();

    // Register dependencies
    container.registerInstance('tenantConfigService', {
      loadConfiguration: async (tenantId: string) => ({ tenantId }),
    });

    // Configure VytchesDDD with auto-discovery
    await VytchesDDD.configure(container);

    console.log('VytchesDDD configured for multi-tenant projections');
  }
}
```

## Key Features

- **Complete Tenant Isolation**: Data and processing isolation with encryption
- **Compliance Framework**: GDPR, data residency, retention policies
- **Advanced Analytics**: Cross-tenant insights with privacy controls
- **Enterprise Integration**: Bridge pattern with VytchesDDD DI
- **Performance Monitoring**: Per-tenant performance and health tracking
- **Dynamic Configuration**: Hot-reload of tenant configurations
- **Audit Trails**: Comprehensive compliance and access logging

## Best Practices

- Always use bridge pattern to avoid dual instances
- Initialize VytchesDDD before NestJS DI system
- Implement proper tenant context validation
- Use ACL patterns for tenant access control
- Monitor compliance status continuously
- Handle tenant configuration changes gracefully
- Implement proper cleanup and resource management

## Common Pitfalls

- **Tenant Data Leakage**: Insufficient isolation between tenants
- **Configuration Drift**: Inconsistent tenant configurations
- **Performance Degradation**: Unbounded tenant data growth
- **Compliance Gaps**: Missing validation of regulatory requirements
- **Access Violations**: Improper tenant access controls

## Related Examples

- [Projection Engine Integration](./example-1.md)
- [Simple Multi-Tenant Setup](../basic/example-1.md)
- [Advanced Distributed Projections](../../advanced/example-1.md)
