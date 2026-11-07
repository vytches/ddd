// Internal barrel of the rule layer. The package barrel (entry-point unit) re-exports `rules`
// and builds `configs.recommended` from `RULE_CATALOG`.
import type { Rule } from 'eslint';
import { eventHandlerRequiresHandle } from './event-handler-requires-handle';
import { noDeprecatedEntityIdFactories } from './no-deprecated-entity-id-factories';
import { noInstanceofResult } from './no-instanceof-result';
import { noInternalImports } from './no-internal-imports';
import { noNewEntityId } from './no-new-entity-id';
import { policyBuilderRequiredCalls } from './policy-builder-required-calls';
import type { RuleName } from './catalog';

/**
 * Rules of the plugin, keyed by name (without the plugin prefix).
 *
 * @beta
 * @since 0.32.0
 */
export const rules: Readonly<Record<RuleName, Rule.RuleModule>> = Object.freeze({
  'no-instanceof-result': noInstanceofResult,
  'no-new-entity-id': noNewEntityId,
  'no-deprecated-entity-id-factories': noDeprecatedEntityIdFactories,
  'event-handler-requires-handle': eventHandlerRequiresHandle,
  'no-internal-imports': noInternalImports,
  'policy-builder-required-calls': policyBuilderRequiredCalls,
});

export { RECOMMENDED_RULES, RULE_CATALOG } from './catalog';
export type { PresetSeverity, RuleCatalogEntry, RuleName } from './catalog';
export { DEPRECATED_ENTITY_ID_FACTORIES } from './no-deprecated-entity-id-factories';
export { resetOriginCaches } from './shared/origin-host';
export { resetOwnPackageCache } from './shared/own-package';
