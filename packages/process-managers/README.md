# @vytches/ddd-process-managers

**Enterprise-grade process managers for orchestrating complex business workflows
in Domain-Driven Design applications.**

## Overview

Process managers (also known as sagas or orchestrators) coordinate long-running
business processes that span multiple aggregates and bounded contexts. This
package provides a robust foundation for implementing process managers in your
DDD applications with built-in state management, timeout handling, and
comprehensive logging.

**Key Features:**

- 🔄 **Workflow Orchestration** - Coordinate multi-aggregate business processes
- 📊 **State Management** - Track process state with optimistic concurrency
  control
- ⏱️ **Timeout Handling** - Built-in timeout detection and recovery
- 🔍 **Comprehensive Logging** - Enterprise-grade structured logging with
  VytchesDDD Logger
- 🎯 **Event Correlation** - Smart event routing using correlation data
- 🛡️ **Type Safety** - Full TypeScript support with generic state typing
- 🏗️ **Enterprise Ready** - Production-grade architecture with error handling

## Installation

```bash
npm install @vytches/ddd-process-managers
# Or with pnpm
pnpm add @vytches/ddd-process-managers
```

**Package Dependencies:**

- `@vytches/ddd-contracts` - Core DDD interfaces and contracts
- `@vytches/ddd-logging` - Enterprise structured logging
- `@vytches/ddd-events` - Domain event infrastructure
- `@vytches/ddd-aggregates` - Aggregate root patterns

## Quick Start

### 15-Minute Setup Guide

**Step 1:** Install the package

```bash
pnpm add @vytches/ddd-process-managers
```

**Step 2:** Create your first process manager

```typescript
import {
  BaseProcessManager,
  ProcessManagerResult,
} from '@vytches/ddd-process-managers';

class OrderProcessManager extends BaseProcessManager {
  canHandle(event: IProcessManagerEvent): boolean {
    return ['OrderCreated', 'PaymentProcessed', 'OrderCompleted'].includes(
      event.eventType
    );
  }

  async handle(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    // Implementation details below...
  }
}
```

**Step 3:** Integrate with your event system  
**Step 4:** Start orchestrating business workflows!

### Complete Business Example - E-commerce Order Processing

```typescript
import {
  BaseProcessManager,
  IProcessManagerEvent,
  IProcessManagerContext,
  ProcessManagerResult,
  ProcessManagerStatus,
} from '@vytches/ddd-process-managers';

/**
 * OrderProcessManager orchestrates the complete order fulfillment workflow:
 * 1. Order Creation → 2. Payment Processing → 3. Inventory Reservation → 4. Order Completion
 *
 * Business Context: E-commerce order processing requires coordination between:
 * - Order aggregate (order management)
 * - Payment aggregate (payment processing)
 * - Inventory aggregate (stock management)
 * - Shipping aggregate (fulfillment)
 */
class OrderProcessManager extends BaseProcessManager {
  canHandle(event: IProcessManagerEvent): boolean {
    return [
      'OrderCreated', // Start the process
      'PaymentProcessed', // Continue to inventory
      'PaymentFailed', // Handle payment failure
      'InventoryReserved', // Continue to completion
      'InventoryUnavailable', // Handle inventory issues
      'OrderCompleted', // Final success state
    ].includes(event.eventType);
  }

  async handle(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    // Set status to running (automatically logged)
    this.setRunning();

    switch (event.eventType) {
      case 'OrderCreated':
        return await this.handleOrderCreated(event, context);
      case 'PaymentProcessed':
        return await this.handlePaymentProcessed(event, context);
      case 'PaymentFailed':
        return await this.handlePaymentFailed(event, context);
      case 'InventoryReserved':
        return await this.handleInventoryReserved(event, context);
      case 'InventoryUnavailable':
        return await this.handleInventoryUnavailable(event, context);
      case 'OrderCompleted':
        this.complete(); // Automatically logged
        return this.createSuccessResult();
      default:
        return this.createFailureResult('Unknown event type', 'UNKNOWN_EVENT');
    }
  }

  isComplete(): boolean {
    return (
      this.state.currentStep === 'completed' ||
      this.state.currentStep === 'cancelled'
    );
  }

  getCorrelationData(): Record<string, unknown> {
    return {
      orderId: this.state.stepData.orderId,
      customerId: this.state.stepData.customerId,
      processId: this.id,
    };
  }

  private async handleOrderCreated(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    // Update process state
    this.updateState({
      currentStep: 'payment-processing',
      stepData: {
        orderId: event.payload.orderId,
        customerId: event.payload.customerId,
        amount: event.payload.amount,
        items: event.payload.items,
      },
    });

    // Generate command to process payment
    return this.createSuccessResult([
      {
        type: 'ProcessPayment',
        payload: {
          orderId: event.payload.orderId,
          customerId: event.payload.customerId,
          amount: event.payload.amount,
          paymentMethod: event.payload.paymentMethod,
        },
        targetBoundedContext: 'Payment',
      },
    ]);
  }

  private async handlePaymentProcessed(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.updateState({
      currentStep: 'inventory-reservation',
      stepData: {
        ...this.state.stepData,
        paymentId: event.payload.paymentId,
        paymentStatus: 'processed',
      },
    });

    // Generate command to reserve inventory
    return this.createSuccessResult([
      {
        type: 'ReserveInventory',
        payload: {
          orderId: this.state.stepData.orderId,
          items: this.state.stepData.items,
        },
        targetBoundedContext: 'Inventory',
      },
    ]);
  }

  private async handlePaymentFailed(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.updateState({
      currentStep: 'cancelled',
      stepData: {
        ...this.state.stepData,
        cancellationReason: 'payment-failed',
        paymentError: event.payload.error,
      },
    });

    // Generate events for cancellation
    return this.createSuccessResult(
      [], // No commands needed
      [
        {
          eventType: 'OrderCancelled',
          payload: {
            orderId: this.state.stepData.orderId,
            reason: 'payment-failed',
            details: event.payload.error,
          },
          targetBoundedContext: 'Orders',
        },
      ]
    );
  }

  private async handleInventoryReserved(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.updateState({
      currentStep: 'completing-order',
      stepData: {
        ...this.state.stepData,
        reservationId: event.payload.reservationId,
        inventoryStatus: 'reserved',
      },
    });

    // Generate final completion command
    return this.createSuccessResult([
      {
        type: 'CompleteOrder',
        payload: {
          orderId: this.state.stepData.orderId,
          paymentId: this.state.stepData.paymentId,
          reservationId: event.payload.reservationId,
        },
        targetBoundedContext: 'Orders',
      },
    ]);
  }

  private async handleInventoryUnavailable(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.updateState({
      currentStep: 'compensating',
      stepData: {
        ...this.state.stepData,
        inventoryError: event.payload.error,
      },
    });

    // Generate compensation commands
    return this.createSuccessResult(
      [
        {
          type: 'RefundPayment',
          payload: {
            paymentId: this.state.stepData.paymentId,
            amount: this.state.stepData.amount,
            reason: 'inventory-unavailable',
          },
          targetBoundedContext: 'Payment',
        },
      ],
      [
        {
          eventType: 'OrderCancelled',
          payload: {
            orderId: this.state.stepData.orderId,
            reason: 'inventory-unavailable',
            details: event.payload.error,
          },
          targetBoundedContext: 'Orders',
        },
      ]
    );
  }
}
```

### Using the Process Manager

```typescript
import { IProcessManagerState } from '@vytches/ddd-process-managers';

// Step 1: Create initial state
const initialState: IProcessManagerState = {
  currentStep: 'created',
  stepData: {},
  version: 0,
  lastModified: new Date(),
  correlationData: {},
};

// Step 2: Instantiate process manager with timeout
const processManager = new OrderProcessManager(
  'order-process-123', // Unique process ID
  'OrderProcessManager', // Process type
  initialState, // Initial state
  new Date(), // Created timestamp
  3600000 // 1 hour timeout
);

// Step 3: Create event and context
const event: IProcessManagerEvent = {
  id: 'event-1',
  eventType: 'OrderCreated',
  eventName: 'OrderCreated',
  payload: {
    orderId: 'order-123',
    customerId: 'customer-456',
    amount: 100.5,
    items: [{ sku: 'WIDGET-001', quantity: 2 }],
    paymentMethod: 'credit-card',
  },
  aggregateId: 'order-123',
  aggregateType: 'Order',
  aggregateVersion: 1,
  timestamp: new Date(),
  correlationId: 'correlation-123',
  metadata: { source: 'web-ui', userAgent: 'Chrome' },
};

const context: IProcessManagerContext = {
  correlationId: 'correlation-123',
  userId: 'user-456',
  sessionId: 'session-789',
  processedAt: new Date(),
  services: {
    commandDispatcher: myCommandDispatcher,
    eventPublisher: myEventPublisher,
    logger: myLogger,
  },
};

// Step 4: Process the event
if (processManager.canHandle(event)) {
  const result = await processManager.handle(event, context);

  if (result.success) {
    console.log('✅ Process manager handled event successfully');

    // Execute any commands generated
    if (result.commands) {
      for (const command of result.commands) {
        await context.services?.commandDispatcher?.dispatch(command);
      }
    }

    // Publish any events generated
    if (result.events) {
      for (const event of result.events) {
        await context.services?.eventPublisher?.publish(event);
      }
    }

    console.log(
      `🔄 Process is ${processManager.isComplete() ? 'complete' : 'continuing'}`
    );
  } else {
    console.error('❌ Process manager failed:', result.error);

    // Handle failure scenarios
    if (result.error?.code === 'TIMEOUT') {
      // Handle timeout-specific logic
    }
  }
}
```

### Integration with VytchesDDD Event System

````typescript
import { UnifiedEventBus } from '@vytches/ddd-events';
import { VytchesDDD } from '@vytches/ddd-di';

// Setup process manager with VytchesDDD ecosystem
class ProcessManagerService {
  private processManagers = new Map<string, OrderProcessManager>();

  constructor(
    private eventBus: UnifiedEventBus,
    private commandDispatcher: CommandDispatcher
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Subscribe to relevant domain events
    this.eventBus.subscribe('OrderCreated', this.handleDomainEvent.bind(this));
    this.eventBus.subscribe('PaymentProcessed', this.handleDomainEvent.bind(this));
    this.eventBus.subscribe('InventoryReserved', this.handleDomainEvent.bind(this));
  }

  private async handleDomainEvent(domainEvent: IDomainEvent): Promise<void> {
    // Convert domain event to process manager event
    const processManagerEvent = this.convertToProcessManagerEvent(domainEvent);

    // Find or create process manager
    const processManager = await this.getOrCreateProcessManager(processManagerEvent);

    if (processManager && processManager.canHandle(processManagerEvent)) {
      const context = this.createProcessingContext(domainEvent);
      const result = await processManager.handle(processManagerEvent, context);

      // Execute resulting commands and events
      await this.executeResult(result);
    }
  }

  private async getOrCreateProcessManager(
    event: IProcessManagerEvent
  ): Promise<OrderProcessManager | undefined> {
    // Use correlation data to find existing process or create new one
    const correlationData = this.extractCorrelationData(event);
    const processId = this.generateProcessId(correlationData);

    if (!this.processManagers.has(processId)) {
      if (event.eventType === 'OrderCreated') {
        // Create new process manager for order creation
        const initialState: IProcessManagerState = {
          currentStep: 'created',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData,
        };

        const processManager = new OrderProcessManager(
          processId,
          'OrderProcessManager',
          initialState,
          new Date(),
          3600000 // 1 hour timeout
        );

        this.processManagers.set(processId, processManager);
      }
    }

    return this.processManagers.get(processId);
  }
}

## Core Concepts

### Process Manager Lifecycle

The process manager follows a well-defined lifecycle with automatic state transitions and comprehensive logging:

1. **CREATED** - Initial state when process manager is instantiated
   - Triggers structured logging with initial state
   - Ready to receive first triggering event

2. **RUNNING** - Actively processing events and coordinating workflow steps
   - Set via `setRunning()` during event handling
   - Indicates active business logic execution

3. **WAITING** - Waiting for specific events to continue processing
   - Set via `setWaiting()` when expecting external responses
   - Process is paused until next relevant event arrives

4. **COMPLETED** - Successfully finished all workflow steps
   - Set via `complete()` when business process finishes
   - Triggers success logging and cleanup workflows

5. **FAILED** - Encountered an error and cannot continue
   - Set via `fail(error)` during error scenarios
   - Includes error details for debugging and compensation

6. **TIMED_OUT** - Exceeded the configured timeout duration
   - Automatically detected via `isTimedOut()` checks
   - Triggers timeout logging and potential compensation

### Event Handling Architecture

Process managers implement a sophisticated event handling system:

**Event Filtering & Routing:**
```typescript
canHandle(event: IProcessManagerEvent): boolean {
  // Smart filtering based on event type and business rules
  return this.supportedEvents.includes(event.eventType) &&
         this.isRelevantForCurrentState(event);
}
````

**State-Driven Processing:**

- **State Updates** - Atomic state changes with version control
- **Command Generation** - Type-safe command creation with target context
- **Event Publishing** - Integration events for cross-boundary communication
- **Compensation Logic** - Built-in support for rollback scenarios

### Advanced State Management

Process managers provide multiple state management patterns:

**Basic State (`IProcessManagerState`):**

```typescript
interface IProcessManagerState {
  currentStep: string; // Current workflow step
  stepData: Record<string, unknown>; // Step-specific data
  version: number; // Optimistic concurrency control
  lastModified: Date; // Audit timestamp
  correlationData: Record<string, unknown>; // Event correlation
}
```

**Extended State (`IExtendedProcessManagerState`):**

```typescript
interface IExtendedProcessManagerState extends IProcessManagerState {
  completedSteps: Array<StepHistory>; // Audit trail
  pendingOperations: Array<PendingOp>; // Expected operations
  errors?: Array<ErrorRecord>; // Error history
  compensationData?: Record<string, unknown>; // Rollback data
}
```

### Business Context Integration

Process managers excel at coordinating **cross-aggregate workflows**:

- **Multi-Bounded Context** - Orchestrate across different business domains
- **Compensation Patterns** - Handle failures with automatic rollback
- **Event Correlation** - Track related events across the workflow
- **Audit Trails** - Complete history of workflow execution
- **Timeout Management** - Handle long-running processes with timeouts

## API Reference

### Core Interfaces

#### `IProcessManager<TState extends IProcessManagerState>`

Main interface for all process managers in the VytchesDDD system.

```typescript
interface IProcessManager<
  TState extends IProcessManagerState = IProcessManagerState,
> {
  // Properties
  readonly id: string; // Unique process instance ID
  readonly type: string; // Process manager class type
  readonly state: TState; // Current process state
  readonly status: ProcessManagerStatus; // Current lifecycle status
  readonly createdAt: Date; // Creation timestamp
  readonly updatedAt: Date; // Last update timestamp
  readonly timeout?: number; // Optional timeout in milliseconds

  // Event Processing
  canHandle(event: IProcessManagerEvent): boolean;
  handle(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult>;

  // State Management
  isComplete(): boolean;
  isTimedOut(): boolean;
  getCorrelationData(): Record<string, unknown>;
  updateState(newState: Partial<TState>): void;

  // Lifecycle Management
  complete(): void;
  fail(error: Error): void;
}
```

#### `IProcessManagerEvent`

Extended domain event interface with process management capabilities:

```typescript
interface IProcessManagerEvent extends IDomainEvent {
  id: string; // Unique event identifier
  eventName: string; // Human-readable event name
  aggregateId: string; // Source aggregate ID
  aggregateType: string; // Source aggregate type
  aggregateVersion: number; // Aggregate version after event
  timestamp: Date; // Event occurrence time
  correlationId?: string; // Correlation identifier
  causationId?: string; // Causing event ID
  metadata: IEventMetadata; // Additional event metadata
}
```

#### `IProcessManagerContext`

Processing context providing access to external services:

```typescript
interface IProcessManagerContext {
  correlationId: string; // Processing session ID
  userId?: string; // Initiating user
  tenantId?: string; // Multi-tenant context
  requestId?: string; // Request tracing ID
  sessionId?: string; // Session identifier
  processedAt: Date; // Processing timestamp
  metadata?: Record<string, unknown>; // Additional metadata
  services?: IProcessManagerServices; // Available services
}
```

#### `ProcessManagerResult`

Result of event processing in a process manager:

```typescript
interface ProcessManagerResult {
  success: boolean; // Processing success flag

  commands?: Array<{
    // Commands to execute
    type: string;
    payload: unknown;
    targetBoundedContext?: string;
  }>;

  events?: Array<{
    // Events to publish
    eventType: string;
    payload: unknown;
    targetBoundedContext?: string;
  }>;

  shouldContinue?: boolean; // Continue processing flag

  error?: {
    // Error information
    message: string;
    code?: string;
    details?: unknown;
  };
}
```

### Base Classes

#### `BaseProcessManager<TState extends IProcessManagerState>`

Abstract base class providing common process manager functionality:

**Constructor:**

```typescript
constructor(
  id: string,                    // Unique process ID
  type: string,                  // Process type identifier
  initialState: TState,          // Initial state
  createdAt: Date = new Date(),  // Creation timestamp
  timeout?: number               // Optional timeout in ms
)
```

**Protected Methods:**

```typescript
protected setRunning(): void;     // Set status to RUNNING
protected setWaiting(): void;     // Set status to WAITING
protected setTimedOut(): void;    // Set status to TIMED_OUT

protected createSuccessResult(   // Create success result
  commands?: ProcessManagerResult['commands'],
  events?: ProcessManagerResult['events'],
  shouldContinue?: boolean
): ProcessManagerResult;

protected createFailureResult(   // Create failure result
  message: string,
  code?: string,
  details?: unknown
): ProcessManagerResult;
```

#### `ProcessManagerStatus` Enumeration

```typescript
enum ProcessManagerStatus {
  CREATED = 'CREATED', // Initial state
  RUNNING = 'RUNNING', // Processing events
  WAITING = 'WAITING', // Waiting for events
  COMPLETED = 'COMPLETED', // Successfully finished
  FAILED = 'FAILED', // Failed with error
  TIMED_OUT = 'TIMED_OUT', // Exceeded timeout
}
```

### State Interfaces

#### `IProcessManagerState` (Base)

```typescript
interface IProcessManagerState {
  currentStep: string; // Current workflow step
  stepData: Record<string, unknown>; // Step-specific data
  version: number; // Optimistic concurrency
  lastModified: Date; // Last modification time
  correlationData: Record<string, unknown>; // Event correlation data
  metadata?: Record<string, unknown>; // Additional metadata
}
```

#### `IExtendedProcessManagerState` (Advanced)

```typescript
interface IExtendedProcessManagerState extends IProcessManagerState {
  completedSteps: Array<{
    // Step completion history
    stepName: string;
    completedAt: Date;
    data?: Record<string, unknown>;
  }>;

  pendingOperations: Array<{
    // Expected operations
    operationType: string;
    operationId: string;
    expectedBy?: Date;
    data?: Record<string, unknown>;
  }>;

  errors?: Array<{
    // Error history
    error: string;
    occurredAt: Date;
    step: string;
    recoverable: boolean;
  }>;

  compensationData?: Record<string, unknown>; // Rollback data
}
```

## Advanced Usage

### Custom State Types

Create strongly-typed process managers for complex business workflows:

```typescript
interface CustomerOnboardingState extends IExtendedProcessManagerState {
  customerId: string;
  email: string;

  // KYC (Know Your Customer) workflow
  kycStatus: 'pending' | 'in-review' | 'approved' | 'rejected';
  kycDocuments: Array<{
    type: string;
    status: 'uploaded' | 'verified' | 'rejected';
    uploadedAt: Date;
  }>;

  // Account setup workflow
  accountStatus: 'pending' | 'created' | 'activated';
  accountId?: string;

  // Communication workflow
  welcomeEmailSent: boolean;
  trainingScheduled: boolean;

  // Progress tracking
  completionPercentage: number;
  estimatedCompletionTime: Date;
}

class CustomerOnboardingProcessManager extends BaseProcessManager<CustomerOnboardingState> {
  canHandle(event: IProcessManagerEvent): boolean {
    return [
      'CustomerRegistered',
      'KYCDocumentUploaded',
      'KYCDocumentVerified',
      'KYCApproved',
      'AccountCreated',
      'WelcomeEmailSent',
      'OnboardingCompleted',
    ].includes(event.eventType);
  }

  async handle(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.setRunning();

    // Check for timeout before processing
    if (this.isTimedOut()) {
      return await this.handleTimeout(context);
    }

    switch (event.eventType) {
      case 'CustomerRegistered':
        return await this.initiateKYCProcess(event, context);
      case 'KYCApproved':
        return await this.createCustomerAccount(event, context);
      case 'AccountCreated':
        return await this.sendWelcomeEmail(event, context);
      // ... other handlers
    }
  }

  private async handleTimeout(
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.setTimedOut();

    // Generate compensation commands based on current state
    const compensationCommands = [];

    if (
      this.state.accountStatus === 'created' &&
      !this.state.completedSteps.some(s => s.stepName === 'account-activated')
    ) {
      compensationCommands.push({
        type: 'DeactivateAccount',
        payload: { accountId: this.state.accountId },
        targetBoundedContext: 'Accounts',
      });
    }

    return this.createFailureResult(
      `Customer onboarding timed out after ${this.timeout}ms`,
      'ONBOARDING_TIMEOUT',
      { compensationCommands }
    );
  }
}
```

### Advanced Error Handling & Compensation

```typescript
class RobustOrderProcessManager extends BaseProcessManager<IExtendedProcessManagerState> {
  async handle(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    try {
      this.setRunning();

      // Timeout check with automatic compensation
      if (this.isTimedOut()) {
        return await this.compensateTimedOutProcess(context);
      }

      const result = await this.processBusinessLogic(event, context);

      // Record successful step
      if (result.success) {
        this.recordCompletedStep(event.eventType, event.payload);
      }

      return result;
    } catch (error) {
      return await this.handleProcessingError(error as Error, event, context);
    }
  }

  private async compensateTimedOutProcess(
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.setTimedOut();

    // Analyze completed steps to determine compensation strategy
    const compensationCommands = this.buildCompensationCommands();

    // Record timeout error
    this.recordError(
      'PROCESS_TIMEOUT',
      'Process exceeded maximum duration',
      false
    );

    return this.createFailureResult(
      'Process timed out and compensation initiated',
      'TIMEOUT_COMPENSATED',
      { compensationCommands }
    );
  }

  private async handleProcessingError(
    error: Error,
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    // Determine if error is recoverable
    const isRecoverable = this.isRecoverableError(error);

    // Record error in state
    this.recordError(error.message, this.state.currentStep, isRecoverable);

    if (isRecoverable && this.getRetryCount() < 3) {
      // Schedule retry
      this.setWaiting();
      return this.createSuccessResult(
        [],
        [
          {
            eventType: 'ProcessRetryScheduled',
            payload: {
              processId: this.id,
              originalEvent: event,
              retryCount: this.getRetryCount() + 1,
              retryAfter: new Date(Date.now() + 5000), // 5 second delay
            },
          },
        ]
      );
    } else {
      // Permanent failure - initiate compensation
      this.fail(error);
      const compensationCommands = this.buildCompensationCommands();

      return this.createFailureResult(
        `Permanent failure: ${error.message}`,
        'PERMANENT_FAILURE',
        { compensationCommands }
      );
    }
  }

  private recordCompletedStep(stepName: string, data?: unknown): void {
    const extendedState = this.state as IExtendedProcessManagerState;
    extendedState.completedSteps.push({
      stepName,
      completedAt: new Date(),
      data: data as Record<string, unknown>,
    });
    this.updateState(extendedState);
  }

  private recordError(error: string, step: string, recoverable: boolean): void {
    const extendedState = this.state as IExtendedProcessManagerState;
    extendedState.errors = extendedState.errors || [];
    extendedState.errors.push({
      error,
      occurredAt: new Date(),
      step,
      recoverable,
    });
    this.updateState(extendedState);
  }
}
```

### Multi-Aggregate Coordination

````typescript
class SupplierOnboardingProcessManager extends BaseProcessManager {
  canHandle(event: IProcessManagerEvent): boolean {
    return [
      'SupplierApplicationReceived',  // From Supplier aggregate
      'ComplianceCheckCompleted',     // From Compliance aggregate
      'ContractGenerated',            // From Legal aggregate
      'PaymentMethodValidated',       // From Finance aggregate
      'SupplierOnboardingCompleted'   // Final state
    ].includes(event.eventType);
  }

  async handle(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.setRunning();

    switch (event.eventType) {
      case 'SupplierApplicationReceived':
        return this.initiateParallelProcessing(event, context);
      case 'ComplianceCheckCompleted':
        return this.checkAllRequirementsComplete(event, context);
      // ... other handlers
    }
  }

  private async initiateParallelProcessing(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {

    this.updateState({
      currentStep: 'parallel-processing',
      stepData: {
        supplierId: event.payload.supplierId,
        applicationId: event.payload.applicationId,
      }
    });

    // Initiate multiple parallel processes
    return this.createSuccessResult([
      {
        type: 'InitiateComplianceCheck',
        payload: { supplierId: event.payload.supplierId },
        targetBoundedContext: 'Compliance'
      },
      {
        type: 'GenerateSupplierContract',
        payload: { supplierId: event.payload.supplierId },
        targetBoundedContext: 'Legal'
      },
      {
        type: 'ValidatePaymentMethod',
        payload: {
          supplierId: event.payload.supplierId,
          paymentDetails: event.payload.paymentDetails
        },
        targetBoundedContext: 'Finance'
      }
    ]);
  }

  private async checkAllRequirementsComplete(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {

    // Track completion of parallel processes
    const stepData = { ...this.state.stepData };
    stepData[`${event.eventType}_completed`] = true;

    this.updateState({ stepData });

    // Check if all parallel processes are complete
    const allComplete = [
      'ComplianceCheckCompleted_completed',
      'ContractGenerated_completed',
      'PaymentMethodValidated_completed'
    ].every(key => stepData[key] === true);

    if (allComplete) {
      this.updateState({ currentStep: 'finalizing' });

      return this.createSuccessResult([{
        type: 'CompleteSupplierOnboarding',
        payload: { supplierId: this.state.stepData.supplierId },
        targetBoundedContext: 'Suppliers'
      }]);
    } else {
      // Still waiting for other processes
      this.setWaiting();
      return this.createSuccessResult();
    }
  }
}

## Framework Integration

### NestJS Integration

#### Manual Setup (Beginner)

```typescript
// order-process.service.ts
import { Injectable } from '@nestjs/common';
import { OrderProcessManager } from './order-process-manager';
import { UnifiedEventBus } from '@vytches/ddd-events';

@Injectable()
export class OrderProcessService {
  private processManagers = new Map<string, OrderProcessManager>();

  constructor(
    private eventBus: UnifiedEventBus,
    private commandDispatcher: CommandDispatcher
  ) {
    this.setupEventSubscriptions();
  }

  private setupEventSubscriptions(): void {
    this.eventBus.subscribe('OrderCreated', this.handleOrderEvent.bind(this));
    this.eventBus.subscribe('PaymentProcessed', this.handleOrderEvent.bind(this));
    this.eventBus.subscribe('InventoryReserved', this.handleOrderEvent.bind(this));
  }

  private async handleOrderEvent(domainEvent: IDomainEvent): Promise<void> {
    const processManagerEvent = this.convertToProcessManagerEvent(domainEvent);
    const processManager = await this.getOrCreateProcessManager(processManagerEvent);

    if (processManager?.canHandle(processManagerEvent)) {
      const context = this.createProcessingContext(domainEvent);
      const result = await processManager.handle(processManagerEvent, context);

      await this.executeProcessResult(result);
    }
  }

  private async executeProcessResult(result: ProcessManagerResult): Promise<void> {
    if (result.success) {
      // Execute commands
      if (result.commands) {
        for (const command of result.commands) {
          await this.commandDispatcher.dispatch(command);
        }
      }

      // Publish events
      if (result.events) {
        for (const event of result.events) {
          await this.eventBus.publish(event);
        }
      }
    } else {
      // Handle failure scenarios
      console.error('Process manager failed:', result.error);
    }
  }
}
````

#### DI Integration (Advanced)

```typescript
// order-process.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD, DomainService } from '@vytches/ddd-di';
import { OrderProcessManager } from './order-process-manager';

@DomainService('orderProcessService', {
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderManagement',
})
export class OrderProcessService {
  private processManagers = new Map<string, OrderProcessManager>();

  async handleDomainEvent(event: IDomainEvent): Promise<void> {
    // Use VytchesDDD service resolution
    const eventBus = VytchesDDD.resolve<UnifiedEventBus>('eventBus');
    const commandDispatcher =
      VytchesDDD.resolve<CommandDispatcher>('commandDispatcher');

    // Process manager logic with dependency injection
    const processManager = await this.getOrCreateProcessManager(event);
    if (processManager) {
      const result = await processManager.handle(event, this.createContext());
      await this.executeResult(result, { eventBus, commandDispatcher });
    }
  }
}

// NestJS Bridge Service
@Injectable()
export class OrderProcessController {
  private readonly orderProcessService: OrderProcessService;

  constructor() {
    // Bridge to VytchesDDD instance
    this.orderProcessService = VytchesDDD.resolve<OrderProcessService>(
      'orderProcessService'
    );
  }

  @EventPattern('OrderCreated')
  async handleOrderCreated(event: IDomainEvent): Promise<void> {
    await this.orderProcessService.handleDomainEvent(event);
  }
}

// Module configuration
@Module({
  controllers: [OrderProcessController],
  providers: [OrderProcessService],
})
export class OrderProcessModule implements OnModuleInit {
  async onModuleInit() {
    // Initialize VytchesDDD before framework DI
    await VytchesDDD.configure();
  }
}
```

### Express Middleware Integration

```typescript
// express-process-manager.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ProcessManagerService } from './process-manager.service';

export class ProcessManagerMiddleware {
  constructor(private processManagerService: ProcessManagerService) {}

  // Middleware for handling domain events via HTTP
  handleDomainEventEndpoint() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const domainEvent = req.body as IDomainEvent;

        // Convert to process manager event
        const processManagerEvent =
          this.convertToProcessManagerEvent(domainEvent);

        // Process through process manager service
        const result =
          await this.processManagerService.handleEvent(processManagerEvent);

        if (result.success) {
          res.status(200).json({
            message: 'Event processed successfully',
            commands: result.commands?.length || 0,
            events: result.events?.length || 0,
          });
        } else {
          res.status(400).json({
            error: 'Event processing failed',
            details: result.error,
          });
        }
      } catch (error) {
        next(error);
      }
    };
  }

  // Middleware for process status checking
  checkProcessStatus() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { processId } = req.params;

        const processManager =
          await this.processManagerService.getProcessManager(processId);

        if (!processManager) {
          return res.status(404).json({ error: 'Process not found' });
        }

        res.json({
          id: processManager.id,
          type: processManager.type,
          status: processManager.status,
          currentStep: processManager.state.currentStep,
          isComplete: processManager.isComplete(),
          isTimedOut: processManager.isTimedOut(),
          createdAt: processManager.createdAt,
          updatedAt: processManager.updatedAt,
        });
      } catch (error) {
        next(error);
      }
    };
  }
}

// Express app setup
const app = express();
const processManagerMiddleware = new ProcessManagerMiddleware(
  processManagerService
);

app.post('/events', processManagerMiddleware.handleDomainEventEndpoint());
app.get('/processes/:processId', processManagerMiddleware.checkProcessStatus());
```

### Fastify Plugin Integration

```typescript
// fastify-process-manager.plugin.ts
import { FastifyPluginAsync } from 'fastify';
import { ProcessManagerService } from './process-manager.service';

const processManagerPlugin: FastifyPluginAsync = async fastify => {
  // Register process manager service
  const processManagerService = new ProcessManagerService();
  fastify.decorate('processManagerService', processManagerService);

  // Event handling endpoint
  fastify.post(
    '/events',
    {
      schema: {
        body: {
          type: 'object',
          required: ['eventType', 'payload', 'aggregateId'],
          properties: {
            eventType: { type: 'string' },
            payload: { type: 'object' },
            aggregateId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const domainEvent = request.body as IDomainEvent;

      try {
        const result = await processManagerService.handleEvent(domainEvent);

        return {
          success: result.success,
          ...(result.commands && { commandsGenerated: result.commands.length }),
          ...(result.events && { eventsGenerated: result.events.length }),
          ...(result.error && { error: result.error }),
        };
      } catch (error) {
        reply.code(500);
        return { error: 'Internal server error' };
      }
    }
  );

  // Process status endpoint
  fastify.get('/processes/:processId', async (request, reply) => {
    const { processId } = request.params as { processId: string };

    const processManager =
      await processManagerService.getProcessManager(processId);

    if (!processManager) {
      reply.code(404);
      return { error: 'Process not found' };
    }

    return {
      id: processManager.id,
      type: processManager.type,
      status: processManager.status,
      state: processManager.state,
      isComplete: processManager.isComplete(),
      isTimedOut: processManager.isTimedOut(),
      timestamps: {
        createdAt: processManager.createdAt,
        updatedAt: processManager.updatedAt,
      },
    };
  });
};

export default processManagerPlugin;
```

### Direct Usage (Framework-Agnostic)

````typescript
// standalone-process-manager.service.ts
import { UnifiedEventBus } from '@vytches/ddd-events';
import { OrderProcessManager } from './order-process-manager';

export class StandaloneProcessManagerService {
  private processManagers = new Map<string, OrderProcessManager>();
  private eventBus: UnifiedEventBus;

  constructor() {
    this.eventBus = new UnifiedEventBus();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.subscribe('*', this.handleAnyDomainEvent.bind(this));
  }

  async handleAnyDomainEvent(event: IDomainEvent): Promise<void> {
    // Find process managers that can handle this event
    const relevantProcessManagers = Array.from(this.processManagers.values())
      .filter(pm => pm.canHandle(event as IProcessManagerEvent));

    // Process event through all relevant process managers
    for (const processManager of relevantProcessManagers) {
      const context = this.createProcessingContext(event);
      const result = await processManager.handle(event as IProcessManagerEvent, context);

      await this.executeResult(result);
    }
  }

  async createNewProcess(
    processType: string,
    initialEvent: IDomainEvent
  ): Promise<OrderProcessManager> {
    const processId = this.generateProcessId(initialEvent);

    const initialState: IProcessManagerState = {
      currentStep: 'created',
      stepData: {},
      version: 0,
      lastModified: new Date(),
      correlationData: this.extractCorrelationData(initialEvent)
    };

    const processManager = new OrderProcessManager(
      processId,
      processType,
      initialState,
      new Date(),
      3600000 // 1 hour timeout
    );

    this.processManagers.set(processId, processManager);

    // Handle initial event
    if (processManager.canHandle(initialEvent as IProcessManagerEvent)) {
      const context = this.createProcessingContext(initialEvent);
      await processManager.handle(initialEvent as IProcessManagerEvent, context);
    }

    return processManager;
  }

  // Public API for external usage
  async publishEvent(event: IDomainEvent): Promise<void> {
    await this.eventBus.publish(event);
  }

  getProcessStatus(processId: string): OrderProcessManager | undefined {
    return this.processManagers.get(processId);
  }

  getAllProcesses(): OrderProcessManager[] {
    return Array.from(this.processManagers.values());
  }
}

## Best Practices

### Design Principles

1. **Single Responsibility** - Each process manager should orchestrate ONE specific business workflow
   ```typescript
   // ✅ Good: Focused on order processing
   class OrderProcessManager extends BaseProcessManager {
     // Handles only order-related workflow steps
   }

   // ❌ Bad: Handles multiple unrelated processes
   class GenericProcessManager extends BaseProcessManager {
     // Handles orders, customers, inventory, etc.
   }
````

2. **Event-Driven Design** - React to domain events, don't poll for state

   ```typescript
   // ✅ Good: Event-driven
   canHandle(event: IProcessManagerEvent): boolean {
     return ['OrderCreated', 'PaymentProcessed'].includes(event.eventType);
   }

   // ❌ Bad: Polling approach
   // Don't use timers or polling mechanisms
   ```

3. **Idempotency** - Handle duplicate events gracefully

   ```typescript
   async handle(event: IProcessManagerEvent, context: IProcessManagerContext) {
     // Check if this event was already processed
     if (this.hasProcessedEvent(event.id)) {
       return this.createSuccessResult(); // Idempotent response
     }

     // Mark event as processed
     this.markEventProcessed(event.id);

     // Continue with business logic...
   }
   ```

4. **Compensation First** - Design rollback logic from the start

   ```typescript
   private async handlePaymentFailed(event: IProcessManagerEvent) {
     // Immediately define compensation strategy
     const compensationCommands = this.buildCompensationCommands();

     this.updateState({ currentStep: 'compensating' });

     return this.createSuccessResult(compensationCommands);
   }
   ```

### State Management Best Practices

5. **Version Control** - Use optimistic concurrency control

   ```typescript
   updateState(newState: Partial<TState>): void {
     this._state = {
       ...this._state,
       ...newState,
       version: this._state.version + 1, // Auto-increment version
       lastModified: new Date(),
     };
   }
   ```

6. **Audit Trails** - Track all state changes

   ```typescript
   interface ProcessAuditState extends IExtendedProcessManagerState {
     auditTrail: Array<{
       action: string;
       timestamp: Date;
       previousState: any;
       newState: any;
       eventId: string;
     }>;
   }
   ```

7. **Correlation Strategy** - Design consistent correlation data

   ```typescript
   getCorrelationData(): Record<string, unknown> {
     return {
       // Always include primary business identifier
       orderId: this.state.stepData.orderId,

       // Include secondary identifiers for routing
       customerId: this.state.stepData.customerId,

       // Include process metadata
       processId: this.id,
       processType: this.type,
     };
   }
   ```

### Error Handling & Resilience

8. **Timeout Strategy** - Set appropriate timeouts for business context

   ```typescript
   // Different timeouts for different process types
   const timeouts = {
     orderProcessing: 3600000, // 1 hour
     customerOnboarding: 86400000, // 24 hours
     supplierVerification: 604800000, // 1 week
   };
   ```

9. **Error Classification** - Distinguish between recoverable and permanent
   errors

   ```typescript
   private isRecoverableError(error: Error): boolean {
     const recoverableCodes = [
       'NETWORK_TIMEOUT',
       'SERVICE_UNAVAILABLE',
       'RATE_LIMITED'
     ];

     return recoverableCodes.some(code => error.message.includes(code));
   }
   ```

10. **Circuit Breaker Integration** - Protect against cascading failures

    ```typescript
    async handle(event: IProcessManagerEvent, context: IProcessManagerContext) {
      // Check circuit breaker status before processing
      if (context.services?.circuitBreaker?.isOpen()) {
        return this.createFailureResult('Circuit breaker open', 'CIRCUIT_OPEN');
      }

      // Continue with processing...
    }
    ```

### Performance & Monitoring

11. **Resource Cleanup** - Remove completed processes

    ```typescript
    complete(): void {
      super.complete();

      // Schedule cleanup after completion
      setTimeout(() => {
        this.cleanup();
      }, 300000); // 5 minutes after completion
    }
    ```

12. **Metrics Collection** - Track process performance

    ```typescript
    private recordMetrics(eventType: string, processingTime: number): void {
      this.logger.info('Process step completed', {
        processId: this.id,
        eventType,
        processingTime,
        currentStep: this.state.currentStep,
        completionPercentage: this.calculateProgress(),
      });
    }
    ```

13. **Health Monitoring** - Implement health checks
    ```typescript
    isHealthy(): boolean {
      return !this.isTimedOut() &&
             this.status !== ProcessManagerStatus.FAILED &&
             this.getRetryCount() < 3;
    }
    ```

## Testing Patterns

### Unit Testing Process Managers

```typescript
// order-process-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { OrderProcessManager } from '../src/order-process-manager';

describe('OrderProcessManager', () => {
  let processManager: OrderProcessManager;
  let initialState: IProcessManagerState;

  beforeEach(() => {
    initialState = {
      currentStep: 'created',
      stepData: {},
      version: 0,
      lastModified: new Date(),
      correlationData: {},
    };

    processManager = new OrderProcessManager(
      'test-process-123',
      'OrderProcessManager',
      initialState,
      new Date(),
      3600000
    );
  });

  describe('Event Handling', () => {
    it('should handle OrderCreated event successfully', async () => {
      const event: IProcessManagerEvent = {
        id: 'event-1',
        eventType: 'OrderCreated',
        eventName: 'OrderCreated',
        payload: {
          orderId: 'order-123',
          customerId: 'customer-456',
          amount: 100.5,
        },
        aggregateId: 'order-123',
        aggregateType: 'Order',
        aggregateVersion: 1,
        timestamp: new Date(),
        metadata: {},
      };

      const context: IProcessManagerContext = {
        correlationId: 'test-correlation',
        processedAt: new Date(),
      };

      const [error, result] = await safeRun(
        async () => await processManager.handle(event, context)
      );

      expect(error).toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.commands).toHaveLength(1);
      expect(result?.commands?.[0].type).toBe('ProcessPayment');
      expect(processManager.state.currentStep).toBe('payment-processing');
    });

    it('should handle timeout scenarios correctly', async () => {
      // Create process manager with very short timeout
      const shortTimeoutManager = new OrderProcessManager(
        'timeout-test',
        'OrderProcessManager',
        initialState,
        new Date(Date.now() - 10000), // 10 seconds ago
        5000 // 5 second timeout
      );

      expect(shortTimeoutManager.isTimedOut()).toBe(true);

      const event: IProcessManagerEvent = {
        id: 'timeout-event',
        eventType: 'OrderCreated',
        eventName: 'OrderCreated',
        payload: { orderId: 'order-timeout' },
        aggregateId: 'order-timeout',
        aggregateType: 'Order',
        aggregateVersion: 1,
        timestamp: new Date(),
        metadata: {},
      };

      const context: IProcessManagerContext = {
        correlationId: 'timeout-test',
        processedAt: new Date(),
      };

      const [error, result] = await safeRun(
        async () => await shortTimeoutManager.handle(event, context)
      );

      expect(error).toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.error?.code).toBe('TIMEOUT');
    });
  });

  describe('State Management', () => {
    it('should update state with version increment', () => {
      const initialVersion = processManager.state.version;

      processManager.updateState({
        currentStep: 'payment-processing',
        stepData: { orderId: 'order-123' },
      });

      expect(processManager.state.version).toBe(initialVersion + 1);
      expect(processManager.state.currentStep).toBe('payment-processing');
      expect(processManager.state.stepData.orderId).toBe('order-123');
    });

    it('should track completion status correctly', () => {
      expect(processManager.isComplete()).toBe(false);

      processManager.complete();

      expect(processManager.isComplete()).toBe(true);
      expect(processManager.status).toBe(ProcessManagerStatus.COMPLETED);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle unknown event types gracefully', async () => {
      const unknownEvent: IProcessManagerEvent = {
        id: 'unknown-event',
        eventType: 'UnknownEventType',
        eventName: 'UnknownEventType',
        payload: {},
        aggregateId: 'test-aggregate',
        aggregateType: 'Test',
        aggregateVersion: 1,
        timestamp: new Date(),
        metadata: {},
      };

      const context: IProcessManagerContext = {
        correlationId: 'error-test',
        processedAt: new Date(),
      };

      const [error, result] = await safeRun(
        async () => await processManager.handle(unknownEvent, context)
      );

      expect(error).toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.error?.message).toBe('Unknown event type');
    });
  });
});
```

### Integration Testing with Event Bus

```typescript
// process-manager-integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { ProcessManagerService } from '../src/process-manager.service';

describe('Process Manager Integration', () => {
  let eventBus: UnifiedEventBus;
  let processManagerService: ProcessManagerService;

  beforeEach(() => {
    eventBus = new UnifiedEventBus();
    processManagerService = new ProcessManagerService(eventBus);
  });

  it('should orchestrate complete order workflow', async () => {
    const orderCreatedEvent = {
      eventType: 'OrderCreated',
      payload: {
        orderId: 'integration-order-123',
        customerId: 'customer-789',
        amount: 250.0,
      },
      aggregateId: 'integration-order-123',
      aggregateType: 'Order',
      aggregateVersion: 1,
      timestamp: new Date(),
    };

    // Publish initial event
    await eventBus.publish(orderCreatedEvent);

    // Wait for process manager to handle event
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify process manager was created and handled event
    const processManager = processManagerService.getProcessManager(
      'integration-order-123'
    );
    expect(processManager).toBeDefined();
    expect(processManager?.state.currentStep).toBe('payment-processing');

    // Continue with payment processed event
    const paymentProcessedEvent = {
      eventType: 'PaymentProcessed',
      payload: {
        orderId: 'integration-order-123',
        paymentId: 'payment-456',
      },
      aggregateId: 'integration-order-123',
      aggregateType: 'Order',
      aggregateVersion: 2,
      timestamp: new Date(),
    };

    await eventBus.publish(paymentProcessedEvent);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify progression to next step
    expect(processManager?.state.currentStep).toBe('inventory-reservation');
  });
});
```

## Migration from Sagas to Process Managers

### When to Use Process Managers vs Sagas

**Use Process Managers when:**

- ✅ You need **stateful workflow orchestration** with persistent state
- ✅ Your process involves **multiple aggregates** across bounded contexts
- ✅ You require **timeout handling** and **compensation patterns**
- ✅ Business workflows are **long-running** (minutes to days)
- ✅ You need **audit trails** and **process monitoring**

**Use Sagas when:**

- ✅ You need **simple command orchestration** without complex state
- ✅ Your process is **short-lived** (seconds to minutes)
- ✅ You have **linear workflows** without complex branching
- ✅ **Performance** is critical and state overhead is unwanted

### Migration Strategy

**Step 1: Identify Migration Candidates**

```typescript
// Evaluate existing sagas for migration
interface SagaMigrationCandidate {
  sagaName: string;
  hasComplexState: boolean; // Indicator for PM migration
  crossesBoundedContexts: boolean; // Indicator for PM migration
  requiresTimeouts: boolean; // Indicator for PM migration
  hasCompensationLogic: boolean; // Both support this
  averageDuration: number; // >5min suggests PM
}
```

**Step 2: Side-by-Side Implementation**

```typescript
// Run both saga and process manager in parallel during migration
class HybridOrderOrchestrator {
  constructor(
    private saga: OrderSaga,
    private processManager: OrderProcessManager
  ) {}

  async handleOrderEvent(event: IDomainEvent): Promise<void> {
    // Run both implementations
    const sagaResult = await this.saga.handle(event);
    const pmResult = await this.processManager.handle(event, context);

    // Compare results for validation
    this.validateResults(sagaResult, pmResult);

    // Use process manager result in production
    return this.executeResult(pmResult);
  }
}
```

**Step 3: State Migration**

```typescript
// Migrate existing saga state to process manager state
class SagaToProcessManagerMigrator {
  migrateState(sagaState: ISagaState): IProcessManagerState {
    return {
      currentStep: this.mapSagaStepToProcessStep(sagaState.currentStep),
      stepData: this.transformSagaData(sagaState.data),
      version: 0, // Start fresh versioning
      lastModified: new Date(),
      correlationData: sagaState.correlationData,
    };
  }
}
```

### Combined Usage Patterns

```typescript
// Use both patterns where appropriate
class HybridWorkflowOrchestrator {
  constructor(
    private processManager: OrderProcessManager, // For complex workflows
    private saga: PaymentSaga // For simple operations
  ) {}

  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // Start process manager for overall order workflow
    await this.processManager.handle(event, context);

    // Use saga for simple payment processing
    const paymentCommand = this.createPaymentCommand(event);
    await this.saga.execute(paymentCommand);
  }
}
```

## Performance Considerations

### Memory Management

```typescript
class OptimizedProcessManagerService {
  private processManagers = new Map<string, OrderProcessManager>();
  private readonly maxProcessCount = 10000;
  private readonly cleanupInterval = 300000; // 5 minutes

  constructor() {
    this.setupCleanupScheduler();
  }

  private setupCleanupScheduler(): void {
    setInterval(() => {
      this.cleanupCompletedProcesses();
    }, this.cleanupInterval);
  }

  private cleanupCompletedProcesses(): void {
    const completed = Array.from(this.processManagers.entries())
      .filter(([_, pm]) => pm.isComplete() || pm.isTimedOut())
      .filter(([_, pm]) => Date.now() - pm.updatedAt.getTime() > 300000); // 5 min old

    completed.forEach(([id]) => {
      this.processManagers.delete(id);
    });

    this.logger.info('Process cleanup completed', {
      removedCount: completed.length,
      activeCount: this.processManagers.size,
    });
  }
}
```

### Scaling Strategies

**Horizontal Scaling:**

```typescript
// Process manager partitioning by correlation data
class PartitionedProcessManagerService {
  private partitions = new Map<string, ProcessManagerService>();

  getPartition(
    correlationData: Record<string, unknown>
  ): ProcessManagerService {
    const partitionKey = this.calculatePartitionKey(correlationData);

    if (!this.partitions.has(partitionKey)) {
      this.partitions.set(partitionKey, new ProcessManagerService());
    }

    return this.partitions.get(partitionKey)!;
  }

  private calculatePartitionKey(
    correlationData: Record<string, unknown>
  ): string {
    // Partition by customer, tenant, or other business key
    const businessKey =
      correlationData.customerId || correlationData.tenantId || 'default';
    return `partition-${this.hashString(businessKey.toString()) % 16}`;
  }
}
```

### Event Processing Optimization

```typescript
// Batch event processing for high-throughput scenarios
class BatchProcessManagerService {
  private eventQueue: IProcessManagerEvent[] = [];
  private readonly batchSize = 100;
  private readonly batchTimeout = 1000; // 1 second

  async queueEvent(event: IProcessManagerEvent): Promise<void> {
    this.eventQueue.push(event);

    if (this.eventQueue.length >= this.batchSize) {
      await this.processBatch();
    }
  }

  private async processBatch(): Promise<void> {
    const batch = this.eventQueue.splice(0, this.batchSize);

    // Process events in parallel
    const processPromises = batch.map(event => this.processEvent(event));

    await Promise.allSettled(processPromises);
  }
}
```

## Enterprise Features

### Multi-Tenant Support

```typescript
interface TenantAwareProcessManagerState extends IExtendedProcessManagerState {
  tenantId: string;
  tenantConfiguration: {
    timeouts: Record<string, number>;
    features: Record<string, boolean>;
    limits: Record<string, number>;
  };
}

class TenantAwareProcessManager extends BaseProcessManager<TenantAwareProcessManagerState> {
  async handle(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    // Apply tenant-specific timeout
    const tenantTimeout = this.state.tenantConfiguration.timeouts[this.type];
    if (tenantTimeout && this.isTimedOut(tenantTimeout)) {
      return this.handleTenantTimeout(context);
    }

    // Apply tenant-specific business rules
    if (!this.isTenantFeatureEnabled('advanced-processing')) {
      return this.handleBasicProcessing(event, context);
    }

    return super.handle(event, context);
  }
}
```

### Monitoring & Observability

```typescript
// Process manager health monitoring
class ProcessManagerHealthMonitor {
  private healthChecks = new Map<string, HealthCheck>();

  registerHealthCheck(processManagerType: string, check: HealthCheck): void {
    this.healthChecks.set(processManagerType, check);
  }

  async checkHealth(): Promise<HealthReport> {
    const results = await Promise.allSettled(
      Array.from(this.healthChecks.entries()).map(async ([type, check]) => ({
        type,
        healthy: await check.isHealthy(),
        metrics: await check.getMetrics(),
      }))
    );

    return {
      overall: results.every(r => r.status === 'fulfilled' && r.value.healthy),
      processManagers: results.map(r =>
        r.status === 'fulfilled'
          ? r.value
          : { type: 'unknown', healthy: false, error: r.reason }
      ),
    };
  }
}
```

### Security Considerations

```typescript
class SecureProcessManager extends BaseProcessManager {
  async handle(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    // Validate event source
    if (!this.validateEventSource(event, context)) {
      return this.createFailureResult(
        'Unauthorized event source',
        'UNAUTHORIZED'
      );
    }

    // Sanitize sensitive data in state
    const sanitizedState = this.sanitizeState(this.state);

    // Apply security policies
    const securityResult = await this.applySecurityPolicies(event, context);
    if (!securityResult.allowed) {
      return this.createFailureResult(
        securityResult.reason,
        'SECURITY_VIOLATION'
      );
    }

    return super.handle(event, context);
  }

  private sanitizeState(state: IProcessManagerState): IProcessManagerState {
    const sensitiveFields = ['creditCard', 'ssn', 'password', 'token'];
    // Remove or mask sensitive fields
    return this.maskSensitiveData(state, sensitiveFields);
  }
}
```

## Troubleshooting Guide

### Common Issues

**1. Process Manager Not Receiving Events**

```typescript
// Debug event routing
class ProcessManagerDebugger {
  debugEventRouting(event: IProcessManagerEvent): void {
    console.log('Event Debug Info:', {
      eventType: event.eventType,
      correlationId: event.correlationId,
      aggregateId: event.aggregateId,
      availableProcessManagers: this.getAvailableProcessManagers(),
      matchingProcessManagers: this.findMatchingProcessManagers(event),
    });
  }
}
```

**2. State Version Conflicts**

```typescript
// Handle version conflicts
async handle(event: IProcessManagerEvent, context: IProcessManagerContext) {
  try {
    return await super.handle(event, context);
  } catch (error) {
    if (error instanceof VersionConflictError) {
      // Reload latest state and retry
      await this.reloadState();
      return await super.handle(event, context);
    }
    throw error;
  }
}
```

**3. Memory Leaks**

```typescript
// Monitor process manager memory usage
class MemoryMonitor {
  checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();

    if (memUsage.heapUsed > this.heapThreshold) {
      this.logger.warn('High memory usage detected', {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        activeProcesses: this.processManagers.size,
      });

      // Trigger aggressive cleanup
      this.forceCleanup();
    }
  }
}
```

## Summary

The `@vytches/ddd-process-managers` package provides enterprise-grade process
orchestration capabilities for Domain-Driven Design applications. Key advantages
include:

🎯 **Business-Focused** - Designed specifically for complex business workflows  
🏗️ **Enterprise Ready** - Production-grade features with comprehensive logging  
🔧 **Framework Agnostic** - Works with NestJS, Express, Fastify, or standalone  
🛡️ **Type Safe** - Full TypeScript support with generic state typing  
📊 **Observable** - Built-in monitoring, metrics, and health checks  
⚡ **Performant** - Optimized for high-throughput scenarios  
🔄 **Resilient** - Timeout handling, compensation, and error recovery

**Enterprise Adoption Checklist:**

- ✅ Comprehensive API documentation
- ✅ Multiple framework integration examples
- ✅ Advanced patterns for complex scenarios
- ✅ Testing strategies and examples
- ✅ Performance optimization guidance
- ✅ Security and monitoring considerations
- ✅ Migration guidance from existing patterns
- ✅ Troubleshooting and debugging support

For additional examples and advanced patterns, see the
[VytchesDDD Examples Repository](https://github.com/vytches/ddd-examples).

## Contributing

Please see the main repository's contributing guidelines.

## License

MIT - see LICENSE file for details.
