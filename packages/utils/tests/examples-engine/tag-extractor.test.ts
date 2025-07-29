/**
 * Tests for TagExtractor functionality
 */

import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { TagExtractor } from '../../src/examples-engine/extractor/tag-extractor';

describe('TagExtractor', () => {
  let extractor: TagExtractor;

  beforeEach(() => {
    extractor = new TagExtractor();
  });

  describe('extractAllTags', () => {
    it('should extract multiple tagged sections', () => {
      const content = `
# Example File

@extract: create:domain:basic
const userData = { name: 'John' };
const user = User.create(userData);
return user;
@extract-end

@extract: create:service:basic
const command = new CreateUserCommand(data);
const result = await this.service.execute(command);
return result;
@extract-end

@extract: validate:domain:basic
const validation = user.validate();
return validation.isValid;
@extract-end
      `;

      const [error, examples] = safeRun(() => 
        extractor.extractAllTags(content, 'test-package')
      );

      expect(error).toBeNull();
      expect(examples).toHaveLength(3);
      
      // Check first example
      expect(examples?.[0].methodName).toBe('create');
      expect(examples?.[0].layer).toBe('domain');
      expect(examples?.[0].complexity).toBe('basic');
      expect(examples?.[0].content).toContain('User.create(userData)');
      
      // Check second example
      expect(examples?.[1].methodName).toBe('create');
      expect(examples?.[1].layer).toBe('service');
      expect(examples?.[1].complexity).toBe('basic');
      
      // Check third example
      expect(examples?.[2].methodName).toBe('validate');
      expect(examples?.[2].layer).toBe('domain');
      expect(examples?.[2].complexity).toBe('basic');
    });

    it('should handle empty content', () => {
      const [error, examples] = safeRun(() => 
        extractor.extractAllTags('', 'test-package')
      );

      expect(error).toBeNull();
      expect(examples).toHaveLength(0);
    });

    it('should handle content without tags', () => {
      const content = `
# Example File

Some regular content without any extraction tags.

\`\`\`typescript
const example = 'code';
\`\`\`
      `;

      const [error, examples] = safeRun(() => 
        extractor.extractAllTags(content, 'test-package')
      );

      expect(error).toBeNull();
      expect(examples).toHaveLength(0);
    });

    it('should skip markdown code fences', () => {
      const content = `
@extract: create:domain:basic
\`\`\`typescript
const user = User.create(data);
return user;
\`\`\`
@extract-end
      `;

      const [error, examples] = safeRun(() => 
        extractor.extractAllTags(content, 'test-package')
      );

      expect(error).toBeNull();
      expect(examples).toHaveLength(1);
      expect(examples?.[0].content).not.toContain('```typescript');
      expect(examples?.[0].content).not.toContain('```');
      expect(examples?.[0].content).toContain('const user = User.create(data)');
    });
  });

  describe('extractSpecificTag', () => {
    it('should extract specific tagged section', () => {
      const content = `
@extract: create:domain:basic
const user = User.create(data);
@extract-end

@extract: create:service:basic
const command = new CreateUserCommand();
@extract-end
      `;

      const [error, example] = safeRun(() => 
        extractor.extractSpecificTag(content, 'create', 'service', 'basic', 'test-package')
      );

      expect(error).toBeNull();
      expect(example).toBeDefined();
      expect(example?.methodName).toBe('create');
      expect(example?.layer).toBe('service');
      expect(example?.complexity).toBe('basic');
      expect(example?.content).toContain('CreateUserCommand');
    });

    it('should return null for non-existent tag', () => {
      const content = `
@extract: create:domain:basic
const user = User.create(data);
@extract-end
      `;

      const [error, example] = safeRun(() => 
        extractor.extractSpecificTag(content, 'update', 'service', 'basic', 'test-package')
      );

      expect(error).toBeNull();
      expect(example).toBeNull();
    });
  });

  describe('findAllTags', () => {
    it('should find all extraction tags without extracting content', () => {
      const content = `
@extract: create:domain:basic
Some content here
@extract-end

@extract: update:service:intermediate  
More content
@extract-end

@extract: delete:integration:advanced
Even more content
@extract-end
      `;

      const [error, tags] = safeRun(() => extractor.findAllTags(content));

      expect(error).toBeNull();
      expect(tags).toHaveLength(3);
      
      expect(tags?.[0].methodName).toBe('create');
      expect(tags?.[0].layer).toBe('domain');
      expect(tags?.[0].complexity).toBe('basic');
      
      expect(tags?.[1].methodName).toBe('update');
      expect(tags?.[1].layer).toBe('service');
      expect(tags?.[1].complexity).toBe('intermediate');
      
      expect(tags?.[2].methodName).toBe('delete');
      expect(tags?.[2].layer).toBe('integration');
      expect(tags?.[2].complexity).toBe('advanced');
    });
  });

  describe('validateTagFormat', () => {
    it('should validate correct tag formats', () => {
      const validTags = [
        '@extract: create:domain:basic',
        '@extract: updateProfile:service:intermediate',
        '@extract: deleteUser:integration:advanced',
      ];

      validTags.forEach(tag => {
        const [error, isValid] = safeRun(() => extractor.validateTagFormat(tag));
        expect(error).toBeNull();
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid tag formats', () => {
      const invalidTags = [
        '@extract: create',  // Missing parts
        '@extract: create:invalid:basic',  // Invalid layer
        '@extract: create:domain:invalid',  // Invalid complexity
        '@extract: 123create:domain:basic',  // Invalid method name
        'extract: create:domain:basic',  // Missing @
      ];

      invalidTags.forEach(tag => {
        const [error, isValid] = safeRun(() => extractor.validateTagFormat(tag));
        expect(error).toBeNull();
        expect(isValid).toBe(false);
      });
    });
  });

  describe('getTagStatistics', () => {
    it('should calculate tag statistics correctly', () => {
      const content = `
@extract: create:domain:basic
Content 1
@extract-end

@extract: create:service:basic
Content 2
@extract-end

@extract: update:domain:intermediate
Content 3
@extract-end

@extract: delete:integration:advanced
Content 4
@extract-end
      `;

      const [error, stats] = safeRun(() => extractor.getTagStatistics(content));

      expect(error).toBeNull();
      expect(stats).toBeDefined();
      expect(stats?.totalTags).toBe(4);
      
      // Check layer distribution
      expect(stats?.tagsByLayer.domain).toBe(2);
      expect(stats?.tagsByLayer.service).toBe(1);
      expect(stats?.tagsByLayer.integration).toBe(1);
      
      // Check complexity distribution
      expect(stats?.tagsByComplexity.basic).toBe(2);
      expect(stats?.tagsByComplexity.intermediate).toBe(1);
      expect(stats?.tagsByComplexity.advanced).toBe(1);
      
      // Check methods
      expect(stats?.methods).toContain('create');
      expect(stats?.methods).toContain('update');
      expect(stats?.methods).toContain('delete');
      expect(stats?.methods).toHaveLength(3);
    });

    it('should handle content with no tags', () => {
      const content = 'No tags here';

      const [error, stats] = safeRun(() => extractor.getTagStatistics(content));

      expect(error).toBeNull();
      expect(stats?.totalTags).toBe(0);
      expect(stats?.methods).toHaveLength(0);
    });
  });
});