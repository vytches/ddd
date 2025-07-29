/**
 * Tests for ExampleEngine core functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  ExampleEngine,
  ExampleFile,
  ExtractedExample,
} from '../../src/examples-engine';

describe('ExampleEngine', () => {
  let engine: ExampleEngine;

  beforeEach(() => {
    engine = new ExampleEngine();
  });

  describe('formatOutput', () => {
    it('should format content for JSDoc output', () => {
      const content = 'const user = User.create(data);\nreturn user;';
      
      const [error, result] = safeRun(() => engine.formatOutput(content, 'jsdoc'));
      
      expect(error).toBeNull();
      expect(result).toContain('* @example');
      expect(result).toContain('* ```typescript');
      expect(result).toContain('* const user = User.create(data);');
      expect(result).toContain('* return user;');
      expect(result).toContain('* ```');
    });

    it('should format content for CLI output', () => {
      const content = 'const user = User.create(data);';
      
      const [error, result] = safeRun(() => engine.formatOutput(content, 'cli'));
      
      expect(error).toBeNull();
      expect(result).toBe('```typescript\nconst user = User.create(data);\n```');
    });

    it('should return original content for unknown output type', () => {
      const content = 'const user = User.create(data);';
      
      const [error, result] = safeRun(() => engine.formatOutput(content, 'unknown' as any));
      
      expect(error).toBeNull();
      expect(result).toBe(content);
    });
  });

  describe('extractTaggedContent', () => {
    it('should extract specific tagged content from file', async () => {
      const mockFile: ExampleFile = {
        filePath: '/test/example.md',
        packageName: 'test-package',
        complexity: 'basic',
        content: `
# Test Example

@extract: create:domain:basic
const userData = { name: 'John', email: 'john@example.com' };
const user = User.create(userData);
return user;
@extract-end

@extract: create:service:basic
const command = new CreateUserCommand(data);
const result = await this.userService.create(command);
return result;
@extract-end
        `,
        metadata: {
          title: 'Test Example',
          description: 'Test description',
          patterns: [],
          dependencies: [],
        },
      };

      const [error, result] = await safeRun(async () => 
        await engine.extractTaggedContent(mockFile, 'create:domain:basic')
      );

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result?.methodName).toBe('create');
      expect(result?.layer).toBe('domain');
      expect(result?.complexity).toBe('basic');
      expect(result?.content).toContain('const userData');
      expect(result?.content).toContain('User.create(userData)');
    });

    it('should return null for non-existent tag', async () => {
      const mockFile: ExampleFile = {
        filePath: '/test/example.md',
        packageName: 'test-package',
        complexity: 'basic',
        content: 'No tagged content here',
        metadata: {
          title: 'Test',
          description: 'Test',
          patterns: [],
          dependencies: [],
        },
      };

      const [error, result] = await safeRun(async () => 
        await engine.extractTaggedContent(mockFile, 'create:domain:basic')
      );

      expect(error).toBeNull();
      expect(result).toBeNull();
    });

    it('should throw error for invalid tag format', async () => {
      const mockFile: ExampleFile = {
        filePath: '/test/example.md',
        packageName: 'test-package',
        complexity: 'basic',
        content: 'test content',
        metadata: {
          title: 'Test',
          description: 'Test',
          patterns: [],
          dependencies: [],
        },
      };

      const [error] = await safeRun(async () => 
        await engine.extractTaggedContent(mockFile, 'invalid-tag')
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain('Invalid tag format');
    });
  });

  describe('getBestExampleForMethod', () => {
    it('should return best example based on preferences', async () => {
      // Mock the getExamplesForMethod to return test examples
      const mockExamples: ExtractedExample[] = [
        {
          methodName: 'create',
          layer: 'domain',
          complexity: 'basic',
          content: 'domain basic example',
          lineCount: 3,
          packageName: 'test-package',
        },
        {
          methodName: 'create',
          layer: 'service',
          complexity: 'basic',
          content: 'service basic example',
          lineCount: 5,
          packageName: 'test-package',
        },
        {
          methodName: 'create',
          layer: 'domain',
          complexity: 'advanced',
          content: 'domain advanced example',
          lineCount: 4,
          packageName: 'test-package',
        },
      ];

      // Mock the method
      const originalMethod = engine.getExamplesForMethod;
      engine.getExamplesForMethod = async () => mockExamples;

      const [error, result] = await safeRun(async () => 
        await engine.getBestExampleForMethod('create', 'test-package', 'domain', 'basic')
      );

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result?.layer).toBe('domain');
      expect(result?.complexity).toBe('basic');
      expect(result?.content).toBe('domain basic example');

      // Restore original method
      engine.getExamplesForMethod = originalMethod;
    });

    it('should return null when no examples found', async () => {
      // Mock empty result
      const originalMethod = engine.getExamplesForMethod;
      engine.getExamplesForMethod = async () => [];

      const [error, result] = await safeRun(async () => 
        await engine.getBestExampleForMethod('nonexistent', 'test-package')
      );

      expect(error).toBeNull();
      expect(result).toBeNull();

      // Restore original method
      engine.getExamplesForMethod = originalMethod;
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const [error, stats] = safeRun(() => engine.getCacheStats());
      
      expect(error).toBeNull();
      expect(stats).toBeDefined();
      expect(typeof stats?.size).toBe('number');
      expect(Array.isArray(stats?.keys)).toBe(true);
    });

    it('should clear cache successfully', () => {
      const [error] = safeRun(() => engine.clearCache());
      
      expect(error).toBeNull();
      
      const stats = engine.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});