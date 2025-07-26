# Multi-Tenant Repository - Tenant-Aware Data Access

**Version**: 1.0.0 **Package**: @vytches/ddd-repositories **Complexity**:
intermediate **Domain**: saas-platform **Patterns**: multi-tenancy,
tenant-isolation, shared-schema, data-partitioning **Dependencies**:
@vytches/ddd-repositories, @vytches/ddd-domain-primitives

## Description

Advanced multi-tenant data access patterns providing tenant isolation, shared
schema management, and tenant-aware querying using the @vytches/ddd-repositories
multi-tenant capabilities.

## Business Context

SaaS platform serving multiple client organizations (tenants) requiring complete
data isolation, tenant-specific configurations, and secure cross-tenant access
prevention while maintaining performance and scalability.

## Code Example

```typescript
// multi-tenant-repository.ts
import {
  MultiTenantRepository,
  TenantContext,
} from '@vytches/ddd-repositories';
import { EntityId } from '@vytches/ddd-domain-primitives';
import {
  User,
  TenantConfig,
  QueryOptions,
  TenantIsolationLevel,
} from './types'; // From your application

// ✅ FOCUS: Base multi-tenant repository with automatic tenant filtering
export class TenantAwareUserRepository extends MultiTenantRepository<User> {
  constructor() {
    super('users', {
      // Tenant configuration
      tenantIdField: 'tenantId',
      isolationLevel: 'SHARED', // SHARED, ISOLATED, DEDICATED
      enableTenantValidation: true,
      enableCrossTenantsAccess: false,
    });
  }

  // ✅ FOCUS: Tenant-scoped user creation
  async createUser(
    userData: CreateUserData,
    tenantContext: TenantContext
  ): Promise<User> {
    // Validate tenant access
    await this.validateTenantAccess(tenantContext);

    const user: User = {
      id: EntityId.generate().value,
      tenantId: tenantContext.tenantId, // ✅ FOCUS: Automatic tenant assignment
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      isActive: true,
      roles: userData.roles || ['user'],
      profile: userData.profile,
      preferences: this.getDefaultTenantPreferences(tenantContext),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    // ✅ FOCUS: Library automatically adds tenant filtering
    return await this.create(user, tenantContext);
  }

  // ✅ FOCUS: Tenant-scoped queries
  async getUserById(
    id: string,
    tenantContext: TenantContext
  ): Promise<User | null> {
    // Library automatically adds tenantId filter
    return await this.findById(EntityId.fromString(id), tenantContext);
  }

  async getUsersByRole(
    role: string,
    tenantContext: TenantContext
  ): Promise<User[]> {
    return await this.find(
      {
        where: [{ field: 'roles', operator: 'in', value: [role] }],
        orderBy: [{ field: 'username', direction: 'ASC' }],
      },
      tenantContext
    );
  }

  async getActiveUsers(tenantContext: TenantContext): Promise<User[]> {
    return await this.find(
      {
        where: [{ field: 'isActive', operator: 'eq', value: true }],
        orderBy: [{ field: 'createdAt', direction: 'DESC' }],
      },
      tenantContext
    );
  }

  // ✅ FOCUS: Tenant-specific user management
  async updateUserRole(
    userId: string,
    newRoles: string[],
    tenantContext: TenantContext
  ): Promise<User | null> {
    // Validate role permissions for tenant
    await this.validateTenantRoles(newRoles, tenantContext);

    return await this.update(
      EntityId.fromString(userId),
      {
        roles: newRoles,
        updatedAt: new Date(),
      },
      tenantContext
    );
  }

  async deactivateUser(
    userId: string,
    tenantContext: TenantContext
  ): Promise<User | null> {
    return await this.update(
      EntityId.fromString(userId),
      {
        isActive: false,
        deactivatedAt: new Date(),
        updatedAt: new Date(),
      },
      tenantContext
    );
  }

  // ✅ FOCUS: Tenant statistics and analytics
  async getTenantUserStatistics(
    tenantContext: TenantContext
  ): Promise<TenantUserStats> {
    const [totalUsers, activeUsers, inactiveUsers] = await Promise.all([
      this.count({}, tenantContext),
      this.count(
        { where: [{ field: 'isActive', operator: 'eq', value: true }] },
        tenantContext
      ),
      this.count(
        { where: [{ field: 'isActive', operator: 'eq', value: false }] },
        tenantContext
      ),
    ]);

    const roleDistribution = await this.getUserRoleDistribution(tenantContext);
    const lastLogin = await this.getLastLoginDate(tenantContext);

    return {
      tenantId: tenantContext.tenantId,
      totalUsers,
      activeUsers,
      inactiveUsers,
      roleDistribution,
      lastUserActivity: lastLogin,
    };
  }

  async getUserRoleDistribution(
    tenantContext: TenantContext
  ): Promise<{ [role: string]: number }> {
    const users = await this.find({}, tenantContext);

    const roleCount: { [role: string]: number } = {};

    for (const user of users) {
      for (const role of user.roles) {
        roleCount[role] = (roleCount[role] || 0) + 1;
      }
    }

    return roleCount;
  }

  // ✅ FOCUS: Tenant-aware bulk operations
  async bulkUpdateUsers(
    userUpdates: { userId: string; updates: Partial<User> }[],
    tenantContext: TenantContext
  ): Promise<User[]> {
    const updatedUsers: User[] = [];

    // Process in batches to maintain performance
    const batchSize = 50;
    for (let i = 0; i < userUpdates.length; i += batchSize) {
      const batch = userUpdates.slice(i, i + batchSize);

      const batchPromises = batch.map(async ({ userId, updates }) => {
        return await this.update(
          EntityId.fromString(userId),
          { ...updates, updatedAt: new Date() },
          tenantContext
        );
      });

      const batchResults = await Promise.all(batchPromises);
      updatedUsers.push(...batchResults.filter(user => user !== null));
    }

    return updatedUsers;
  }

  // ✅ FOCUS: Tenant migration support
  async migrateUserToTenant(
    userId: string,
    currentTenantContext: TenantContext,
    targetTenantContext: TenantContext
  ): Promise<User | null> {
    // Load user from current tenant
    const user = await this.findById(
      EntityId.fromString(userId),
      currentTenantContext
    );
    if (!user) {
      throw new Error('User not found in source tenant');
    }

    // Validate migration permissions
    await this.validateTenantMigration(
      currentTenantContext,
      targetTenantContext
    );

    // Create user in target tenant
    const migratedUser = {
      ...user,
      id: EntityId.generate().value, // New ID for target tenant
      tenantId: targetTenantContext.tenantId,
      migrationMetadata: {
        originalTenantId: currentTenantContext.tenantId,
        originalUserId: user.id,
        migratedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    const created = await this.create(migratedUser, targetTenantContext);

    // Mark original user as migrated (don't delete for audit trail)
    await this.update(
      EntityId.fromString(userId),
      {
        isActive: false,
        migrationMetadata: {
          migratedTo: targetTenantContext.tenantId,
          newUserId: created.id,
          migratedAt: new Date(),
        },
        updatedAt: new Date(),
      },
      currentTenantContext
    );

    return created;
  }

  // ✅ FOCUS: Advanced tenant-scoped queries with caching
  async getUsersWithCaching(
    queryOptions: QueryOptions,
    tenantContext: TenantContext,
    cacheTtl: number = 300
  ): Promise<User[]> {
    const cacheKey = `tenant:${tenantContext.tenantId}:users:${this.hashQueryOptions(queryOptions)}`;

    return await this.findWithCache(
      queryOptions,
      { key: cacheKey, ttl: cacheTtl },
      tenantContext
    );
  }

  // ✅ FOCUS: Tenant data export
  async exportTenantUsers(
    tenantContext: TenantContext,
    exportOptions: ExportOptions = {}
  ): Promise<any[]> {
    const users = await this.find({}, tenantContext);

    // Sanitize data for export (remove sensitive information)
    return users.map(user => ({
      id: user.id,
      username: user.username,
      email: exportOptions.includePII ? user.email : '[REDACTED]',
      firstName: exportOptions.includePII ? user.firstName : '[REDACTED]',
      lastName: exportOptions.includePII ? user.lastName : '[REDACTED]',
      isActive: user.isActive,
      roles: user.roles,
      createdAt: user.createdAt,
      lastLoginAt: user.profile?.lastLoginAt,
    }));
  }

  // ✅ FOCUS: Cross-tenant operations (admin only)
  async findUserAcrossTenants(
    email: string,
    adminContext: TenantContext
  ): Promise<{ user: User; tenantId: string }[]> {
    // Validate admin permissions
    if (!this.isSystemAdmin(adminContext)) {
      throw new Error('Cross-tenant access requires system admin privileges');
    }

    // ✅ FOCUS: Bypass tenant filtering for admin operations
    const results = await this.findAcrossAllTenants({
      where: [{ field: 'email', operator: 'eq', value: email }],
    });

    return results.map(user => ({
      user,
      tenantId: user.tenantId,
    }));
  }

  // ✅ FOCUS: Tenant health monitoring
  async getTenantHealthStatus(
    tenantContext: TenantContext
  ): Promise<TenantHealthStatus> {
    const stats = await this.getTenantUserStatistics(tenantContext);
    const recentActivity = await this.getRecentUserActivity(tenantContext, 24); // Last 24 hours

    return {
      tenantId: tenantContext.tenantId,
      status: this.calculateTenantHealthStatus(stats, recentActivity),
      userCount: stats.totalUsers,
      activeUserCount: stats.activeUsers,
      recentActivityCount: recentActivity.length,
      lastChecked: new Date(),
    };
  }

  // Private helper methods
  private async validateTenantAccess(
    tenantContext: TenantContext
  ): Promise<void> {
    const tenantConfig = await this.getTenantConfiguration(
      tenantContext.tenantId
    );

    if (!tenantConfig.isActive) {
      throw new Error('Tenant is not active');
    }

    if (
      tenantConfig.userLimit &&
      tenantConfig.currentUserCount >= tenantConfig.userLimit
    ) {
      throw new Error('Tenant user limit exceeded');
    }
  }

  private async validateTenantRoles(
    roles: string[],
    tenantContext: TenantContext
  ): Promise<void> {
    const tenantConfig = await this.getTenantConfiguration(
      tenantContext.tenantId
    );
    const allowedRoles = tenantConfig.allowedRoles || ['user', 'admin'];

    const invalidRoles = roles.filter(role => !allowedRoles.includes(role));
    if (invalidRoles.length > 0) {
      throw new Error(`Invalid roles for tenant: ${invalidRoles.join(', ')}`);
    }
  }

  private getDefaultTenantPreferences(tenantContext: TenantContext): any {
    // Return tenant-specific default preferences
    return {
      language: tenantContext.tenantSettings?.defaultLanguage || 'en',
      timezone: tenantContext.tenantSettings?.defaultTimezone || 'UTC',
      theme: tenantContext.tenantSettings?.defaultTheme || 'light',
      emailNotifications: true,
      smsNotifications: false,
    };
  }

  private async getTenantConfiguration(
    tenantId: string
  ): Promise<TenantConfig> {
    // Mock implementation - would typically load from tenant configuration store
    return {
      tenantId,
      isActive: true,
      userLimit: 1000,
      currentUserCount: 0,
      allowedRoles: ['user', 'admin', 'manager'],
      settings: {
        defaultLanguage: 'en',
        defaultTimezone: 'UTC',
        defaultTheme: 'light',
      },
    };
  }

  private async validateTenantMigration(
    source: TenantContext,
    target: TenantContext
  ): Promise<void> {
    // Validate migration permissions and constraints
    if (source.tenantId === target.tenantId) {
      throw new Error('Cannot migrate to the same tenant');
    }

    // Additional validation logic...
  }

  private isSystemAdmin(context: TenantContext): boolean {
    return context.userRoles?.includes('system_admin') || false;
  }

  private async getLastLoginDate(
    tenantContext: TenantContext
  ): Promise<Date | null> {
    const users = await this.find(
      {
        where: [
          { field: 'profile.lastLoginAt', operator: 'isNotNull', value: null },
        ],
        orderBy: [{ field: 'profile.lastLoginAt', direction: 'DESC' }],
        limit: 1,
      },
      tenantContext
    );

    return users.length > 0 ? users[0].profile?.lastLoginAt || null : null;
  }

  private async getRecentUserActivity(
    tenantContext: TenantContext,
    hours: number
  ): Promise<User[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return await this.find(
      {
        where: [
          { field: 'profile.lastLoginAt', operator: 'gte', value: since },
        ],
      },
      tenantContext
    );
  }

  private calculateTenantHealthStatus(
    stats: TenantUserStats,
    recentActivity: User[]
  ): 'healthy' | 'warning' | 'critical' {
    const activeRatio = stats.activeUsers / Math.max(stats.totalUsers, 1);
    const activityRatio =
      recentActivity.length / Math.max(stats.activeUsers, 1);

    if (activeRatio > 0.8 && activityRatio > 0.1) return 'healthy';
    if (activeRatio > 0.5 && activityRatio > 0.05) return 'warning';
    return 'critical';
  }

  private hashQueryOptions(options: QueryOptions): string {
    return Buffer.from(JSON.stringify(options)).toString('base64').slice(0, 16);
  }
}

// ✅ FOCUS: Tenant-aware service layer
export class MultiTenantUserService {
  constructor(private userRepository: TenantAwareUserRepository) {}

  async createTenantUser(
    userData: CreateUserData,
    tenantContext: TenantContext
  ): Promise<User> {
    // Additional business logic before repository call
    this.validateBusinessRules(userData, tenantContext);

    return await this.userRepository.createUser(userData, tenantContext);
  }

  async getTenantDashboardData(
    tenantContext: TenantContext
  ): Promise<TenantDashboard> {
    const [stats, healthStatus, recentUsers] = await Promise.all([
      this.userRepository.getTenantUserStatistics(tenantContext),
      this.userRepository.getTenantHealthStatus(tenantContext),
      this.userRepository.find(
        {
          orderBy: [{ field: 'createdAt', direction: 'DESC' }],
          limit: 10,
        },
        tenantContext
      ),
    ]);

    return {
      statistics: stats,
      healthStatus,
      recentUsers,
      generatedAt: new Date(),
    };
  }

  // Admin-only cross-tenant operations
  async findUserGlobally(
    email: string,
    adminContext: TenantContext
  ): Promise<GlobalUserSearchResult[]> {
    return await this.userRepository.findUserAcrossTenants(email, adminContext);
  }

  private validateBusinessRules(
    userData: CreateUserData,
    tenantContext: TenantContext
  ): void {
    // Business validation logic
    if (!userData.email || !userData.username) {
      throw new Error('Email and username are required');
    }

    // Additional tenant-specific validations...
  }
}

// Usage Example
async function demonstrateMultiTenantRepository() {
  const userRepo = new TenantAwareUserRepository();
  const userService = new MultiTenantUserService(userRepo);

  // Tenant A operations
  const tenantAContext: TenantContext = {
    tenantId: 'tenant-a',
    tenantName: 'ACME Corporation',
    isolationLevel: 'SHARED',
    userId: 'admin-a',
    userRoles: ['admin'],
  };

  console.log('=== Tenant A Operations ===');

  // Create user in Tenant A
  const userA = await userRepo.createUser(
    {
      username: 'john.doe',
      email: 'john@acme.com',
      firstName: 'John',
      lastName: 'Doe',
      roles: ['user'],
    },
    tenantAContext
  );
  console.log('Created user in Tenant A:', userA.username);

  // Get Tenant A users
  const tenantAUsers = await userRepo.getActiveUsers(tenantAContext);
  console.log(`Tenant A active users: ${tenantAUsers.length}`);

  // Tenant B operations
  const tenantBContext: TenantContext = {
    tenantId: 'tenant-b',
    tenantName: 'Beta Industries',
    isolationLevel: 'SHARED',
    userId: 'admin-b',
    userRoles: ['admin'],
  };

  console.log('=== Tenant B Operations ===');

  // Create user in Tenant B
  const userB = await userRepo.createUser(
    {
      username: 'jane.smith',
      email: 'jane@beta.com',
      firstName: 'Jane',
      lastName: 'Smith',
      roles: ['manager'],
    },
    tenantBContext
  );
  console.log('Created user in Tenant B:', userB.username);

  // Verify tenant isolation
  const tenantBUsers = await userRepo.getActiveUsers(tenantBContext);
  console.log(`Tenant B active users: ${tenantBUsers.length}`);

  // Tenant A cannot see Tenant B users
  const attemptCrossTenantAccess = await userRepo.getUserById(
    userB.id,
    tenantAContext
  );
  console.log('Cross-tenant access result:', attemptCrossTenantAccess); // Should be null

  // Admin operations across tenants
  const adminContext: TenantContext = {
    tenantId: 'system',
    tenantName: 'System Admin',
    isolationLevel: 'DEDICATED',
    userId: 'system-admin',
    userRoles: ['system_admin'],
  };

  console.log('=== Admin Operations ===');
  const globalSearch = await userService.findUserGlobally(
    'john@acme.com',
    adminContext
  );
  console.log(`Global search results: ${globalSearch.length}`);

  // Tenant statistics
  const tenantAStats = await userRepo.getTenantUserStatistics(tenantAContext);
  console.log('Tenant A Statistics:', tenantAStats);

  // Dashboard data
  const dashboardData =
    await userService.getTenantDashboardData(tenantAContext);
  console.log('Dashboard data generated at:', dashboardData.generatedAt);
}

// Supporting types
interface TenantUserStats {
  tenantId: string;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  roleDistribution: { [role: string]: number };
  lastUserActivity: Date | null;
}

interface TenantHealthStatus {
  tenantId: string;
  status: 'healthy' | 'warning' | 'critical';
  userCount: number;
  activeUserCount: number;
  recentActivityCount: number;
  lastChecked: Date;
}

interface TenantDashboard {
  statistics: TenantUserStats;
  healthStatus: TenantHealthStatus;
  recentUsers: User[];
  generatedAt: Date;
}

interface GlobalUserSearchResult {
  user: User;
  tenantId: string;
}

interface CreateUserData {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles?: string[];
  profile?: any;
}

interface ExportOptions {
  includePII?: boolean;
  format?: 'json' | 'csv';
  fields?: string[];
}
```

## Key Features

- Automatic tenant filtering on all repository operations
- Configurable tenant isolation levels (SHARED, ISOLATED, DEDICATED)
- Cross-tenant access prevention with role-based overrides
- Tenant-specific configuration and preferences management
- Tenant migration support with audit trail preservation
- Multi-tenant caching with tenant-scoped cache keys

## Common Pitfalls

- Forgetting to pass tenant context to repository methods
- Not validating tenant permissions before operations
- Accidentally allowing cross-tenant data leakage
- Not considering tenant-specific business rules and configurations
- Poor cache key design leading to cross-tenant cache pollution

## Related Examples

- [Unit of Work Pattern](example-1.md) - Transaction management across
  repositories
- [Specification Pattern](example-2.md) - Advanced querying with specifications
