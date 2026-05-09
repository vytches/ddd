#!/usr/bin/env bash
#
# DX-NEW-002 — 5-minute start validation.
#
# Spins up a fresh node:22-alpine container, copies the repo in, runs the
# quickstart example end-to-end, and reports timing + friction.
#
# Goal: verify that a developer landing on the project can go from
# "git clone" to "16 passing tests" in under 5 minutes on broadband.
#
# Usage:
#   ./scripts/validate-quickstart.sh           # standard run
#   ./scripts/validate-quickstart.sh --quiet   # only print final summary
#   ./scripts/validate-quickstart.sh --no-docker  # run on host (faster, less isolated)
#
# Exit codes:
#   0  — quickstart passes within 5 minutes
#   1  — tests fail or build error
#   2  — exceeded 5-minute budget (but tests passed) — warning, not blocker
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUIET=0
USE_DOCKER=1
TIMEOUT_SECONDS=300  # 5 minutes
NODE_VERSION="22-alpine"

for arg in "$@"; do
  case "$arg" in
    --quiet) QUIET=1 ;;
    --no-docker) USE_DOCKER=0 ;;
    --help|-h)
      sed -n '4,18p' "${BASH_SOURCE[0]}" | sed 's/^# *//'
      exit 0
      ;;
  esac
done

log() { [[ $QUIET -eq 0 ]] && echo "$@" >&2 || true; }
section() { [[ $QUIET -eq 0 ]] && echo -e "\n=== $* ===" >&2 || true; }

run_in_docker() {
  section "Pulling node:$NODE_VERSION (or using cached layer)"
  docker pull "node:$NODE_VERSION" >/dev/null 2>&1 || true

  section "Running quickstart in fresh container (timeout ${TIMEOUT_SECONDS}s)"
  # The whole repo is mounted read-only; pnpm install + tests happen inside.
  # Working dir is /workspace; user is the repo's UID to avoid root-owned artifacts.
  docker run --rm \
    --memory=2g \
    --cpus=2 \
    -v "$REPO_ROOT":/workspace:ro \
    -w /tmp/work \
    "node:$NODE_VERSION" \
    sh -c '
      set -e
      apk add --no-cache git bash >/dev/null 2>&1 || true
      corepack enable >/dev/null 2>&1
      cp -r /workspace/. /tmp/work/
      cd /tmp/work
      echo "[stage] pnpm install"
      pnpm install --frozen-lockfile --prefer-offline 2>&1 | tail -3
      echo "[stage] pnpm -F @vytches/quickstart-example test"
      pnpm -F @vytches/quickstart-example test
    '
}

run_on_host() {
  section "Running quickstart on host (no Docker isolation)"
  cd "$REPO_ROOT/examples/quickstart"
  pnpm test
}

main() {
  local start=$(date +%s)

  if [[ $USE_DOCKER -eq 1 ]]; then
    if ! command -v docker >/dev/null 2>&1; then
      log "WARN: docker not available, falling back to --no-docker"
      USE_DOCKER=0
    fi
  fi

  if [[ $USE_DOCKER -eq 1 ]]; then
    timeout "$TIMEOUT_SECONDS" bash -c "$(declare -f run_in_docker section log); QUIET=$QUIET REPO_ROOT='$REPO_ROOT' NODE_VERSION='$NODE_VERSION' TIMEOUT_SECONDS='$TIMEOUT_SECONDS' run_in_docker"
  else
    timeout "$TIMEOUT_SECONDS" bash -c "$(declare -f run_on_host section log); QUIET=$QUIET REPO_ROOT='$REPO_ROOT' run_on_host"
  fi

  local exit_code=$?
  local end=$(date +%s)
  local elapsed=$((end - start))

  echo
  echo "================================================================"
  echo "  Quickstart validation summary"
  echo "================================================================"
  echo "  Mode:           $([[ $USE_DOCKER -eq 1 ]] && echo "docker (node:$NODE_VERSION)" || echo "host")"
  echo "  Elapsed time:   ${elapsed}s"
  echo "  Budget:         ${TIMEOUT_SECONDS}s (5 min)"
  echo "  Test exit code: $exit_code"
  echo "================================================================"

  if [[ $exit_code -ne 0 ]]; then
    echo "  ✗ FAIL — tests failed or container error" >&2
    exit 1
  fi

  if [[ $elapsed -gt $TIMEOUT_SECONDS ]]; then
    echo "  ⚠ OVER BUDGET — tests passed but took longer than 5 minutes" >&2
    exit 2
  fi

  echo "  ✓ PASS — quickstart works in under 5 minutes"
  exit 0
}

main "$@"
