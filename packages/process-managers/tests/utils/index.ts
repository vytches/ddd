/**
 * Process Manager Testing Utilities
 *
 * This module provides comprehensive testing utilities for Process Manager testing:
 *
 * Core Testing:
 * - ProcessManagerTestHarness: Enterprise-grade test harness with event simulation
 * - WorkflowScenarioBuilder: Fluent API for complex workflow testing
 *
 * Edge Case Testing:
 * - ConcurrencyTestHelper: Race condition and concurrent operation testing
 * - ConcurrencyScenarios: Pre-built scenarios for common concurrency tests
 *
 * Mock Implementations:
 * - Complete mock ecosystem for isolated testing
 * - Repository, Event Bus, Orchestrator, and Services mocks
 */

// Core testing utilities
export { ProcessManagerTestHarness } from './process-manager-test-harness';
export type {
  ProcessManagerTestHarnessOptions,
  StateTransitionAssertion,
  WorkflowAssertion,
} from './process-manager-test-harness';

export { WorkflowScenarioBuilder, WorkflowScenarioSuite } from './workflow-scenario-builder';
export type {
  ProcessManagerScenario,
  ScenarioExecutionResult,
  WorkflowExpectation,
  WorkflowStep,
} from './workflow-scenario-builder';

// Edge case testing utilities
export { ConcurrencyScenarios, ConcurrencyTestHelper } from '../edge-cases/concurrency-test-helper';
export type {
  ConcurrencyTestResult,
  ConcurrentOperation,
  LoadTestScenario,
  RaceConditionScenario,
} from '../edge-cases/concurrency-test-helper';

// Mock implementations
export * from '../mocks';
