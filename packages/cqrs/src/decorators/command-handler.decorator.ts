/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ICommand, ICommandHandler } from '../interfaces';
import { CQRSMetadataRegistry } from '../registry';

export function CommandHandler<T extends ICommand>(commandType: new (...args: any[]) => T) {
  return function <K extends ICommandHandler<T>>(target: new (...args: any[]) => K) {
    CQRSMetadataRegistry.registerCommandHandler(commandType, target);
    return target;
  };
}
