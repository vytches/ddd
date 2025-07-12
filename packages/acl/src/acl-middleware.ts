/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Result } from '@vytches-ddd/utils';

import type { ACLError } from './acl-errors';
import type { ACLMiddleware, ExecuteOptions } from './acl.interfaces';

export abstract class BaseACLMiddleware implements ACLMiddleware {
  abstract execute<T>(
    operation: string,
    domainModel: any,
    options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>>;
}
