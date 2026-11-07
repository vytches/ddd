// Shapes in which project code can reach a symbol of the library. A rule that resolves symbols
// by import source must see through every one of them (the corpus requires 100% detection).

/** A way to bring `name` of `pkg` into scope: extra files, the prelude of the entry, the reference. */
export interface RefVariant {
  readonly variant: string;
  readonly files: Readonly<Record<string, string>>;
  readonly prelude: string;
  /** Expression that denotes the library symbol in the entry file. */
  readonly ref: string;
}

/** Variants in which the reference really is the library symbol. */
export function libraryRefVariants(pkg: string, name: string): readonly RefVariant[] {
  const direct = `import { ${name} } from '${pkg}';`;
  return [
    { variant: 'direct', files: {}, prelude: direct, ref: name },
    {
      variant: 'alias',
      files: {},
      prelude: `import { ${name} as Local${name} } from '${pkg}';`,
      ref: `Local${name}`,
    },
    {
      variant: 'namespace',
      files: {},
      prelude: `import * as lib from '${pkg}';`,
      ref: `lib.${name}`,
    },
    {
      variant: 'meta-package',
      files: {},
      prelude: `import { ${name} } from '@vytches/ddd';`,
      ref: name,
    },
    {
      variant: 'facade-named',
      files: { 'facade.ts': `export { ${name} } from '${pkg}';\n` },
      prelude: `import { ${name} } from './facade';`,
      ref: name,
    },
    {
      variant: 'facade-renamed',
      files: { 'facade.ts': `export { ${name} as Renamed${name} } from '${pkg}';\n` },
      prelude: `import { Renamed${name} as ${name} } from './facade';`,
      ref: name,
    },
    {
      variant: 'facade-star',
      files: { 'facade.ts': `export * from '${pkg}';\n` },
      prelude: `import { ${name} } from './facade';`,
      ref: name,
    },
    {
      variant: 'facade-namespace',
      files: { 'facade.ts': `export * as lib from '${pkg}';\n` },
      prelude: `import { lib } from './facade';`,
      ref: `lib.${name}`,
    },
    {
      variant: 'facade-local-then-export',
      files: { 'facade.ts': `import { ${name} } from '${pkg}';\nexport { ${name} };\n` },
      prelude: `import { ${name} } from './facade';`,
      ref: name,
    },
    {
      variant: 'facade-chain',
      files: {
        'facade.ts': `export { ${name} } from './inner/barrel';\n`,
        'inner/barrel.ts': `export * from '${pkg}';\n`,
      },
      prelude: `import { ${name} } from './facade';`,
      ref: name,
    },
    {
      variant: 'facade-explicit-extension',
      files: { 'facade.ts': `export { ${name} } from '${pkg}';\n` },
      prelude: `import { ${name} } from './facade.js';`,
      ref: name,
    },
    {
      variant: 'facade-index-file',
      files: { 'barrel/index.ts': `export * from '${pkg}';\n` },
      prelude: `import { ${name} } from './barrel';`,
      ref: name,
    },
    {
      variant: 'const-alias',
      files: {},
      prelude: `${direct}\nconst Alias${name} = ${name};`,
      ref: `Alias${name}`,
    },
    {
      variant: 'const-alias-of-namespace',
      files: {},
      prelude: `import * as lib from '${pkg}';\nconst Alias${name} = lib.${name};`,
      ref: `Alias${name}`,
    },
    { variant: 'cast-as', files: {}, prelude: direct, ref: `(${name} as typeof ${name})` },
    { variant: 'cast-any', files: {}, prelude: direct, ref: `(${name} as any)` },
    { variant: 'cast-non-null', files: {}, prelude: direct, ref: `(${name}!)` },
    {
      variant: 'cast-satisfies',
      files: {},
      prelude: direct,
      ref: `(${name} satisfies typeof ${name})`,
    },
    {
      variant: 'alias-cast-chain',
      files: {},
      prelude: `import { ${name} as Local${name} } from '${pkg}';\nconst Alias${name} = Local${name} as typeof Local${name};`,
      ref: `Alias${name}`,
    },
  ];
}

/**
 * Variants in which the reference only looks like the library symbol: the same name from another
 * package, a project symbol, or a local binding that shadows an import. Never reportable.
 */
export function lookalikeRefVariants(pkg: string, name: string): readonly RefVariant[] {
  const direct = `import { ${name} } from '${pkg}';`;
  return [
    {
      variant: 'other-package',
      files: {},
      prelude: `import { ${name} } from 'some-other-lib';`,
      ref: name,
    },
    {
      variant: 'sibling-scope-package',
      files: {},
      prelude: `import { ${name} } from '@vytches/utils';`,
      ref: name,
    },
    {
      variant: 'facade-over-other-package',
      files: { 'facade.ts': `export { ${name} } from 'some-other-lib';\n` },
      prelude: `import { ${name} } from './facade';`,
      ref: name,
    },
    {
      variant: 'facade-star-over-other-package',
      files: { 'facade.ts': `export * from 'some-other-lib';\n` },
      prelude: `import { ${name} } from './facade';`,
      ref: name,
    },
    {
      variant: 'project-symbol',
      files: {
        'own.ts': `export class ${name} {\n  static create(): ${name} { return new ${name}(); }\n}\n`,
      },
      prelude: `import { ${name} } from './own';`,
      ref: name,
    },
    {
      variant: 'local-declaration',
      files: {},
      prelude: `declare const ${name}: any;`,
      ref: name,
    },
    {
      variant: 'local-class',
      files: {},
      prelude: `class ${name} {\n  static create(): ${name} { return new ${name}(); }\n}`,
      ref: name,
    },
    {
      variant: 'namespace-of-other-package',
      files: {},
      prelude: `import * as lib from 'some-other-lib';`,
      ref: `lib.${name}`,
    },
    {
      variant: 'const-alias-of-local',
      files: {},
      prelude: `declare const Base${name}: any;\nconst Alias${name} = Base${name};`,
      ref: `Alias${name}`,
    },
    {
      variant: 'unimported-name',
      files: {},
      prelude: `// ${pkg} is not imported here`,
      ref: name,
    },
    {
      variant: 'type-only-name-in-other-export',
      files: { 'facade.ts': `export { Other } from '${pkg}';\n` },
      prelude: `import { ${name} } from './facade';`,
      ref: name,
    },
    {
      variant: 'import-unused-then-local',
      files: {},
      prelude: `${direct}`,
      ref: `Unrelated${name}`,
    },
  ];
}

/** Wraps a usage in a scope that shadows the imported `name`: parameter, const, class, catch. */
export interface ShadowVariant {
  readonly variant: string;
  /** Wraps `usage` (code referring to `name`) so that `name` no longer is the import. */
  wrap(name: string, usage: string): string;
}

export const SHADOW_VARIANTS: readonly ShadowVariant[] = [
  {
    variant: 'shadow-parameter',
    wrap: (name, usage) =>
      `export function shadowed(${name}: any): unknown {\n  ${usage}\n  return ${name};\n}`,
  },
  {
    variant: 'shadow-local-const',
    wrap: (name, usage) =>
      `export function shadowed(): unknown {\n  const ${name}: any = {};\n  ${usage}\n  return ${name};\n}`,
  },
  {
    variant: 'shadow-local-class',
    wrap: (name, usage) =>
      `export function shadowed(): unknown {\n  class ${name} {\n    static create(): ${name} { return new ${name}(); }\n  }\n  ${usage}\n  return ${name};\n}`,
  },
  {
    variant: 'shadow-arrow-parameter',
    wrap: (name, usage) =>
      `export const shadowed = (${name}: any): unknown => {\n  ${usage}\n  return ${name};\n};`,
  },
];
