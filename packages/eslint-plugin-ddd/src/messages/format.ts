// Agent-oriented message format (VF-043 AC-MESSAGES):
//   <what is wrong>. <why>. Fix: <instruction>. See: <LLMGUIDE anchor>
// `what` and `why` are ESLint templates (`{{name}}` placeholders). `fix` and `see` are data, so a
// project can replace them (and add a rule-card id) through the rule options.

/** One message of a rule. */
export interface MessageSpec {
  /** What is wrong, as a template; no trailing period. */
  readonly what: string;
  /** Why it is wrong, as a template; no trailing period. */
  readonly why: string;
  /** Default instruction; `{{name}}` placeholders are filled from the report data. */
  readonly fix: string;
  /** Default documentation link. */
  readonly see: string;
}

/** Options every rule of the plugin accepts. All optional. */
export interface MessageOverrides {
  /** Tag shown at the start of the message, e.g. a rule-card id (`PA1`). */
  readonly id?: string;
  /** Replaces the `Fix:` instruction. */
  readonly fix?: string;
  /** Replaces the `See:` link. */
  readonly see?: string;
}

/** JSON schema of {@link MessageOverrides}; the sole option of every rule unless it adds more. */
export const MESSAGE_OVERRIDES_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    fix: { type: 'string', minLength: 1 },
    see: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
});

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

function stripTrailingPeriod(text: string): string {
  return text.replace(/[.\s]+$/, '');
}

function endWithPeriod(text: string): string {
  return `${stripTrailingPeriod(text)}.`;
}

function capitalize(text: string): string {
  return text.replace(/^[a-z]/, letter => letter.toUpperCase());
}

/** Replaces `{{key}}` in `text` with `data[key]`; unknown keys stay as written. */
export function interpolate(text: string, data: Readonly<Record<string, string>>): string {
  return text.replace(PLACEHOLDER, (whole, key: string) => data[key] ?? whole);
}

/** The ESLint message template of a spec. Always contains the literal `Fix:` and `See:`. */
export function renderTemplate(spec: MessageSpec): string {
  return `{{tag}}${stripTrailingPeriod(spec.what)}. ${capitalize(endWithPeriod(spec.why))} Fix: {{fix}} See: {{see}}`;
}

/** `meta.messages` of a rule: one rendered template per message id. */
export function renderTemplates<M extends string>(
  specs: Readonly<Record<M, MessageSpec>>
): Record<M, string> {
  const out = {} as Record<M, string>;
  for (const id of Object.keys(specs) as M[]) out[id] = renderTemplate(specs[id]);
  return out;
}

/** Placeholder values for one report: spec defaults overridden by the rule options. */
export function messageData(
  spec: MessageSpec,
  overrides: MessageOverrides | undefined,
  data: Readonly<Record<string, string>> = {}
): Record<string, string> {
  const fix = overrides?.fix ?? interpolate(spec.fix, data);
  return {
    ...data,
    tag: overrides?.id ? `[${overrides.id}] ` : '',
    fix: endWithPeriod(fix),
    see: overrides?.see ?? spec.see,
  };
}
