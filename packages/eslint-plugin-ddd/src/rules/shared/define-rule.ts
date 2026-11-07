import type { Rule } from 'eslint';
import {
  MESSAGE_OVERRIDES_SCHEMA,
  messageData,
  renderTemplates,
  ruleDocsUrl,
  type MessageOverrides,
  type MessageSpec,
} from '../../messages';
import type { AstNode } from '../../resolver/types';
import { createSymbolResolver, type SymbolResolver } from './symbols';

/** What a rule body works with: the context, reference resolution and message reporting. */
export interface RuleApi<M extends string> {
  readonly context: Rule.RuleContext;
  /** Resolves references to library exports; reads nothing until first used. */
  readonly symbols: SymbolResolver;
  /** Reports at `node` with message `id`; `data` fills the `{{placeholders}}` of the message. */
  report(node: AstNode, id: M, data?: Readonly<Record<string, string>>): void;
}

export interface RuleDefinition<M extends string> {
  /** Rule name, also the name of its docs page. */
  readonly name: string;
  readonly description: string;
  readonly type?: 'problem' | 'suggestion';
  readonly messages: Readonly<Record<M, MessageSpec>>;
  create(api: RuleApi<M>): Rule.RuleListener;
}

/**
 * Builds an ESLint rule with the plugin's message contract: agent-format messages, a docs URL
 * and the `{ id, fix, see }` options every rule accepts.
 */
export function defineRule<M extends string>(definition: RuleDefinition<M>): Rule.RuleModule {
  return {
    meta: {
      type: definition.type ?? 'problem',
      docs: { description: definition.description, url: ruleDocsUrl(definition.name) },
      schema: [MESSAGE_OVERRIDES_SCHEMA as unknown as Record<string, unknown>],
      messages: renderTemplates(definition.messages),
    },
    create(context) {
      const overrides = context.options[0] as MessageOverrides | undefined;
      let symbols: SymbolResolver | undefined;
      const api: RuleApi<M> = {
        context,
        get symbols() {
          return (symbols ??= createSymbolResolver(context));
        },
        report(node, id, data) {
          context.report({
            node: node as unknown as Rule.Node,
            messageId: id,
            data: messageData(definition.messages[id], overrides, data),
          });
        },
      };
      return definition.create(api);
    },
  };
}
