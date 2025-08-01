/**
 * Integration tests for Examples Engine
 */

import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { ExampleEngine, TagExtractor, FileScanner } from '../../src/examples-engine';

describe('Examples Engine Integration', () => {
  describe('TagExtractor', () => {
    let extractor: TagExtractor;

    beforeEach(() => {
      extractor = new TagExtractor();
    });

    it('should extract basic tagged content', () => {
      const content = `
# Test Example

@extract: create:domain:basic
const userData = { name: 'John' };
const user = User.create(userData);
return user;
@extract-end
      `;

      const [error, examples] = safeRun(() => 
        extractor.extractAllTags(content, 'test-package')
      );

      expect(error).toBeUndefined();
      expect(examples).toBeDefined();
      expect(examples?.length).toBe(1);
      
      if (examples && examples[0]) {
        expect(examples[0].methodName).toBe('create');
        expect(examples[0].layer).toBe('domain');
        expect(examples[0].complexity).toBe('basic');
        expect(examples[0].content).toContain('User.create(userData)');
      }
    });
  });

  describe('ExampleEngine', () => {
    let engine: ExampleEngine;

    beforeEach(() => {
      engine = new ExampleEngine();
    });

    it('should format output for JSDoc', () => {
      const content = 'const user = User.create(data);\nreturn user;';
      
      const [error, result] = safeRun(() => engine.formatOutput(content, 'jsdoc'));
      
      expect(error).toBeUndefined();
      expect(result).toContain('* @example');
      expect(result).toContain('* ```typescript');
      expect(result).toContain('* const user = User.create(data);');
    });

    it('should format output for CLI', () => {
      const content = 'const user = User.create(data);';
      
      const [error, result] = safeRun(() => engine.formatOutput(content, 'cli'));
      
      expect(error).toBeUndefined();
      expect(result).toBe('```typescript\nconst user = User.create(data);\n```');
    });

    it('should manage cache correctly', () => {
      const [error, initialStats] = safeRun(() => engine.getCacheStats());
      expect(error).toBeUndefined();
      expect(initialStats?.size).toBe(0);

      engine.clearCache();
      
      const [clearError, clearedStats] = safeRun(() => engine.getCacheStats());
      expect(clearError).toBeUndefined();
      expect(clearedStats?.size).toBe(0);
    });
  });

  describe('FileScanner', () => {
    let scanner: FileScanner;

    beforeEach(() => {
      scanner = new FileScanner();
    });

    it('should extract metadata from content', () => {
      const content = `# Test Example

**Description**: This is a test example
**Patterns**: creation, validation
**Dependencies**: @vytches/ddd-core

## Description

This example shows how to create objects.`;

      const [error, metadata] = safeRun(() => scanner.extractMetadata(content));

      expect(error).toBeUndefined();
      expect(metadata).toBeDefined();
      expect(metadata?.title).toBe('Test Example');
      expect(metadata?.description).toBe('This is a test example');
      expect(metadata?.patterns).toContain('creation');
      expect(metadata?.patterns).toContain('validation');
      expect(metadata?.dependencies).toContain('@vytches/ddd-core');
    });
  });
});