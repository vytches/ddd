export interface IProcessManagerSecurityContext {
  userId?: string | undefined;
  roles?: string[] | undefined;
  permissions?: string[] | undefined;
  tenantId?: string | undefined;
  sessionId?: string | undefined;
  requestId?: string | undefined;
}
