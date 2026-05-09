import { describe, it, expect } from 'vitest';
import * as api from '../src';

/**
 * Public API surface test for @vytches/ddd-utils.
 *
 * Captures the current set of named exports as an inline snapshot. Any change
 * to the public surface (additions, removals, renames) will fail this test,
 * forcing an explicit decision:
 *   - intentional change → run `vitest -u` to update the snapshot
 *   - accidental change  → revert
 *
 * Added in REL-005 to lock the public API before v0.25.0-beta.1 publish.
 */
describe('@vytches/ddd-utils public API surface', () => {
  it('exports the documented set of symbols', () => {
    const exports = Object.keys(api).sort();
    expect(exports).toMatchSnapshot();
  });
});
