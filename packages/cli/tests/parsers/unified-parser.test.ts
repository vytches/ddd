import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { UnifiedExampleParser } from '../../src/parsers/unified-parser';
import { globalDocumentationRegistry } from '../../src/core/documentation-registry';
import type {
  EnhancedExampleDefinition,
  FrameworkComponentType,
  ParsedDocumentationSet,
} from '../../src/types/documentation-types';
import { promises as fs } from 'fs';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('../../src/core/documentation-registry', () => ({
  globalDocumentationRegistry: {
    findById: vi.fn(),
    getAvailableFrameworks: vi.fn(),
  },
}));

const mockFs = fs as any;
const mockRegistry = globalDocumentationRegistry as any;

describe('UnifiedExampleParser', () => {
  let parser: UnifiedExampleParser;
  let mockExample: EnhancedExampleDefinition;

  beforeEach(() => {
    vi.clearAllMocks();
    parser = new UnifiedExampleParser('/test/workspace');

    mockExample = {
      id: 'test-example',
      package: 'core',
      path: 'basic/test-example.md',
      file: 'test-example.md',
      name: 'Test Example',
      description: 'Test example description',
      complexity: 'basic',
      patterns: ['aggregate'],
      priority: 'medium',
      dependencies: [],
      tags: [],
      frameworkIntegrations: [
        {
          framework: 'nestjs',
          path: 'frameworks/nestjs/test-example.md',
          components: ['service', 'controller', 'module'],
        },
      ],
    };

    // Setup default registry mocks
    mockRegistry.findById.mockReturnValue(mockExample);
    mockRegistry.getAvailableFrameworks.mockReturnValue(['nestjs', 'express']);
  });

  describe('parseExample', () => {
    const sampleMarkdown = `
# Test Example

## Description
This is a test example description.

## Business Context
Business context explanation.

## Code Example
\`\`\`typescript
export class TestClass {
  constructor() {}
}
\`\`\`

## Supporting Types
\`\`\`typescript
interface TestInterface {
  id: string;
}
\`\`\`

## Usage Example
\`\`\`typescript
const test = new TestClass();
\`\`\`

## Test Example
\`\`\`typescript
describe('TestClass', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
\`\`\`

## Common Pitfalls
- Don't forget to initialize
- Always validate inputs
- Handle errors properly

## Migration Notes
No migration needed.
`;

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(sampleMarkdown);
    });

    it('should parse base example successfully', async () => {
      const resultUP = await safeRun(async (): Promise<ParsedDocumentationSet> => {
        return await parser.parseExample({ exampleId: 'test-example' });
      });
      const error = resultUP[0] as Error | undefined;
      const result = resultUP[1] as ParsedDocumentationSet | undefined;

      expect(error).toBeUndefined();
      expect(result).toBeDefined();
      expect(result?.base.metadata.id).toBe('test-example');
      expect(result?.base.content.description).toContain('test example description');
      expect(result?.base.content.businessContext).toContain('Business context explanation');
      expect(result?.base.content.codeExample).toContain('export class TestClass');
      expect(result?.base.content.supportingTypes).toContain('interface TestInterface');
      expect(result?.base.content.usageExample).toContain('const test = new TestClass()');
      expect(result?.base.content.testExample).toContain("describe('TestClass'");
      expect(result?.base.content.commonPitfalls).toEqual([
        "Don't forget to initialize",
        'Always validate inputs',
        'Handle errors properly',
      ]);
      expect(result?.base.content.migrationNotes).toContain('No migration needed');
    });

    it('should handle missing example', async () => {
      mockRegistry.findById.mockReturnValue(null);

      const resultUP2 = await safeRun(async (): Promise<ParsedDocumentationSet> => {
        return await parser.parseExample({ exampleId: 'non-existent' });
      });
      const error = resultUP2[0] as Error | undefined;

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("Example 'non-existent' not found");
    });

    it('should parse with framework integration', async () => {
      const frameworkMarkdown = `
# NestJS Integration

## Service Implementation
\`\`\`typescript
@Injectable()
export class TestService {
  async process(): Promise<void> {}
}
\`\`\`

## Controller Implementation
\`\`\`typescript
@Controller('test')
export class TestController {
  constructor(private service: TestService) {}
}
\`\`\`

## Module Configuration
\`\`\`typescript
@Module({
  providers: [TestService],
  controllers: [TestController],
})
export class TestModule {}
\`\`\`

## Configuration
\`\`\`typescript
export const config = {
  port: 3000
};
\`\`\`

## Installation
npm install @nestjs/core

## Error Handling
\`\`\`typescript
try {
  await service.process();
} catch (error) {
  // Handle error
}
\`\`\`

## Testing
\`\`\`typescript
describe('TestService', () => {
  it('should work', () => {
    expect(service).toBeDefined();
  });
});
\`\`\`

## Deployment
Deploy with PM2 or Docker.
`;

      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('frameworks/nestjs')) {
          return Promise.resolve(frameworkMarkdown);
        }
        return Promise.resolve(sampleMarkdown);
      });

      const resultUP = await safeRun(async (): Promise<ParsedDocumentationSet> => {
        return await parser.parseExample({
          exampleId: 'test-example',
          framework: 'nestjs',
        });
      });
      const error = resultUP[0] as Error | undefined;
      const result = resultUP[1] as ParsedDocumentationSet | undefined;

      expect(error).toBeUndefined();
      expect(result?.framework).toBeDefined();
      expect(result?.framework?.framework).toBe('nestjs');
      expect(result?.framework?.components.get('service')).toContain('@Injectable()');
      expect(result?.framework?.components.get('controller')).toContain("@Controller('test')");
      expect(result?.framework?.components.get('module')).toContain('@Module({');
      expect(result?.framework?.configuration).toContain('export const config');
      expect(result?.framework?.installation).toContain('npm install @nestjs/core');
      expect(result?.framework?.errorHandling).toContain('try {');
      expect(result?.framework?.testing).toContain("describe('TestService'");
      expect(result?.framework?.deployment).toContain('Deploy with PM2');
    });

    it('should handle unavailable framework', async () => {
      mockRegistry.getAvailableFrameworks.mockReturnValue(['express']);

      const resultUP2 = await safeRun(async (): Promise<ParsedDocumentationSet> => {
        return await parser.parseExample({
          exampleId: 'test-example',
          framework: 'nestjs',
        });
      });
      const error = resultUP2[0] as Error | undefined;

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("Framework 'nestjs' not available");
      expect(error?.message).toContain('Available: express');
    });

    it('should create merged documentation content', async () => {
      const resultUP = await safeRun(async (): Promise<ParsedDocumentationSet> => {
        return await parser.parseExample({ exampleId: 'test-example' });
      });
      const error = resultUP[0] as Error | undefined;
      const result = resultUP[1] as ParsedDocumentationSet | undefined;

      expect(error).toBeUndefined();
      expect(result?.merged).toBeDefined();
      expect(result?.merged.metadata.id).toBe('test-example');
      expect(result?.merged.baseContent).toBeDefined();
      expect(result?.merged.availableComponents).toEqual([]);
    });

    it('should merge framework content when available', async () => {
      const frameworkMarkdown = `
## Service Implementation
\`\`\`typescript
@Injectable()
export class TestService {}
\`\`\`
`;

      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('frameworks/nestjs')) {
          return Promise.resolve(frameworkMarkdown);
        }
        return Promise.resolve(sampleMarkdown);
      });

      const resultUP = await safeRun(async (): Promise<ParsedDocumentationSet> => {
        return await parser.parseExample({
          exampleId: 'test-example',
          framework: 'nestjs',
        });
      });
      const error = resultUP[0] as Error | undefined;
      const result = resultUP[1] as ParsedDocumentationSet | undefined;

      expect(error).toBeUndefined();
      expect(result?.merged.frameworkContent).toBeDefined();
      expect(result?.merged.availableComponents).toContain('service');
    });
  });

  describe('file reading errors', () => {
    it('should handle file reading errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const resultUP3 = await safeRun(async () => {
        return await parser.parseExample({ exampleId: 'test-example' });
      });
      const error = resultUP3[0] as Error | undefined;

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Failed to read file');
    });

    it('should handle framework integration file errors', async () => {
      // Base file succeeds
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('frameworks/nestjs')) {
          return Promise.reject(new Error('Framework file not found'));
        }
        return Promise.resolve('# Base Example\n## Description\nBase content');
      });

      const resultUP2 = await safeRun(async (): Promise<ParsedDocumentationSet> => {
        return await parser.parseExample({
          exampleId: 'test-example',
          framework: 'nestjs',
        });
      });
      const error = resultUP2[0] as Error | undefined;

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Failed to read file');
    });
  });

  describe('component extraction', () => {
    it('should extract components by file markers', () => {
      const codeWithMarkers = `
// user.service.ts
@Injectable()
export class UserService {
  async getUser(id: string): Promise<User> {
    return this.userRepository.findById(id);
  }
}

// user.controller.ts
@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get(':id')
  async getUser(@Param('id') id: string): Promise<User> {
    return this.userService.getUser(id);
  }
}

// user.module.ts
@Module({
  providers: [UserService],
  controllers: [UserController],
})
export class UserModule {}
`;

      const components = parser.extractComponentsByFileMarkers(codeWithMarkers);

      expect(components.size).toBe(3);
      expect(components.get('user.service.ts')).toContain('@Injectable()');
      expect(components.get('user.controller.ts')).toContain("@Controller('users')");
      expect(components.get('user.module.ts')).toContain('@Module({');
    });

    it('should handle empty component extraction', () => {
      const codeWithoutMarkers = `
export class TestClass {
  method() {}
}
`;

      const components = parser.extractComponentsByFileMarkers(codeWithoutMarkers);
      expect(components.size).toBe(0);
    });

    it('should handle malformed file markers', () => {
      const malformedCode = `
// incomplete marker
export class TestClass {}

//   user.service.ts
@Injectable()
export class UserService {}
`;

      const components = parser.extractComponentsByFileMarkers(malformedCode);
      expect(components.get('user.service.ts')).toContain('@Injectable()');
    });
  });

  describe('component filtering', () => {
    let mockComponents: Map<FrameworkComponentType, string>;

    beforeEach(() => {
      mockComponents = new Map([
        ['service', 'ServiceCode'],
        ['controller', 'ControllerCode'],
        ['repository', 'RepositoryCode'],
        ['dto', 'DTOCode'],
        ['module', 'ModuleCode'],
      ]);
    });

    it('should filter components with only option', () => {
      const filtered = parser.filterComponents(mockComponents, {
        only: ['service', 'controller'],
      });

      expect(filtered.size).toBe(2);
      expect(filtered.has('service')).toBe(true);
      expect(filtered.has('controller')).toBe(true);
      expect(filtered.has('repository')).toBe(false);
    });

    it('should filter components with exclude option', () => {
      const filtered = parser.filterComponents(mockComponents, {
        exclude: ['dto', 'module'],
      });

      expect(filtered.size).toBe(3);
      expect(filtered.has('service')).toBe(true);
      expect(filtered.has('controller')).toBe(true);
      expect(filtered.has('repository')).toBe(true);
      expect(filtered.has('dto')).toBe(false);
      expect(filtered.has('module')).toBe(false);
    });

    it('should handle both only and exclude filters', () => {
      const filtered = parser.filterComponents(mockComponents, {
        only: ['service', 'controller', 'dto'],
        exclude: ['dto'],
      });

      expect(filtered.size).toBe(2);
      expect(filtered.has('service')).toBe(true);
      expect(filtered.has('controller')).toBe(true);
      expect(filtered.has('dto')).toBe(false);
    });

    it('should return all components when no filters applied', () => {
      const filtered = parser.filterComponents(mockComponents, {});

      expect(filtered.size).toBe(5);
      expect(Array.from(filtered.keys())).toEqual([
        'service',
        'controller',
        'repository',
        'dto',
        'module',
      ]);
    });

    it('should handle empty only array', () => {
      const filtered = parser.filterComponents(mockComponents, {
        only: [],
      });

      expect(filtered.size).toBe(5);
    });
  });

  describe('path resolution', () => {
    it('should resolve paths correctly', async () => {
      const { package: _, ...exampleWithoutPackage } = mockExample;

      mockRegistry.findById.mockReturnValue(exampleWithoutPackage);

      const resultUP3 = await safeRun(async () => {
        return await parser.parseExample({ exampleId: 'test-example' });
      });
      const error = resultUP3[0] as Error | undefined;

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Package not specified');
    });

    it('should handle framework integration without metadata', async () => {
      const { frameworkIntegrations: _, ...exampleWithoutIntegrations } = mockExample;

      mockRegistry.findById.mockReturnValue(exampleWithoutIntegrations);
      mockFs.readFile.mockResolvedValue('# Base content');

      const resultUP2 = await safeRun(async (): Promise<ParsedDocumentationSet> => {
        return await parser.parseExample({
          exampleId: 'test-example',
          framework: 'nestjs',
        });
      });
      const error = resultUP2[0] as Error | undefined;

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("Framework integration for 'nestjs' not found");
    });
  });

  describe('markdown parsing edge cases', () => {
    it('should handle missing sections gracefully', async () => {
      const incompleteMarkdown = `
# Test Example

## Description
Only description available.
`;

      mockFs.readFile.mockResolvedValue(incompleteMarkdown);

      const resultUP = await safeRun(async (): Promise<ParsedDocumentationSet> => {
        return await parser.parseExample({ exampleId: 'test-example' });
      });
      const error = resultUP[0] as Error | undefined;
      const result = resultUP[1] as ParsedDocumentationSet | undefined;

      expect(error).toBeUndefined();
      expect(result?.base.content.description).toContain('Only description available');
      expect(result?.base.content.businessContext).toBe('');
      expect(result?.base.content.codeExample).toBe('');
      expect(result?.base.content.commonPitfalls).toEqual([]);
    });

    it('should handle code blocks without language specification', async () => {
      const markdownWithPlainCode = `
# Test Example

## Description
Test example.

## Code Example
\`\`\`
export class TestClass {
  method() {}
}
\`\`\`
`;

      mockFs.readFile.mockResolvedValue(markdownWithPlainCode);

      const resultUP = await safeRun(async (): Promise<ParsedDocumentationSet> => {
        return await parser.parseExample({ exampleId: 'test-example' });
      });
      const error = resultUP[0] as Error | undefined;
      const result = resultUP[1] as ParsedDocumentationSet | undefined;

      expect(error).toBeUndefined();
      expect(result?.base.content.codeExample).toContain('export class TestClass');
    });

    it('should handle nested markdown structures', async () => {
      const nestedMarkdown = `
# Test Example

## Description
Main description.

### Sub-description
This should not be extracted.

## Business Context
Context with nested content.

### Implementation Details
These details should be part of business context.

## Code Example
\`\`\`typescript
// This should be extracted
export class Test {}
\`\`\`
`;

      mockFs.readFile.mockResolvedValue(nestedMarkdown);

      const resultUP = await safeRun(async (): Promise<ParsedDocumentationSet> => {
        return await parser.parseExample({ exampleId: 'test-example' });
      });
      const error = resultUP[0] as Error | undefined;
      const result = resultUP[1] as ParsedDocumentationSet | undefined;

      expect(error).toBeUndefined();
      expect(result?.base.content.description).toContain('Main description');
      expect(result?.base.content.businessContext).toContain('Context with nested content');
      expect(result?.base.content.businessContext).toContain('Implementation Details');
      expect(result?.base.content.codeExample).toContain('export class Test {}');
    });
  });

  describe('constructor with custom workspace', () => {
    it('should accept custom workspace root', () => {
      const customParser = new UnifiedExampleParser('/custom/workspace');
      expect(customParser).toBeInstanceOf(UnifiedExampleParser);
    });

    it('should use process.cwd() as default workspace', () => {
      const defaultParser = new UnifiedExampleParser();
      expect(defaultParser).toBeInstanceOf(UnifiedExampleParser);
    });
  });
});
