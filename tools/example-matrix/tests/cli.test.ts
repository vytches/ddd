import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { checkMatrix, resolveDefaultPaths, runGenerate, type CliPaths } from '../src/cli.js';
import {
  makeTempRepo,
  writeManifest,
  writePackageJson,
  writeSrcFile,
  writeTestFile,
} from './test-helpers.js';

function pathsFor(root: string): CliPaths {
  const defaults = resolveDefaultPaths(root);
  return {
    ...defaults,
    manifestPath: join(root, 'expected-combinations.yaml'),
  };
}

describe('resolveDefaultPaths', () => {
  it('derives the real repo layout from a root', () => {
    const paths = resolveDefaultPaths('/repo');
    expect(paths.examplesRoot).toBe(join('/repo', 'examples'));
    expect(paths.manifestPath).toBe(
      join('/repo', 'tools/example-matrix/expected-combinations.yaml')
    );
    expect(paths.jsonPath).toBe(join('/repo', 'docs/coverage-matrix.json'));
    expect(paths.mdPath).toBe(join('/repo', 'docs/COVERAGE-MATRIX.md'));
  });
});

describe('checkMatrix — --check mode', () => {
  it('exits ok (0) on a clean/consistent fixture: one VERIFIED cell, docs freshly generated', () => {
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

      const paths = pathsFor(root);
      writeManifest(
        paths.manifestPath,
        `
combinations:
  - name: aggregate-plus-specification
    level: quick-start
    packages:
      - '@vytches/ddd-aggregates'
      - '@vytches/ddd-validation'
    file: examples/combo/src/order.aggregate.ts
`
      );

      runGenerate(paths);
      const report = checkMatrix(paths);

      expect(report.hardFailures).toEqual([]);
      expect(report.ok).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('exits non-zero (ok: false) when a manifest cell is EXAMPLE_ONLY', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'combo', '@vytches/examples-combo');
      writeSrcFile(
        examplesRoot,
        'combo',
        'service.ts',
        `
          import { DomainService } from '@vytches/ddd-domain-services';
          export class MyService extends DomainService {}
        `
      );
      // No test file imports service.ts.
      writeTestFile(
        examplesRoot,
        'combo',
        'unrelated.test.ts',
        `import { describe, it } from 'vitest'; describe('unrelated', () => { it('noop', () => {}); });`
      );

      const paths = pathsFor(root);
      writeManifest(
        paths.manifestPath,
        `
combinations:
  - name: domain-service-unit-of-work-aware
    level: quick-start
    packages:
      - '@vytches/ddd-domain-services'
    file: examples/combo/src/service.ts
`
      );

      runGenerate(paths);
      const report = checkMatrix(paths);

      expect(report.ok).toBe(false);
      expect(report.hardFailures.some(f => f.startsWith('(a)'))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('exits non-zero (ok: false) when a manifest entry is DECLARED_MISSING', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      const paths = pathsFor(root);
      writeManifest(
        paths.manifestPath,
        `
combinations:
  - name: cqrs-plus-resilience-decorator
    level: advanced
    packages:
      - '@vytches/ddd-cqrs'
      - '@vytches/ddd-resilience'
    file: null
`
      );

      runGenerate(paths);
      const report = checkMatrix(paths);

      expect(report.ok).toBe(false);
      expect(report.hardFailures.some(f => f.startsWith('(b)'))).toBe(true);
      void examplesRoot;
    } finally {
      cleanup();
    }
  });

  it('exits non-zero (ok: false) when committed docs are stale relative to current repo state', () => {
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

      const paths = pathsFor(root);
      writeManifest(
        paths.manifestPath,
        `
combinations:
  - name: aggregate-plus-specification
    level: quick-start
    packages:
      - '@vytches/ddd-aggregates'
      - '@vytches/ddd-validation'
    file: examples/combo/src/order.aggregate.ts
`
      );

      runGenerate(paths);

      // Repo state changes AFTER docs were generated: the test is deleted, so
      // the cell would now classify as EXAMPLE_ONLY — committed docs are stale.
      writeTestFile(
        examplesRoot,
        'combo',
        'order.aggregate.test.ts',
        `import { describe, it } from 'vitest'; describe('deleted-in-spirit', () => { it('noop', () => {}); });`
      );

      const report = checkMatrix(paths);

      expect(report.ok).toBe(false);
      expect(report.hardFailures.some(f => f.startsWith('(c)'))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('exits ok (0) when an EXAMPLE_ONLY cell is marked planned: true (soft warning only)', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'combo', '@vytches/examples-combo');
      writeSrcFile(
        examplesRoot,
        'combo',
        'service.ts',
        `
          import { DomainService } from '@vytches/ddd-domain-services';
          export class MyService extends DomainService {}
        `
      );
      // No test file imports service.ts.
      writeTestFile(
        examplesRoot,
        'combo',
        'unrelated.test.ts',
        `import { describe, it } from 'vitest'; describe('unrelated', () => { it('noop', () => {}); });`
      );

      const paths = pathsFor(root);
      writeManifest(
        paths.manifestPath,
        `
combinations:
  - name: domain-service-unit-of-work-aware
    level: quick-start
    packages:
      - '@vytches/ddd-domain-services'
    file: examples/combo/src/service.ts
    planned: true
`
      );

      runGenerate(paths);
      const report = checkMatrix(paths);

      expect(report.ok).toBe(true);
      expect(report.hardFailures).toEqual([]);
      expect(report.softWarnings.some(w => w.startsWith('[soft, planned] (a)'))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('exits ok (0) when a DECLARED_MISSING entry is marked planned: true (soft warning only)', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      const paths = pathsFor(root);
      writeManifest(
        paths.manifestPath,
        `
combinations:
  - name: cqrs-plus-resilience-decorator
    level: advanced
    packages:
      - '@vytches/ddd-cqrs'
      - '@vytches/ddd-resilience'
    file: null
    planned: true
`
      );

      runGenerate(paths);
      const report = checkMatrix(paths);

      expect(report.ok).toBe(true);
      expect(report.hardFailures).toEqual([]);
      expect(report.softWarnings.some(w => w.startsWith('[soft, planned] (b)'))).toBe(true);
      void examplesRoot;
    } finally {
      cleanup();
    }
  });

  it('reports undeclared multi-package combinations as soft warnings, not hard failures', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'combo', '@vytches/examples-combo');
      writeSrcFile(
        examplesRoot,
        'combo',
        'surprise.ts',
        `
          import { CommandHandler } from '@vytches/ddd-cqrs';
          import { CircuitBreaker } from '@vytches/ddd-resilience';
          export class Surprise {}
        `
      );

      const paths = pathsFor(root);
      writeManifest(paths.manifestPath, `combinations: []\n`);

      runGenerate(paths);
      const report = checkMatrix(paths);

      expect(report.ok).toBe(true);
      expect(report.softWarnings.length).toBeGreaterThan(0);
      expect(report.softWarnings.some(w => w.includes('surprise.ts'))).toBe(true);
    } finally {
      cleanup();
    }
  });
});
