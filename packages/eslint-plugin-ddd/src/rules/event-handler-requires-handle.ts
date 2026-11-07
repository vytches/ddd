import { RULE_MESSAGES } from '../messages';
import type { AstNode } from '../resolver/types';
import { defineRule } from './shared/define-rule';
import { isLibraryExport } from './shared/symbols';

function memberName(member: AstNode): string | undefined {
  const key = member['key'] as AstNode | undefined;
  if (!key || member['computed']) return undefined;
  if (key.type === 'Identifier') return key['name'] as string;
  if (key.type === 'Literal' && typeof key['value'] === 'string') return key['value'] as string;
  return undefined;
}

function declaresHandle(cls: AstNode): boolean {
  const members = ((cls['body'] as AstNode)['body'] as AstNode[] | undefined) ?? [];
  return members.some(
    m =>
      (m.type === 'MethodDefinition' ||
        m.type === 'PropertyDefinition' ||
        m.type === 'TSAbstractMethodDefinition' ||
        m.type === 'AccessorProperty') &&
      memberName(m) === 'handle'
  );
}

/**
 * Reports a class decorated with the library's `@EventHandler` that has no `handle()`. Only the
 * plain class form is checked: a class with `extends` may inherit `handle()`, an abstract class
 * is a base, and a decorated method is the method form of the decorator.
 */
export const eventHandlerRequiresHandle = defineRule({
  name: 'event-handler-requires-handle',
  description: 'Require a `handle()` method on a class decorated with `@EventHandler`.',
  messages: RULE_MESSAGES['event-handler-requires-handle'],
  create({ symbols, report }) {
    const check = (node: unknown): void => {
      const cls = node as AstNode;
      if (cls['superClass'] || cls['abstract']) return;
      const decorators = (cls['decorators'] as AstNode[] | undefined) ?? [];
      const decorated = decorators.some(d => {
        const expression = d['expression'] as AstNode;
        const callee =
          expression.type === 'CallExpression' ? (expression['callee'] as AstNode) : expression;
        return isLibraryExport(symbols.libraryRefs(callee), 'EventHandler');
      });
      if (!decorated || declaresHandle(cls)) return;
      const id = cls['id'] as AstNode | null;
      report(id ?? cls, 'missingHandle', { name: id ? (id['name'] as string) : '<anonymous>' });
    };
    return { ClassDeclaration: check, ClassExpression: check };
  },
});
