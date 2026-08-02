import { describe, it, expect } from 'vitest';
import ts from 'typescript';

import { factoryMustReturnResult } from '../src/rules/factory-must-return-result.js';
import { noMutableStateInAggregate } from '../src/rules/no-mutable-state-in-aggregate.js';
import { noThrowInDomain } from '../src/rules/no-throw-in-domain.js';
import { deepImportInsteadOfBarrel } from '../src/rules/deep-import-instead-of-barrel.js';

function parse(src: string, filePath = 'src/aggregates/order.ts'): ts.SourceFile {
  return ts.createSourceFile(filePath, src, ts.ScriptTarget.ES2022, true);
}

describe('ddd-001 — no mutable state in aggregate', () => {
  it('flags bare public fields (no modifier defaults to public)', () => {
    const src = `
      class Order extends AggregateRoot<string> {
        customerId = '';
      }
    `;
    const issues = noMutableStateInAggregate.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.ruleId).toBe('ddd-001');
    expect(issues[0]!.message).toContain('customerId');
  });

  it('flags public mutable fields', () => {
    const src = `
      class Order extends AggregateRoot {
        public total = 0;
      }
    `;
    const issues = noMutableStateInAggregate.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('externally reachable');
  });

  it('warns (not errors) on private mutable fields — legitimate in event handlers', () => {
    const src = `
      class Order extends AggregateRoot {
        private status = 'pending';
      }
    `;
    const issues = noMutableStateInAggregate.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('warning');
    expect(issues[0]!.message).toContain('not readonly');
  });

  it('passes private readonly fields', () => {
    const src = `
      class Order extends AggregateRoot {
        private readonly customerId = '';
        private readonly amount = 0;
      }
    `;
    const issues = noMutableStateInAggregate.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toEqual([]);
  });

  it('passes public readonly fields', () => {
    const src = `
      class Order extends AggregateRoot {
        public readonly id: string = 'x';
      }
    `;
    const issues = noMutableStateInAggregate.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toEqual([]);
  });

  it('also checks Entity subclasses, not just AggregateRoot', () => {
    const src = `
      class OrderLine extends Entity<string> {
        quantity = 0;
      }
    `;
    const issues = noMutableStateInAggregate.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order-line.ts',
    });
    expect(issues).toHaveLength(1);
  });

  it('ignores non-aggregate classes', () => {
    const src = `
      class OrderDto {
        customerId = '';
        amount = 0;
      }
    `;
    const issues = noMutableStateInAggregate.run({
      sourceFile: parse(src),
      filePath: 'src/dto/order-dto.ts',
    });
    expect(issues).toEqual([]);
  });

  it('reports correct line numbers', () => {
    const src = `class Order extends AggregateRoot {
  status = 'pending';
}`;
    const issues = noMutableStateInAggregate.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues[0]!.line).toBe(2);
  });

  it('honors // ddd-lint-disable no-mutable-state-in-aggregate directive', () => {
    const src = `// ddd-lint-disable no-mutable-state-in-aggregate
class Order extends AggregateRoot {
  customerId = '';
  amount = 0;
}`;
    const issues = noMutableStateInAggregate.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toEqual([]);
  });
});

describe('ddd-002 — no throw in domain', () => {
  it('flags throw inside files in /aggregates/', () => {
    const src = `
      function validate(x: number) {
        if (x < 0) throw new Error('negative');
      }
    `;
    const issues = noThrowInDomain.run({
      sourceFile: parse(src),
      filePath: 'packages/orders/src/aggregates/order.ts',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.ruleId).toBe('ddd-002');
  });

  it('flags throw inside /domain/', () => {
    const src = `if (true) throw new TypeError('x');`;
    const issues = noThrowInDomain.run({
      sourceFile: parse(src),
      filePath: 'src/domain/order.ts',
    });
    expect(issues).toHaveLength(1);
  });

  it('flags throw inside /value-objects/, /policies/, /specifications/', () => {
    const src = `function fail() { throw new Error('bad'); }`;
    for (const dir of ['value-objects', 'policies', 'specifications']) {
      const issues = noThrowInDomain.run({
        sourceFile: parse(src),
        filePath: `src/${dir}/file.ts`,
      });
      expect(issues, `dir=${dir}`).toHaveLength(1);
    }
  });

  it('does NOT flag throw in non-domain files', () => {
    const src = `if (true) throw new Error('infra fault');`;
    for (const path of [
      'src/infrastructure/db.ts',
      'src/api/controller.ts',
      'src/utils/parse.ts',
    ]) {
      const issues = noThrowInDomain.run({ sourceFile: parse(src), filePath: path });
      expect(issues, `path=${path}`).toEqual([]);
    }
  });

  it('does NOT flag throws in tests under /tests/ or /__tests__/', () => {
    const src = `it('x', () => { throw new Error('test'); });`;
    for (const path of [
      'src/aggregates/__tests__/order.test.ts',
      'packages/foo/tests/aggregates/order.test.ts',
    ]) {
      const issues = noThrowInDomain.run({ sourceFile: parse(src), filePath: path });
      expect(issues, `path=${path}`).toEqual([]);
    }
  });

  it('does NOT flag throws in colocated *.test.ts / *.spec.ts files', () => {
    const src = `it('x', () => { throw new Error('test'); });`;
    for (const path of [
      'src/aggregates/order.test.ts',
      'src/aggregates/order.spec.ts',
      'src/value-objects/money.spec.ts',
    ]) {
      const issues = noThrowInDomain.run({ sourceFile: parse(src), filePath: path });
      expect(issues, `path=${path}`).toEqual([]);
    }
  });

  it('catches multiple throws in the same file', () => {
    const src = `
      function a() { throw new Error('a'); }
      function b() { throw new Error('b'); }
      function c() { throw new Error('c'); }
    `;
    const issues = noThrowInDomain.run({
      sourceFile: parse(src),
      filePath: 'src/domain/x.ts',
    });
    expect(issues).toHaveLength(3);
  });

  it('flags throw when the domain folder IS the first path segment, no leading slash (SA-M1 regression)', () => {
    // This is the exact shape produced by the real CLI: `runLint({ root:
    // 'packages' })` yields paths relative to that root, so
    // `packages/aggregates/src/x.ts` on disk becomes `aggregates/src/x.ts` —
    // no leading slash before "aggregates". The old `includes('/aggregates/')`
    // check silently never matched this shape (0 findings in the wired
    // script vs 100+ when scanned from the repo root, where every domain
    // folder has a preceding `packages/` segment). If this regresses, the
    // rule is a no-op again in its actual CI/CLI wiring.
    const src = `function validate(x: number) { if (x < 0) throw new Error('negative'); }`;
    for (const path of [
      'aggregates/src/core/aggregate-root.ts',
      'domain/errors.ts',
      'value-objects/money.ts',
      'specifications/order-spec.ts',
      'policies/registry/policy-registry.ts',
    ]) {
      const issues = noThrowInDomain.run({ sourceFile: parse(src), filePath: path });
      expect(issues, `path=${path}`).toHaveLength(1);
    }
  });

  it('does NOT flag a folder that merely contains a domain word as substring (no false positive from segment matching)', () => {
    const src = `if (true) throw new Error('x');`;
    for (const path of [
      'src/my-aggregates-helper/util.ts',
      'src/domain-tools/format.ts',
      'src/policies-config/loader.ts',
    ]) {
      const issues = noThrowInDomain.run({ sourceFile: parse(src), filePath: path });
      expect(issues, `path=${path}`).toEqual([]);
    }
  });

  it('honors // ddd-lint-disable no-throw-in-domain directive', () => {
    const src = `// ddd-lint-disable no-throw-in-domain
function fail() { throw new Error('intentional'); }`;
    const issues = noThrowInDomain.run({
      sourceFile: parse(src),
      filePath: 'src/domain/x.ts',
    });
    expect(issues).toEqual([]);
  });
});

describe('ddd-003 — factory must return Result', () => {
  it('flags static create() with concrete return type', () => {
    const src = `
      class Order extends AggregateRoot {
        static create(customerId: string): Order {
          return new Order({ customerId } as any);
        }
      }
    `;
    const issues = factoryMustReturnResult.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.ruleId).toBe('ddd-003');
    expect(issues[0]!.severity).toBe('warning');
  });

  it('flags static create() with no return type annotation', () => {
    const src = `
      class Order {
        static create(customerId: string) {
          return new Order();
        }
      }
    `;
    const issues = factoryMustReturnResult.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toHaveLength(1);
  });

  it('passes static create() returning Result<T>', () => {
    const src = `
      class Order {
        static create(customerId: string): Result<Order, Error> {
          return Result.ok(new Order());
        }
      }
    `;
    const issues = factoryMustReturnResult.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toEqual([]);
  });

  it('passes static create() returning Promise<Result<T>>', () => {
    const src = `
      class Order {
        static async create(customerId: string): Promise<Result<Order, Error>> {
          return Result.ok(new Order());
        }
      }
    `;
    const issues = factoryMustReturnResult.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toEqual([]);
  });

  it('does NOT flag non-static create() (likely an internal helper)', () => {
    const src = `
      class Order {
        create(): Order { return this; }
      }
    `;
    const issues = factoryMustReturnResult.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toEqual([]);
  });

  it('does NOT flag static methods named differently', () => {
    const src = `
      class Order {
        static from(payload: any): Order { return new Order(); }
        static of(x: number): Order { return new Order(); }
      }
    `;
    const issues = factoryMustReturnResult.run({
      sourceFile: parse(src),
      filePath: 'src/aggregates/order.ts',
    });
    expect(issues).toEqual([]);
  });

  it('honors // ddd-lint-disable factory-must-return-result directive', () => {
    const src = `// ddd-lint-disable factory-must-return-result
      class Money {
        static create(amount: number): Money {
          if (amount < 0) throw new Error('negative');
          return new Money();
        }
      }
    `;
    const issues = factoryMustReturnResult.run({
      sourceFile: parse(src),
      filePath: 'src/value-objects/money.ts',
    });
    expect(issues).toEqual([]);
  });
});

describe('ddd-005 — deep import instead of barrel', () => {
  it('flags a deep subpath import from another @vytches/ddd-* package', () => {
    const src = `import { Internal } from '@vytches/ddd-contracts/src/internal';`;
    const issues = deepImportInsteadOfBarrel.run({
      sourceFile: parse(src, 'packages/orders/src/aggregates/order.ts'),
      filePath: 'packages/orders/src/aggregates/order.ts',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.ruleId).toBe('ddd-005');
    expect(issues[0]!.message).toContain('@vytches/ddd-contracts/src/internal');
  });

  it('flags a deep subpath re-export from another @vytches/ddd-* package', () => {
    const src = `export { Internal } from '@vytches/ddd-contracts/dist/internal.js';`;
    const issues = deepImportInsteadOfBarrel.run({
      sourceFile: parse(src, 'packages/orders/src/aggregates/order.ts'),
      filePath: 'packages/orders/src/aggregates/order.ts',
    });
    expect(issues).toHaveLength(1);
  });

  it('flags a type-only deep subpath import (no exemption for types)', () => {
    const src = `import type { Internal } from '@vytches/ddd-contracts/src/internal';`;
    const issues = deepImportInsteadOfBarrel.run({
      sourceFile: parse(src, 'packages/orders/src/aggregates/order.ts'),
      filePath: 'packages/orders/src/aggregates/order.ts',
    });
    expect(issues).toHaveLength(1);
  });

  it('flags a relative import that crosses out of the current package into a different one', () => {
    const src = `import { Foo } from '../../../payments/src/domain/foo';`;
    const issues = deepImportInsteadOfBarrel.run({
      sourceFile: parse(src, 'packages/orders/src/aggregates/order.ts'),
      filePath: 'packages/orders/src/aggregates/order.ts',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.ruleId).toBe('ddd-005');
    expect(issues[0]!.message).toContain('payments');
    expect(issues[0]!.message).toContain('orders');
  });

  it('does NOT flag a same-package relative import', () => {
    const src = `import { Foo } from '../value-objects/money.js';`;
    const issues = deepImportInsteadOfBarrel.run({
      sourceFile: parse(src, 'packages/orders/src/aggregates/order.ts'),
      filePath: 'packages/orders/src/aggregates/order.ts',
    });
    expect(issues).toEqual([]);
  });

  it('does NOT flag a bare package import with no subpath', () => {
    const src = `import { Result } from '@vytches/ddd-contracts';`;
    const issues = deepImportInsteadOfBarrel.run({
      sourceFile: parse(src, 'packages/orders/src/aggregates/order.ts'),
      filePath: 'packages/orders/src/aggregates/order.ts',
    });
    expect(issues).toEqual([]);
  });

  it('does NOT flag a relative import in a file outside any packages/ directory', () => {
    const src = `import { Foo } from '../../other-tool/src/foo';`;
    const issues = deepImportInsteadOfBarrel.run({
      sourceFile: parse(src, 'tools/ddd-lint/src/rules/some-rule.ts'),
      filePath: 'tools/ddd-lint/src/rules/some-rule.ts',
    });
    expect(issues).toEqual([]);
  });

  it('does NOT flag test files', () => {
    const src = `import { Internal } from '@vytches/ddd-contracts/src/internal';`;
    for (const path of [
      'packages/orders/src/aggregates/order.test.ts',
      'packages/orders/tests/aggregates/order.ts',
      'packages/orders/src/aggregates/__tests__/order.ts',
    ]) {
      const issues = deepImportInsteadOfBarrel.run({
        sourceFile: parse(src, path),
        filePath: path,
      });
      expect(issues, `path=${path}`).toEqual([]);
    }
  });

  it('honors // ddd-lint-disable deep-import-instead-of-barrel directive', () => {
    const src = `// ddd-lint-disable deep-import-instead-of-barrel
import { Internal } from '@vytches/ddd-contracts/src/internal';`;
    const issues = deepImportInsteadOfBarrel.run({
      sourceFile: parse(src, 'packages/orders/src/aggregates/order.ts'),
      filePath: 'packages/orders/src/aggregates/order.ts',
    });
    expect(issues).toEqual([]);
  });
});
