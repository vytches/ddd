# Events Package - Basic Use Cases

**Version**: 1.0.0  
**Package**: @vytches-ddd/events  
**Complexity**: beginner  
**Domain**: Multiple  
**Patterns**: event-driven-architecture, repository-pattern,
automatic-publishing

## Overview

The Events package enables reliable event-driven architecture through automatic
event publishing when aggregates are saved. This eliminates the complexity of
manual event management while ensuring consistency between state changes and
event emission.

## Primary Use Cases

### 1. **E-commerce Order Processing Pipeline**

**Business Need**: When orders are created, multiple downstream processes need
to be triggered reliably: inventory reservation, payment processing, shipping
preparation, and customer notifications.

**Solution**: Repository pattern with automatic event publishing ensures all
business events are emitted when orders are persisted.

**Example Flow**:

```
Order Created → Save Aggregate → Auto-publish Events →
├── Inventory Handler: Reserve stock
├── Payment Handler: Initiate payment
├── Shipping Handler: Prepare shipment
└── Notification Handler: Send confirmation
```

**Key Benefits**:

- ✅ Atomic consistency between order state and events
- ✅ Automatic triggering of downstream processes
- ✅ No manual event publishing code required
- ✅ Transaction-safe event persistence

### 2. **User Registration and Onboarding**

**Business Need**: New user registrations need to trigger welcome emails,
account setup, preference initialization, and integration with external systems.

**Solution**: Domain events automatically published when user aggregates are
saved, triggering personalized onboarding flows.

**Example Flow**:

```
User Registered → Save Aggregate → Auto-publish Events →
├── Welcome Handler: Send welcome email
├── Setup Handler: Initialize account preferences
├── Integration Handler: Sync with CRM system
└── Analytics Handler: Track registration metrics
```

**Key Benefits**:

- ✅ Personalized onboarding experiences
- ✅ Reliable external system integration
- ✅ Automatic metrics and analytics tracking
- ✅ Modular welcome flow components

### 3. **Inventory Management System**

**Business Need**: Product sales, restocking, and adjustments need to update
inventory levels while triggering reorder alerts, reporting updates, and
supplier notifications.

**Solution**: Inventory events automatically published when product aggregates
change, enabling real-time inventory tracking and automated responses.

**Example Flow**:

```
Product Sold → Save Aggregate → Auto-publish Events →
├── Stock Handler: Update inventory levels
├── Reorder Handler: Check minimum thresholds
├── Reporting Handler: Update sales analytics
└── Supplier Handler: Trigger reorder if needed
```

**Key Benefits**:

- ✅ Real-time inventory tracking
- ✅ Automated reorder management
- ✅ Integrated sales reporting
- ✅ Supplier relationship automation

### 4. **Multi-Tenant SaaS Platform**

**Business Need**: Different tenants require different business logic,
integrations, and compliance rules while sharing the same core platform.

**Solution**: Context-aware event processing routes events to tenant-specific
handlers based on tenant ID, region, or custom context.

**Example Flow**:

```
Tenant Event → Context Filter → Route to Handlers →
├── Enterprise Handler: Enhanced features + ERP integration
├── Standard Handler: Basic features + standard notifications
├── EU Handler: GDPR compliance + regional preferences
└── APAC Handler: Regional compliance + local integrations
```

**Key Benefits**:

- ✅ Tenant-specific business logic
- ✅ Regional compliance automation
- ✅ Scalable multi-tenant architecture
- ✅ Shared code with customized behavior

### 5. **Financial Transaction Processing**

**Business Need**: Payment processing requires multiple verification steps,
fraud detection, compliance checks, and reconciliation while maintaining audit
trails.

**Solution**: Transaction events automatically published during state changes,
triggering comprehensive verification and audit workflows.

**Example Flow**:

```
Payment Initiated → Save Aggregate → Auto-publish Events →
├── Fraud Handler: Risk assessment and verification
├── Compliance Handler: Regulatory compliance checks
├── Audit Handler: Transaction audit trail creation
└── Notification Handler: Customer and merchant alerts
```

**Key Benefits**:

- ✅ Automated fraud detection
- ✅ Regulatory compliance automation
- ✅ Complete audit trail generation
- ✅ Real-time transaction monitoring

## Implementation Patterns

### **Repository-First Pattern** (Recommended)

- Events published automatically when aggregates are saved
- No manual event publishing code required
- Transaction-safe consistency between state and events
- Clean separation of business logic and event management

### **Handler Registration Pattern**

- Event handlers automatically discovered through decorators
- Context-based filtering for targeted event processing
- Concurrent handler execution for optimal performance
- Error isolation prevents handler failures from affecting others

### **Context-Aware Processing Pattern**

- Rich context information enables sophisticated routing
- Multi-tenant support with tenant-specific handlers
- Regional processing for compliance and localization
- Correlation tracking for distributed system observability

## When to Use Events Package

✅ **Perfect For:**

- Applications requiring reliable event-driven architecture
- Systems needing automatic event publishing with state changes
- Multi-tenant applications with context-based processing
- Complex business workflows with multiple integration points
- Applications requiring comprehensive audit trails

❌ **Consider Alternatives:**

- Simple CRUD applications without complex business logic
- Systems requiring only synchronous processing
- Applications where eventual consistency is problematic
- High-frequency, low-latency trading systems

## Getting Started Journey

1. **Start with Repository Pattern** - Understand automatic event publishing
   through aggregate save operations
2. **Add Event Handlers** - Create handlers that respond to published events
   with business logic
3. **Explore Context Filtering** - Implement tenant-specific or region-specific
   event processing
4. **Framework Integration** - Integrate with NestJS, Express, or other
   frameworks for production use
5. **Advanced Features** - Explore batch processing, event sourcing, and
   projections integration

## Related Packages

- **@vytches-ddd/repositories**: Foundation for automatic event publishing
  pattern
- **@vytches-ddd/aggregates**: Source of domain events through business
  operations
- **@vytches-ddd/di**: Automatic handler discovery and registration system
- **@vytches-ddd/event-store**: Event persistence for event sourcing scenarios
- **@vytches-ddd/projections**: Read model updates from published domain events
