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

// Workflows
export { DomainBuilderWorkflow } from './workflows/domain-builder/domain-builder-workflow';
export { NaturalLanguageProcessor } from './workflows/domain-builder/natural-language-processor';
export { BoundedContextMapper } from './workflows/domain-builder/bounded-context-mapper';
export { PatternOrchestrator } from './workflows/domain-builder/pattern-orchestrator';
export { DomainAnalyzer } from './workflows/domain-builder/domain-analyzer';

// Types
export * from './types';

// Version
export const CLI_VERSION = '1.0.0';
