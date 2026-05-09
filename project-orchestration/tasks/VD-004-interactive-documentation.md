# Task: Interactive Documentation System

## Task Metadata

```yaml
task_id: VD-004
title: Search, live playground, categorization for docs site
type: documentation
priority: normal
complexity: complex
estimated_time: 20h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
status: planned
release_target: post-v0.25 (v0.26 or later)
priority_score: 77/100
depends_on: VI-001 (CANCELLED — see REL-001)
```

## Why This Task Exists

Docs are static markdown without search, playground, or categorization.

**Business Impact**: 80% faster documentation discovery and learning.

## Why Post-Release

20h scope on a 3-week release runway is too aggressive. Original VI-001
dependency has been cancelled (CLI deprecation per REL-001). After v0.25 ships
and feedback comes in, prioritize either:

a) StackBlitz playground (1-day, big DX win — see DX-NEW-StackBlitz) b) Or full
interactive docs (this task)

Decision deferred to post-release planning sprint.

## Original Acceptance Criteria (preserved)

1. Interactive documentation architecture
2. Search across all content
3. Live code playground for examples
4. Example categorization system
5. Visual architecture diagrams
6. Mobile-friendly experience

## Notes

Reconsider scope after v0.25 ships. Lighter-weight alternatives:

- StackBlitz badge in README (1h, identical conversion gain)
- Algolia DocSearch on existing markdown (4h)
- Mermaid diagrams in existing docs (4h)
