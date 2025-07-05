/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import type { ICommand, ICommandHandler } from '../interfaces';
import { CQRSMetadataRegistry } from '../registry';
import type { CommandHandlerOptions, DIHandlerMetadata } from './di-types';

/**
 * Enhanced CommandHandler decorator with DI integration
 * Maintains backward compatibility while adding Phase 2 DI features
 */
export function CommandHandler<T extends ICommand>(
  commandType: new (...args: any[]) => T,
  options?: CommandHandlerOptions
) {
  return function <K extends ICommandHandler<T>>(target: new (...args: any[]) => K) {
    // Phase 1: Maintain existing functionality
    CQRSMetadataRegistry.registerCommandHandler(commandType, target);
    
    // Phase 2: Enhanced DI integration
    const diOptions = options || {};
    const metadata: DIHandlerMetadata = {
      type: 'command',
      messageType: commandType,
      handlerType: target,
      options: diOptions,
      registeredAt: new Date(),
      registeredWithDI: false
    };
    
    // Store enhanced metadata for auto-discovery
    Reflect.defineMetadata('di:command-handler', metadata, target);
    Reflect.defineMetadata('di:handler-type', 'command', target);
    
    // Phase 2: Auto-register with DI container if available and enabled
    // Note: Registration is deferred to avoid circular dependencies
    // Actual DI registration happens during VytchesDDD.discoverAndRegisterHandlers()
    if (diOptions.autoRegister !== false) {
      // Mark as pending DI registration for auto-discovery
      metadata.registeredWithDI = false; // Will be updated by auto-discovery
      Reflect.defineMetadata('di:registration-pending', true, target);
    }
    
    return target;
  };
}
