import type { Rule } from 'eslint';
import type { RoleResolver } from '../resolver';

/**
 * How far a wrapped rule reaches once a file holds a class of the requested role.
 *
 * - `class`: only reports located inside such a class are kept.
 * - `file`: the rule runs on the whole file (for rules whose findings sit outside the class,
 *   e.g. a framework import at the top of a domain file).
 *
 * @beta
 * @since 0.32.0
 */
export type RoleScope = 'class' | 'file';

/**
 * Resolver used by `roleScoped`: a resolver instance, or a factory called once per linted
 * file (e.g. to build it from `context.settings`).
 *
 * @beta
 * @since 0.32.0
 */
export type ResolverSource = RoleResolver | ((context: Rule.RuleContext) => RoleResolver);

/**
 * Options of {@link roleScoped}.
 *
 * @beta
 * @since 0.32.0
 */
export interface RoleScopedOptions {
  readonly resolver: ResolverSource;
  /** Default `'class'`. */
  readonly scope?: RoleScope;
  /** Replaces `meta.docs.url` of the wrapped rule. */
  readonly docsUrl?: string;
}
