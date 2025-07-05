/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IQuery, IQueryHandler } from '../interfaces';
import { CQRSMetadataRegistry } from '../registry';

export function QueryHandler<T extends IQuery<R>, R>(queryType: new (...args: any[]) => T) {
  return function <K extends IQueryHandler<T, R>>(target: new (...args: any[]) => K) {
    CQRSMetadataRegistry.registerQueryHandler(queryType, target);
    return target;
  };
}
