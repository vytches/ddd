import { describe, it, expect } from 'vitest';

import { discoverExamples } from '../src/scanner.js';
import { buildExampleFiles, buildMatrix, buildTestedByMap, correlate } from '../src/matrix.js';
import type { ExpectedCombination } from '../src/types.js';
import { makeTempRepo, writePackageJson, writeSrcFile, writeTestFile } from './test-helpers.js';

describe('buildMatrix — classification (Correlate phase)', () => {
  it('(a) classifies a manifest entry as VERIFIED when the file exists, imports multiple @vytches packages, AND a test file imports it', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'combo', '@vytches/examples-combo');
      writeSrcFile(
        examplesRoot,
        'combo',
        'order.aggregate.ts',
        `
          import { AggregateRoot } from '@vytches/ddd-aggregates';
          import { Specification } from '@vytches/ddd-validation';
          export class Order extends AggregateRoot {}
        `
      );
      writeTestFile(
        examplesRoot,
        'combo',
        'order.aggregate.test.ts',
        `
          import { describe, it } from 'vitest';
          import { Order } from '../src/order.aggregate';
          describe('Order', () => { it('works', () => {}); });
        `
      );

      const manifest: ExpectedCombination[] = [
        {
          name: 'aggregate-plus-specification',
          level: 'quick-start',
          packages: ['@vytches/ddd-aggregates', '@vytches/ddd-validation'],
          file: 'examples/combo/src/order.aggregate.ts',
        },
      ];

      const discovered = discoverExamples(examplesRoot);
      const matrix = buildMatrix(discovered, root, manifest);

      expect(matrix.cells).toHaveLength(1);
      expect(matrix.cells[0].status).toBe('VERIFIED');
      expect(matrix.cells[0].file).toBe('examples/combo/src/order.aggregate.ts');
      expect(matrix.cells[0].testedBy).toEqual(['examples/combo/tests/order.aggregate.test.ts']);
      expect(matrix.cells[0].packages).toEqual([
        '@vytches/ddd-aggregates',
        '@vytches/ddd-validation',
      ]);
    } finally {
      cleanup();
    }
  });

  it('(b) classifies a manifest entry as EXAMPLE_ONLY when the file exists but no test file imports it', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'untested', '@vytches/examples-untested');
      writeSrcFile(
        examplesRoot,
        'untested',
        'service.ts',
        `
          import { DomainService } from '@vytches/ddd-domain-services';
          export class MyService extends DomainService {}
        `
      );
      // A test file exists but does NOT import the src file above.
      writeTestFile(
        examplesRoot,
        'untested',
        'unrelated.test.ts',
        `
          import { describe, it } from 'vitest';
          describe('unrelated', () => { it('does not test service.ts', () => {}); });
        `
      );

      const manifest: ExpectedCombination[] = [
        {
          name: 'domain-service-unit-of-work-aware',
          level: 'quick-start',
          packages: ['@vytches/ddd-domain-services'],
          file: 'examples/untested/src/service.ts',
        },
      ];

      const discovered = discoverExamples(examplesRoot);
      const matrix = buildMatrix(discovered, root, manifest);

      expect(matrix.cells).toHaveLength(1);
      expect(matrix.cells[0].status).toBe('EXAMPLE_ONLY');
      expect(matrix.cells[0].file).toBe('examples/untested/src/service.ts');
      expect(matrix.cells[0].testedBy).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('(c) classifies a manifest entry with file: null as DECLARED_MISSING', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      // No matching file exists on disk at all — examples/ can even be empty.
      const manifest: ExpectedCombination[] = [
        {
          name: 'cqrs-plus-resilience-decorator',
          level: 'advanced',
          packages: ['@vytches/ddd-cqrs', '@vytches/ddd-resilience'],
          file: null,
        },
      ];

      const discovered = discoverExamples(examplesRoot);
      const matrix = buildMatrix(discovered, root, manifest);

      expect(matrix.cells).toHaveLength(1);
      expect(matrix.cells[0].status).toBe('DECLARED_MISSING');
      expect(matrix.cells[0].file).toBeNull();
      expect(matrix.cells[0].testedBy).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('(c-bis) classifies as DECLARED_MISSING when the declared "file" path does not exist on disk', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'combo', '@vytches/examples-combo');
      // Note: no src file is actually written at this path.

      const manifest: ExpectedCombination[] = [
        {
          name: 'ghost-combination',
          level: 'intermediate',
          packages: ['@vytches/ddd-cqrs'],
          file: 'examples/combo/src/does-not-exist.ts',
        },
      ];

      const discovered = discoverExamples(examplesRoot);
      const matrix = buildMatrix(discovered, root, manifest);

      expect(matrix.cells[0].status).toBe('DECLARED_MISSING');
      expect(matrix.cells[0].file).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('(d) fully-matched file+test still classifies as VERIFIED end-to-end via buildMatrix', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'policies', '@vytches/examples-policies');
      writeSrcFile(
        examplesRoot,
        'policies',
        '02-reusable-specification.ts',
        `
          import { Specification } from '@vytches/ddd-validation';
          import { PolicyBuilder } from '@vytches/ddd-policies';
          export class MinimumAgeSpecification extends Specification<number> {}
        `
      );
      writeTestFile(
        examplesRoot,
        'policies',
        '02-reusable-specification.test.ts',
        `
          import { describe, it } from 'vitest';
          import { MinimumAgeSpecification } from '../src/02-reusable-specification';
          describe('MinimumAgeSpecification', () => { it('works', () => {}); });
        `
      );

      const manifest: ExpectedCombination[] = [
        {
          name: 'policy-plus-specification',
          level: 'quick-start',
          packages: ['@vytches/ddd-policies', '@vytches/ddd-validation'],
          file: 'examples/policies/src/02-reusable-specification.ts',
        },
      ];

      const discovered = discoverExamples(examplesRoot);
      const matrix = buildMatrix(discovered, root, manifest);

      expect(matrix.cells[0].status).toBe('VERIFIED');
      expect(matrix.cells[0].testedBy).toEqual([
        'examples/policies/tests/02-reusable-specification.test.ts',
      ]);
      expect(matrix.generatedAt).toEqual(expect.any(String));
      expect(() => new Date(matrix.generatedAt).toISOString()).not.toThrow();
    } finally {
      cleanup();
    }
  });
});

describe('buildExampleFiles — transitive @vytches package resolution', () => {
  it('unions packages transitively imported via same-example relative imports', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'quickstart', '@vytches/examples-quickstart');
      writeSrcFile(
        examplesRoot,
        'quickstart',
        'money.ts',
        `import { ValueObject } from '@vytches/ddd-value-objects'; export class Money extends ValueObject {}`
      );
      writeSrcFile(
        examplesRoot,
        'quickstart',
        'order.aggregate.ts',
        `
          import { AggregateRoot } from '@vytches/ddd-aggregates';
          import { Money } from './money';
          export class Order extends AggregateRoot {}
        `
      );

      const discovered = discoverExamples(examplesRoot);
      const files = buildExampleFiles(discovered, root);

      const order = files.find(f => f.path === 'examples/quickstart/src/order.aggregate.ts');
      expect(order?.packages).toEqual(['@vytches/ddd-aggregates', '@vytches/ddd-value-objects']);

      const money = files.find(f => f.path === 'examples/quickstart/src/money.ts');
      expect(money?.packages).toEqual(['@vytches/ddd-value-objects']);
    } finally {
      cleanup();
    }
  });
});

describe('buildTestedByMap', () => {
  it('maps a src file to every test file that directly imports it (direct match only)', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'foo', '@vytches/examples-foo');
      writeSrcFile(examplesRoot, 'foo', 'a.ts', `export const a = 1;`);
      writeSrcFile(examplesRoot, 'foo', 'b.ts', `import { a } from './a'; export const b = a + 1;`);
      writeTestFile(
        examplesRoot,
        'foo',
        'a.test.ts',
        `import { a } from '../src/a'; export const t = a;`
      );

      const discovered = discoverExamples(examplesRoot);
      const testedBy = buildTestedByMap(discovered, root);

      expect(testedBy.get('examples/foo/src/a.ts')).toEqual(['examples/foo/tests/a.test.ts']);
      // b.ts is imported by a.ts (relative, same-example) but NOT directly by
      // any test file — transitive coverage through a sibling does not count.
      expect(testedBy.get('examples/foo/src/b.ts')).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});

describe('correlate — undeclared combinations (D-7 soft-fail signal)', () => {
  it('surfaces a discovered multi-package file that matches no manifest entry as undeclared', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'foo', '@vytches/examples-foo');
      writeSrcFile(
        examplesRoot,
        'foo',
        'surprise.ts',
        `
          import { AggregateRoot } from '@vytches/ddd-aggregates';
          import { EventBus } from '@vytches/ddd-events';
          export class Surprise extends AggregateRoot {}
        `
      );

      const discovered = discoverExamples(examplesRoot);
      const exampleFiles = buildExampleFiles(discovered, root);
      const testedBy = buildTestedByMap(discovered, root);
      const { cells, undeclared } = correlate([], exampleFiles, testedBy);

      expect(cells).toEqual([]);
      expect(undeclared).toHaveLength(1);
      expect(undeclared[0].file).toBe('examples/foo/src/surprise.ts');
      expect(undeclared[0].packages).toEqual(['@vytches/ddd-aggregates', '@vytches/ddd-events']);
      expect(undeclared[0].status).toBe('EXAMPLE_ONLY');
    } finally {
      cleanup();
    }
  });

  it('does not surface single-package files as undeclared combinations', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'foo', '@vytches/examples-foo');
      writeSrcFile(
        examplesRoot,
        'foo',
        'single.ts',
        `import { AggregateRoot } from '@vytches/ddd-aggregates'; export class X extends AggregateRoot {}`
      );

      const discovered = discoverExamples(examplesRoot);
      const exampleFiles = buildExampleFiles(discovered, root);
      const testedBy = buildTestedByMap(discovered, root);
      const { undeclared } = correlate([], exampleFiles, testedBy);

      expect(undeclared).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('does not surface a manifest-declared file as undeclared even if it combines 2+ packages', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'foo', '@vytches/examples-foo');
      writeSrcFile(
        examplesRoot,
        'foo',
        'declared.ts',
        `
          import { AggregateRoot } from '@vytches/ddd-aggregates';
          import { EventBus } from '@vytches/ddd-events';
          export class Declared extends AggregateRoot {}
        `
      );

      const manifest: ExpectedCombination[] = [
        {
          name: 'declared-combo',
          level: 'quick-start',
          packages: ['@vytches/ddd-aggregates', '@vytches/ddd-events'],
          file: 'examples/foo/src/declared.ts',
        },
      ];

      const discovered = discoverExamples(examplesRoot);
      const exampleFiles = buildExampleFiles(discovered, root);
      const testedBy = buildTestedByMap(discovered, root);
      const { undeclared } = correlate(manifest, exampleFiles, testedBy);

      expect(undeclared).toEqual([]);
    } finally {
      cleanup();
    }
  });
});
