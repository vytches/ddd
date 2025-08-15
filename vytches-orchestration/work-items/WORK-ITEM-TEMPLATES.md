# 📋 VytchesDDD Work Item Templates

## Template Structure

All work items follow a consistent structure with YAML frontmatter and markdown
content.

---

## VF-XXX: Feature Template

````markdown
---
id: VF-XXX
title: [Feature Title]
package: [package-name]
priority: [CRITICAL|HIGH|MEDIUM|LOW]
business_impact: X/10
technical_complexity: X/10
estimated_hours: XX
assigned_agents:
  - [agent-name]
status: [pending|ready|in_progress|blocked|completed]
created: YYYY-MM-DD
target_release: X.Y.Z
---

# VF-XXX: [Feature Title]

## Business Context

[Why this feature matters to users and business goals]

### Expected Impact

- **Adoption**: [Expected adoption increase]
- **Market**: [Market opportunity addressed]
- **Revenue**: [Revenue impact]
- **Community**: [Community benefit]

## Technical Requirements

### Core Features

- ✅ [Feature requirement 1]
- ✅ [Feature requirement 2]
- ✅ [Feature requirement 3]

### Integration Points

```typescript
// Example usage after implementation
```
````

## Orchestration Checkpoints

### Phase 1: Architecture Design (X hours)

**Agent**: architecture-guardian

- [ ] [Task 1]
- [ ] [Task 2]

### Phase 2: Implementation (X hours)

**Agent**: library-expert

- [ ] [Task 1]
- [ ] [Task 2]

### Phase 3: Testing (X hours)

**Agent**: testing-excellence

- [ ] [Task 1]
- [ ] [Task 2]

### Phase 4: Documentation (X hours)

**Agent**: developer-experience

- [ ] [Task 1]
- [ ] [Task 2]

## Acceptance Criteria

1. **Functionality**

   - [Criterion 1]
   - [Criterion 2]

2. **Performance**

   - [Performance requirement]
   - [Benchmark target]

3. **Developer Experience**
   - [UX requirement]
   - [Documentation requirement]

## Dependencies

- Runtime: [dependencies or "none"]
- Dev: [dev dependencies]
- Packages: [internal package dependencies]

## Risk Analysis

| Risk   | Impact         | Mitigation            |
| ------ | -------------- | --------------------- |
| [Risk] | [Impact level] | [Mitigation strategy] |

## Success Metrics

- ✅ [Metric 1]
- ✅ [Metric 2]
- ✅ [Metric 3]

## Notes

[Additional context or considerations]

````

---

## VB-XXX: Bug Fix Template

```markdown
---
id: VB-XXX
title: Fix [Issue Description]
package: [package-name]
priority: [CRITICAL|HIGH|MEDIUM|LOW]
severity: [critical|major|minor|cosmetic]
business_impact: X/10
technical_complexity: X/10
estimated_hours: XX
assigned_agents:
  - [agent-name]
status: [pending|ready|in_progress|blocked|completed]
created: YYYY-MM-DD
target_release: X.Y.Z
reported_by: [source]
---

# VB-XXX: Fix [Issue Description]

## Issue Description

[Clear description of the bug and its symptoms]

## Current State
- **Affected Version**: X.Y.Z
- **Failing Tests**: X
- **Coverage Impact**: XX%
- **Users Affected**: [estimate]

## Root Cause Analysis

[Investigation findings or hypothesis]

## Reproduction Steps

1. [Step 1]
2. [Step 2]
3. [Step 3]
Expected: [Expected behavior]
Actual: [Actual behavior]

## Fix Plan

### Immediate Actions (X min)
**Agent**: [agent-name]
- [ ] [Task 1]
- [ ] [Task 2]

### Implementation (X hour)
**Agent**: [agent-name]
- [ ] [Task 1]
- [ ] [Task 2]

### Validation (X min)
**Agent**: testing-excellence
- [ ] [Task 1]
- [ ] [Task 2]

## Acceptance Criteria

- ✅ All tests passing
- ✅ Coverage ≥ X%
- ✅ No regression in other packages
- ✅ CI pipeline green

## Impact

- [Impact on users]
- [Impact on other packages]
- [Impact on release schedule]

## Testing Notes

[Special testing considerations]
````

---

## VI-XXX: Improvement Template

```markdown
---
id: VI-XXX
title: Improve [Area/Feature]
package: [package-name]
priority: [CRITICAL|HIGH|MEDIUM|LOW]
improvement_type: [performance|usability|maintainability|architecture]
business_impact: X/10
technical_complexity: X/10
estimated_hours: XX
assigned_agents:
  - [agent-name]
status: [pending|ready|in_progress|blocked|completed]
created: YYYY-MM-DD
target_release: X.Y.Z
---

# VI-XXX: Improve [Area/Feature]

## Improvement Context

[Why this improvement is needed and what it achieves]

## Current State

- **Performance**: [Current metrics]
- **User Experience**: [Current state]
- **Technical Debt**: [Current issues]

## Proposed Improvement

[Detailed description of the improvement]

### Expected Benefits

- 📈 [Benefit 1]
- 📈 [Benefit 2]
- 📈 [Benefit 3]

## Implementation Plan

### Phase 1: Analysis (X hours)

**Agent**: [agent-name]

- [ ] [Task 1]
- [ ] [Task 2]

### Phase 2: Implementation (X hours)

**Agent**: [agent-name]

- [ ] [Task 1]
- [ ] [Task 2]

### Phase 3: Validation (X hours)

**Agent**: [agent-name]

- [ ] [Task 1]
- [ ] [Task 2]

## Success Metrics

### Before

- [Metric]: [Current value]

### After

- [Metric]: [Target value]

## Risk Assessment

- **Breaking Changes**: [Yes/No - details]
- **Performance Impact**: [Positive/Neutral/Negative]
- **Migration Required**: [Yes/No - details]

## Notes

[Additional considerations]
```

---

## VD-XXX: Documentation Template

```markdown
---
id: VD-XXX
title: Document [Topic/Feature]
package: [package-name or "all"]
priority: [CRITICAL|HIGH|MEDIUM|LOW]
doc_type: [api|guide|example|architecture|migration]
business_impact: X/10
technical_complexity: X/10
estimated_hours: XX
assigned_agents:
  - developer-experience
status: [pending|ready|in_progress|blocked|completed]
created: YYYY-MM-DD
target_release: X.Y.Z
---

# VD-XXX: Document [Topic/Feature]

## Documentation Need

[Why this documentation is needed and who benefits]

## Target Audience

- Primary: [Audience segment]
- Secondary: [Audience segment]

## Current State

- **Existing Docs**: [What exists]
- **Gaps**: [What's missing]
- **User Feedback**: [Common questions/issues]

## Documentation Plan

### Content Structure

1. [Section 1]
2. [Section 2]
3. [Section 3]

### Deliverables

- [ ] [Deliverable 1]
- [ ] [Deliverable 2]
- [ ] [Deliverable 3]

## Implementation

### Phase 1: Content Creation (X hours)

**Agent**: developer-experience

- [ ] [Task 1]
- [ ] [Task 2]

### Phase 2: Examples (X hours)

**Agent**: developer-experience

- [ ] [Task 1]
- [ ] [Task 2]

### Phase 3: Review (X hours)

**Agent**: library-expert

- [ ] Technical accuracy review
- [ ] Code examples validation

## Success Criteria

- ✅ All public APIs documented
- ✅ Working examples provided
- ✅ Migration guide if needed
- ✅ Enhanced metadata updated

## Distribution

- README.md update
- Documentation site
- GitHub wiki
- Blog post (if major)

## Notes

[Additional context]
```

---

## VP-XXX: Performance Template

```markdown
---
id: VP-XXX
title: Optimize [Component/Process]
package: [package-name]
priority: [CRITICAL|HIGH|MEDIUM|LOW]
optimization_type: [bundle_size|runtime|memory|startup]
business_impact: X/10
technical_complexity: X/10
estimated_hours: XX
assigned_agents:
  - performance-optimizer
  - library-expert
status: [pending|ready|in_progress|blocked|completed]
created: YYYY-MM-DD
target_release: X.Y.Z
---

# VP-XXX: Optimize [Component/Process]

## Performance Issue

[Description of performance problem and its impact]

## Current Metrics

- **Bundle Size**: XXkB
- **Runtime**: XXms
- **Memory**: XXMB
- **Benchmark**: [Current benchmark results]

## Target Metrics

- **Bundle Size**: XXkB (-XX%)
- **Runtime**: XXms (-XX%)
- **Memory**: XXMB (-XX%)
- **Benchmark**: [Target benchmark results]

## Optimization Strategy

[Detailed optimization approach]

### Techniques

1. [Technique 1]
2. [Technique 2]
3. [Technique 3]

## Implementation Plan

### Phase 1: Profiling (X hours)

**Agent**: performance-optimizer

- [ ] [Task 1]
- [ ] [Task 2]

### Phase 2: Optimization (X hours)

**Agent**: library-expert

- [ ] [Task 1]
- [ ] [Task 2]

### Phase 3: Validation (X hours)

**Agent**: performance-optimizer

- [ ] [Task 1]
- [ ] [Task 2]

## Benchmarks

### Before Optimization
```

[Benchmark results]

```

### After Optimization
```

[Benchmark results]

```

## Risk Analysis

- **Breaking Changes**: [Assessment]
- **Compatibility**: [Impact on older environments]
- **Trade-offs**: [What we're trading for performance]

## Success Metrics

- ✅ Bundle size reduced by X%
- ✅ Runtime improved by X%
- ✅ No functionality regression
- ✅ Benchmarks show improvement

## Notes

[Additional considerations]
```

---

## Usage Guidelines

1. **ID Assignment**: Sequential numbering within each category
2. **Priority Scoring**: Use the formula in ORCHESTRATOR-MANDATORY-CHECKLIST.md
3. **Agent Assignment**: Follow delegation matrix in agent-assignments.json
4. **Status Updates**: Update immediately when status changes
5. **Completion**: Move to completed/ folder when done

## Status Definitions

- **pending**: Created but not ready to start
- **ready**: All prerequisites met, can begin
- **in_progress**: Actively being worked on
- **blocked**: Waiting on external dependency
- **completed**: All acceptance criteria met

## Priority Levels

- **CRITICAL** (90-100): Blocks other work or production
- **HIGH** (70-89): Significant business/technical impact
- **MEDIUM** (50-69): Important but not urgent
- **LOW** (0-49): Nice to have, can wait
