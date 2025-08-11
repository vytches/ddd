#!/usr/bin/env node

/**
 * @fileoverview VytchesDDD CLI - Enterprise-Grade Domain Builder
 * Main library exports for programmatic usage
 */

// Core engines
export { CommandRegistry } from './core/engines/command-registry';
export { ConfigManager } from './core/engines/config-manager';
export { PatternRegistry } from './core/engines/pattern-registry';
export { StructureManager } from './core/engines/structure-manager';
export { TemplateEngine } from './core/engines/template-engine';
export { WorkflowEngine } from './core/engines/workflow-engine';

// Utilities
export { Colors } from './core/utils/colors';
export { FileSystem } from './core/utils/file-system';
export { Performance } from './core/utils/performance';
export { Prompts } from './core/utils/prompts';
export { Validation } from './core/utils/validation';

// Types
export * from './types';

// CLI Main
export { main } from './cli';

// Version

export const CLI_VERSION = '1.0.0';
