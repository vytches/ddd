import { describe, it, expect } from 'vitest';

import { extractImports } from '../src/ast.js';

describe('extractImports', () => {
  it('extracts @vytches/* package specifiers from import declarations', () => {
    const source = `
      import { AggregateRoot } from '@vytches/ddd-aggregates';
      import type { EntityId } from '@vytches/ddd-contracts';
      import { readFileSync } from 'node:fs';

      export class Order extends AggregateRoot {}
    `;

    const result = extractImports('examples/foo/src/order.ts', source);

    expect(result.packages).toEqual(['@vytches/ddd-aggregates', '@vytches/ddd-contracts']);
  });

  it('extracts relative (same-repo) specifiers separately from @vytches packages', () => {
    const source = `
      import { Money } from './money';
      import { Order } from '../src/order';
      import { AggregateRoot } from '@vytches/ddd-aggregates';
    `;

    const result = extractImports('examples/foo/tests/order.test.ts', source);

    expect(result.relativeSpecifiers).toEqual(['../src/order', './money']);
    expect(result.packages).toEqual(['@vytches/ddd-aggregates']);
  });

  it('deduplicates and sorts repeated specifiers', () => {
    const source = `
      import { A } from '@vytches/ddd-events';
      import { B } from '@vytches/ddd-events';
      import { C } from '@vytches/ddd-aggregates';
    `;

    const result = extractImports('examples/foo/src/x.ts', source);

    expect(result.packages).toEqual(['@vytches/ddd-aggregates', '@vytches/ddd-events']);
  });

  it('captures export ... from re-exports too', () => {
    const source = `export { Money } from '@vytches/ddd-value-objects';`;

    const result = extractImports('examples/foo/src/index.ts', source);

    expect(result.packages).toEqual(['@vytches/ddd-value-objects']);
  });

  it('returns empty arrays for a file with no imports', () => {
    const result = extractImports('examples/foo/src/plain.ts', `export const x = 1;`);

    expect(result.packages).toEqual([]);
    expect(result.relativeSpecifiers).toEqual([]);
  });

  it('ignores non-@vytches, non-relative bare specifiers (e.g. node builtins, third-party)', () => {
    const source = `
      import { z } from 'zod';
      import { readFileSync } from 'node:fs';
    `;

    const result = extractImports('examples/foo/src/x.ts', source);

    expect(result.packages).toEqual([]);
    expect(result.relativeSpecifiers).toEqual([]);
  });
});
