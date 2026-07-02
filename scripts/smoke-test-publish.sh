#!/bin/bash
# smoke-test-publish.sh — Publish Integrity Smoke Test (VB-002, AC1)
#
# Verifies that every publishable package in packages/*/ actually works for
# a real external consumer, not just inside this pnpm workspace. This is the
# check that would have caught every finding in VB-002: broken .d.ts paths
# (F-C1), the testing package's ESM require() crash (F-C2), undeclared
# reflect-metadata (F-C3), and 18 phantom workspace dependencies (F-H1).
#
# Why "outside the pnpm workspace" matters: installing a package inside this
# monorepo lets pnpm's hoisting/symlinked node_modules silently resolve
# dependencies that were never declared in the package's own manifest. That
# is exactly how the 18 phantom deps went unnoticed for this long. Every
# install here happens in an isolated tmp directory with a bare `npm install`
# (no workspace, no hoisting).
#
# Why local tarballs instead of a registry: the `@vytches` scope is already
# published on the real npm registry up to the current version numbers (this
# repo had earlier partial publishes). If package X declares a dependency on
# "@vytches/ddd-contracts@0.30.0" and we let npm resolve that from the real
# registry, we'd silently test against the OLD ALREADY-PUBLISHED code, not
# today's local fixes — producing false results in both directions. Instead,
# every package in the workspace is `pnpm pack`-ed once up front, and each
# package-under-test is installed together with the packed tarballs of its
# full transitive `@vytches/ddd-*` dependency closure, passed as local file
# paths to a single `npm install`. Node's module resolution is purely
# filesystem-based, so this produces the exact same node_modules layout a
# real consumer would get after `npm install <pkg>` pulls in its real
# dependencies — without touching any registry for `@vytches/*` packages.
# (A local Verdaccio-backed publish was tried first but requires bypassing
# each package's `publishConfig.registry: npmjs.org`, which is exactly the
# kind of "quietly hit the real registry" foot-gun this script should avoid.)
#
# For each package with a `dist/` (i.e. already built via `pnpm build`):
#   1. `pnpm pack` every package once (pnpm, not npm — see note below on
#      workspace:* rewriting).
#   2. `npm install <tarball> <closure-tarballs...>` (+ required
#      peerDependencies, resolved from the real registry as any real
#      consumer would) in an isolated directory outside the workspace.
#   3. `require()` (CJS) and dynamic `import()` (ESM) it, asserting it
#      actually exports something.
#   4. `tsc --noEmit` a trivial consumer .ts file that imports the package's
#      types, proving the shipped `.d.ts` resolves on its own.
#
# Usage:
#   pnpm build && bash scripts/smoke-test-publish.sh
#   pnpm test:smoke

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

HAS_ERRORS=0
TESTED=0
SKIPPED=0

SMOKE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/vytches-ddd-smoke.XXXXXX")"
trap 'rm -rf "$SMOKE_ROOT"' EXIT

echo "🧪 Publish Integrity Smoke Test"
echo "================================"
echo "Isolated workspace (outside pnpm monorepo): $SMOKE_ROOT"

# --- F-C1 CI guard -----------------------------------------------------
# No package's shipped .d.ts may reference a monorepo-relative source path.
# If this ever fails again, scripts/fix-dts-imports.js (run via `pnpm
# fix:dts` as part of `pnpm build`) either didn't run or missed a package.
echo -e "\n📌 Checking packages/*/dist for unresolved '/src/index.ts' imports..."
LEAKED="$(grep -rl "/src/index.ts" packages/*/dist 2>/dev/null || true)"
if [ -n "$LEAKED" ]; then
  echo -e "${RED}❌ Found monorepo-relative '/src/index.ts' imports leaking into published dist:${NC}"
  echo "$LEAKED"
  HAS_ERRORS=1
else
  echo -e "${GREEN}✅ No '/src/index.ts' leaks in any package's dist${NC}"
fi

# --- Pack every buildable package once, up front ------------------------
PACK_DIR="$SMOKE_ROOT/pack"
mkdir -p "$PACK_DIR"
echo -e "\n📌 Packing every package (pnpm pack rewrites workspace:* to real versions)..."
declare -A TARBALL_BY_DIR
for pkg_dir in packages/*/; do
  pkg_dir_name="$(basename "$pkg_dir")"
  [ -f "${pkg_dir}package.json" ] || continue
  [ -d "${pkg_dir}dist" ] || continue

  is_private="$(node -e "console.log(require('./${pkg_dir}package.json').private === true)")"
  [ "$is_private" = "true" ] && continue

  # `pnpm pack` prints the tarball's FULL PATH as its last stdout line
  # (unlike `npm pack`, which prints only the filename).
  tarball_path="$(cd "$pkg_dir" && pnpm pack --pack-destination "$PACK_DIR/$pkg_dir_name" 2>/dev/null | tail -n 1)"
  if [ -f "$tarball_path" ]; then
    TARBALL_BY_DIR["$pkg_dir_name"]="$tarball_path"
  else
    echo -e "${RED}❌ pnpm pack failed for $pkg_dir_name${NC}"
    HAS_ERRORS=1
  fi
done
echo -e "${GREEN}✅ Packed ${#TARBALL_BY_DIR[@]} packages${NC}"

# --- Transitive @vytches/ddd-* dependency closure, from source manifests ---
# (dependencies are identical whether read from packages/*/package.json or
# from the packed tarball — reading source avoids re-extracting each tarball).
compute_closure() {
  local start_dir="$1"
  node -e "
    const fs = require('fs');
    const path = require('path');
    const packagesDir = path.join('$REPO_ROOT', 'packages');

    const nameToDir = new Map();
    for (const dir of fs.readdirSync(packagesDir)) {
      const pkgPath = path.join(packagesDir, dir, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      nameToDir.set(pkg.name, dir);
    }

    const visited = new Set();
    const queue = ['$start_dir'];
    while (queue.length > 0) {
      const dir = queue.shift();
      if (visited.has(dir)) continue;
      visited.add(dir);
      const pkgPath = path.join(packagesDir, dir, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      for (const dep of Object.keys(pkg.dependencies || {})) {
        if (dep.startsWith('@vytches/ddd-') && nameToDir.has(dep)) {
          queue.push(nameToDir.get(dep));
        }
      }
    }
    visited.delete('$start_dir');
    console.log([...visited].join(' '));
  "
}

# Shared TypeScript install, reused for every package's consumer.ts check so
# we don't re-fetch typescript from the registry 19 times.
TSC_HOME="$SMOKE_ROOT/tsc-runner"
mkdir -p "$TSC_HOME"
echo -e "\n📌 Installing a shared TypeScript for consumer type-checks..."
(cd "$TSC_HOME" && npm init -y > /dev/null 2>&1 && npm install --no-audit --no-fund --silent --ignore-scripts typescript@5.8.2 @types/node@22 > /dev/null 2>&1)
TSC_BIN="$TSC_HOME/node_modules/.bin/tsc"
TSC_TYPE_ROOTS="$TSC_HOME/node_modules/@types"
if [ ! -x "$TSC_BIN" ]; then
  echo -e "${RED}❌ Could not install a local TypeScript for smoke testing${NC}"
  exit 1
fi

for pkg_dir in packages/*/; do
  pkg_dir_name="$(basename "$pkg_dir")"
  [ -f "${pkg_dir}package.json" ] || continue

  is_private="$(node -e "console.log(require('./${pkg_dir}package.json').private === true)")"
  if [ "$is_private" = "true" ]; then
    echo -e "\n⏭️  Skipping $pkg_dir_name (private package)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if [ ! -d "${pkg_dir}dist" ]; then
    echo -e "\n${YELLOW}⚠️  Skipping $pkg_dir_name — no dist/ (run 'pnpm build' first)${NC}"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  pkg_name="$(node -e "console.log(require('./${pkg_dir}package.json').name)")"
  echo -e "\n📦 Smoke-testing $pkg_name ..."
  TESTED=$((TESTED + 1))

  TARBALL_PATH="${TARBALL_BY_DIR[$pkg_dir_name]:-}"
  if [ -z "$TARBALL_PATH" ] || [ ! -f "$TARBALL_PATH" ]; then
    echo -e "${RED}❌ $pkg_name: no tarball available (pack step failed earlier)${NC}"
    HAS_ERRORS=1
    continue
  fi

  INSTALL_DIR="$SMOKE_ROOT/install/$pkg_dir_name"
  mkdir -p "$INSTALL_DIR"

  # Every @vytches/ddd-* dependency (direct + transitive) as a local tarball
  # path, so npm never needs to touch the (already-published, out of date)
  # real registry for anything in this scope — this is what makes the test
  # validate TODAY's local fixes instead of yesterday's published artifacts.
  CLOSURE_ARGS=()
  for dep_dir in $(compute_closure "$pkg_dir_name"); do
    dep_tarball="${TARBALL_BY_DIR[$dep_dir]:-}"
    if [ -n "$dep_tarball" ] && [ -f "$dep_tarball" ]; then
      CLOSURE_ARGS+=("$dep_tarball")
    fi
  done

  # Resolve non-optional peerDependencies (as their FULL semver range, e.g.
  # "^10.0.0 || ^11.0.0", passed as a single npm argument) so packages like
  # `nestjs` (@nestjs/common, @nestjs/core) install cleanly with a mutually
  # compatible set — these are real, already-published npm packages, so
  # resolving them from the real registry is correct and expected. Packages
  # where reflect-metadata is an *optional* peer (cqrs, di, events,
  # domain-services — F-C3) deliberately do NOT get it installed here: the
  # whole point is proving require()/import() succeed without it.
  mapfile -t PEER_INSTALL_ARGS < <(node -e "
    const pkg = require('./${pkg_dir}package.json');
    const peers = pkg.peerDependencies || {};
    const meta = pkg.peerDependenciesMeta || {};
    for (const [name, range] of Object.entries(peers)) {
      if (meta[name] && meta[name].optional) continue;
      console.log(name + '@' + range);
    }
  ")

  # Install OUTSIDE the pnpm workspace — plain npm, no hoisting, no registry
  # involvement for any @vytches/ddd-* package.
  (
    cd "$INSTALL_DIR"
    npm init -y > /dev/null 2>&1
    npm install --no-audit --no-fund --silent --ignore-scripts \
      "$TARBALL_PATH" "${CLOSURE_ARGS[@]}" "${PEER_INSTALL_ARGS[@]}"
  ) > "$INSTALL_DIR/install.log" 2>&1
  if [ ! -d "$INSTALL_DIR/node_modules/$pkg_name" ]; then
    echo -e "${RED}❌ $pkg_name: isolated npm install failed${NC}"
    tail -n 30 "$INSTALL_DIR/install.log"
    HAS_ERRORS=1
    continue
  fi

  # The tsc probe reuses the same install as the runtime probes below — no
  # package in this workspace declares an optional @vytches/ddd-* peer
  # anymore (the last one, cqrs's @vytches/ddd-di, was reclassified as a
  # required `dependencies` entry once F-C3's re-verification found it was
  # a required, non-defaulted constructor parameter on cqrs's flagship
  # classes — not a genuinely optional add-on). If a future package ever
  # needs an optional @vytches/ddd-* peer whose types are still reachable
  # from its public API, reintroduce a dedicated type-check-only install
  # here rather than installing it into $INSTALL_DIR (which must keep
  # proving the runtime probes pass WITHOUT the optional peer).
  TYPES_INSTALL_DIR="$INSTALL_DIR"

  # 3a. CJS require()
  cat > "$INSTALL_DIR/probe.cjs" <<NODE
const mod = require('$pkg_name');
const keys = Object.keys(mod);
if (typeof mod !== 'object' && typeof mod !== 'function') {
  console.error('CJS: unexpected module type: ' + typeof mod);
  process.exit(1);
}
if (keys.length === 0) {
  console.error('CJS: module has no exports');
  process.exit(1);
}
console.log('CJS OK — ' + keys.length + ' export(s)');
NODE

  if (cd "$INSTALL_DIR" && node probe.cjs); then
    echo -e "${GREEN}  ✅ CJS require() OK${NC}"
  else
    echo -e "${RED}  ❌ $pkg_name: CJS require() failed${NC}"
    HAS_ERRORS=1
  fi

  # 3b. ESM dynamic import()
  cat > "$INSTALL_DIR/probe.mjs" <<NODE
const mod = await import('$pkg_name');
const keys = Object.keys(mod);
if (keys.length === 0) {
  console.error('ESM: module has no exports');
  process.exit(1);
}
console.log('ESM OK — ' + keys.length + ' export(s)');
NODE

  if (cd "$INSTALL_DIR" && node probe.mjs); then
    echo -e "${GREEN}  ✅ ESM import() OK${NC}"
  else
    echo -e "${RED}  ❌ $pkg_name: ESM import() failed${NC}"
    HAS_ERRORS=1
  fi

  # 4. tsc --noEmit against a trivial consumer of the package's types.
  cat > "$TYPES_INSTALL_DIR/consumer.ts" <<TS
import type * as PackageUnderTest from '$pkg_name';
export type _SmokeTestTypesResolve = typeof PackageUnderTest;
TS

  if (
    cd "$TYPES_INSTALL_DIR" &&
    "$TSC_BIN" --noEmit --strict --moduleResolution bundler \
      --module esnext --target es2022 --typeRoots "$TSC_TYPE_ROOTS" consumer.ts
  ) > "$TYPES_INSTALL_DIR/tsc.log" 2>&1; then
    echo -e "${GREEN}  ✅ tsc --noEmit resolved published types${NC}"
  else
    echo -e "${RED}  ❌ $pkg_name: tsc --noEmit failed against published .d.ts${NC}"
    tail -n 30 "$TYPES_INSTALL_DIR/tsc.log"
    HAS_ERRORS=1
  fi
done

echo -e "\n================================"
echo "Tested: $TESTED   Skipped: $SKIPPED"
if [ "$HAS_ERRORS" -eq 0 ]; then
  echo -e "${GREEN}✅ ALL PACKAGES PASSED THE PUBLISH SMOKE TEST${NC}"
  exit 0
else
  echo -e "${RED}❌ SMOKE TEST FAILED — see above for the failing package(s)${NC}"
  exit 1
fi
