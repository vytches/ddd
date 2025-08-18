# ADR-0020: Process Managers Implementation - Why Not Just Use Sagas?

**Status**: Accepted  
**Date**: 2025-08-16  
**Decision Makers**: architecture-guardian, library-expert  
**Related Issues**: VF-008

## Context and Problem Statement

VytchesDDD currently has a **fully implemented, enterprise-grade Saga pattern**
for transaction orchestration with compensation. The question arises: **"Why do
we need Process Managers when we already have Sagas?"**

This ADR explains why Process Managers are fundamentally different from Sagas
and why enterprises need BOTH patterns for complete DDD implementation.

## The Core Difference: Transactions vs Business Workflows

### What Sagas Solve (Already Implemented ✅)

Sagas handle **distributed transactions** where you need to maintain consistency
across multiple services/aggregates:

```typescript
// SAGA: "If payment fails, undo everything"
class PaymentProcessingSaga extends BaseSaga {
  async handle(event: OrderCreated) {
    try {
      await this.processPayment(event.paymentDetails); // Step 1
      await this.reserveInventory(event.items); // Step 2
      await this.createShippingLabel(event.address); // Step 3
    } catch (error) {
      // ROLLBACK EVERYTHING
      await this.compensate(); // Undo Step 3, Step 2, Step 1
    }
  }
}
```

**Saga Characteristics:**

- **Duration**: Minutes to hours
- **Goal**: All-or-nothing transaction
- **Failure**: Rollback/compensate
- **State**: Minimal (just tracking compensation)
- **Business Visibility**: None (technical pattern)

### What Process Managers Solve (Missing ❌)

Process Managers handle **business workflows** that span days/weeks/months with
complex state management:

```typescript
// PROCESS MANAGER: "Track order through multiple business states over weeks"
class OrderFulfillmentProcess extends ProcessManager<OrderState> {
  states = [
    'OrderReceived', // Day 1
    'PaymentPending', // Day 1-3
    'PaymentReceived', // Day 3
    'InventoryAllocated', // Day 3-4
    'Picking', // Day 4-5
    'Packing', // Day 5
    'Shipped', // Day 6-7
    'InTransit', // Day 7-14
    'Delivered', // Day 14
    'Completed', // Day 14+
  ];

  // Business rules change based on state
  @State('Picking')
  pickingState = {
    businessHours: '9am-5pm',
    requiredStaff: ['warehouse-worker'],
    timeout: { after: '4h', escalateTo: 'Supervisor' },
    allowedTransitions: ['Packing', 'BackOrdered', 'Cancelled'],
  };

  // Time-based triggers (not events)
  @Timeout('PaymentPending', '72h')
  handleAbandonedCart() {
    this.transitionTo('Cancelled');
    this.notifyCustomer('Order cancelled due to payment timeout');
  }
}
```

**Process Manager Characteristics:**

- **Duration**: Days to months
- **Goal**: Guide through business workflow
- **Failure**: Transition to error-handling state
- **State**: Rich, business-meaningful states
- **Business Visibility**: Full ("Your order is in Picking state")

## Real-World Examples: Why You Can't Use Sagas

### Example 1: Loan Application Process

```typescript
class LoanApplicationProcess extends ProcessManager<LoanState> {
  states = [
    'ApplicationSubmitted', // Day 1
    'DocumentsRequested', // Day 2 - Email sent to customer
    'DocumentsReceived', // Day 3-7 - Customer uploads docs
    'InitialReview', // Day 8-10 - Automated checks
    'UnderwritingReview', // Day 11-15 - Human review
    'ManagerApproval', // Day 16-17 - Management decision
    'ConditionalApproval', // Day 18 - Additional requirements
    'FinalDocumentation', // Day 19-25 - Legal docs
    'FundsReleased', // Day 26
  ];

  // Can't be a Saga because:
  // 1. Spans 26 days
  // 2. Requires human intervention at multiple points
  // 3. Has business-visible states customers track
  // 4. Different rules apply at each state
  // 5. No "rollback" - you move to different states
}
```

### Example 2: Employee Onboarding

```typescript
class EmployeeOnboardingProcess extends ProcessManager<OnboardingState> {
  states = [
    'OfferAccepted',           // Day 1
    'BackgroundCheckStarted',   // Day 2
    'BackgroundCheckPending',   // Day 2-14 - External service
    'BackgroundCheckComplete',  // Day 14
    'ITEquipmentOrdered',      // Day 15
    'WorkspaceAssigned',       // Day 16
    'FirstDayScheduled',       // Day 17
    'OrientationDay1',         // Day 30
    'OrientationDay2',         // Day 31
    'DepartmentTraining',      // Day 32-60
    'ProbationReview',         // Day 90
    'FullyOnboarded'          // Day 90+
  ];

  // Multiple parallel tracks
  @ParallelState(['ITSetup', 'HRPaperwork', 'TeamIntroduction'])

  // Different timeouts for different states
  @Timeout('BackgroundCheckPending', '21d', 'Escalate')
  @Timeout('DepartmentTraining', '90d', 'ManagerReview')
}
```

## The Decision Matrix: When to Use Which

| Scenario                       | Use Saga | Use Process Manager | Why                                    |
| ------------------------------ | -------- | ------------------- | -------------------------------------- |
| **Payment processing**         | ✅       | ❌                  | Need rollback if payment fails         |
| **Order fulfillment**          | ❌       | ✅                  | Multi-day process with business states |
| **Hotel booking + payment**    | ✅       | ❌                  | Atomic transaction                     |
| **Insurance claim processing** | ❌       | ✅                  | Weeks-long with human decisions        |
| **Stock trade execution**      | ✅       | ❌                  | Must complete or rollback              |
| **Customer onboarding**        | ❌       | ✅                  | Multi-step over days/weeks             |
| **Database migration**         | ✅       | ❌                  | Technical transaction                  |
| **Manufacturing workflow**     | ❌       | ✅                  | Physical process with stages           |

## Why Sagas Cannot Replace Process Managers

### 1. Temporal Mismatch

- **Sagas**: Designed for immediate execution
- **Process Managers**: Designed for long-running processes with delays

### 2. State Philosophy

- **Sagas**: State is temporary (just for compensation tracking)
- **Process Managers**: State is the core concept (business tracks state)

### 3. Failure Handling

- **Sagas**: Failure = rollback everything
- **Process Managers**: Failure = move to error state and handle

### 4. Business Alignment

- **Sagas**: Technical pattern invisible to business
- **Process Managers**: Business states that stakeholders understand

### 5. Trigger Mechanisms

- **Sagas**: Event-driven only
- **Process Managers**: Events + Time + Rules + Human input

## Combined Usage: They Work Together

In real systems, Process Managers often USE Sagas for specific operations:

```typescript
class OrderManagementService {
  // Process Manager: Manages overall workflow (weeks)
  private orderProcess = new OrderFulfillmentProcess();

  // Saga: Handles payment transaction (minutes)
  private paymentSaga = new PaymentProcessingSaga();

  async handleOrder(order: Order) {
    // Process Manager tracks overall state
    await this.orderProcess.transitionTo('PaymentProcessing');

    // Saga handles the atomic transaction
    const paymentResult = await this.paymentSaga.execute({
      chargeCard: order.payment,
      reserveFunds: order.amount,
      updateAccounting: true,
    });

    if (paymentResult.success) {
      // Process Manager continues the workflow
      await this.orderProcess.transitionTo('PaymentComplete');
      // ... order continues through fulfillment states for days
    } else {
      // Process Manager handles business failure
      await this.orderProcess.transitionTo('PaymentFailed');
      // ... may retry, request different payment, or cancel
    }
  }
}
```

## Decision

Implement Process Managers as a **separate, complementary pattern** to Sagas
because:

1. **They solve different problems**: Sagas for transactions, Process Managers
   for workflows
2. **Enterprises need both**: Real systems have both distributed transactions
   AND business workflows
3. **They work together**: Process Managers often orchestrate Sagas for specific
   operations
4. **Market differentiation**: Most DDD libraries lack proper Process Manager
   implementation
5. **Completeness**: This is the only missing major DDD pattern in VytchesDDD

## Implementation Strategy

Create new package `@vytches/ddd-process-managers` with:

- State machine core
- Process repository for persistence
- Integration with existing event bus
- Timeout scheduling
- Multi-aggregate coordination
- Framework decorators (NestJS)

## Consequences

### Positive

- ✅ Complete enterprise DDD pattern coverage
- ✅ Enable complex business workflow modeling
- ✅ Clear separation of concerns
- ✅ Business-aligned state visibility

### Negative

- ❌ Additional complexity (two patterns to understand)
- ❌ More code to maintain
- ❌ Developers must learn when to use which

### Risk Mitigation

- Clear documentation with decision matrix
- Examples showing combined usage
- Framework integration to simplify usage
- Training materials and guides

## Summary

**Process Managers are NOT a replacement for Sagas** - they are a complementary
pattern that solves a fundamentally different problem. While Sagas handle
distributed transactions with compensation, Process Managers handle long-running
business workflows with state management. Enterprises need both patterns for
complete DDD implementation.

---

**Decision**: Implement Process Managers to complete the enterprise DDD pattern
suite  
**Rationale**: Fills the gap for long-running business workflow coordination
that Sagas cannot address  
**Impact**: Enables modeling of real business processes that span time and
require state management
