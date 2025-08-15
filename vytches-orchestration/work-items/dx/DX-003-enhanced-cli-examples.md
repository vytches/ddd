# DX-003: Enhanced CLI Examples Experience

**Priority**: 85 (HIGH) **Agent**: developer-experience **Timeline**: 3-4 days
**Status**: Active **Created**: 2025-08-15

## Problem Statement

Existing CLI has powerful generate and examples commands, but they're not
optimized for <15 minutes time-to-first-success. We need to enhance existing CLI
capabilities rather than creating new tools.

## Context

Current CLI infrastructure:

```bash
# Existing commands that work
vytches-ddd generate --type aggregate --name Order
vytches-ddd generate --type specification --name OrderValidation
vytches-ddd generate --interactive
vytches-ddd domain --name OrderManagement --guided
```

Available framework support:

- NestJS, Express, Fastify, standalone
- Interactive mode framework
- Examples management system

## Success Metrics

- [ ] <15 minutes to first success using enhanced CLI
- [ ] Interactive tutorial mode using existing commands
- [ ] Framework-specific quick starts with realistic examples
- [ ] Better discoverability of existing CLI features

## Action Items

1. [ ] Add time-to-success targeting to existing CLI

   - Create `--quick-start` flag for existing generate command
   - Add timing feedback: "Step 1/3 - Creating aggregate (1 min remaining)"
   - Focus on essential patterns only in quick start mode

2. [ ] Create interactive tutorial mode using existing commands

   - Enhance existing `--interactive` mode with tutorial flow
   - Guide through: aggregate → entity → domain event → repository
   - Use existing CLI generate commands under the hood

3. [ ] Enhance framework-specific examples generation

   - Improve existing framework flags (--framework nestjs)
   - Generate complete working examples using existing templates
   - Include setup instructions for each framework

4. [ ] Improve discoverability of existing CLI features
   - Better help text for existing commands
   - Add usage examples to CLI help
   - Create `vytches-ddd examples` command for browsing patterns

## Technical Requirements

**Enhance existing CLI only**:

- Use current CLI structure in packages/cli/src/
- Extend existing commands, don't create new ones
- Leverage existing framework templates
- Use current interactive mode infrastructure

## Example Enhanced Experience

Target enhanced CLI flow:

```bash
# Enhanced existing commands
vytches-ddd generate --quick-start
# → Interactive 15-minute guided tutorial

vytches-ddd generate --type aggregate --name Order --framework nestjs --quick-start
# → Complete NestJS example in <5 minutes

vytches-ddd examples --pattern cqrs
# → Show existing CQRS examples with copy-paste ready code
```

## Definition of Done

- [ ] `vytches-ddd generate --quick-start` provides 15-minute tutorial
- [ ] Enhanced `--interactive` mode with time estimates
- [ ] Framework-specific examples include complete setup
- [ ] `vytches-ddd examples --help` shows pattern browsing
- [ ] All enhancements use existing CLI infrastructure
- [ ] Tutorial generates working code using existing APIs

## Dependencies

- Existing CLI in packages/cli/src/
- Current generate and examples commands
- Framework templates (NestJS, Express, Fastify)
- Interactive mode infrastructure

## Notes

This enhances our already powerful CLI rather than creating new tools. The CLI
has solid foundations - we just need to optimize it for developer onboarding
speed and add better guidance.
