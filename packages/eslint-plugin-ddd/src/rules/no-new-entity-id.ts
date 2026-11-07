import { RULE_MESSAGES } from '../messages';
import type { AstNode } from '../resolver/types';
import { defineRule } from './shared/define-rule';
import { isLibraryExport } from './shared/symbols';

/**
 * Reports `new EntityId(...)` where `EntityId` is a library class. The library ships two
 * `EntityId` classes (contracts and value-objects); the symbol is resolved by import source, so
 * a project class that happens to be called `EntityId` is left alone.
 */
export const noNewEntityId = defineRule({
  name: 'no-new-entity-id',
  description: 'Disallow `new EntityId(...)`; use the validating static factories.',
  messages: RULE_MESSAGES['no-new-entity-id'],
  create({ symbols, report }) {
    return {
      NewExpression(node) {
        const created = node as unknown as AstNode;
        if (isLibraryExport(symbols.libraryRefs(created['callee'] as AstNode), 'EntityId')) {
          report(created, 'newEntityId');
        }
      },
    };
  },
});
