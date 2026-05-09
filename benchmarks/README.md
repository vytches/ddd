# @vytches/ddd — Benchmarks

Performance baselines for the library's hot paths, captured via `vitest bench`
(tinybench under the hood). Use these for **relative** comparison across
versions on the same hardware — absolute numbers vary.

## Run

```bash
cd benchmarks
pnpm bench           # one-shot run
pnpm bench:watch     # continuous on file change
```

## Baseline (v0.25.0-beta.1, Node 22, dev hardware)

Captured 2026-05-09. See `baseline.json` for the machine-readable form.

| Operation                                    |                     ops/sec |       p99 |
| -------------------------------------------- | --------------------------: | --------: |
| `AggregateRoot.apply()` single event         |               **1,578,919** | 0.0015 ms |
| `AggregateRoot.apply()` 100-event replay     | **32,103** (≈3.2M events/s) |  0.035 ms |
| `BaseValueObject.equals()` equal objects     |               **5,929,420** | 0.0002 ms |
| `BaseValueObject.equals()` different objects |               **6,061,245** | 0.0002 ms |
| `EntityId.create()` (UUID generation)        |               **8,355,359** | 0.0003 ms |
| `EntityId.fromUUID()` (validation)           |              **11,109,997** | 0.0001 ms |
| `LibUtils.isValidUUID()` (predicate)         |              **15,689,797** | 0.0001 ms |
| `LibUtils.deepEqual()` shallow nested        |               **2,888,579** | 0.0005 ms |

## What's measured

Five core hot paths identified by performance-optimizer agent (2026-05-08):

1. **`apply()` single event + replay** — every event-sourced aggregate goes
   through this path on every command + replay. Most-called function in the
   library.
2. **`BaseValueObject.equals()`** — equality check for ValueObjects, called on
   every domain comparison.
3. **`EntityId.create()` / `fromUUID()`** — UUID generation + validation, called
   on every aggregate construction and lookup.
4. **`LibUtils.isValidUUID()`** — pure predicate, baseline for any
   string-validation hot path.
5. **`LibUtils.deepEqual()`** — used by capabilities and equality checks (e.g.
   snapshot diff).

## How to compare across versions

```bash
git checkout v0.25.0-beta.1
pnpm bench > /tmp/v0.25-results.txt

git checkout main
pnpm bench > /tmp/main-results.txt

diff /tmp/v0.25-results.txt /tmp/main-results.txt
```

Or compare against `baseline.json` programmatically — the file is JSON for
exactly this reason.

## CI gate (future, v0.26+)

`vitest bench` doesn't yet ship a built-in regression detector, but a follow-up
could:

1. Save current run as `current.json`
2. Compute `(baseline.opsPerSec - current.opsPerSec) / baseline.opsPerSec`
3. Fail if regression ≥ 15% on any hot path

This is on the post-release backlog (VP-NEW-001 only delivers the baseline for
now).
