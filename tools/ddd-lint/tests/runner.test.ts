import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runLint, formatResult } from '../src/runner.js';

function makeTempProject(): { root: string; cleanup: () => void } {
  const root = join(tmpdir(), `ddd-lint-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, 'src', 'aggregates'), { recursive: true });
  mkdirSync(join(root, 'src', 'utils'), { recursive: true });
  mkdirSync(join(root, 'node_modules', 'fakedep'), { recursive: true });
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

describe('runLint — end-to-end', () => {
  it('finds issues in a temp project across multiple files', () => {
    const { root, cleanup } = makeTempProject();
    try {
      writeFileSync(
        join(root, 'src', 'aggregates', 'order.ts'),
        `
          class Order extends AggregateRoot {
            customerId = '';
            static create(): Order {
              if (true) throw new Error('bad');
              return new Order();
            }
          }
        `
      );
      writeFileSync(
        join(root, 'src', 'utils', 'helper.ts'),
        `export function noop() { return null; }`
      );

      const result = runLint({ root });

      expect(result.scannedFiles).toBe(2);
      // Order.ts has 3 issues:
      //   ddd-001 (mutable customerId)
      //   ddd-002 (throw in /aggregates/)
      //   ddd-003 (factory returns Order, not Result)
      const orderIssues = result.issues.filter(i => i.file.includes('order.ts'));
      expect(orderIssues).toHaveLength(3);
      const ruleIds = orderIssues.map(i => i.ruleId).sort();
      expect(ruleIds).toEqual(['ddd-001', 'ddd-002', 'ddd-003']);

      // helper.ts has no issues
      const helperIssues = result.issues.filter(i => i.file.includes('helper.ts'));
      expect(helperIssues).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('skips node_modules', () => {
    const { root, cleanup } = makeTempProject();
    try {
      writeFileSync(
        join(root, 'node_modules', 'fakedep', 'broken.ts'),
        `class X extends AggregateRoot { thing = ''; }`
      );
      const result = runLint({ root });
      expect(result.scannedFiles).toBe(0);
      expect(result.issues).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('skips .d.ts declaration files', () => {
    const { root, cleanup } = makeTempProject();
    try {
      writeFileSync(
        join(root, 'src', 'aggregates', 'order.d.ts'),
        `declare class Order extends AggregateRoot { x: string; }`
      );
      const result = runLint({ root });
      expect(result.scannedFiles).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('returns clean result for an empty project', () => {
    const { root, cleanup } = makeTempProject();
    try {
      const result = runLint({ root });
      expect(result.issues).toEqual([]);
      expect(result.scannedFiles).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    } finally {
      cleanup();
    }
  });

  it('produces relative paths by default', () => {
    const { root, cleanup } = makeTempProject();
    try {
      writeFileSync(
        join(root, 'src', 'aggregates', 'order.ts'),
        `class Order extends AggregateRoot { x = ''; }`
      );
      const result = runLint({ root });
      expect(result.issues[0]!.file).not.toContain(root);
      expect(result.issues[0]!.file).toMatch(/^src/);
    } finally {
      cleanup();
    }
  });

  it('formatResult prints clean banner when no issues', () => {
    const { root, cleanup } = makeTempProject();
    try {
      const result = runLint({ root });
      const text = formatResult(result);
      expect(text).toContain('clean');
      expect(text).toContain('scanned 0 files');
    } finally {
      cleanup();
    }
  });

  it('formatResult groups by file and reports counts', () => {
    const { root, cleanup } = makeTempProject();
    try {
      writeFileSync(
        join(root, 'src', 'aggregates', 'order.ts'),
        `class Order extends AggregateRoot { x = ''; y = 0; }`
      );
      const result = runLint({ root });
      const text = formatResult(result);
      expect(text).toContain('order.ts');
      expect(text).toContain('ddd-001');
      expect(text).toMatch(/2 error\(s\)/);
    } finally {
      cleanup();
    }
  });
});
