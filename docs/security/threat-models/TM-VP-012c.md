# Threat Model: TM-VP-012c

**Feature:** `CachedPolicy` / `PolicyCachingBehavior.generateCacheKey()` — merge
two `hashString()` (SHA-256) calls into one over a length-prefixed combined
buffer **Task:** VP-012c-hotpath-quickwins (implementation layer) **Date:**
2026-08-20 **Method:** STRIDE + DREAD (targeted — see scoping note) **Scope:**
`@vytches/ddd-policies` — `packages/policies/src/decorators/cached-policy.ts`
(`generateCacheKey()` + `hashString()`)

**Predecessor threat models (not reproduced here, still in force):**

- `docs/security/threat-models/TM-VS-005.md` — djb2 → SHA-256 replacement,
  established the 128-bit-prefix digest this task builds on
- F4 (post-VS-005 hardening) — `contextRaw` (userId/tenantId/environment) is
  itself hashed through `hashString()`, closing the plain-text `contextKey`
  finding TM-VS-005 flagged as residual (its S1/I1 findings)

---

## Scoping note

This is a **narrow, non-breaking, digest-count-only refactor** of code TM-VS-005
already hardened to SHA-256. It does not touch the digest algorithm, the
truncation width, or the public API. Full STRIDE/LINDDUN re-derivation of
`CachedPolicy` is not repeated here — only the delta introduced by this change
(two `hashString()` calls → one) is analyzed, plus the collision-surface
question that motivated it (F6/F7) and the rejected alternative (D3).

---

## 1. Facts established before this change (F6/F7)

- **F6:** `hashString()` already computes a full SHA-256 digest and truncates to
  the first 32 hex characters — a **128-bit** prefix, not the full 64-char
  (256-bit) digest.
- **F7:** `generateCacheKey()` called `hashString()` **twice** — once over
  `contextRaw` (`userId\x00tenantId\x00environment`) producing `contextHash`,
  once over `entityKey` (`JSON.stringify(entity)` or the circular-safe fallback)
  producing `entityHash`. The cache key was
  `${namespace}:${contextHash}:${entityHash}`.

**Consequence of F7 (pre-R1):** because `contextHash` and `entityHash` were
independent digests concatenated into one key, a collision on `contextHash`
**alone** was sufficient to make two different users'/tenants' requests for the
**same entity** collapse onto the same cache slot — the `entityHash` component
does not protect against a `contextHash` collision, since the two halves are
independently, not jointly, hashed. Under SHA-256 (128-bit) this is not
practically exploitable, but it is a real structural property: the collision
requirement is bounded by the **weaker of the two independent 128-bit spaces**,
not by their combination.

## 2. Rejected alternative (D3, binding)

A candidate optimization considered replacing the digest primitive itself with a
non-cryptographic hash (FNV-1a or djb2-like, bare, unsalted) to reduce CPU cost
on the cache-key hot path. **This was rejected.** A 32-bit non-cryptographic
hash has a birthday-bound collision surface of roughly 2^16 entries — squarely
inside realistic per-namespace/per-context cache population sizes (TM-VS-005
documented the identical failure mode for the original djb2 implementation, HIGH
severity, DREAD 12). Because these are **authorization cache keys**
(`CachedPolicy` wraps `IBusinessPolicy.check()` results, including
`allow`/`deny` decisions for policies such as blacklist or tier checks), a
colliding key means one tenant's/entity's cached decision is served to a
different tenant/entity — **cross-tenant data/decision disclosure**, not a
benign performance artifact (F8/F9). Collision resistance is therefore treated
as a security property of this code path, not an implementation detail open to a
throughput trade-off. See the NON-GOAL note added to `hashString()`'s doc
comment in this PR.

## 3. The accepted fix (R1)

`generateCacheKey()` now calls `hashString()` **once**, over a single combined
buffer:

```
combined = `${contextRaw.length}:${contextRaw}${entityKey}`
```

instead of hashing `contextRaw` and `entityKey` independently. This is a
**mechanical reduction of digest invocations (2 → 1)**. The digest primitive
itself is unchanged: still SHA-256 via `globalThis.crypto.subtle`, still
truncated to the same 128-bit prefix (F6 unchanged). No new algorithm, no
narrower truncation, no change to `PolicyCacheConfig` or any other public
surface.

### Why the combined buffer needs a length prefix, not a bare separator

`contextRaw` already uses NUL (`\x00`) as its **internal** field separator
between `userId`, `tenantId`, and `environment`. Reusing a bare NUL as the
**context/entity** boundary in the merged buffer would be a second, unrelated
use of the same byte as a delimiter — an attacker able to influence entity
content (or, more subtly, a value carried through `request.context`) could shift
where the "boundary" NUL is interpreted to sit, making two different (context,
entity) pairs hash to the same combined string. The chosen encoding —
`${contextRaw.length}:${contextRaw}${entityKey}` — is a standard length-prefixed
(netstring-style) encoding: the digit run before `:` fixes exactly how many
subsequent bytes belong to the context, regardless of what bytes (including NUL,
digits, or `:` itself) appear inside `contextRaw` or `entityKey`. This makes the
encoding **injective** — no two distinct (context, entity) pairs can produce the
same combined string — independent of and in addition to whatever collision
resistance SHA-256 itself provides. (Proof sketch: if two encodings agreed on
their full byte sequence, the decimal length prefixes would have to be textually
identical too, which forces the context lengths to be equal, which forces the
context substrings to be equal, which forces the entity remainders to be equal —
see inline comment in `generateCacheKey()` for the concrete non-collision
argument and the regression tests added for this in
`packages/policies/tests/decorators/cached-policy.test.ts`, describe block
`VP-012c R1`.)

### Net effect on the F7 collision surface

Because the merge hashes context and entity **jointly** rather than
independently, the narrower "collide `contextHash` alone" surface from F7 no
longer exists in the same form — an attacker now needs a joint preimage over the
combined (context ‖ entity) buffer, not merely a preimage over the context
component. This is a byproduct of the merge, not its purpose (the merge's
purpose is call-count reduction per KROK1/KROK2), and it does not by itself
change the security **level** — both the pre-R1 two-hash scheme and the post-R1
one-hash scheme rely on the same 128-bit SHA-256 prefix, which was already
computationally infeasible to collide deliberately (TM-VS-005's verdict:
djb2→SHA-256 "eliminates both collision vectors"). R1 does not reopen or narrow
that guarantee.

---

## 4. STRIDE delta (only what changes vs. TM-VS-005's baseline)

| Category                                                                 | Before R1 (2× SHA-256, independent)                                                                                                                               | After R1 (1× SHA-256, joint)                                                                                 | Delta                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T** Tampering — deliberate cache-key collision craft                   | Requires either an `entityHash` collision or (narrower) a `contextHash`-only collision; both are 128-bit SHA-256 spaces, computationally infeasible per TM-VS-005 | Requires a joint preimage over the combined buffer; also a 128-bit SHA-256 space, computationally infeasible | **No practical change.** Both are infeasible under SHA-256; R1 removes a structural narrowing (context-only collision sufficiency) without that narrowing having been exploitable in practice. |
| **E** Elevation of Privilege — cross-tenant `allow` disclosure via cache | Same 128-bit SHA-256 collision resistance as TM-VS-005's E1 (DREAD 12, judged infeasible post-VS-005)                                                             | Same 128-bit SHA-256 collision resistance, now over a joint rather than split input                          | **No change in DREAD score** — this finding's mitigation (SHA-256 itself) is untouched by R1; only the input construction changed.                                                             |
| **I** Information Disclosure                                             | `contextRaw`/`entityKey` are hashed before storage either way (F4 already closed the plain-text `contextKey` finding from TM-VS-005)                              | Unchanged — combined buffer is hashed before storage, nothing new is retained in plain text                  | **No change.**                                                                                                                                                                                 |
| S / R / D                                                                | N/A — no identity spoofing, no new repudiation surface, no DoS surface (one `crypto.subtle.digest` call is strictly cheaper than two, see benchmark below)        | —                                                                                                            | **Improves marginally** (fewer digest calls = lower CPU per cache miss), not a new risk.                                                                                                       |

No new STRIDE category is introduced by R1. The only category with a non-trivial
delta (T) is a narrowing/removal of a structural sub-case that was never
independently exploitable given SHA-256's strength — recorded here for
completeness per F7, not because it changes the risk rating.

## 5. DREAD — residual risk after R1

| ID             | Finding                                                                                                          | D   | R   | E   | A   | Disc | Score | Priority                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | ---- | ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| TM-VP-012c-001 | Cross-tenant/cross-entity cache-key collision (joint SHA-256 preimage required)                                  | 3   | 1   | 1   | 2   | 2    | **9** | LOW (inherits TM-VS-005's post-mitigation rating; SHA-256 unchanged)                                                              |
| TM-VP-012c-002 | Regression: length-prefix boundary encoding implemented incorrectly (e.g. no prefix, or a bare separator reused) | 3   | 1   | 1   | 2   | 1    | **8** | LOW — closed by the injectivity proof (§3) + dedicated regression tests (`VP-012c R1` describe block); not closed by review alone |

No CRITICAL or HIGH findings. This is consistent with the change being a
call-count optimization on top of an already-hardened primitive (TM-VS-005), not
a new authorization mechanism.

---

## 6. What is explicitly out of scope (deferred, not silently dropped)

Stronger variants considered during analysis and **not** adopted in this task:

- **R4 / R5** (stronger digest/keying schemes beyond the current 128-bit SHA-256
  prefix, e.g. full 256-bit key retention, or a keyed/HMAC scheme for the cache
  key) — deliberately **out of scope for VP-012c**. R1's mandate is the
  mechanical 2→1 call reduction (KROK1/KROK2), not a security-level upgrade. Any
  future move to R4/R5 requires:
  1. A dedicated ADR (cost/benefit: cache-key size, CPU, and any BC impact on
     stored/serialized cache state must be weighed against the already-LOW
     residual risk in §5), and
  2. `security-privacy-architect` review before implementation, per the binding
     scope note carried over from this task's D3 decision.
- Hashing/shortening `contextRaw` differently, or reintroducing a configurable
  context-key hasher (TM-VS-005's S1/F4 follow-up) — unrelated to this task,
  already tracked separately.

## 7. Verification performed for this task

- `packages/policies/tests/decorators/cached-policy.test.ts` — existing
  `VS-005: SHA-256 cache key hash` suite (zero collisions over 1000 distinct
  entities, determinism, `keyGenerator` override regression, cross-user
  isolation) re-verified green against the merged implementation; new
  `VP-012c R1: merged single-hashString cache key generation` describe block
  adds boundary-safety regression coverage (NUL-bearing and colon-bearing entity
  payloads, namespace isolation with the new one-hash key shape).
- `benchmarks/suites/hot-paths.bench.ts` — new
  `CachedPolicy.generateCacheKey() — R1 hash-merge (VP-012c)` describe block
  measures BEFORE (2 calls) vs AFTER (1 call) against a
  `JSON.stringify(request.entity)` baseline, so the merge's real-world benefit
  is judged against the dominant serialization cost, not digest count in
  isolation.

---

## Threat Model Verdict

**PROCEED — no blocking findings.** R1 is a call-count reduction over an
already-hardened SHA-256 digest (TM-VS-005). It does not change the security
level of the cache-key scheme; the one structural narrowing it removes
(context-only collision sufficiency, F7) was not independently exploitable under
SHA-256 in the first place. The rejected alternative (D3, bare FNV-1a/djb2-style
hash) would have been a genuine regression back to TM-VS-005's original
HIGH-severity finding — that rejection stands and is now also recorded as a
binding NON-GOAL in the `hashString()` doc comment. Stronger variants (R4/R5)
are consciously deferred to a future ADR + `security-privacy-architect` review,
not silently dropped.

---

_Generated: 2026-08-20 | Method: STRIDE + DREAD (targeted delta) | Task: VP-012c
| Predecessor: TM-VS-005_
