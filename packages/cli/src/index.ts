#!/usr/bin/env node

/**
 * @fileoverview VytchesDDD CLI - Enterprise-Grade Domain Builder
 * Main library exports for programmatic usage
 */

// Core utilities - preserved for JSDoc and Repomix functionality

// Utilities
export { Colors } from './core/utils/colors';
export { FileSystem } from './core/utils/file-system';
export { Performance } from './core/utils/performance';
export { Prompts } from './core/utils/prompts';

// Types
export * from './types';

// CLI Main
export { main } from './cli';

// Version

export const CLI_VERSION = '1.0.0-simplified';
