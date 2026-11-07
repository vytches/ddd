import { RULE_MESSAGES } from '../messages';
import type { AstNode } from '../resolver/types';
import { defineRule } from './shared/define-rule';
import { isLibraryExport } from './shared/symbols';

/** `@deprecated` static factories of the library's `EntityId` classes and their replacements. */
export const DEPRECATED_ENTITY_ID_FACTORIES: ReadonlyMap<string, string> = new Map([
  ['createText', 'fromText'],
  ['createUuid', 'fromUUID'],
  ['createInteger', 'fromInteger'],
  ['createBigInt', 'fromBigInt'],
  ['createWithRandomUUID', 'create'],
]);

/** Reports references to the deprecated `EntityId` static factories (a warning, not misuse). */
export const noDeprecatedEntityIdFactories = defineRule({
  name: 'no-deprecated-entity-id-factories',
  description: 'Flag the deprecated static factories of `EntityId`.',
  type: 'suggestion',
  messages: RULE_MESSAGES['no-deprecated-entity-id-factories'],
  create({ symbols, report }) {
    return {
      MemberExpression(node) {
        const member = node as unknown as AstNode;
        const property = member['property'] as AstNode;
        if (member['computed'] || property.type !== 'Identifier') return;
        const method = property['name'] as string;
        const replacement = DEPRECATED_ENTITY_ID_FACTORIES.get(method);
        if (replacement === undefined) return;
        if (isLibraryExport(symbols.libraryRefs(member), 'EntityId', [method])) {
          report(property, 'deprecatedFactory', { method, replacement });
        }
      },
    };
  },
});
