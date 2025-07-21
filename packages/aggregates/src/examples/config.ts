// aggregates/src/examples/config.ts
import type { ExampleConfig } from '@vytches-ddd/examples';

export const aggregatesExamplesConfig: ExampleConfig = {
  packageName: '@vytches-ddd/aggregates',
  packageDescription: 'Aggregate root patterns with capabilities, event sourcing, and complex business logic',
  complexity: {
    basic: {
      description: 'Foundation aggregate patterns with basic domain operations',
      examples: [
        {
          id: 'user-aggregate',
          title: 'User Aggregate - Basic Factory and Operations',
          description: 'Simple user aggregate with factory methods, invariant protection, and domain events',
          tags: ['factory-methods', 'invariant-protection', 'domain-events'],
          framework: null,
          file: 'basic/example-1.md'
        },
        {
          id: 'order-aggregate',
          title: 'Order Aggregate - State Machine Pattern',
          description: 'Order lifecycle management with state machine validation and transitions',
          tags: ['state-machine', 'lifecycle-management', 'validation'],
          framework: null,
          file: 'basic/example-2.md'
        },
        {
          id: 'product-inventory',
          title: 'Product Inventory - Multi-Location Stock Management',
          description: 'Inventory tracking with reservations, locations, and optimistic locking',
          tags: ['inventory-management', 'reservations', 'multi-location', 'optimistic-locking'],
          framework: null,
          file: 'basic/example-3.md'
        }
      ],
      implementations: [
        {
          id: 'basic-implementation',
          title: 'Basic Aggregate Implementation Patterns',
          description: 'Foundation patterns for aggregate design and implementation',
          file: 'basic/implementation.md'
        }
      ],
      useCases: [
        {
          id: 'basic-use-cases',
          title: 'Basic Aggregate Use Cases - Business Scenarios',
          description: 'Real-world scenarios for basic aggregate patterns',
          file: 'basic/use-case.md'
        }
      ]
    },
    intermediate: {
      description: 'Advanced aggregate patterns with event sourcing and capabilities',
      examples: [
        {
          id: 'event-sourced-cart',
          title: 'Event Sourced Shopping Cart - Complete Audit Trail',
          description: 'Shopping cart with event sourcing, snapshots, and temporal queries',
          tags: ['event-sourcing', 'snapshots', 'temporal-queries', 'audit-trail'],
          framework: null,
          file: 'intermediate/example-1.md'
        },
        {
          id: 'banking-account-capabilities',
          title: 'Banking Account - Capability Pattern',
          description: 'Bank account with separated capabilities for transactions, risk, compliance, and audit',
          tags: ['capability-pattern', 'separation-of-concerns', 'banking-domain'],
          framework: null,
          file: 'intermediate/example-2.md'
        },
        {
          id: 'loan-application-workflow',
          title: 'Multi-Tenant Loan Application - Complex Workflow',
          description: 'Loan application with workflow management, multi-tenancy, and approval chains',
          tags: ['workflow-management', 'multi-tenant', 'approval-chain', 'document-management'],
          framework: null,
          file: 'intermediate/example-3.md'
        }
      ],
      implementations: [
        {
          id: 'intermediate-implementation',
          title: 'Intermediate Aggregate Implementation Patterns',
          description: 'Event sourcing, capability separation, and workflow patterns',
          file: 'intermediate/implementation.md'
        }
      ],
      useCases: [
        {
          id: 'intermediate-use-cases',
          title: 'Intermediate Aggregate Use Cases - Complex Business Scenarios',
          description: 'Enterprise scenarios for intermediate aggregate patterns',
          file: 'intermediate/use-case.md'
        }
      ]
    },
    advanced: {
      description: 'Enterprise-scale patterns with AI integration and distributed coordination',
      examples: [
        {
          id: 'enterprise-process-orchestrator',
          title: 'Enterprise Process Orchestration Platform',
          description: 'Global process orchestration with AI decision making and saga coordination',
          tags: ['ai-integration', 'saga-pattern', 'global-orchestration', 'process-management'],
          framework: null,
          file: 'advanced/example-1.md'
        },
        {
          id: 'ai-risk-management',
          title: 'AI-Powered Global Financial Risk Management',
          description: 'Risk management with machine learning, predictive analytics, and real-time assessment',
          tags: ['ai-powered', 'risk-management', 'predictive-analytics', 'machine-learning'],
          framework: null,
          file: 'advanced/example-2.md'
        },
        {
          id: 'blockchain-orchestrator',
          title: 'Enterprise Blockchain Transaction Orchestrator',
          description: 'Cross-chain operations with consensus management and cryptographic validation',
          tags: ['blockchain', 'cross-chain', 'consensus-management', 'cryptographic-validation'],
          framework: null,
          file: 'advanced/example-3.md'
        }
      ],
      implementations: [
        {
          id: 'advanced-implementation',
          title: 'Advanced Aggregate Implementation - Enterprise Patterns',
          description: 'Distributed coordination, AI integration, and high-performance patterns',
          file: 'advanced/implementation.md'
        }
      ],
      useCases: [
        {
          id: 'advanced-use-cases',
          title: 'Advanced Aggregate Use Cases - Enterprise-Scale Complex Scenarios',
          description: 'Global enterprise scenarios for advanced aggregate patterns',
          file: 'advanced/use-case.md'
        }
      ]
    }
  },
  frameworks: {
    nestjs: {
      name: 'NestJS',
      description: 'NestJS integration with @vytches-ddd/di service locator pattern',
      versions: ['10.x', '11.x'],
      basic: [
        {
          id: 'nestjs-user-aggregate',
          title: 'User Aggregate - NestJS Integration',
          description: 'Basic user aggregate integration with NestJS dependency injection',
          tags: ['nestjs', 'dependency-injection', 'service-locator'],
          baseExample: 'user-aggregate',
          file: 'frameworks/nestjs/basic/example-1.md'
        },
        {
          id: 'nestjs-order-aggregate',
          title: 'Order Aggregate - NestJS Integration with State Machine',
          description: 'Order state machine aggregate integration with NestJS',
          tags: ['nestjs', 'state-machine', 'lifecycle-management'],
          baseExample: 'order-aggregate',
          file: 'frameworks/nestjs/basic/example-2.md'
        },
        {
          id: 'nestjs-product-inventory',
          title: 'Product Inventory - NestJS Integration',
          description: 'Product inventory management with stock tracking in NestJS',
          tags: ['nestjs', 'inventory-management', 'stock-tracking'],
          baseExample: 'product-inventory',
          file: 'frameworks/nestjs/basic/example-3.md'
        }
      ],
      intermediate: [
        {
          id: 'nestjs-event-sourced-cart',
          title: 'Event Sourced Shopping Cart - NestJS Integration',
          description: 'Event sourced shopping cart with NestJS and @vytches-ddd/di integration',
          tags: ['nestjs', 'event-sourcing', 'snapshots', 'di-integration'],
          baseExample: 'event-sourced-cart',
          file: 'frameworks/nestjs/intermediate/example-1.md'
        },
        {
          id: 'nestjs-banking-account',
          title: 'Banking Account with Capabilities - NestJS Integration',
          description: 'Banking account with capability separation in NestJS',
          tags: ['nestjs', 'capability-pattern', 'banking', 'risk-management'],
          baseExample: 'banking-account-capabilities',
          file: 'frameworks/nestjs/intermediate/example-2.md'
        },
        {
          id: 'nestjs-loan-application',
          title: 'Multi-Tenant Loan Application - NestJS Integration',
          description: 'Multi-tenant loan workflow management in NestJS',
          tags: ['nestjs', 'multi-tenant', 'workflow', 'approval-chain'],
          baseExample: 'loan-application-workflow',
          file: 'frameworks/nestjs/intermediate/example-3.md'
        }
      ],
      advanced: [
        {
          id: 'nestjs-enterprise-orchestrator',
          title: 'Enterprise Process Orchestrator - NestJS Integration',
          description: 'Enterprise process orchestration with AI integration in NestJS',
          tags: ['nestjs', 'ai-integration', 'process-orchestration', 'saga-pattern'],
          baseExample: 'enterprise-process-orchestrator',
          file: 'frameworks/nestjs/advanced/example-1.md'
        },
        {
          id: 'nestjs-ai-risk-management',
          title: 'AI-Powered Risk Management - NestJS Integration',
          description: 'AI-powered financial risk management with NestJS',
          tags: ['nestjs', 'ai-powered', 'risk-management', 'machine-learning'],
          baseExample: 'ai-risk-management',
          file: 'frameworks/nestjs/advanced/example-2.md'
        },
        {
          id: 'nestjs-blockchain-orchestrator',
          title: 'Blockchain Transaction Orchestrator - NestJS Integration',
          description: 'Enterprise blockchain operations with NestJS integration',
          tags: ['nestjs', 'blockchain', 'cross-chain', 'smart-contracts'],
          baseExample: 'blockchain-orchestrator',
          file: 'frameworks/nestjs/advanced/example-3.md'
        }
      ]
    }
  },
  sharedTypes: {
    description: 'Common types and interfaces used across aggregate examples',
    file: 'types/index.ts',
    exports: [
      'User', 'CreateUserData', 'UpdateUserData', 'UserPreferences',
      'Order', 'CreateOrderData', 'OrderItem', 'OrderStatus', 'ShippingAddress',
      'ProductInventory', 'CreateProductData', 'StockLocation', 'StockReservation',
      'ShoppingCart', 'CartItem', 'CartSnapshot', 'PriceCalculation',
      'BankingAccount', 'Transaction', 'RiskAssessment', 'ComplianceCheck',
      'LoanApplication', 'ApprovalStep', 'WorkflowEngine', 'TenantConfig',
      'ProcessDefinition', 'GlobalProcessContext', 'AIDecisionEngine',
      'RiskManagementResult', 'BlockchainNetwork', 'SmartContractAddress'
    ]
  },
  sharedUtilities: {
    description: 'Common utilities and helper functions for aggregate examples',
    file: 'shared/index.ts',
    exports: [
      'createExecutionContext',
      'calculateHealthScore',
      'isRetryableError',
      'formatCurrency',
      'validateEmail',
      'generateOrderNumber',
      'calculatePricing',
      'validateStockOperation'
    ]
  },
  dependencies: [
    '@vytches-ddd/aggregates',
    '@vytches-ddd/domain-primitives', 
    '@vytches-ddd/contracts',
    '@vytches-ddd/di'
  ],
  optionalDependencies: [
    '@vytches-ddd/events',
    '@vytches-ddd/validation',
    '@vytches-ddd/policies'
  ],
  tags: [
    'aggregates',
    'domain-driven-design',
    'factory-methods',
    'invariant-protection',
    'domain-events',
    'state-machine',
    'event-sourcing',
    'snapshots',
    'capability-pattern',
    'workflow-management',
    'multi-tenant',
    'ai-integration',
    'blockchain',
    'enterprise-patterns',
    'distributed-coordination',
    'saga-pattern',
    'process-orchestration',
    'risk-management',
    'consensus-management'
  ],
  learningPath: [
    {
      step: 1,
      title: 'Foundation Aggregates',
      description: 'Start with basic aggregate patterns, factory methods, and domain events',
      examples: ['user-aggregate', 'order-aggregate', 'product-inventory']
    },
    {
      step: 2,
      title: 'Event Sourcing & Capabilities',
      description: 'Learn event sourcing, snapshots, and capability separation patterns',
      examples: ['event-sourced-cart', 'banking-account-capabilities']
    },
    {
      step: 3,
      title: 'Complex Business Logic',
      description: 'Master workflow management, multi-tenancy, and complex business rules',
      examples: ['loan-application-workflow']
    },
    {
      step: 4,
      title: 'Framework Integration',
      description: 'Integrate aggregates with NestJS using @vytches-ddd/di patterns',
      examples: ['nestjs-user-aggregate', 'nestjs-event-sourced-cart']
    },
    {
      step: 5,
      title: 'Enterprise Patterns',
      description: 'Explore AI integration, distributed coordination, and blockchain operations',
      examples: ['enterprise-process-orchestrator', 'ai-risk-management', 'blockchain-orchestrator']
    }
  ],
  bestPractices: [
    'Keep aggregates focused on a single business concept',
    'Use factory methods to ensure invariants are maintained',
    'Implement proper state validation for state machines', 
    'Leverage event sourcing for complete audit trails',
    'Separate complex logic into focused capabilities',
    'Design for eventual consistency in distributed scenarios',
    'Implement snapshot optimization for large event histories',
    'Use AI augmentation for complex decision scenarios',
    'Plan for multi-tenant requirements from the start',
    'Maintain clear boundaries between domain and infrastructure'
  ],
  antiPatterns: [
    'Creating god aggregates that handle too many responsibilities',
    'Exposing internal aggregate state directly to external consumers',
    'Performing external calls directly from aggregate methods',
    'Neglecting proper validation in state machine transitions',
    'Creating dependencies between different aggregates',
    'Using synchronous operations for eventually consistent scenarios',
    'Ignoring snapshot optimization in event sourcing',
    'Over-engineering simple business logic with unnecessary patterns',
    'Mixing framework concerns with domain logic',
    'Failing to handle concurrent modifications properly'
  ]
};

export default aggregatesExamplesConfig;