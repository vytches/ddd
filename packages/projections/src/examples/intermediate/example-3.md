# Multi-Tenant Projections

**Version**: 1.0.0 **Package**: @vytches/ddd-projections **Complexity**:
intermediate **Domain**: Event Sourcing **Patterns**: Multi-tenancy, tenant
isolation, shared resources **Dependencies**: @vytches/ddd-projections,
@vytches/ddd-events, @vytches/ddd-acl

## Description

Multi-tenant projection system with tenant isolation, shared resource
management, and tenant-specific business logic. This example demonstrates how to
build projections that serve multiple tenants while maintaining data isolation,
security, and performance across different organizational contexts.

## Business Context

SaaS applications require multi-tenant architecture:

- Complete data isolation between tenant organizations
- Tenant-specific business rules and configurations
- Shared infrastructure with isolated data processing
- Tenant-aware analytics and reporting
- Compliance with data sovereignty requirements
- Scalable resource allocation per tenant

This system enables secure, scalable multi-tenant event sourcing with flexible
projection strategies.

## Code Example

```typescript
// multi-tenant-projections.ts
import {
  ProjectionBase,
  ProjectionEngine,
  TenantIsolationCapability,
  TenantConfigurationCapability,
  ProjectionRegistry,
} from '@vytches/ddd-projections';
import { IDomainEvent } from '@vytches/ddd-events';
import { TenantContextACL } from '@vytches/ddd-acl';
import {
  TenantContext,
  TenantConfiguration,
  TenantMetrics,
  UserData,
  OrderData,
  TenantId,
  ProjectionTenantConfig,
  TenantIsolatedState,
  CrossTenantAnalytics,
  ServiceResponse,
} from '../types';

// ✅ FOCUS: Multi-Tenant Projection Base Class
export abstract class MultiTenantProjectionBase<T> extends ProjectionBase<T> {
  protected tenantIsolationCapability: TenantIsolationCapability;
  protected tenantConfigCapability: TenantConfigurationCapability;
  protected tenantContextACL: TenantContextACL;
  protected tenantConfigurations: Map<TenantId, TenantConfiguration> =
    new Map();

  constructor(projectionName: string, version: string) {
    super(projectionName, version);

    this.setupTenantCapabilities();
    this.initializeTenantState();
  }

  private setupTenantCapabilities(): void {
    // Tenant isolation capability
    this.tenantIsolationCapability = new TenantIsolationCapability({
      projectionName: this.projectionName,
      isolationStrategy: 'namespace', // 'namespace' | 'database' | 'schema'
      enableCrossTenantAnalytics: false,
      auditTenantAccess: true,
    });

    // Tenant configuration capability
    this.tenantConfigCapability = new TenantConfigurationCapability({
      projectionName: this.projectionName,
      configurationStorage: 'memory', // In production, use persistent storage
      enableHotReload: true,
      validateConfigurations: true,
    });

    // Anti-corruption layer for tenant context
    this.tenantContextACL = new TenantContextACL({
      enableTenantValidation: true,
      enableContextEnrichment: true,
      enableAccessLogging: true,
    });

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
  }

  private initializeTenantState(): void {
    // Initialize with tenant-isolated state structure
    this.setState({
      tenants: new Map<TenantId, TenantIsolatedState<T>>(),
      crossTenantMetrics: {
        totalTenants: 0,
        activeTenants: 0,
        processingMetrics: new Map<TenantId, any>(),
        lastUpdated: new Date(),
      },
      globalState: {} as T,
    });
  }

  // Override handle method with tenant awareness
  async handle(event: IDomainEvent): Promise<void> {
    try {
      // Extract and validate tenant context
      const tenantContext =
        await this.tenantContextACL.extractTenantContext(event);

      if (!tenantContext.isValid) {
        console.warn(
          `Invalid tenant context for event ${event.eventId}: ${tenantContext.error}`
        );
        return;
      }

      // Check tenant access permissions
      const hasAccess = await this.tenantIsolationCapability.checkTenantAccess(
        tenantContext.tenantId,
        event.eventType
      );

      if (!hasAccess) {
        await this.handleTenantAccessViolation({
          tenantId: tenantContext.tenantId,
          eventId: event.eventId,
          eventType: event.eventType,
          reason: 'Access denied',
        });
        return;
      }

      // Process event with tenant isolation
      await this.processTenantEvent(event, tenantContext);
    } catch (error) {
      console.error(`Error processing tenant event ${event.eventId}:`, error);
      throw error;
    }
  }

  protected async processTenantEvent(
    event: IDomainEvent,
    tenantContext: TenantContext
  ): Promise<void> {
    const tenantId = tenantContext.tenantId;

    // Ensure tenant state exists
    await this.ensureTenantState(tenantId);

    // Get tenant configuration
    const tenantConfig = await this.getTenantConfiguration(tenantId);

    // Process event within tenant context
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

    // Update tenant metrics
    await this.updateTenantMetrics(tenantId, event);
  }

  protected abstract handleTenantSpecificEvent(
    event: IDomainEvent,
    tenantContext: TenantContext,
    tenantConfig: TenantConfiguration
  ): Promise<void>;

  protected async ensureTenantState(tenantId: TenantId): Promise<void> {
    const currentState = this.getState();

    if (!currentState.tenants.has(tenantId)) {
      const tenantState: TenantIsolatedState<T> = {
        tenantId,
        data: this.createInitialTenantData(),
        metadata: {
          createdAt: new Date(),
          lastUpdated: new Date(),
          eventCount: 0,
          version: 1,
        },
      };

      currentState.tenants.set(tenantId, tenantState);
      currentState.crossTenantMetrics.totalTenants = currentState.tenants.size;
      currentState.crossTenantMetrics.lastUpdated = new Date();

      this.setState(currentState);

      console.log(`Initialized state for tenant: ${tenantId}`);
    }
  }

  protected abstract createInitialTenantData(): T;

  protected async getTenantConfiguration(
    tenantId: TenantId
  ): Promise<TenantConfiguration> {
    let config = this.tenantConfigurations.get(tenantId);

    if (!config) {
      config =
        await this.tenantConfigCapability.loadTenantConfiguration(tenantId);
      if (config) {
        this.tenantConfigurations.set(tenantId, config);
      } else {
        // Use default configuration
        config = this.createDefaultTenantConfiguration(tenantId);
        this.tenantConfigurations.set(tenantId, config);
      }
    }

    return config;
  }

  protected createDefaultTenantConfiguration(
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
      },
      integrations: {
        webhooks: [],
        externalServices: [],
      },
      compliance: {
        dataResidency: 'US',
        encryptionRequired: true,
        auditLogRetention: 2555, // 7 years
      },
    };
  }

  // Tenant-aware query methods
  protected getTenantData(
    tenantId: TenantId
  ): TenantIsolatedState<T> | undefined {
    return this.getState().tenants.get(tenantId);
  }

  protected getAllTenantIds(): TenantId[] {
    return Array.from(this.getState().tenants.keys());
  }

  protected getTenantCount(): number {
    return this.getState().tenants.size;
  }

  // Cross-tenant analytics (when allowed)
  protected getCrossTenantMetrics(): CrossTenantAnalytics {
    const state = this.getState();
    const tenantMetrics: any[] = [];

    for (const [tenantId, tenantState] of state.tenants) {
      const config = this.tenantConfigurations.get(tenantId);

      // Only include metrics if tenant allows cross-tenant analytics
      if (config?.features?.advancedAnalytics) {
        tenantMetrics.push({
          tenantId,
          eventCount: tenantState.metadata.eventCount,
          lastUpdated: tenantState.metadata.lastUpdated,
          // Add other anonymized metrics
        });
      }
    }

    return {
      totalTenants: state.crossTenantMetrics.totalTenants,
      activeTenants: state.crossTenantMetrics.activeTenants,
      anonymizedMetrics: tenantMetrics,
      lastUpdated: state.crossTenantMetrics.lastUpdated,
    };
  }

  private async updateTenantMetrics(
    tenantId: TenantId,
    event: IDomainEvent
  ): Promise<void> {
    const state = this.getState();
    const tenantState = state.tenants.get(tenantId);

    if (tenantState) {
      tenantState.metadata.eventCount++;
      tenantState.metadata.lastUpdated = new Date();

      // Update cross-tenant metrics
      const processingMetrics = state.crossTenantMetrics.processingMetrics.get(
        tenantId
      ) || {
        eventsProcessed: 0,
        lastEventTime: new Date(),
        processingRate: 0,
      };

      processingMetrics.eventsProcessed++;
      processingMetrics.lastEventTime = new Date();

      state.crossTenantMetrics.processingMetrics.set(
        tenantId,
        processingMetrics
      );
      state.crossTenantMetrics.lastUpdated = new Date();

      this.setState(state);
    }
  }

  private handleTenantConfigurationUpdate(
    tenantId: TenantId,
    config: TenantConfiguration
  ): void {
    this.tenantConfigurations.set(tenantId, config);
    console.log(`Configuration updated for tenant: ${tenantId}`);
  }

  private async handleTenantAccessViolation(violation: any): Promise<void> {
    console.error(`Tenant access violation:`, violation);

    // Log security event
    // In production, this would integrate with security monitoring systems
  }
}

// ✅ FOCUS: Multi-Tenant User Management Projection
export class MultiTenantUserProjection extends MultiTenantProjectionBase<any> {
  constructor() {
    super('MultiTenantUserProjection', 'v1.0');
  }

  protected createInitialTenantData(): any {
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
      },
      tenantSpecificData: {
        customFields: new Map<string, any>(),
        businessLogicResults: new Map<string, any>(),
      },
    };
  }

  protected async handleTenantSpecificEvent(
    event: IDomainEvent,
    tenantContext: TenantContext,
    tenantConfig: TenantConfiguration
  ): Promise<void> {
    const tenantId = tenantContext.tenantId;

    switch (event.eventType) {
      case 'UserRegistered':
        await this.handleTenantUserRegistered(event, tenantId, tenantConfig);
        break;
      case 'UserUpdated':
        await this.handleTenantUserUpdated(event, tenantId, tenantConfig);
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
    tenantConfig: TenantConfiguration
  ): Promise<void> {
    const userData = event.payload;
    const tenantState = this.getTenantData(tenantId)!;

    // Apply tenant-specific business rules
    const processedUserData = await this.applyTenantBusinessRules(
      userData,
      tenantConfig
    );

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
      },
    };

    // Store user in tenant-isolated data
    tenantState.data.users.set(user.id, user);

    // Update role-based index
    const roleUsers =
      tenantState.data.usersByRole.get(user.role) || new Set<string>();
    roleUsers.add(user.id);
    tenantState.data.usersByRole.set(user.role, roleUsers);

    // Update tenant statistics
    tenantState.data.userStats.totalUsers = tenantState.data.users.size;
    tenantState.data.userStats.activeUsers++;

    // Update growth tracking
    const registrationDate = user.createdAt.toISOString().split('T')[0];
    const dailyCount =
      tenantState.data.userStats.userGrowth.daily.get(registrationDate) || 0;
    tenantState.data.userStats.userGrowth.daily.set(
      registrationDate,
      dailyCount + 1
    );

    // Apply tenant-specific custom logic
    await this.applyTenantCustomLogic(user, tenantConfig, tenantState);

    console.log(
      `User registered for tenant ${tenantId}: ${user.name} (${user.id})`
    );
  }

  private async handleTenantUserRoleChanged(
    event: IDomainEvent,
    tenantId: TenantId,
    tenantConfig: TenantConfiguration
  ): Promise<void> {
    const roleChangeData = event.payload;
    const tenantState = this.getTenantData(tenantId)!;
    const user = tenantState.data.users.get(roleChangeData.userId);

    if (!user) {
      console.warn(
        `User ${roleChangeData.userId} not found for role change in tenant ${tenantId}`
      );
      return;
    }

    const oldRole = user.role;
    const newRole = roleChangeData.newRole;

    // Validate role change against tenant configuration
    if (!this.isValidRoleForTenant(newRole, tenantConfig)) {
      console.warn(`Invalid role ${newRole} for tenant ${tenantId}`);
      return;
    }

    // Update user role
    user.role = newRole;
    tenantState.data.users.set(user.id, user);

    // Update role indexes
    const oldRoleUsers = tenantState.data.usersByRole.get(oldRole);
    if (oldRoleUsers) {
      oldRoleUsers.delete(user.id);
      if (oldRoleUsers.size === 0) {
        tenantState.data.usersByRole.delete(oldRole);
      }
    }

    const newRoleUsers =
      tenantState.data.usersByRole.get(newRole) || new Set<string>();
    newRoleUsers.add(user.id);
    tenantState.data.usersByRole.set(newRole, newRoleUsers);

    console.log(
      `User role changed for tenant ${tenantId}: ${user.name} from ${oldRole} to ${newRole}`
    );
  }

  // Tenant-aware query methods
  getTenantUsers(tenantId: TenantId): UserData[] {
    const tenantState = this.getTenantData(tenantId);
    return tenantState ? Array.from(tenantState.data.users.values()) : [];
  }

  getTenantUserById(tenantId: TenantId, userId: string): UserData | undefined {
    const tenantState = this.getTenantData(tenantId);
    return tenantState ? tenantState.data.users.get(userId) : undefined;
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

    return {
      tenantId,
      totalUsers: tenantState.data.userStats.totalUsers,
      activeUsers: tenantState.data.userStats.activeUsers,
      userGrowth: {
        last30Days: this.calculateGrowthForPeriod(
          tenantState.data.userStats.userGrowth.daily,
          30
        ),
        last7Days: this.calculateGrowthForPeriod(
          tenantState.data.userStats.userGrowth.daily,
          7
        ),
      },
      complianceStatus: {
        withinUserLimit:
          tenantState.data.userStats.totalUsers <
          (config?.features?.maxUsers || 1000),
        dataResidencyCompliant: true, // Would be calculated based on actual compliance rules
      },
      lastUpdated: tenantState.metadata.lastUpdated,
    };
  }

  // Cross-tenant analytics (aggregated, anonymized)
  getTenantComparison(): CrossTenantAnalytics {
    const crossTenantMetrics = this.getCrossTenantMetrics();

    // Add user-specific cross-tenant insights
    const tenantUserCounts = this.getAllTenantIds()
      .map(tenantId => {
        const stats = this.getTenantUserStats(tenantId);
        const config = this.tenantConfigurations.get(tenantId);

        // Only include if tenant allows analytics sharing
        if (config?.features?.advancedAnalytics) {
          return {
            tenantSize: stats?.totalUsers || 0,
            growth: stats?.userGrowth?.last30Days || 0,
            // No tenant-identifying information
          };
        }
        return null;
      })
      .filter(Boolean);

    return {
      ...crossTenantMetrics,
      userMetrics: {
        averageUsersPerTenant:
          tenantUserCounts.reduce((sum, t) => sum + (t?.tenantSize || 0), 0) /
          tenantUserCounts.length,
        totalUsers: tenantUserCounts.reduce(
          (sum, t) => sum + (t?.tenantSize || 0),
          0
        ),
        averageGrowthRate:
          tenantUserCounts.reduce((sum, t) => sum + (t?.growth || 0), 0) /
          tenantUserCounts.length,
      },
    };
  }

  // Tenant management methods
  async addTenant(
    tenantId: TenantId,
    initialConfig: TenantConfiguration
  ): Promise<ServiceResponse<void>> {
    try {
      // Ensure tenant state
      await this.ensureTenantState(tenantId);

      // Store tenant configuration
      await this.tenantConfigCapability.saveTenantConfiguration(
        tenantId,
        initialConfig
      );
      this.tenantConfigurations.set(tenantId, initialConfig);

      console.log(`Tenant added: ${tenantId}`);

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

  async removeTenant(tenantId: TenantId): Promise<ServiceResponse<void>> {
    try {
      const currentState = this.getState();

      // Remove tenant data
      currentState.tenants.delete(tenantId);
      currentState.crossTenantMetrics.totalTenants = currentState.tenants.size;
      currentState.crossTenantMetrics.processingMetrics.delete(tenantId);

      // Remove tenant configuration
      this.tenantConfigurations.delete(tenantId);
      await this.tenantConfigCapability.deleteTenantConfiguration(tenantId);

      this.setState(currentState);

      console.log(`Tenant removed: ${tenantId}`);

      return {
        success: true,
        metadata: {
          timestamp: new Date(),
          requestId: 'remove-tenant-' + Date.now(),
          duration: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REMOVE_TENANT_FAILED',
          message: 'Failed to remove tenant',
          details: { error: (error as Error).message, tenantId },
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'remove-tenant-' + Date.now(),
          duration: 0,
        },
      };
    }
  }

  // Helper methods
  private async applyTenantBusinessRules(
    userData: any,
    tenantConfig: TenantConfiguration
  ): Promise<any> {
    // Apply tenant-specific transformations and validations
    const processedData = { ...userData };

    // Apply custom validations
    for (const validation of tenantConfig.businessRules.customValidations ||
      []) {
      // Apply custom validation logic
      processedData = await this.applyCustomValidation(
        processedData,
        validation
      );
    }

    return processedData;
  }

  private async applyTenantCustomLogic(
    user: UserData,
    tenantConfig: TenantConfiguration,
    tenantState: TenantIsolatedState<any>
  ): Promise<void> {
    // Apply tenant-specific custom logic
    // This could include custom field processing, integrations, etc.

    if (tenantConfig.integrations.webhooks.length > 0) {
      // Trigger tenant-specific webhooks
      console.log(
        `Triggering ${tenantConfig.integrations.webhooks.length} webhooks for tenant ${tenantConfig.tenantId}`
      );
    }
  }

  private isValidRoleForTenant(
    role: string,
    tenantConfig: TenantConfiguration
  ): boolean {
    const validRoles = tenantConfig.businessRules.allowedRoles || [
      'user',
      'admin',
      'manager',
    ];
    return validRoles.includes(role);
  }

  private calculateGrowthForPeriod(
    dailyGrowth: Map<string, number>,
    days: number
  ): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let totalGrowth = 0;
    for (const [date, count] of dailyGrowth) {
      const growthDate = new Date(date);
      if (growthDate >= cutoffDate) {
        totalGrowth += count;
      }
    }

    return totalGrowth;
  }

  private async applyCustomValidation(
    data: any,
    validation: any
  ): Promise<any> {
    // Apply custom tenant validation logic
    return data; // Simplified for example
  }

  // Additional placeholder methods for missing handlers
  private async handleTenantUserUpdated(
    event: IDomainEvent,
    tenantId: TenantId,
    tenantConfig: TenantConfiguration
  ): Promise<void> {
    const updateData = event.payload;
    const tenantState = this.getTenantData(tenantId)!;
    const existingUser = tenantState.data.users.get(updateData.userId);

    if (!existingUser) {
      console.warn(
        `User ${updateData.userId} not found for update in tenant ${tenantId}`
      );
      return;
    }

    const updatedUser: UserData = {
      ...existingUser,
      name: updateData.name || existingUser.name,
      email: updateData.email || existingUser.email,
      preferences: {
        ...existingUser.preferences,
        ...(updateData.preferences || {}),
      },
    };

    tenantState.data.users.set(updatedUser.id, updatedUser);
    console.log(`User updated for tenant ${tenantId}: ${updatedUser.name}`);
  }

  private async handleTenantUserDeactivated(
    event: IDomainEvent,
    tenantId: TenantId,
    tenantConfig: TenantConfiguration
  ): Promise<void> {
    const deactivationData = event.payload;
    const tenantState = this.getTenantData(tenantId)!;
    const user = tenantState.data.users.get(deactivationData.userId);

    if (!user) {
      console.warn(
        `User ${deactivationData.userId} not found for deactivation in tenant ${tenantId}`
      );
      return;
    }

    // Change role to deactivated
    await this.handleTenantUserRoleChanged(
      {
        ...event,
        payload: {
          userId: deactivationData.userId,
          newRole: 'deactivated',
          reason: deactivationData.reason,
        },
      },
      tenantId,
      tenantConfig
    );

    // Update active user count
    tenantState.data.userStats.activeUsers = Array.from(
      tenantState.data.users.values()
    ).filter(u => u.role !== 'deactivated').length;

    console.log(`User deactivated for tenant ${tenantId}: ${user.name}`);
  }
}

// Multi-Tenant Projection Manager
export class MultiTenantProjectionManager {
  private projections: Map<string, MultiTenantProjectionBase<any>> = new Map();
  private tenantConfigurations: Map<TenantId, TenantConfiguration> = new Map();

  registerProjection(projection: MultiTenantProjectionBase<any>): void {
    this.projections.set(projection.projectionName, projection);
    console.log(
      `Registered multi-tenant projection: ${projection.projectionName}`
    );
  }

  async addTenantToAllProjections(
    tenantId: TenantId,
    config: TenantConfiguration
  ): Promise<ServiceResponse<void>[]> {
    this.tenantConfigurations.set(tenantId, config);

    const results: ServiceResponse<void>[] = [];

    for (const projection of this.projections.values()) {
      const result = await projection.addTenant(tenantId, config);
      results.push(result);
    }

    return results;
  }

  async removeTenantFromAllProjections(
    tenantId: TenantId
  ): Promise<ServiceResponse<void>[]> {
    const results: ServiceResponse<void>[] = [];

    for (const projection of this.projections.values()) {
      const result = await projection.removeTenant(tenantId);
      results.push(result);
    }

    this.tenantConfigurations.delete(tenantId);

    return results;
  }

  getProjection<T extends MultiTenantProjectionBase<any>>(
    name: string
  ): T | undefined {
    return this.projections.get(name) as T;
  }

  getTenantConfiguration(tenantId: TenantId): TenantConfiguration | undefined {
    return this.tenantConfigurations.get(tenantId);
  }

  getAllTenants(): TenantId[] {
    return Array.from(this.tenantConfigurations.keys());
  }
}
```

## Key Features

- **Complete Tenant Isolation**: Data and processing isolation between tenants
- **Tenant-Specific Configuration**: Per-tenant business rules and feature flags
- **Scalable Architecture**: Efficient resource sharing with security boundaries
- **Compliance Support**: Data residency and regulatory compliance features
- **Cross-Tenant Analytics**: Anonymized aggregations where permitted
- **Dynamic Tenant Management**: Runtime addition and removal of tenants

## Usage Examples

```typescript
// Create multi-tenant projection manager
const manager = new MultiTenantProjectionManager();

// Create and register multi-tenant projection
const userProjection = new MultiTenantUserProjection();
manager.registerProjection(userProjection);

// Add tenants with different configurations
const tenant1Config: TenantConfiguration = {
  tenantId: 'acme-corp',
  features: {
    advancedAnalytics: true,
    realTimeNotifications: true,
    dataRetentionDays: 2555, // 7 years
    maxUsers: 5000,
  },
  businessRules: {
    currency: 'USD',
    timezone: 'America/New_York',
    locale: 'en-US',
    allowedRoles: ['user', 'admin', 'manager', 'analyst'],
    customValidations: [],
  },
  compliance: {
    dataResidency: 'US',
    encryptionRequired: true,
    auditLogRetention: 2555,
  },
};

const tenant2Config: TenantConfiguration = {
  tenantId: 'global-inc',
  features: {
    advancedAnalytics: false, // No cross-tenant analytics
    realTimeNotifications: true,
    dataRetentionDays: 365,
    maxUsers: 1000,
  },
  businessRules: {
    currency: 'EUR',
    timezone: 'Europe/London',
    locale: 'en-GB',
    allowedRoles: ['user', 'admin'],
    customValidations: [],
  },
  compliance: {
    dataResidency: 'EU',
    encryptionRequired: true,
    auditLogRetention: 2555,
  },
};

// Add tenants
await manager.addTenantToAllProjections('acme-corp', tenant1Config);
await manager.addTenantToAllProjections('global-inc', tenant2Config);

// Process tenant-specific events
await userProjection.handle({
  eventId: '1001',
  eventType: 'UserRegistered',
  aggregateId: 'user-1',
  payload: {
    userId: 'user-1',
    email: 'john@acmecorp.com',
    name: 'John Doe',
    role: 'user',
    tenantId: 'acme-corp', // Tenant context
  },
  timestamp: new Date(),
  version: 1,
});

await userProjection.handle({
  eventId: '1002',
  eventType: 'UserRegistered',
  aggregateId: 'user-2',
  payload: {
    userId: 'user-2',
    email: 'jane@globalinc.com',
    name: 'Jane Smith',
    role: 'admin',
    tenantId: 'global-inc',
  },
  timestamp: new Date(),
  version: 1,
});

// Query tenant-specific data
const acmeUsers = userProjection.getTenantUsers('acme-corp');
console.log('ACME Corp users:', acmeUsers.length);

const globalUsers = userProjection.getTenantUsers('global-inc');
console.log('Global Inc users:', globalUsers.length);

// Get tenant-specific statistics
const acmeStats = userProjection.getTenantUserStats('acme-corp');
console.log('ACME Corp user stats:', acmeStats);

const globalStats = userProjection.getTenantUserStats('global-inc');
console.log('Global Inc user stats:', globalStats);

// Cross-tenant analytics (only for tenants that allow it)
const crossTenantAnalytics = userProjection.getTenantComparison();
console.log('Cross-tenant analytics:', crossTenantAnalytics);

// Query specific user within tenant context
const user = userProjection.getTenantUserById('acme-corp', 'user-1');
console.log('User in ACME Corp:', user);

// Get users by role for specific tenant
const acmeAdmins = userProjection.getTenantUsersByRole('acme-corp', 'admin');
console.log('ACME Corp administrators:', acmeAdmins.length);
```

## Multi-Tenancy Patterns

### **Namespace Isolation**

```typescript
// Each tenant gets isolated namespace
tenantState = {
  'acme-corp': { users: Map(), stats: {} },
  'global-inc': { users: Map(), stats: {} },
};
```

### **Configuration-Driven Behavior**

```typescript
// Tenant-specific business rules
const config = await getTenantConfiguration(tenantId);
if (config.features.advancedAnalytics) {
  // Include in cross-tenant reporting
}
```

### **Access Control**

```typescript
// Strict tenant access validation
const hasAccess = await checkTenantAccess(tenantId, eventType);
if (!hasAccess) {
  throw new TenantAccessViolationError();
}
```

## Compliance Features

### **Data Residency**

- Per-tenant data location requirements
- Regional processing restrictions
- Compliance validation

### **Encryption**

- Tenant-specific encryption keys
- Data-at-rest and in-transit protection
- Audit trail for encrypted data access

### **Audit Logging**

- Comprehensive tenant activity logging
- Access violation tracking
- Compliance reporting

## Scalability Considerations

### **Resource Allocation**

- Per-tenant processing limits
- Memory usage monitoring
- Performance isolation

### **Data Growth Management**

- Tenant-specific retention policies
- Automated data archiving
- Storage optimization

### **Performance Monitoring**

- Per-tenant performance metrics
- Resource usage tracking
- Capacity planning

## Best Practices

- **Strict Isolation**: Never allow data leakage between tenants
- **Configuration Management**: Centralize tenant configuration with versioning
- **Security First**: Validate all tenant access at multiple layers
- **Monitoring**: Implement comprehensive per-tenant monitoring
- **Compliance**: Regular compliance validation and reporting
- **Testing**: Test multi-tenant scenarios thoroughly

## Common Pitfalls

- **Data Leakage**: Insufficient isolation between tenant data
- **Configuration Drift**: Inconsistent tenant configurations
- **Performance Impact**: Tenant isolation overhead
- **Memory Growth**: Unbounded tenant data growth
- **Security Gaps**: Missing tenant access validations

## Related Examples

- [Projection Rebuilding System](./example-1.md)
- [Event Stream Processing](./example-2.md)
- [Simple Event Projection](../basic/example-1.md)
- [Projection with Capabilities](../basic/example-2.md)
