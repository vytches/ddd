#!/usr/bin/env node

/**
 * @vytches/ddd CLI — LLM Context Distribution
 *
 * Copies LLM-optimized documentation to your project for AI coding assistants.
 *
 * Usage:
 *   npx @vytches/ddd                     # Copy to .claude/vytches-ddd/
 *   npx @vytches/ddd --dir .             # Copy to custom directory
 *   npx @vytches/ddd --verify            # Check if local copy is up-to-date
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, '..');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

function log(color, symbol, msg) {
  console.log(`${color}${symbol}${COLORS.reset} ${msg}`);
}

function md5(content) {
  return createHash('md5').update(content).digest('hex');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args.find(a => !a.startsWith('-')) || 'init-context';
  const flags = {
    dir: null,
    verify: args.includes('--verify'),
    help: args.includes('--help') || args.includes('-h'),
  };

  const dirIdx = args.indexOf('--dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    flags.dir = args[dirIdx + 1];
  }

  return { command, flags };
}

function findNodeModules(startDir) {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    const nm = join(dir, 'node_modules');
    if (existsSync(nm)) return nm;
    dir = dirname(dir);
  }
  return null;
}

function collectLLMGuides(nodeModulesDir) {
  const guides = [];
  const vytchesDir = join(nodeModulesDir, '@vytches');

  if (!existsSync(vytchesDir)) return guides;

  for (const entry of readdirSync(vytchesDir)) {
    const guidePath = join(vytchesDir, entry, 'LLMGUIDE.md');
    if (existsSync(guidePath)) {
      guides.push({
        package: `@vytches/${entry}`,
        shortName: entry.replace(/^ddd-/, ''),
        path: guidePath,
        content: readFileSync(guidePath, 'utf-8'),
      });
    }
  }

  return guides.sort((a, b) => a.shortName.localeCompare(b.shortName));
}

function buildManifest(masterContent, guides) {
  return {
    version: getPackageVersion(),
    generatedAt: new Date().toISOString(),
    masterHash: md5(masterContent),
    guides: guides.map(g => ({
      package: g.package,
      file: `${g.shortName}.md`,
      hash: md5(g.content),
    })),
  };
}

function getPackageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

function initContext(targetDir) {
  const masterPath = join(PACKAGE_ROOT, 'llm-context.md');
  if (!existsSync(masterPath)) {
    log(COLORS.red, '!', 'llm-context.md not found in package. Was the package installed correctly?');
    process.exit(1);
  }

  const masterContent = readFileSync(masterPath, 'utf-8');

  // Find and collect per-package guides
  const nodeModulesDir = findNodeModules(process.cwd());
  const guides = nodeModulesDir ? collectLLMGuides(nodeModulesDir) : [];

  // Create target directory
  mkdirSync(targetDir, { recursive: true });

  // Write master context
  writeFileSync(join(targetDir, 'llm-context.md'), masterContent);
  log(COLORS.green, '+', `llm-context.md ${COLORS.dim}(master context)${COLORS.reset}`);

  // Write per-package guides
  for (const guide of guides) {
    writeFileSync(join(targetDir, `${guide.shortName}.md`), guide.content);
    log(COLORS.green, '+', `${guide.shortName}.md ${COLORS.dim}(${guide.package})${COLORS.reset}`);
  }

  // Write manifest for verification
  const manifest = buildManifest(masterContent, guides);
  writeFileSync(join(targetDir, '.manifest.json'), JSON.stringify(manifest, null, 2));

  return { masterContent, guides, manifest };
}

function verifyContext(targetDir) {
  const manifestPath = join(targetDir, '.manifest.json');
  if (!existsSync(manifestPath)) {
    log(COLORS.yellow, '?', `No manifest found at ${targetDir}. Run 'init-context' first.`);
    return false;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  let allFresh = true;

  // Check master context
  const masterPath = join(PACKAGE_ROOT, 'llm-context.md');
  if (existsSync(masterPath)) {
    const currentHash = md5(readFileSync(masterPath, 'utf-8'));
    if (currentHash !== manifest.masterHash) {
      log(COLORS.yellow, '!', `llm-context.md is OUTDATED (installed: ${manifest.version})`);
      allFresh = false;
    } else {
      log(COLORS.green, '+', 'llm-context.md is up-to-date');
    }
  }

  // Check per-package guides
  const nodeModulesDir = findNodeModules(process.cwd());
  const currentGuides = nodeModulesDir ? collectLLMGuides(nodeModulesDir) : [];

  for (const guide of currentGuides) {
    const recorded = manifest.guides.find(g => g.package === guide.package);
    const currentHash = md5(guide.content);

    if (!recorded) {
      log(COLORS.yellow, '+', `${guide.package} has a NEW guide not in your local copy`);
      allFresh = false;
    } else if (currentHash !== recorded.hash) {
      log(COLORS.yellow, '!', `${guide.package} guide is OUTDATED`);
      allFresh = false;
    } else {
      log(COLORS.green, '+', `${guide.package} guide is up-to-date`);
    }
  }

  // Check for removed guides
  for (const recorded of manifest.guides) {
    const stillExists = currentGuides.find(g => g.package === recorded.package);
    if (!stillExists) {
      log(COLORS.dim, '-', `${recorded.package} guide no longer available (package removed?)`);
    }
  }

  if (allFresh) {
    log(COLORS.green, '\n=', `All context files are up-to-date (v${manifest.version})`);
  } else {
    log(COLORS.yellow, '\n!', `Some files are outdated. Run 'npx @vytches/ddd' to update.`);
  }

  return allFresh;
}

function printHelp() {
  console.log(`
${COLORS.cyan}@vytches/ddd${COLORS.reset} — LLM Context Distribution

${COLORS.cyan}Usage:${COLORS.reset}
  npx @vytches/ddd                   Copy context to .claude/vytches-ddd/
  npx @vytches/ddd --dir DIR         Copy context to custom directory
  npx @vytches/ddd --verify          Check if local copy is up-to-date

${COLORS.cyan}What it does:${COLORS.reset}
  Copies LLM-optimized documentation for AI coding assistants (Claude Code,
  Copilot, Cursor, etc.) into your project. The context files help AI tools
  generate correct DDD code using @vytches/ddd patterns.

${COLORS.cyan}Files copied:${COLORS.reset}
  llm-context.md     Master context — architecture, API reference, anti-patterns
  <package>.md       Per-package guides with quick start and patterns
  .manifest.json     Version manifest for freshness verification

${COLORS.cyan}After init:${COLORS.reset}
  Add to your project's CLAUDE.md or AI assistant context:
    @.claude/vytches-ddd/llm-context.md
`);
}

// --- Main ---

const { command, flags } = parseArgs(process.argv);

if (flags.help) {
  printHelp();
  process.exit(0);
}

if (command === 'init-context' || command === 'init') {
  const targetDir = resolve(process.cwd(), flags.dir || '.claude/vytches-ddd');

  if (flags.verify) {
    const ok = verifyContext(targetDir);
    process.exit(ok ? 0 : 1);
  }

  console.log(`\n${COLORS.cyan}@vytches/ddd${COLORS.reset} — Initializing LLM context\n`);

  const { guides, manifest } = initContext(targetDir);

  console.log(`\n${COLORS.green}Done!${COLORS.reset} Context files written to ${COLORS.cyan}${targetDir}${COLORS.reset}`);
  console.log(`  Master context + ${guides.length} package guide(s) (v${manifest.version})\n`);
  console.log(`${COLORS.dim}Next steps:${COLORS.reset}`);
  console.log(`  1. Add to your CLAUDE.md:  ${COLORS.cyan}@.claude/vytches-ddd/llm-context.md${COLORS.reset}`);
  console.log(`  2. Or add to .cursorrules / .github/copilot-instructions.md`);
  console.log(`  3. Run ${COLORS.cyan}npx @vytches/ddd --verify${COLORS.reset} after updates\n`);
} else {
  log(COLORS.red, '!', `Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}
