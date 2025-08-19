# VytchesDDD Orchestration Workflows

## Overview

This directory contains workflow definitions and coordination rules from the
original project-orchestration system, now integrated with the proactive
vytches-orchestration system.

## Structure

- `workflows.yaml` - Comprehensive workflow definitions for all development
  processes
- `coordination-rules.md` - Agent collaboration patterns and rules
- `release-process.md` - Detailed release preparation and publishing guide
- `task-templates.yaml` - Legacy task templates (migrated to work-items/)

## Integration with Vytches-Orchestration

The original workflow system provides the **execution patterns**, while the new
vytches-orchestration provides **proactive task generation and prioritization**.

### How They Work Together

1. **Orchestrator** (vytches-orchestration) identifies work needed
2. **Workflows** (project-orchestration) define how to execute that work
3. **Agents** follow both systems for maximum efficiency

## Key Workflows

- **feature_development** - New feature implementation
- **package_creation** - Creating new packages
- **bug_fix** - Fixing reported issues
- **release** - Release preparation
- **security_audit** - Security scanning
- **performance_optimization** - Bundle and runtime optimization

See `workflows.yaml` for complete definitions.
