'use strict';
// VF-043 AC-SPIKE (b) prototype: untyped role resolver.
// A class gets a role when it extends a bound base class or carries a bound decorator, matched by
// import source (package name, relative path or tsconfig `paths` alias, following barrel re-exports),
// or when its file matches a glob binding. Single-file, no type information.
const fs = require('fs');
const path = require('path');

const TS_EXT = ['.ts', '.tsx', '.d.ts'];

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function createRoleResolver({ cwd, paths = {}, baseUrl = '.', bindings }) {
  const root = path.resolve(cwd, baseUrl);
  const aliasEntries = Object.entries(paths)
    .map(([k, v]) => ({
      prefix: k.replace(/\*$/, ''),
      wildcard: k.endsWith('*'),
      target: v[0].replace(/\*$/, ''),
    }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  const fileCache = new Map();
  const reexportCache = new Map();

  const norm = b => ({
    ...b,
    fileRe: b.files ? globToRegExp(b.files) : null,
    target: b.extends || b.decorator || null,
    targetFile:
      (b.extends || b.decorator) && !isPackage((b.extends || b.decorator).from)
        ? stripExt(path.resolve(cwd, (b.extends || b.decorator).from))
        : null,
  });
  const compiled = bindings.map(norm);

  // A binding target is a project file when it names a .ts file (relative to cwd); otherwise a package.
  function isPackage(spec) {
    return !/\.tsx?$/.test(spec);
  }
  function stripExt(p) {
    return p.replace(/\.(d\.)?tsx?$/, '').replace(/\/index$/, '');
  }

  function resolveSpecifier(spec, fromFile) {
    let base = null;
    if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
    else {
      for (const a of aliasEntries) {
        if (a.wildcard ? spec.startsWith(a.prefix) : spec === a.prefix) {
          base = path.resolve(root, a.target + (a.wildcard ? spec.slice(a.prefix.length) : ''));
          break;
        }
      }
    }
    if (!base) return null;
    if (fileCache.has(base)) return fileCache.get(base);
    let hit = null;
    for (const ext of TS_EXT)
      if (fs.existsSync(base + ext)) {
        hit = base + ext;
        break;
      }
    if (!hit)
      for (const ext of TS_EXT) {
        const p = path.join(base, 'index' + ext);
        if (fs.existsSync(p)) {
          hit = p;
          break;
        }
      }
    fileCache.set(base, hit);
    return hit;
  }

  // Does `file` define or re-export `name` from `targetFile`? Follows `export {x} from` / `export * from`.
  function reaches(file, name, targetFile, depth = 0) {
    if (!file || depth > 6) return false;
    if (stripExt(file) === targetFile) return true;
    const key = `${file}|${name}|${targetFile}`;
    if (reexportCache.has(key)) return reexportCache.get(key);
    reexportCache.set(key, false);
    let src = '';
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      return false;
    }
    let ok = false;
    const re = /export\s+(\*|\{([^}]*)\})\s+from\s+['"]([^'"]+)['"]/g;
    for (let m; !ok && (m = re.exec(src)); ) {
      const names = m[1] === '*' ? null : m[2].split(',').map(s => s.trim().split(/\s+as\s+/));
      const pair = names && names.find(p => (p[1] || p[0]).replace(/^type\s+/, '') === name);
      if (m[1] !== '*' && !pair) continue;
      const orig = pair ? pair[0].replace(/^type\s+/, '') : name;
      ok = reaches(resolveSpecifier(m[3], file), orig, targetFile, depth + 1);
    }
    reexportCache.set(key, ok);
    return ok;
  }

  function importMap(ast) {
    const map = new Map();
    for (const st of ast.body) {
      if (st.type !== 'ImportDeclaration') continue;
      for (const s of st.specifiers) {
        if (s.type === 'ImportSpecifier')
          map.set(s.local.name, { imported: s.imported.name, source: st.source.value });
      }
    }
    return map;
  }

  function matchesTarget(b, localName, imports, filename) {
    const imp = imports.get(localName);
    if (!imp || imp.imported !== b.target.name) return false;
    if (!b.targetFile) {
      const pkg = b.target.from;
      return (
        imp.source === pkg ||
        imp.source.startsWith(pkg + '/') ||
        (b.target.fromPrefix && imp.source.startsWith(b.target.fromPrefix))
      );
    }
    return reaches(resolveSpecifier(imp.source, filename), imp.imported, b.targetFile);
  }

  function decoratorName(d) {
    const e = d.expression.type === 'CallExpression' ? d.expression.callee : d.expression;
    return e.type === 'Identifier' ? e.name : null;
  }

  // Returns [{ node, name, roles: Set<string> }] for every class in the file.
  function classify(ast, filename) {
    const imports = importMap(ast);
    const rel = path.relative(cwd, filename).split(path.sep).join('/');
    const out = [];
    const visit = node => {
      if (!node || typeof node.type !== 'string') return;
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        const roles = new Set();
        for (const b of compiled) {
          if (
            b.extends &&
            node.superClass &&
            node.superClass.type === 'Identifier' &&
            matchesTarget(b, node.superClass.name, imports, filename)
          )
            roles.add(b.role);
          if (
            b.decorator &&
            (node.decorators || []).some(d => {
              const n = decoratorName(d);
              return n && matchesTarget(b, n, imports, filename);
            })
          )
            roles.add(b.role);
          if (b.fileRe && b.fileRe.test(rel)) roles.add(b.role);
        }
        out.push({ node, name: node.id ? node.id.name : '<anonymous>', roles });
      }
      for (const k of Object.keys(node)) {
        if (k === 'parent') continue;
        const v = node[k];
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v.type === 'string') visit(v);
      }
    };
    visit(ast);
    return out;
  }

  // Validates bindings: every non-package target file must exist.
  function validate() {
    return compiled
      .filter(b => b.targetFile && !TS_EXT.some(e => fs.existsSync(b.targetFile + e)))
      .map(b => `binding for role "${b.role}": ${b.target.from} does not exist`);
  }

  return { classify, validate };
}

module.exports = { createRoleResolver, globToRegExp };
