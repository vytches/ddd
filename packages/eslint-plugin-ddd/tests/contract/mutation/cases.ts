import { internalImportsCases } from './internal-imports-cases';
import { SYMBOL_RULES } from './rule-templates';
import type { MutationCase } from './types';
import { libraryRefVariants, lookalikeRefVariants, SHADOW_VARIANTS } from './variants';

// Variants in which a correct use of the symbol is also exercised (a subset: the full set is
// applied to the violating usage, which is what proves the detection).
const VALID_USE_VARIANTS = new Set([
  'direct',
  'alias',
  'namespace',
  'facade-named',
  'const-alias',
  'cast-as',
]);

function entryText(prelude: string, setup: string | undefined, usage: string): string {
  const body = [prelude, setup, usage].filter(part => part !== undefined && part !== '').join('\n');
  return `${body}\n`;
}

/** The whole corpus: violations the rules must see and valid code they must leave alone. */
export function buildMutationCases(): readonly MutationCase[] {
  const cases: MutationCase[] = [];

  for (const t of SYMBOL_RULES) {
    const tag = `${t.rule}/${t.pkg.replace('@vytches/', '')}`;
    const add = (
      kind: MutationCase['kind'],
      id: string,
      variant: string,
      files: Readonly<Record<string, string>>,
      text: string
    ): void => {
      cases.push({
        id: `${tag}/${kind}/${id}/${variant}`,
        rule: t.rule,
        kind,
        variant,
        files: { ...files, 'entry.ts': text },
        entry: 'entry.ts',
        expected: kind === 'violation' ? 1 : 0,
      });
    };

    for (const v of libraryRefVariants(t.pkg, t.symbol)) {
      for (const use of t.violations) {
        add(
          'violation',
          use.id,
          v.variant,
          v.files,
          entryText(v.prelude, t.setup, use.usage(v.ref))
        );
      }
      if (VALID_USE_VARIANTS.has(v.variant)) {
        for (const use of t.valid) {
          add('valid', use.id, v.variant, v.files, entryText(v.prelude, t.setup, use.usage(v.ref)));
        }
      }
    }

    for (const v of lookalikeRefVariants(t.pkg, t.symbol)) {
      for (const use of t.violations) {
        add(
          'valid',
          `lookalike-${use.id}`,
          v.variant,
          v.files,
          entryText(v.prelude, t.setup, use.usage(v.ref))
        );
      }
    }

    // An import of the library symbol that a local binding shadows where it is used.
    const imported = `import { ${t.symbol} } from '${t.pkg}';`;
    for (const shadow of SHADOW_VARIANTS) {
      for (const use of t.violations) {
        const body = shadow.wrap(t.symbol, use.usage(t.symbol));
        add('valid', `shadowed-${use.id}`, shadow.variant, {}, entryText(imported, t.setup, body));
      }
    }
  }

  return [...cases, ...internalImportsCases()];
}
