#!/usr/bin/env node

/**
 * @fileoverview VytchesDDD CLI - Enterprise-Grade Domain Builder
 * Main library exports for programmatic usage
 */

// Core engines
export { CommandRegistry } from './core/engines/command-registry';
export { TemplateEngine } from './core/engines/template-engine';
export { WorkflowEngine } from './core/engines/workflow-engine';
export { ConfigManager } from './core/engines/config-manager';
export { StructureManager } from './core/engines/structure-manager';
export { PatternRegistry } from './core/engines/pattern-registry';

// Utilities
export { FileSystem } from './core/utils/file-system';
export { Prompts } from './core/utils/prompts';
export { Colors } from './core/utils/colors';
export { Validation } from './core/utils/validation';
export { Performance } from './core/utils/performance';

// Types
export * from './types';

// Version

/**
 * @llm-summary CLI_VERSION constant
 * @llm-domain Infrastructure
 *
 * @description
 * CLI_VERSION constant implementing infrastructure service for c l i_ v e r s i o n operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(CLI_VERSION);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const CLI_VERSION = '1.0.0';
