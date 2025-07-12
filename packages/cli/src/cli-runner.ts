import { Logger } from '@vytches-ddd/logging';

export class CLI {
  private logger = Logger.create('CLI');
  async run(args: string[]): Promise<void> {
    this.logger.info('🎯 VytchesDDD CLI');
    this.logger.info('Version: 0.1.0');

    const command = args[2];

    switch (command) {
      case 'generate':
      case 'g':
        await this.generateCode(args.slice(3));
        break;
      case 'help':
      case '--help':
      case '-h':
        this.showHelp();
        break;
      default:
        this.logger.warn('Unknown command:', { command });
        this.showHelp();
    }
  }

  private async generateCode(args: string[]): Promise<void> {
    this.logger.info('🔧 Code generation coming soon...');
    this.logger.debug('Args:', { args });
  }

  private showHelp(): void {
    this.logger.info(`
🎯 VytchesDDD CLI

Usage:
  vytches-ddd generate <type> <name>  Generate code templates
  vytches-ddd help                   Show this help

Examples:
  vytches-ddd generate value-object Email
  vytches-ddd generate entity User
  vytches-ddd generate aggregate Order
`);
  }
}
