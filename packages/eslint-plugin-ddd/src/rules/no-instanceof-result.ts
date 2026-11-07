import { RULE_MESSAGES } from '../messages';
import type { AstNode } from '../resolver/types';
import { defineRule } from './shared/define-rule';
import { isLibraryExport } from './shared/symbols';

/**
 * Reports `x instanceof Result` where `Result` is the library class. Class identity of `Result`
 * differs across bundles and duplicated package copies, so the check is unreliable.
 */
export const noInstanceofResult = defineRule({
  name: 'no-instanceof-result',
  description: 'Disallow `instanceof Result`; use `isSuccess` / `isFailure` or `Result.match()`.',
  messages: RULE_MESSAGES['no-instanceof-result'],
  create({ symbols, report }) {
    return {
      BinaryExpression(node) {
        const binary = node as unknown as AstNode;
        if (binary['operator'] !== 'instanceof') return;
        const right = binary['right'] as AstNode;
        if (isLibraryExport(symbols.libraryRefs(right), 'Result')) {
          report(binary, 'instanceofResult');
        }
      },
    };
  },
});
