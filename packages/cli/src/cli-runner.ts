export class CLI {
  async run(args: string[]): Promise<void> {
    console.log('🎯 VytchesDDD CLI');
    console.log('Version: 0.1.0');

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
        console.log('Unknown command:', command);
        this.showHelp();
    }
  }

  private async generateCode(args: string[]): Promise<void> {
    console.log('🔧 Code generation coming soon...');
    console.log('Args:', args);
  }

  private showHelp(): void {
    console.log(`
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
