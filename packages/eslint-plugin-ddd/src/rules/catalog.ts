/** Severity a rule has when a preset turns it on. */
export type PresetSeverity = 'error' | 'warn';

/** How a rule is offered to consumers. */
export interface RuleCatalogEntry {
  /** Severity used by presets that enable the rule. */
  readonly severity: PresetSeverity;
  /** Whether the `recommended` preset enables the rule. */
  readonly recommended: boolean;
  /** Why a rule is held back, or what its severity depends on. */
  readonly note?: string;
}

/**
 * Preset membership of the plugin's rules (VF-043 D5). The entry-point unit builds
 * `configs.recommended` from this table; the severity doubles as the `warn` = "not on the agent
 * lane" marker, because the lane reports errors only.
 *
 * - `no-new-entity-id` is an error but stays out of `recommended` until `contracts/LLMGUIDE.md`
 *   stops using `new EntityId(...)` itself (the "zero hits on documented usage" requirement).
 * - `policy-builder-required-calls` is opt-in until its precision is measured on natural hits
 *   (>= 95% over >= 60 hits without a false one, AC-DOGFOOD).
 */
export const RULE_CATALOG = {
  'no-instanceof-result': { severity: 'error', recommended: true },
  'no-new-entity-id': {
    severity: 'error',
    recommended: false,
    note: 'Enters `recommended` once contracts/LLMGUIDE.md no longer uses `new EntityId(...)`.',
  },
  'no-deprecated-entity-id-factories': { severity: 'warn', recommended: true },
  'event-handler-requires-handle': { severity: 'error', recommended: true },
  'no-internal-imports': { severity: 'error', recommended: true },
  'policy-builder-required-calls': {
    severity: 'error',
    recommended: false,
    note: 'Opt-in: promotion needs measured precision on natural hits.',
  },
} as const satisfies Record<string, RuleCatalogEntry>;

/**
 * Name of a rule shipped by the plugin.
 *
 * @beta
 * @since 0.32.0
 */
export type RuleName = keyof typeof RULE_CATALOG;

/** Rules (bare names) and severities of the `recommended` preset. */
export const RECOMMENDED_RULES: Readonly<Record<string, PresetSeverity>> = Object.freeze(
  Object.fromEntries(
    (Object.entries(RULE_CATALOG) as [RuleName, RuleCatalogEntry][])
      .filter(([, entry]) => entry.recommended)
      .map(([name, entry]) => [name, entry.severity])
  )
);
