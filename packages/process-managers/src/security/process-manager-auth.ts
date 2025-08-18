import { ProcessManagerSecurityError } from './process-manager-security-error';
import type { IProcessManagerSecurityContext } from './types';

export class ProcessManagerAuth {
  static requireAuthentication(context?: IProcessManagerSecurityContext): void {
    if (!context || !context.userId) {
      throw new ProcessManagerSecurityError('Authentication required');
    }
  }

  static requirePermissions(
    context: IProcessManagerSecurityContext,
    ...permissions: string[]
  ): void {
    this.requireAuthentication(context);

    if (!context.permissions || permissions.some(p => !context.permissions?.includes(p))) {
      throw new ProcessManagerSecurityError('Insufficient permissions');
    }
  }

  static requireRoles(context: IProcessManagerSecurityContext, ...roles: string[]): void {
    this.requireAuthentication(context);

    if (!context.roles || roles.some(r => !context.roles?.includes(r))) {
      throw new ProcessManagerSecurityError('Insufficient roles');
    }
  }

  static validateTenantAccess(
    context?: IProcessManagerSecurityContext,
    requiredTenantId?: string
  ): void {
    if (!requiredTenantId) {
      return; // No tenant validation required
    }

    if (!context || !context.tenantId) {
      throw new ProcessManagerSecurityError('Tenant context required');
    }

    if (context.tenantId !== requiredTenantId) {
      throw new ProcessManagerSecurityError('Tenant access denied: tenant mismatch');
    }
  }
}
