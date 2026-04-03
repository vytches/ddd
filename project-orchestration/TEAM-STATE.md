# Team State — @vytches/ddd

_Last sync: 2026-04-03 by @pulse_ _Updated by `/pulse`. Read-only for humans —
agents write here._

---

## 🎯 Sprint Focus

Publish v0.1.0-beta to npm. Backlog empty — all effort goes to publication
readiness.

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **publishConfig targets GitHub Packages** — all 20 packages have
   `registry: npm.pkg.github.com` + `access: restricted`. Must change to
   `registry.npmjs.org` + `access: public`.
2. **Version skew across packages** — 4 different versions (0.22.4, 0.23.1,
   0.23.4, 0.24.4) + nestjs at 12.1.1. Need alignment or explicit strategy
   before publish.
3. **No consumer-facing README** — current README is project-internal. Need a
   10-line example above the fold, "why this exists", "how it differs from
   @node-ts/ddd".

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-04-03 -->

**Active tasks**: 0 (backlog clear) **Build health**: ✅ PASS — all 20 packages
build clean, ESM + CJS + `.d.ts` present **Test health**: ✅ PASS — 1,636 tests
pass, 0 failures (19 skipped in domain-services e2e) **Debt**: 🟢 LOW | No
blocking debt **Publish readiness**: BLOCKED — registry config + version skew

### Publish Blockers

1. **publishConfig** in all 20 `package.json` files points to GitHub Packages,
   not npmjs.com. Need `registry: https://registry.npmjs.org` +
   `access: public`.
2. **Version skew**: 0.22.4 (13 pkgs), 0.23.1 (cqrs, events), 0.23.4
   (enterprise, policies, validation), 0.24.4 (contracts), 12.1.1 (nestjs). No
   pending changesets.
3. **Cold-install test needed**: `npm install @vytches/ddd` → import
   AggregateRoot → must work in a fresh project.

### Low Priority

- Vitest `poolOptions` deprecation warning (1-line fix in vitest.config.mts)
- 19 skipped e2e tests in domain-services (missing container classes)
- nestjs exclusion from enterprise barrel undocumented

### Velocity

- 26 tasks completed, 0 active
- 22 commits in last 33 days
- Build + tests green

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-04-03 -->

**Next milestone**: v0.1.0-beta on npm — est. 3-4 weeks (target: 2026-04-25)
**Backlog**: Empty — planning needed, but publishing IS the next feature
**Publishing readiness**: Technically ready for beta, blocked by registry config
**Market window**: Narrowing — competitors stagnant but new entrants positioning

### Publication Sprint (weeks 1-4)

**Week 1**: Fix publishConfig, write consumer-facing README, cold-install test
**Week 2**: Extract real bounded context example from juz-ide-api **Week 3**:
Publish v0.1.0-beta, write dev.to article ("237 aggregates" hook) **Week 4**:
Respond to feedback, iterate

### Key Insight

The library has been in dev mode too long. juz-ide-api with 237 aggregates and
16K tests IS the proof it works. The library needs to catch up to its own
evidence.

### What NOT to Do

- Don't wait for perfect JSDoc — beta means beta
- Don't build a docs site before npm publish — sequence matters
- Don't add new features in the next 4 weeks — publishing IS the feature
- Don't create a roadmap promising 2026 features when no v0.1 exists on npm

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

[2026-04-03] @product-owner: Set hard deadline: v0.1.0-beta on npm by
2026-04-25. Everything else is subordinate. [2026-04-03] @tech-lead: Build
GREEN, tests GREEN (1636 pass). Only real blockers: publishConfig + version
skew. [2026-04-03] @tech-lead: Backlog empty after deep audit — VF-009 was
already done, VF-010 was mostly busywork. [2026-04-03] @tech-lead: VF-009 CLOSED
— already implemented. VF-010 CANCELLED — remaining items not worth doing.
