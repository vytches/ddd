import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ContentResolver } from '../../src/core/content-resolver';

// Mock fs module
vi.mock('fs');

describe('ContentResolver', () => {
  const mockFs: any = fs;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('');
    mockFs.readdirSync.mockReturnValue([]); // Ensure readdirSync always returns an array
  });

  describe('resolveContent', () => {
    it('should resolve exact path when file exists', () => {
      const packageName = 'test-package';
      const requestedPath = 'basic/example.md';
      const expectedContent = '# Example Content';
      const fullPath = path.join(process.cwd(), 'packages', packageName, 'src', 'examples', requestedPath);

      mockFs.existsSync.mockImplementation((path: string) => path === fullPath);
      mockFs.readFileSync.mockReturnValue(expectedContent);

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toBe(expectedContent);
      expect(mockFs.existsSync).toHaveBeenCalledWith(fullPath);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(fullPath, 'utf-8');
    });

    it('should try alternative paths when exact path not found', () => {
      const packageName = 'test-package';
      const requestedPath = 'basic/example.md';
      const altPath = path.join(process.cwd(), 'packages', packageName, 'examples', requestedPath);
      const expectedContent = '# Alternative Path Content';

      mockFs.existsSync.mockImplementation((path: string) => path === altPath);
      mockFs.readFileSync.mockReturnValue(expectedContent);

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toBe(expectedContent);
      expect(mockFs.existsSync).toHaveBeenCalledWith(altPath);
    });

    it('should only read .md files', () => {
      const packageName = 'test-package';
      const requestedPath = 'basic/example.js';

      mockFs.existsSync.mockReturnValue(true);

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      // Non-.md files should return placeholder content, not "Content not found"
      expect(content).toContain('Placeholder content');
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });
  });

  describe('mapped paths', () => {
    it('should resolve mapped paths for basic implementation', () => {
      const packageName = 'test-package';
      const requestedPath = 'basic/implementation.md';
      const mappedPath = 'basic/basic-example.md';
      const expectedContent = '# Basic Example';
      const fullPath = path.join(process.cwd(), 'packages', packageName, 'src', 'examples', mappedPath);

      mockFs.existsSync.mockImplementation((path: string) => path === fullPath);
      mockFs.readFileSync.mockReturnValue(expectedContent);

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toBe(expectedContent);
    });

    it('should try multiple mapped paths in order', () => {
      const packageName = 'test-package';
      const requestedPath = 'intermediate/use-case.md';
      const mappedPath = 'intermediate/usage.md';
      const expectedContent = '# Usage Example';
      const fullPath = path.join(process.cwd(), 'packages', packageName, 'src', 'examples', mappedPath);

      mockFs.existsSync.mockImplementation((path: string) => path === fullPath);
      mockFs.readFileSync.mockReturnValue(expectedContent);

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toBe(expectedContent);
    });
  });

  describe('pattern fallback', () => {
    it('should generate pattern content for patterns/error-handling.md', () => {
      const packageName = 'domain-services';
      const requestedPath = 'patterns/error-handling.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('Error Handling Pattern');
      expect(content).toContain('BaseDomainService');
      expect(content).toContain('Result.failure');
      expect(content).toContain('DomainError');
    });

    it('should generate pattern content for patterns/testing.md', () => {
      const packageName = 'acl';
      const requestedPath = 'patterns/testing.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('Testing Pattern');
      expect(content).toContain('BaseACL');
      expect(content).toContain('safeRun');
      expect(content).toContain('vitest');
    });

    it('should generate pattern content for patterns/imports.md', () => {
      const packageName = 'policies';
      const requestedPath = 'patterns/imports.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('Import Pattern');
      expect(content).toContain('PolicyBuilder');
      expect(content).toContain('@vytches-ddd/policies');
    });

    it('should fallback to any file in complexity directory', () => {
      const packageName = 'test-package';
      const requestedPath = 'intermediate/nonexistent.md';
      const existingFile = 'example.md';
      const expectedContent = '# Intermediate Example';
      const dirPath = path.join(process.cwd(), 'packages', packageName, 'src', 'examples', 'intermediate');

      mockFs.existsSync.mockImplementation((path: string) =>
        path === dirPath
      );
      // Ensure readdirSync returns an array with the existing file
      mockFs.readdirSync.mockReturnValue([existingFile, 'other-file.txt']); // Test .md filtering
      mockFs.readFileSync.mockReturnValue(expectedContent);

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toBe(expectedContent);
      expect(mockFs.readdirSync).toHaveBeenCalledWith(dirPath);
    });
  });

  describe('generated content', () => {
    it('should generate package description for shared/description.md', () => {
      const packageName = 'domain-services';
      const requestedPath = 'shared/description.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('Domain Services provide orchestration');
      expect(content).toContain('Key Features');
      expect(content).toContain('Business Operation Orchestration');
    });

    it('should generate hero section for shared/hero.md', () => {
      const packageName = 'di';
      const requestedPath = 'shared/hero.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('Enterprise Dependency Injection');
      expect(content).toContain('Perfect for');
      expect(content).toContain('Key benefit');
    });

    it('should generate when-to-use section for shared/when-to-use.md', () => {
      const packageName = 'domain-services';
      const requestedPath = 'shared/when-to-use.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('When to Use Domain Services');
      expect(content).toContain('Perfect Scenarios');
      expect(content).toContain('Multi-Aggregate Operations');
    });

    it('should generate when-not-to-use section for shared/when-not-to-use.md', () => {
      const packageName = 'di';
      const requestedPath = 'shared/when-not-to-use.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('When NOT to Use Dependency Injection');
      expect(content).toContain('Simple Applications');
      expect(content).toContain('Alternative Approaches');
    });

    it('should generate common pitfalls section for shared/common-pitfalls.md', () => {
      const packageName = 'domain-services';
      const requestedPath = 'shared/common-pitfalls.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('Common Pitfalls');
      expect(content).toContain('Anemic Domain Models');
      expect(content).toContain('God Services');
    });

    it('should generate troubleshooting section for shared/troubleshooting.md', () => {
      const packageName = 'di';
      const requestedPath = 'shared/troubleshooting.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('Troubleshooting');
      expect(content).toContain('Service Not Found');
      expect(content).toContain('Circular Dependencies');
    });

    it('should generate performance section for shared/performance.md', () => {
      const packageName = 'domain-services';
      const requestedPath = 'shared/performance.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('Performance Considerations');
      expect(content).toContain('Optimization Strategies');
      expect(content).toContain('Performance Metrics');
    });

    it('should generate default description for unknown package', () => {
      const packageName = 'unknown-package';
      const requestedPath = 'shared/description.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('unknown-package package provides essential functionality');
      expect(content).toContain('DDD Patterns');
    });

    it('should generate default hero section for unknown package', () => {
      const packageName = 'new-package';
      const requestedPath = 'shared/hero.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('New-package');
      expect(content).toContain('Enterprise-grade new-package implementation');
    });

    it('should generate default sections for unknown package', () => {
      const packageName = 'test-package';
      const requestedPath = 'shared/when-to-use.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('When to Use test-package');
      expect(content).toContain('Production applications');
    });
  });

  describe('getMainExport', () => {
    it('should return correct main export for known packages', () => {
      const packages = {
        'domain-services': 'BaseDomainService',
        'acl': 'BaseACL',
        'policies': 'PolicyBuilder',
        'resilience': 'ResiliencePolicy',
        'messaging': 'MessageBus',
        'events': 'UnifiedEventBus',
        'cqrs': 'CommandBus',
        'projections': 'ProjectionEngine',
        'validation': 'ValidationFacade',
        'aggregates': 'AggregateRoot',
        'repositories': 'BaseRepository',
        'di': 'VytchesDDD'
      };

      // Note: getMainExport is private, so we test it indirectly through generated content
      for (const [packageName, expectedExport] of Object.entries(packages)) {
        const content = ContentResolver.resolveContent(packageName, 'patterns/imports.md');
        expect(content).toContain(`import { ${expectedExport} }`);
      }
    });

    it('should generate default export name for unknown package', () => {
      const packageName = 'custom-package';
      const content = ContentResolver.resolveContent(packageName, 'patterns/imports.md');

      expect(content).toContain('import { BaseCustom-package }');
    });
  });

  describe('default content fallback', () => {
    it('should provide implementation placeholder when no content found', () => {
      const packageName = 'test-package';
      const requestedPath = 'advanced/implementation.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('// Implementation example');
      expect(content).toContain('placeholder');
      expect(content).toContain('BaseTest-package');
    });

    it('should provide use-case placeholder when no content found', () => {
      const packageName = 'test-package';
      const requestedPath = 'basic/use-case.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('Use Case Example');
      expect(content).toContain('shows how to use');
      expect(content).toContain('BaseTest-package');
    });

    it('should provide generic placeholder for other paths', () => {
      const packageName = 'test-package';
      const requestedPath = 'some/random/path.md';

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      expect(content).toContain('Placeholder content');
      expect(content).toContain(requestedPath);
    });

    it('should return default content when all file strategies fail', () => {
      const packageName = 'test-package';
      const requestedPath = 'random/path.md'; // .md file but doesn't exist

      // Mock all files as not existing
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readdirSync.mockReturnValue([]);

      const content = ContentResolver.resolveContent(packageName, requestedPath);

      // Should get default placeholder content since getDefaultContent always returns a string
      expect(content).toContain('Placeholder content');
      expect(content).toContain(requestedPath);
    });
  });

  describe('strategy order', () => {
    it('should try strategies in correct order', () => {
      const packageName = 'test-package';
      const requestedPath = 'basic/implementation.md';
      const callPaths: string[] = [];

      // Mock to track which paths are checked
      mockFs.existsSync.mockImplementation((path: string) => {
        callPaths.push(path);
        return false; // All paths fail to force trying all strategies
      });

      mockFs.readdirSync.mockReturnValue([]); // No files in directories

      ContentResolver.resolveContent(packageName, requestedPath);

      // Should try exact paths first
      expect(callPaths.some(p => p.includes('src/examples/basic/implementation.md'))).toBe(true);
      expect(callPaths.some(p => p.includes('examples/basic/implementation.md'))).toBe(true);
      
      // Should also try mapped paths (basic-example.md, example-1.md)
      const hasMappedPaths = callPaths.some(p => p.includes('basic-example.md') || p.includes('example-1.md'));
      expect(hasMappedPaths).toBe(true);
    });
  });
});
