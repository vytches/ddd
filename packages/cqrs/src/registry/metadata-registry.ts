/* eslint-disable @typescript-eslint/no-explicit-any */
export class CQRSMetadataRegistry {
  private static commandHandlers = new Map<any, any>();
  private static queryHandlers = new Map<any, any>();

  static registerCommandHandler(commandType: any, handlerType: any): void {
    this.commandHandlers.set(commandType, handlerType);
  }

  static registerQueryHandler(queryType: any, handlerType: any): void {
    this.queryHandlers.set(queryType, handlerType);
  }

  static getCommandHandlers(): Map<any, any> {
    return new Map(this.commandHandlers);
  }

  static getQueryHandlers(): Map<any, any> {
    return new Map(this.queryHandlers);
  }

  static getAllHandlers(): {
    commands: Map<any, any>;
    queries: Map<any, any>;
  } {
    return {
      commands: this.getCommandHandlers(),
      queries: this.getQueryHandlers(),
    };
  }

  // Testing helper
  static clearAll(): void {
    this.commandHandlers.clear();
    this.queryHandlers.clear();
  }
}
