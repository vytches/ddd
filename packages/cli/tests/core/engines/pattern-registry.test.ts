import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { PatternRegistry } from '../../../src/core/engines/pattern-registry';
import { CLIError } from '../../../src/types';

interface PatternDefinition {
  name: any;
  displayName: string;
  description: string;
  category: 'domain' | 'application' | 'infrastructure' | 'patterns';
  dependencies: any[];
  templates: string[];
  examples: string[];
  complexity: 'basic' | 'intermediate' | 'advanced';
  frameworks: string[];
}

describe('PatternRegistry', () => {
  let registry: PatternRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new PatternRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and factory', () => {
    it('should create instance and initialize built-in patterns', () => {
      expect(registry).toBeInstanceOf(PatternRegistry);

      // Verify that built-in patterns are loaded
      const allPatterns = registry.getAllPatterns();
      expect(allPatterns.length).toBeGreaterThan(0);
    });

    it('should create instance using static factory method', () => {
      const factoryRegistry = PatternRegistry.create();

      expect(factoryRegistry).toBeInstanceOf(PatternRegistry);
    });
  });

  describe('pattern retrieval', () => {
    it('should get pattern by type', () => {
      const [error, pattern] = safeRun(() => registry.getPattern('aggregate'));

      expect(error).toBeUndefined();
      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe('aggregate');
      expect(pattern?.displayName).toBe('Aggregate Root');
      expect(pattern?.category).toBe('domain');
    });

    it('should throw error for non-existent pattern', () => {
      const [patternError] = safeRun(() => registry.getPattern('non-existent' as any));

      expect(patternError).toBeInstanceOf(CLIError);
      expect(patternError?.message).toContain('Unknown pattern type: non-existent');
    });

    it('should get all patterns', () => {
      const allPatterns = registry.getAllPatterns();

      expect(allPatterns).toBeInstanceOf(Array);
      expect(allPatterns.length).toBeGreaterThan(10);

      // Check that key patterns are included
      const patternNames = allPatterns.map(p => p.name);
      expect(patternNames).toContain('aggregate');
      expect(patternNames).toContain('entity');
      expect(patternNames).toContain('value-object');
      expect(patternNames).toContain('command');
      expect(patternNames).toContain('query');
    });
  });

  describe('pattern filtering', () => {
    it('should get patterns by category', () => {
      const domainPatterns = registry.getPatternsByCategory('domain');
      const applicationPatterns = registry.getPatternsByCategory('application');
      const infrastructurePatterns = registry.getPatternsByCategory('infrastructure');

      expect(domainPatterns.length).toBeGreaterThan(0);
      expect(applicationPatterns.length).toBeGreaterThan(0);
      expect(infrastructurePatterns.length).toBeGreaterThan(0);

      // Verify all patterns in domain category are actually domain patterns
      domainPatterns.forEach(pattern => {
        expect(pattern.category).toBe('domain');
      });
    });

    it('should get patterns by complexity', () => {
      const basicPatterns = registry.getPatternsByComplexity('basic');
      const intermediatePatterns = registry.getPatternsByComplexity('intermediate');
      const advancedPatterns = registry.getPatternsByComplexity('advanced');

      expect(basicPatterns.length).toBeGreaterThan(0);
      expect(intermediatePatterns.length).toBeGreaterThan(0);
      expect(advancedPatterns.length).toBeGreaterThan(0);

      // Verify complexity filtering
      basicPatterns.forEach(pattern => {
        expect(pattern.complexity).toBe('basic');
      });
    });

    it('should get patterns by framework', () => {
      const nestjsPatterns = registry.getPatternsByFramework('nestjs');
      const standalonePatterns = registry.getPatternsByFramework('standalone');

      expect(nestjsPatterns.length).toBeGreaterThan(0);
      expect(standalonePatterns.length).toBeGreaterThan(0);

      // Verify framework filtering
      nestjsPatterns.forEach(pattern => {
        expect(pattern.frameworks).toContain('nestjs');
      });
    });
  });

  describe('pattern existence check', () => {
    it('should check if pattern exists', () => {
      expect(registry.hasPattern('aggregate')).toBe(true);
      expect(registry.hasPattern('entity')).toBe(true);
      expect(registry.hasPattern('non-existent' as any)).toBe(false);
    });
  });

  describe('custom pattern registration', () => {
    it('should register custom pattern', () => {
      const customPattern: PatternDefinition = {
        name: 'custom-pattern' as any,
        displayName: 'Custom Pattern',
        description: 'A custom test pattern',
        category: 'domain',
        dependencies: [],
        templates: ['custom.ts.template'],
        examples: ['CustomExample'],
        complexity: 'basic',
        frameworks: ['nestjs'],
      };

      const [error] = safeRun(() => registry.registerPattern(customPattern));

      expect(error).toBeUndefined();
      expect(registry.hasPattern('custom-pattern' as any)).toBe(true);

      const retrievedPattern = registry.getPattern('custom-pattern' as any);
      expect(retrievedPattern.displayName).toBe('Custom Pattern');
    });
  });

  describe('dependency management', () => {
    it('should get pattern dependencies', () => {
      const aggregateDeps = registry.getPatternDependencies('aggregate');

      expect(aggregateDeps).toContain('entity');
      expect(aggregateDeps).toContain('value-object');
    });

    it('should get all dependencies recursively', () => {
      const allDeps = registry.getAllDependencies('aggregate');

      expect(allDeps).toBeInstanceOf(Array);
      // Should include direct dependencies
      expect(allDeps).toContain('entity');
      expect(allDeps).toContain('value-object');
    });

    it('should check if pattern has dependencies', () => {
      expect(registry.hasDependencies('aggregate')).toBe(true);
      expect(registry.hasDependencies('value-object')).toBe(false);
    });
  });

  describe('pattern suggestions', () => {
    it('should suggest repository for aggregate', () => {
      const suggestions = registry.getSuggestions(['aggregate']);

      expect(suggestions).toContain('repository');
    });

    it('should suggest handler for command', () => {
      const suggestions = registry.getSuggestions(['command']);

      expect(suggestions).toContain('handler');
    });

    it('should suggest processor for event', () => {
      const suggestions = registry.getSuggestions(['event']);

      expect(suggestions).toContain('processor');
    });

    it('should suggest saga for aggregate and event combination', () => {
      const suggestions = registry.getSuggestions(['aggregate', 'event']);

      expect(suggestions).toContain('saga');
    });

    it('should suggest projection for event', () => {
      const suggestions = registry.getSuggestions(['event']);

      expect(suggestions).toContain('projection');
    });
  });

  describe('pattern validation', () => {
    it('should validate valid pattern combination', () => {
      const validation = registry.validatePatternCombination([
        'value-object',
        'entity',
        'aggregate',
      ]);

      expect(validation.isValid).toBe(true);
      expect(validation.missingDependencies).toHaveLength(0);
      expect(validation.conflicts).toHaveLength(0);
    });

    it('should detect missing dependencies', () => {
      const validation = registry.validatePatternCombination(['aggregate']);

      expect(validation.isValid).toBe(false);
      expect(validation.missingDependencies).toContain('entity');
      expect(validation.missingDependencies).toContain('value-object');
    });

    it('should handle patterns with no dependencies', () => {
      const validation = registry.validatePatternCombination(['value-object']);

      expect(validation.isValid).toBe(true);
      expect(validation.missingDependencies).toHaveLength(0);
    });
  });

  describe('documentation generation', () => {
    it('should generate pattern documentation', () => {
      const documentation = registry.generatePatternDocumentation('aggregate');

      expect(documentation).toContain('# Aggregate Root');
      expect(documentation).toContain('**Category**: domain');
      expect(documentation).toContain('**Complexity**: intermediate');
      expect(documentation).toContain('Domain aggregate that encapsulates business logic');
      expect(documentation).toContain('## Dependencies');
      expect(documentation).toContain('## Examples');
      expect(documentation).toContain('## Supported Frameworks');
    });

    it('should generate documentation for pattern with no dependencies', () => {
      const documentation = registry.generatePatternDocumentation('value-object');

      expect(documentation).toContain('# Value Object');
      expect(documentation).toContain('**Category**: domain');
      expect(documentation).toContain('**Complexity**: basic');
      expect(documentation).not.toContain('## Dependencies');
    });
  });

  describe('learning path', () => {
    it('should provide learning path', () => {
      const learningPath = registry.getLearningPath();

      expect(learningPath).toBeInstanceOf(Array);
      expect(learningPath.length).toBeGreaterThan(0);

      // Check that basic patterns come first
      const firstLevel = learningPath[0];
      expect(firstLevel).toContain('value-object');
      expect(firstLevel).toContain('entity');

      // Check that advanced patterns come later
      const lastLevel = learningPath[learningPath.length - 1];
      expect(lastLevel).toContain('saga');
      expect(lastLevel).toContain('projection');
    });

    it('should provide progressive complexity in learning path', () => {
      const learningPath = registry.getLearningPath();

      // Each level should be an array of pattern types
      learningPath.forEach(level => {
        expect(level).toBeInstanceOf(Array);
        expect(level.length).toBeGreaterThan(0);
      });
    });
  });

  describe('built-in patterns', () => {
    it('should have core domain patterns', () => {
      expect(registry.hasPattern('aggregate')).toBe(true);
      expect(registry.hasPattern('entity')).toBe(true);
      expect(registry.hasPattern('value-object')).toBe(true);
      expect(registry.hasPattern('specification')).toBe(true);
      expect(registry.hasPattern('policy')).toBe(true);
    });

    it('should have application patterns', () => {
      expect(registry.hasPattern('command')).toBe(true);
      expect(registry.hasPattern('query')).toBe(true);
      expect(registry.hasPattern('handler')).toBe(true);
      expect(registry.hasPattern('service')).toBe(true);
    });

    it('should have infrastructure patterns', () => {
      expect(registry.hasPattern('repository')).toBe(true);
      expect(registry.hasPattern('middleware')).toBe(true);
      expect(registry.hasPattern('processor')).toBe(true);
    });

    it('should have advanced patterns', () => {
      expect(registry.hasPattern('saga')).toBe(true);
      expect(registry.hasPattern('projection')).toBe(true);
      expect(registry.hasPattern('event')).toBe(true);
    });
  });
});
