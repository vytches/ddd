import { describe, it, expect } from 'vitest';
import ts from 'typescript';

import { factoryMustReturnResult } from '../src/rules/factory-must-return-result.js';
import { noMutableStateInAggregate } from '../src/rules/no-mutable-state-in-aggregate.js';
import { noThrowInDomain } from '../src/rules/no-throw-in-domain.js';

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
