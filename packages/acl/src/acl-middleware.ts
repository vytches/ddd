/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Result } from '@vytches-ddd/utils';

import type { ACLError } from './acl-errors';
import type { ACLMiddleware, ExecuteOptions } from './acl.interfaces';

/**
 * @llm-summary BaseACLMiddleware class for base a c l middleware operations
 * @llm-domain Integration
 * @llm-complexity Medium
 *
 * @description
 * BaseACLMiddleware class implementing integration layer component for base a c l middleware operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseACLMiddleware();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new BaseACLMiddleware());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class BaseACLMiddleware implements ACLMiddleware {
  abstract execute<T>(
    operation: string,
    domainModel: any,
    options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>>;
}
