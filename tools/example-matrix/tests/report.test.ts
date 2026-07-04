import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, it, expect } from 'vitest';

import {
  matrixDataEquals,
  renderCoverageMarkdown,
  renderMatrixJson,
  writeReport,
} from '../src/report.js';
import type { Matrix } from '../src/types.js';

function sampleMatrix(overrides: Partial<Matrix> = {}): Matrix {
  return {
    generatedAt: '2026-07-04T00:00:00.000Z',
    cells: [
      {
        name: 'aggregate-plus-specification',
        level: 'quick-start',
        packages: ['@vytches/ddd-aggregates', '@vytches/ddd-validation'],
        status: 'VERIFIED',
        file: 'examples/quickstart/src/domain/order.aggregate.ts',
        testedBy: ['examples/quickstart/tests/order.aggregate.test.ts'],
        description: 'sample',
      },
      {
        name: 'domain-service-plus-policy',
        level: 'intermediate',
        packages: ['@vytches/ddd-domain-services', '@vytches/ddd-policies'],
        status: 'DECLARED_MISSING',
        file: null,
        testedBy: [],
      },
    ],
    undeclared: [
      {
        file: 'examples/policies/src/09-surprise-combo.ts',
        exampleDir: 'policies',
        packages: ['@vytches/ddd-cqrs', '@vytches/ddd-policies'],
        status: 'EXAMPLE_ONLY',
        testedBy: [],
      },
    ],
    ...overrides,
  };
}

describe('renderMatrixJson', () => {
  it('round-trips through JSON.parse to an equivalent object', () => {
    const matrix = sampleMatrix();
    const json = renderMatrixJson(matrix);
    expect(JSON.parse(json)).toEqual(matrix);
    expect(json.endsWith('\n')).toBe(true);
  });
});

describe('renderCoverageMarkdown', () => {
  it('includes the AC#7 "additional report, not a substitute" disclaimer', () => {
    const md = renderCoverageMarkdown(sampleMatrix());
    expect(md).toContain('ADDITIONAL report');
    expect(md).toContain('L1/L2/L3');
    expect(md).toContain('vitest --coverage');
    expect(md).toContain('NOT a substitute');
  });

  it('renders a summary count row per status', () => {
    const md = renderCoverageMarkdown(sampleMatrix());
    expect(md).toContain('| VERIFIED | 1 |');
    expect(md).toContain('| DECLARED_MISSING | 1 |');
    expect(md).toContain('| EXAMPLE_ONLY | 0 |');
  });

  it('renders one row per manifest cell with its status, file, and testedBy', () => {
    const md = renderCoverageMarkdown(sampleMatrix());
    expect(md).toContain('aggregate-plus-specification');
    expect(md).toContain('examples/quickstart/src/domain/order.aggregate.ts');
    expect(md).toContain('examples/quickstart/tests/order.aggregate.test.ts');
    expect(md).toContain('domain-service-plus-policy');
  });

  it('renders undeclared combinations in their own section', () => {
    const md = renderCoverageMarkdown(sampleMatrix());
    expect(md).toContain('Undeclared combinations');
    expect(md).toContain('examples/policies/src/09-surprise-combo.ts');
  });

  it('renders "none" copy when there are no undeclared combinations', () => {
    const md = renderCoverageMarkdown(sampleMatrix({ undeclared: [] }));
    expect(md).toContain('_None');
  });
});

describe('matrixDataEquals', () => {
  it('is true for matrices with identical cells/undeclared but different generatedAt', () => {
    const a = sampleMatrix({ generatedAt: '2026-01-01T00:00:00.000Z' });
    const b = sampleMatrix({ generatedAt: '2026-12-31T00:00:00.000Z' });
    expect(matrixDataEquals(a, b)).toBe(true);
  });

  it('is false when cells differ', () => {
    const a = sampleMatrix();
    const b = sampleMatrix();
    b.cells[0].status = 'EXAMPLE_ONLY';
    expect(matrixDataEquals(a, b)).toBe(false);
  });

  it('is false when undeclared differs', () => {
    const a = sampleMatrix();
    const b = sampleMatrix({ undeclared: [] });
    expect(matrixDataEquals(a, b)).toBe(false);
  });
});

describe('writeReport', () => {
  it('writes both files to disk, creating parent directories', () => {
    const root = join(
      tmpdir(),
      `example-matrix-report-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const jsonPath = join(root, 'docs', 'coverage-matrix.json');
    const mdPath = join(root, 'docs', 'COVERAGE-MATRIX.md');
    try {
      const matrix = sampleMatrix();
      writeReport(matrix, { jsonPath, mdPath });

      expect(existsSync(jsonPath)).toBe(true);
      expect(existsSync(mdPath)).toBe(true);
      expect(JSON.parse(readFileSync(jsonPath, 'utf8'))).toEqual(matrix);
      expect(readFileSync(mdPath, 'utf8')).toBe(renderCoverageMarkdown(matrix));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
