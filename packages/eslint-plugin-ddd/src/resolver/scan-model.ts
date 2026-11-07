import { emptyModel, type HeritageRef, type ModuleModel } from './module-model';
import { tokenize, type Token } from './tokenizer';

type Toks = readonly Token[];
const isId = (t: Token | undefined, v?: string): t is Token =>
  t !== undefined && t.t === 'id' && (v === undefined || t.v === v);
const isP = (t: Token | undefined, v: string): boolean => t?.t === 'p' && t.v === v;

interface Path {
  readonly root: string;
  readonly rest: string[];
  readonly next: number;
}

/** Reads `a.b.c` starting at `i`. */
function readPath(T: Toks, i: number): Path | undefined {
  const first = T[i];
  if (!isId(first)) return undefined;
  const rest: string[] = [];
  let j = i + 1;
  while (isP(T[j], '.') && isId(T[j + 1])) {
    rest.push((T[j + 1] as Token).v);
    j += 2;
  }
  return { root: first.v, rest, next: j };
}

/** Skips a `<...>` group starting at `i` (type parameters / arguments). */
function skipAngles(T: Toks, i: number): number {
  if (!isP(T[i], '<')) return i;
  let depth = 0;
  for (let j = i; j < T.length; j++) {
    if (isP(T[j], '<')) depth++;
    else if (isP(T[j], '>') && !isP(T[j - 1], '=') && --depth === 0) return j + 1;
    else if (isP(T[j], '{') || isP(T[j], ';')) return j;
  }
  return T.length;
}

function skipParens(T: Toks, i: number): number {
  let depth = 0;
  for (let j = i; j < T.length; j++) {
    if (isP(T[j], '(')) depth++;
    else if (isP(T[j], ')') && --depth === 0) return j + 1;
  }
  return T.length;
}

interface SpecEntry {
  readonly imported: string;
  readonly local: string;
}

/** Parses `{ a, type b, c as d }` starting at the `{`. */
function readSpecList(T: Toks, i: number): { entries: SpecEntry[]; next: number } {
  const entries: SpecEntry[] = [];
  let group: string[] = [];
  const flush = () => {
    let g = group;
    group = [];
    if (g.length > 1 && g[0] === 'type' && g[1] !== 'as') g = g.slice(1);
    const first = g[0];
    if (first === undefined) return;
    if (g.length >= 3 && g[g.length - 2] === 'as') {
      entries.push({ imported: first, local: g[g.length - 1] as string });
    } else entries.push({ imported: first, local: first });
  };
  let j = i + 1;
  for (; j < T.length; j++) {
    const t = T[j] as Token;
    if (isP(t, '}')) {
      flush();
      return { entries, next: j + 1 };
    }
    if (isP(t, ',')) flush();
    else if (t.t === 'id' || t.t === 'str') group.push(t.v);
  }
  flush();
  return { entries, next: j };
}

function parseImport(T: Toks, start: number, m: ModuleModel): number {
  let i = start;
  if (T[i]?.t === 'str') return i + 1;
  if (isId(T[i], 'type') && !isId(T[i + 1], 'from') && !isP(T[i + 1], ',') && !isP(T[i + 1], '=')) {
    i++;
  }
  let def: string | undefined;
  if (isId(T[i]) && !isId(T[i], 'from')) {
    def = (T[i] as Token).v;
    i++;
    if (isP(T[i], '=')) {
      if (isId(T[i + 1], 'require') && isP(T[i + 2], '(') && T[i + 3]?.t === 'str') {
        m.imports.set(def, { source: (T[i + 3] as Token).v, path: [] });
        return i + 5;
      }
      return i + 1;
    }
    if (isP(T[i], ',')) i++;
  } else if (isId(T[i], 'from') && isId(T[i + 1], 'from')) {
    def = 'from';
    i++;
  }
  let ns: string | undefined;
  let named: SpecEntry[] = [];
  if (isP(T[i], '*')) {
    if (isId(T[i + 1], 'as') && isId(T[i + 2])) ns = (T[i + 2] as Token).v;
    i += 3;
  } else if (isP(T[i], '{')) {
    const list = readSpecList(T, i);
    named = list.entries;
    i = list.next;
  }
  if (!isId(T[i], 'from') || T[i + 1]?.t !== 'str') return i;
  const source = (T[i + 1] as Token).v;
  if (def) m.imports.set(def, { source, path: ['default'] });
  if (ns) m.imports.set(ns, { source, path: [] });
  for (const e of named) m.imports.set(e.local, { source, path: [e.imported] });
  return i + 2;
}

function readHeritageList(
  T: Toks,
  start: number,
  kind: HeritageRef['kind'],
  out: HeritageRef[]
): number {
  let i = start;
  for (;;) {
    const p = readPath(T, i);
    if (!p) return i;
    i = skipAngles(T, p.next);
    if (isP(T[i], '(')) return i; // call expression (mixin): unsupported, stays silent
    out.push({ kind, root: p.root, rest: p.rest });
    if (!isP(T[i], ',')) return i;
    i++;
  }
}

function parseClass(
  T: Toks,
  start: number,
  m: ModuleModel,
  decorators: readonly HeritageRef[]
): { next: number; name: string | undefined } {
  let i = start;
  let name: string | undefined;
  if (isId(T[i]) && !isId(T[i], 'extends') && !isId(T[i], 'implements')) {
    name = (T[i] as Token).v;
    i++;
  }
  i = skipAngles(T, i);
  const heritage: HeritageRef[] = [...decorators];
  if (isId(T[i], 'extends')) i = readHeritageList(T, i + 1, 'extends', heritage);
  if (isId(T[i], 'implements')) i = readHeritageList(T, i + 1, 'implements', heritage);
  if (name) m.locals.set(name, { name, heritage });
  return { next: i, name };
}

function parseInterface(T: Toks, start: number, m: ModuleModel): { next: number; name?: string } {
  let i = start;
  const name = isId(T[i]) ? (T[i] as Token).v : undefined;
  i = skipAngles(T, name ? i + 1 : i);
  const heritage: HeritageRef[] = [];
  if (isId(T[i], 'extends')) i = readHeritageList(T, i + 1, 'extends', heritage);
  if (name) m.locals.set(name, { name, heritage });
  return name ? { next: i, name } : { next: i };
}

/** `const A = Import` / `const A = ns.X`: records an alias; returns the declared name. */
function parseVar(T: Toks, start: number, m: ModuleModel): { next: number; name?: string } {
  const first = T[start];
  if (!isId(first)) return { next: start };
  let i = start + 1;
  if (isP(T[i], ':')) {
    while (i < T.length && !isP(T[i], '=') && !isP(T[i], ';')) i++;
  }
  if (isP(T[i], '=')) {
    const p = readPath(T, i + 1);
    if (p && !isP(T[p.next], '(') && !isP(T[p.next], '[') && !isP(T[p.next], '=')) {
      m.aliases.set(first.v, { root: p.root, rest: p.rest });
      return { next: p.next, name: first.v };
    }
  }
  return { next: i, name: first.v };
}

function parseDecorator(T: Toks, start: number): { ref?: HeritageRef; next: number } {
  const p = readPath(T, start);
  if (!p) return { next: start };
  const next = isP(T[p.next], '(') ? skipParens(T, p.next) : p.next;
  return { ref: { kind: 'decorator', root: p.root, rest: p.rest }, next };
}

function parseExport(
  T: Toks,
  start: number,
  m: ModuleModel,
  decorators: readonly HeritageRef[]
): number {
  let i = start;
  if (isId(T[i], 'type') && (isP(T[i + 1], '{') || isP(T[i + 1], '*'))) i++;
  const t = T[i];
  if (isP(t, '*')) {
    if (isId(T[i + 1], 'as') && isId(T[i + 2]) && isId(T[i + 3], 'from') && T[i + 4]?.t === 'str') {
      m.exports.set((T[i + 2] as Token).v, {
        kind: 'from',
        source: (T[i + 4] as Token).v,
        path: [],
      });
      return i + 5;
    }
    if (isId(T[i + 1], 'from') && T[i + 2]?.t === 'str') {
      m.stars.push((T[i + 2] as Token).v);
      return i + 3;
    }
    return i + 1;
  }
  if (isP(t, '{')) {
    const list = readSpecList(T, i);
    if (isId(T[list.next], 'from') && T[list.next + 1]?.t === 'str') {
      const source = (T[list.next + 1] as Token).v;
      for (const e of list.entries) {
        m.exports.set(e.local, { kind: 'from', source, path: [e.imported] });
      }
      return list.next + 2;
    }
    // `{ imported as exported }` is stored as imported/local; for exports the order flips.
    for (const e of list.entries) m.exports.set(e.local, { kind: 'local', local: e.imported });
    return list.next;
  }
  if (isId(t, 'default')) {
    i++;
    if (isId(T[i], 'abstract')) i++;
    if (isId(T[i], 'class')) {
      const c = parseClass(T, i + 1, m, decorators);
      if (c.name) m.exports.set('default', { kind: 'local', local: c.name });
      return c.next;
    }
    if (isId(T[i]) && !isId(T[i], 'function') && !isId(T[i], 'async') && !isP(T[i + 1], '(')) {
      m.exports.set('default', { kind: 'local', local: (T[i] as Token).v });
      return i + 1;
    }
    return i;
  }
  return parseExportedDeclaration(T, i, m, decorators);
}

function declaredName(
  T: Toks,
  kwIndex: number,
  setLocal: (name: string | undefined) => void
): number {
  let j = kwIndex + 1;
  if (isP(T[j], '*')) j++;
  if (isId(T[j])) setLocal((T[j] as Token).v);
  return j + 1;
}

function parseExportedDeclaration(
  T: Toks,
  start: number,
  m: ModuleModel,
  decorators: readonly HeritageRef[]
): number {
  let i = start;
  while (isId(T[i], 'declare') || isId(T[i], 'abstract') || isId(T[i], 'async')) i++;
  const kw = T[i];
  if (!isId(kw)) return i;
  const setLocal = (name: string | undefined) => {
    if (name) m.exports.set(name, { kind: 'local', local: name });
  };
  switch (kw.v) {
    case 'class': {
      const c = parseClass(T, i + 1, m, decorators);
      setLocal(c.name);
      return c.next;
    }
    case 'interface': {
      const c = parseInterface(T, i + 1, m);
      setLocal(c.name);
      return c.next;
    }
    case 'const':
    case 'let':
    case 'var': {
      if (isId(T[i + 1], 'enum')) return declaredName(T, i + 1, setLocal);
      const v = parseVar(T, i + 1, m);
      setLocal(v.name);
      return v.next;
    }
    case 'enum':
    case 'type':
    case 'namespace':
    case 'module':
    case 'function':
      return declaredName(T, i, setLocal);
    default:
      return i + 1;
  }
}

/** Builds a `ModuleModel` from raw source text (top-level statements only). */
export function modelFromText(src: string): ModuleModel {
  const m = emptyModel();
  if (!/\b(?:import|export|class|interface)\b/.test(src)) return m;
  const T = tokenize(src);
  let depth = 0;
  let pending: HeritageRef[] = [];
  let i = 0;
  while (i < T.length) {
    const tok = T[i] as Token;
    if (tok.t === 'p') {
      if (depth === 0 && tok.v === '@') {
        const d = parseDecorator(T, i + 1);
        if (d.ref) pending = [...pending, d.ref];
        i = d.next > i ? d.next : i + 1;
        continue;
      }
      if (tok.v === '{' || tok.v === '(' || tok.v === '[') depth++;
      else if (tok.v === '}' || tok.v === ')' || tok.v === ']') depth = Math.max(0, depth - 1);
      else if (tok.v === ';') pending = [];
      i++;
      continue;
    }
    if (depth > 0 || tok.t !== 'id' || isP(T[i - 1], '.')) {
      i++;
      continue;
    }
    switch (tok.v) {
      case 'import':
        i = isP(T[i + 1], '(') ? i + 1 : parseImport(T, i + 1, m);
        break;
      case 'export':
        i = parseExport(T, i + 1, m, pending);
        pending = [];
        break;
      case 'class':
        i = parseClass(T, i + 1, m, pending).next;
        pending = [];
        break;
      case 'interface':
        i = parseInterface(T, i + 1, m).next;
        break;
      case 'const':
      case 'let':
      case 'var':
        i = parseVar(T, i + 1, m).next;
        break;
      default:
        i++;
    }
  }
  return m;
}
