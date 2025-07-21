/**
 * @fileoverview Configuration for validation package examples
 * @package @vytches-ddd/validation
 * @version 1.0.0
 */

import type { ExampleDefinition } from '@vytches-ddd/examples-shared';

export const validationExamples: ExampleDefinition[] = [
  // Basic Examples
  {
    id: 'validation-basic-specification',
    title: 'Basic Specification Pattern Implementation',
    description: 'Fundamental specification pattern for validation with email and age validation examples',
    complexity: 'basic',
    domain: 'User Management',
    patterns: ['Specification Pattern', 'Field Validation', 'Business Rules'],
    dependencies: ['@vytches-ddd/validation'],
    path: 'basic/example-1.md',
    estimatedReadTime: 8,
    tags: ['specification', 'validation', 'business-rules', 'field-validation'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },
  {
    id: 'validation-basic-composite',
    title: 'Composite Validation with Business Rules',
    description: 'Product validation using configurable business rules and field-level validation with quality assessment',
    complexity: 'basic',
    domain: 'Product Management',
    patterns: ['Composite Validation', 'Business Rules', 'Data Quality Assessment'],
    dependencies: ['@vytches-ddd/validation'],
    path: 'basic/example-2.md',
    estimatedReadTime: 10,
    tags: ['composite-validation', 'product', 'quality-assessment', 'field-validation'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },
  {
    id: 'validation-basic-use-case',
    title: 'Basic Validation Use Cases',
    description: 'Common validation scenarios including user registration, product creation, and order processing',
    complexity: 'basic',
    domain: 'Cross-Domain',
    patterns: ['Use Case Patterns', 'Domain Validation', 'Error Handling'],
    dependencies: ['@vytches-ddd/validation'],
    path: 'basic/use-case.md',
    estimatedReadTime: 12,
    tags: ['use-cases', 'domain-validation', 'error-handling', 'best-practices'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },

  // Intermediate Examples
  {
    id: 'validation-intermediate-async',
    title: 'Composite Validation with Policy Integration',
    description: 'Advanced async specifications with financial services validation and policy integration',
    complexity: 'intermediate',
    domain: 'Financial Services',
    patterns: ['Async Specifications', 'Policy Integration', 'Financial Validation'],
    dependencies: ['@vytches-ddd/validation', '@vytches-ddd/policies'],
    path: 'intermediate/example-1.md',
    estimatedReadTime: 12,
    tags: ['async-validation', 'policies', 'financial', 'composite-validation'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },
  {
    id: 'validation-intermediate-rules',
    title: 'Dynamic Business Rules Engine',
    description: 'Dynamic business rules engine with rule composition and conditional validation logic',
    complexity: 'intermediate',
    domain: 'Business Rules',
    patterns: ['Business Rules Engine', 'Dynamic Rules', 'Rule Composition'],
    dependencies: ['@vytches-ddd/validation'],
    path: 'intermediate/example-2.md',
    estimatedReadTime: 14,
    tags: ['business-rules', 'dynamic-rules', 'rule-engine', 'composition'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },
  {
    id: 'validation-intermediate-batch',
    title: 'Batch Validation with Performance Optimization',
    description: 'High-performance batch validation with parallel processing and optimization strategies',
    complexity: 'intermediate',
    domain: 'Data Processing',
    patterns: ['Batch Processing', 'Performance Optimization', 'Parallel Validation'],
    dependencies: ['@vytches-ddd/validation'],
    path: 'intermediate/example-3.md',
    estimatedReadTime: 16,
    tags: ['batch-validation', 'performance', 'parallel-processing', 'optimization'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },
  {
    id: 'validation-intermediate-use-case',
    title: 'Intermediate Validation Use Cases',
    description: 'Advanced validation scenarios including multi-step validation, async processing, and error recovery',
    complexity: 'intermediate',
    domain: 'Cross-Domain',
    patterns: ['Multi-step Validation', 'Async Processing', 'Error Recovery'],
    dependencies: ['@vytches-ddd/validation', '@vytches-ddd/policies'],
    path: 'intermediate/use-case.md',
    estimatedReadTime: 18,
    tags: ['multi-step', 'async-processing', 'error-recovery', 'advanced-patterns'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },

  // Advanced Examples
  {
    id: 'validation-advanced-orchestration',
    title: 'Enterprise Validation Orchestration Platform',
    description: 'Enterprise-scale validation orchestration with global coordination and AI-powered enhancement',
    complexity: 'advanced',
    domain: 'Enterprise Architecture',
    patterns: ['Validation Orchestration', 'Global Coordination', 'AI Enhancement'],
    dependencies: ['@vytches-ddd/validation', '@vytches-ddd/events', '@vytches-ddd/messaging'],
    path: 'advanced/example-1.md',
    estimatedReadTime: 20,
    tags: ['orchestration', 'enterprise', 'ai-enhancement', 'global-coordination'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },
  {
    id: 'validation-advanced-ai',
    title: 'AI-Powered Adaptive Validation',
    description: 'Machine learning-enhanced validation system with adaptive thresholds and predictive validation',
    complexity: 'advanced',
    domain: 'AI/ML Integration',
    patterns: ['AI-Powered Validation', 'Adaptive Systems', 'Predictive Validation'],
    dependencies: ['@vytches-ddd/validation', '@vytches-ddd/events'],
    path: 'advanced/example-2.md',
    estimatedReadTime: 18,
    tags: ['ai-validation', 'machine-learning', 'adaptive-systems', 'predictive'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },
  {
    id: 'validation-advanced-monitoring',
    title: 'Real-time Global Data Quality Monitoring',
    description: 'Real-time global data quality monitoring with predictive analytics and automated remediation',
    complexity: 'advanced',
    domain: 'Data Quality Management',
    patterns: ['Real-time Monitoring', 'Predictive Analytics', 'Automated Remediation'],
    dependencies: ['@vytches-ddd/validation', '@vytches-ddd/events', '@vytches-ddd/messaging', '@vytches-ddd/resilience'],
    path: 'advanced/example-3.md',
    estimatedReadTime: 25,
    tags: ['real-time-monitoring', 'data-quality', 'predictive-analytics', 'remediation'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },
  {
    id: 'validation-advanced-use-case',
    title: 'Advanced Enterprise Validation Use Cases',
    description: 'Enterprise-scale validation scenarios including global compliance, healthcare data integrity, and supply chain quality',
    complexity: 'advanced',
    domain: 'Enterprise Use Cases',
    patterns: ['Global Compliance', 'Healthcare Validation', 'Supply Chain Quality'],
    dependencies: ['@vytches-ddd/validation', '@vytches-ddd/events', '@vytches-ddd/messaging'],
    path: 'advanced/use-case.md',
    estimatedReadTime: 30,
    tags: ['enterprise-use-cases', 'global-compliance', 'healthcare', 'supply-chain'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },

  // Framework Examples - NestJS Basic
  {
    id: 'validation-nestjs-basic-manual',
    title: 'NestJS Basic Validation Integration - Manual Setup',
    description: 'Manual integration of validation with NestJS using standard dependency injection patterns',
    complexity: 'basic',
    domain: 'NestJS Integration',
    patterns: ['Manual Setup', 'NestJS Integration', 'Standard DI'],
    dependencies: ['@vytches-ddd/validation', '@nestjs/common'],
    path: 'frameworks/nestjs/basic/example-1.md',
    estimatedReadTime: 12,
    tags: ['nestjs', 'manual-setup', 'basic-integration', 'dependency-injection'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },
  {
    id: 'validation-nestjs-basic-business-rules',
    title: 'NestJS Product Validation - Manual Setup',
    description: 'Product validation with business rules and manual configuration in NestJS environment',
    complexity: 'basic',
    domain: 'NestJS Integration',
    patterns: ['Product Validation', 'Business Rules', 'Manual Configuration'],
    dependencies: ['@vytches-ddd/validation', '@nestjs/common'],
    path: 'frameworks/nestjs/basic/example-2.md',
    estimatedReadTime: 14,
    tags: ['nestjs', 'product-validation', 'business-rules', 'manual-configuration'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },

  // Framework Examples - NestJS Intermediate
  {
    id: 'validation-nestjs-intermediate-di',
    title: 'NestJS Advanced Validation with VytchesDDD DI Integration',
    description: 'Advanced NestJS integration using VytchesDDD DI for enterprise validation patterns',
    complexity: 'intermediate',
    domain: 'NestJS Integration',
    patterns: ['VytchesDDD DI', 'Enterprise Validation', 'Bridge Pattern'],
    dependencies: ['@vytches-ddd/validation', '@vytches-ddd/di', '@nestjs/common'],
    path: 'frameworks/nestjs/intermediate/example-1.md',
    estimatedReadTime: 16,
    tags: ['nestjs', 'vytchesddd-di', 'enterprise', 'bridge-pattern'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },

  // Framework Examples - NestJS Advanced
  {
    id: 'validation-nestjs-advanced-orchestration',
    title: 'NestJS Enterprise Validation Orchestration - VytchesDDD DI',
    description: 'Enterprise-scale validation orchestration with global coordination and AI enhancement',
    complexity: 'advanced',
    domain: 'NestJS Integration',
    patterns: ['Enterprise Orchestration', 'Global Coordination', 'AI Enhancement'],
    dependencies: ['@vytches-ddd/validation', '@vytches-ddd/di', '@nestjs/common'],
    path: 'frameworks/nestjs/advanced/example-1.md',
    estimatedReadTime: 20,
    tags: ['nestjs', 'enterprise-orchestration', 'global-coordination', 'ai-enhancement'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },
  {
    id: 'validation-nestjs-advanced-ai',
    title: 'NestJS AI-Powered Adaptive Validation - VytchesDDD DI',
    description: 'AI-powered adaptive validation with machine learning enhancement and predictive analytics',
    complexity: 'advanced',
    domain: 'NestJS Integration',
    patterns: ['AI-Powered Validation', 'Adaptive Systems', 'Predictive Analytics'],
    dependencies: ['@vytches-ddd/validation', '@vytches-ddd/di', '@nestjs/common'],
    path: 'frameworks/nestjs/advanced/example-2.md',
    estimatedReadTime: 18,
    tags: ['nestjs', 'ai-validation', 'adaptive-systems', 'predictive-analytics'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },
  {
    id: 'validation-nestjs-advanced-monitoring',
    title: 'NestJS Real-time Quality Monitoring - VytchesDDD DI',
    description: 'Real-time global data quality monitoring with streaming analytics and automated remediation',
    complexity: 'advanced',
    domain: 'NestJS Integration',
    patterns: ['Real-time Monitoring', 'Streaming Analytics', 'Automated Remediation'],
    dependencies: ['@vytches-ddd/validation', '@vytches-ddd/di', '@nestjs/common'],
    path: 'frameworks/nestjs/advanced/example-3.md',
    estimatedReadTime: 22,
    tags: ['nestjs', 'real-time-monitoring', 'streaming-analytics', 'automated-remediation'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  },

  // Types Definition
  {
    id: 'validation-types',
    title: 'Validation Package Types Definition',
    description: 'Comprehensive type definitions for validation examples including User, Product, Order, and ValidationContext',
    complexity: 'basic',
    domain: 'Type Definitions',
    patterns: ['Type Safety', 'Domain Models', 'Validation Contracts'],
    dependencies: ['@vytches-ddd/validation'],
    path: 'types/index.ts',
    estimatedReadTime: 5,
    tags: ['types', 'typescript', 'domain-models', 'contracts'],
    lastUpdated: new Date('2024-07-21'),
    version: '1.0.0'
  }
];

/**
 * Get examples by complexity level
 */
export function getExamplesByComplexity(complexity: 'basic' | 'intermediate' | 'advanced'): ExampleDefinition[] {
  return validationExamples.filter(example => example.complexity === complexity);
}

/**
 * Get examples by domain
 */
export function getExamplesByDomain(domain: string): ExampleDefinition[] {
  return validationExamples.filter(example => example.domain === domain);
}

/**
 * Get examples by pattern
 */
export function getExamplesByPattern(pattern: string): ExampleDefinition[] {
  return validationExamples.filter(example => example.patterns.includes(pattern));
}

/**
 * Get framework-specific examples
 */
export function getFrameworkExamples(framework: string): ExampleDefinition[] {
  return validationExamples.filter(example => 
    example.path.includes(`frameworks/${framework}`)
  );
}

/**
 * Get example by ID
 */
export function getExampleById(id: string): ExampleDefinition | undefined {
  return validationExamples.find(example => example.id === id);
}

/**
 * Package statistics
 */
export const validationPackageStats = {
  totalExamples: validationExamples.length,
  byComplexity: {
    basic: getExamplesByComplexity('basic').length,
    intermediate: getExamplesByComplexity('intermediate').length,
    advanced: getExamplesByComplexity('advanced').length
  },
  byType: {
    domain: validationExamples.filter(e => !e.path.includes('frameworks') && !e.path.includes('types')).length,
    frameworks: validationExamples.filter(e => e.path.includes('frameworks')).length,
    types: validationExamples.filter(e => e.path.includes('types')).length
  },
  totalReadTime: validationExamples.reduce((total, example) => total + example.estimatedReadTime, 0)
};

export default validationExamples;