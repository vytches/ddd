import ts from 'typescript';

/** Description of one public entry point as the compiler sees it. */
export interface PublicApiDescription {
  /** `export <kind> <name> ...` lines, sorted by name: what a consumer's compiler would see. */
  readonly lines: readonly string[];
  /** Exported names that lack a `@beta` or a `@since` tag in their doc comment. */
  readonly untagged: readonly string[];
}

const TYPE_FLAGS =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

/**
 * Reads the exports of `entry` (a `.ts` file) with the TypeScript checker and renders each one
 * as a declaration line. Interfaces and type aliases are printed without comments, functions as
 * their signatures, constants as their types, classes by constructor and instance members.
 */
export function describePublicApi(entry: string): PublicApiDescription {
  const program = ts.createProgram([entry], {
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    experimentalDecorators: true,
    strict: true,
    resolveJsonModule: true,
    types: ['node'],
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  const moduleSymbol = source ? checker.getSymbolAtLocation(source) : undefined;
  if (!moduleSymbol) throw new Error(`No module symbol for ${entry}`);

  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  const lines: string[] = [];
  const untagged: string[] = [];

  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    const target =
      exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const decl = target.declarations?.[0];
    if (!decl) throw new Error(`Export ${exported.name} of ${entry} has no declaration`);

    const tags = new Set(target.getJsDocTags(checker).map(tag => tag.name));
    if (!tags.has('beta') || !tags.has('since')) untagged.push(exported.name);

    lines.push(`${describe(exported.name, target, decl, checker, printer)}`);
  }
  return { lines: lines.sort(), untagged: untagged.sort() };
}

function describe(
  name: string,
  symbol: ts.Symbol,
  decl: ts.Declaration,
  checker: ts.TypeChecker,
  printer: ts.Printer
): string {
  if (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl)) {
    const kind = ts.isInterfaceDeclaration(decl) ? 'interface' : 'type';
    return `${kind} ${name}: ${normalize(printer.printNode(ts.EmitHint.Unspecified, decl, decl.getSourceFile()))}`;
  }
  const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
  if (ts.isFunctionDeclaration(decl)) {
    const signatures = checker
      .getSignaturesOfType(type, ts.SignatureKind.Call)
      .map(sig => checker.signatureToString(sig, decl, TYPE_FLAGS));
    return `function ${name}: ${signatures.join(' | ')}`;
  }
  if (ts.isClassDeclaration(decl)) {
    const ctors = checker
      .getSignaturesOfType(type, ts.SignatureKind.Construct)
      .map(sig => checker.signatureToString(sig, decl, TYPE_FLAGS, ts.SignatureKind.Construct));
    const instance = checker.getDeclaredTypeOfSymbol(symbol);
    const members = checker
      .getPropertiesOfType(instance)
      .filter(p => p.declarations?.some(d => d.getSourceFile() === decl.getSourceFile()))
      .map(
        p =>
          `${p.name}: ${checker.typeToString(checker.getTypeOfSymbolAtLocation(p, decl), decl, TYPE_FLAGS)}`
      )
      .sort();
    return `class ${name}: ${ctors.join(' | ')} { ${members.join('; ')} }`;
  }
  return `const ${name}: ${checker.typeToString(type, decl, TYPE_FLAGS)}`;
}

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();
