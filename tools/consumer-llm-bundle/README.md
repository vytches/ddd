# @vytches/ddd-consumer-llm-bundle

A standalone Node script that aggregates `LLMGUIDE.md` from every installed
`@vytches/ddd-*` package in your application's `node_modules` into a single
markdown file, ready to paste into Claude / Cursor / Copilot's context window.

**Pure Node, zero dependencies.** ~250 lines, single `.mjs` file. Works with
pnpm, npm, and yarn `node_modules` layouts.

---

## Why this exists

The full repo bundle (`pnpm llm:bundle`) is ~260K tokens — too big for
day-to-day pair programming with an AI assistant. The per-package `LLMGUIDE.md`
files are ~3-15K tokens each but scattered across `node_modules`. This script
gives you one ~30-50K-token file containing exactly the packages your project
actually uses, refreshable on demand.

---

## Quickstart for `juz-ide-api-1` (or any consumer app)

From your application's project root:

```bash
node /path/to/vytches-ddd/tools/consumer-llm-bundle/bin/generate.mjs
# -> writes ./vytches-ddd-context.md
```

Or with explicit paths:

```bash
node /path/to/vytches-ddd/tools/consumer-llm-bundle/bin/generate.mjs \
  --root . \
  --output .ai/vytches-ddd-context.md \
  --verbose
```

Add it as a script in your `package.json`:

```json
{
  "scripts": {
    "llm:vytches": "node ../vytches-ddd/tools/consumer-llm-bundle/bin/generate.mjs --output .ai/vytches-ddd-context.md"
  }
}
```

Run after every `pnpm install` / `pnpm update` to refresh.

---

## Vendoring (no monorepo on disk)

If your `juz-ide-api-1` checkout doesn't sit next to a `vytches-ddd` clone, copy
the single file into your project:

```bash
mkdir -p tools/llm
curl -fsSL \
  https://raw.githubusercontent.com/vytches/ddd/develop/tools/consumer-llm-bundle/bin/generate.mjs \
  > tools/llm/generate.mjs
chmod +x tools/llm/generate.mjs
```

(Or copy from a local clone — the file is self-contained.)

Then in your `package.json`:

```json
{
  "scripts": {
    "llm:vytches": "node tools/llm/generate.mjs --output .ai/vytches-ddd-context.md"
  }
}
```

---

## CLI flags

| Flag             | Default                    | Purpose                                                           |
| ---------------- | -------------------------- | ----------------------------------------------------------------- |
| `--output`, `-o` | `./vytches-ddd-context.md` | Bundle output path (relative to `--root`)                         |
| `--root`, `-r`   | current working directory  | Project root (where `node_modules/` lives)                        |
| `--verbose`      | off                        | Print per-package `[llm-bundle] including @vytches/...` to stderr |
| `--help`, `-h`   | —                          | Print usage and exit                                              |

Exit codes: `0` ok, `1` no `@vytches/ddd-*` packages found in `node_modules`,
`2` filesystem write error.

---

## What goes in the bundle

For each `@vytches/ddd-*` package found under `node_modules/@vytches/`:

1. **Header** — generation date, project path, version label (single version
   when uniform, "mixed" if your installed packages drift apart).
2. **Index table** — package name + version + description for everything
   included.
3. **Per-package sections** — each package's `LLMGUIDE.md` content (preferred)
   or `README.md` (fallback). H1 stripped to avoid duplicate top-level headings.
4. **Footer** — invariants for the AI assistant: Result<T,E>, no throws in
   domain, aggregate mutation rules, no-adapters principle.

Packages are ordered: `@vytches/ddd` meta first, then `contracts`,
`domain-primitives`, `utils`, `logging`, then alphabetical, with
`@vytches/ddd-nestjs` last.

---

## Recommended `.ai/` setup for AI-assisted development

```
.ai/
├── vytches-ddd-context.md    # this bundle, regenerated on lib update
├── project-conventions.md    # your team's coding standards
└── domain-glossary.md        # ubiquitous-language reference
```

Then in `CLAUDE.md` / `.cursorrules` / Copilot instructions:

```
@./.ai/vytches-ddd-context.md
@./.ai/project-conventions.md
@./.ai/domain-glossary.md
```

The `@./...` syntax pulls the file into the AI's context on every request — no
manual paste, no stale clipboard buffers.

---

## Sample run against `juz-ide-api-1`

```bash
$ node /opt/projects/vytches-ddd/tools/consumer-llm-bundle/bin/generate.mjs \
    --root /opt/projects/juz-ide-api-1 --verbose

[llm-bundle] including @vytches/ddd@0.23.5
[llm-bundle] including @vytches/ddd-nestjs@12.1.2
vytches-ddd-context: 2 packages -> vytches-ddd-context.md (38 KB, ~9801 tokens)
```

After upgrading `juz-ide-api-1` to `@vytches/ddd@^0.25.0-beta.1`, the same
command will pick up all 20 packages (foundation through nestjs).
