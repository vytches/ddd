#!/usr/bin/env node

/**
 * @fileoverview Binary entry point for VytchesDDD CLI
 * This is the actual executable file
 */

async function runCLI(): Promise<void> {
  try {
    // Import the CLI main function
    const { main } = await import('./cli.js');

    // Execute CLI
    await main();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Execute CLI
runCLI();
