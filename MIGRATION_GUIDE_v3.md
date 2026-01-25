# Migration Guide: v2.x → v3.0.0

## Breaking Changes

### Event Property Rename: `eventType` → `eventName`

**Version:** 3.0.0 **Impact:** **HIGH** - All event-related code **Migration
Time:** 15-30 minutes for typical applications

---

## What Changed?

All event interfaces and classes now use `eventName` instead of `eventType`:

```typescript
// ❌ v2.x (OLD)
export interface IDomainEvent<P = unknown> {
  eventType: string;
  payload?: P;
  metadata?: IEventMetadata;
}

// ✅ v3.0 (NEW)
export interface IDomainEvent<P = unknown> {
  eventName: string;
  payload?: P;
  metadata?: IEventMetadata;
}
```

**Affected Interfaces:**

- `IDomainEvent` (contracts package)
- `IIntegrationEvent` (events package)
- `IAuditEvent` (events package)
- All event base classes (`DomainEvent`, `IntegrationEvent`)

---

## Migration Steps

### 1. Update Event Class Definitions

**Before (v2.x):**

```typescript
class OrderCreatedEvent extends DomainEvent<OrderData> {
  constructor(
    payload: OrderData,
    metadata?: IEventMetadata,
    eventType?: string
  ) {
    super(payload, metadata, eventType);
  }
}
```

**After (v3.0):**

```typescript
class OrderCreatedEvent extends DomainEvent<OrderData> {
  constructor(
    payload: OrderData,
    metadata?: IEventMetadata,
    eventName?: string
  ) {
    super(payload, metadata, eventName);
  }
}
```

### 2. Update Event Handlers

**Before (v2.x):**

```typescript
@EventHandler(OrderCreatedEvent)
class OrderCreatedHandler {
  async handle(event: OrderCreatedEvent): Promise<void> {
    console.log(`Handling event: ${event.eventType}`);
  }
}
```

**After (v3.0):**

```typescript
@EventHandler(OrderCreatedEvent)
class OrderCreatedHandler {
  async handle(event: OrderCreatedEvent): Promise<void> {
    console.log(`Handling event: ${event.eventName}`);
  }
}
```

### 3. Update Event Bus Subscriptions

**Before (v2.x):**

```typescript
eventBus.subscribe('OrderCreated', event => {
  console.log(event.eventType); // 'OrderCreated'
});
```

**After (v3.0):**

```typescript
eventBus.subscribe('OrderCreated', event => {
  console.log(event.eventName); // 'OrderCreated'
});
```

### 4. Update Event Serialization

**Before (v2.x):**

```typescript
const serialized = JSON.stringify({
  eventType: event.eventType,
  payload: event.payload,
  metadata: event.metadata,
});
```

**After (v3.0):**

```typescript
const serialized = JSON.stringify({
  eventName: event.eventName,
  payload: event.payload,
  metadata: event.metadata,
});
```

### 5. Update Database Queries (Event Store)

If you're persisting events to a database, update your schemas:

**SQL Migration:**

```sql
-- Rename column in PostgreSQL
ALTER TABLE events
RENAME COLUMN event_type TO event_name;

-- Update indexes
DROP INDEX IF EXISTS idx_events_event_type;
CREATE INDEX idx_events_event_name ON events(event_name);
```

**MongoDB Migration:**

```javascript
db.events.updateMany({}, { $rename: { eventType: 'eventName' } });
```

---

## Automated Migration

### Search & Replace Script

Run this script to automatically update your codebase:

```bash
#!/bin/bash
# migrate-events-v3.sh

echo "Migrating eventType → eventName..."

# Update TypeScript files
find src -type f -name "*.ts" -exec sed -i 's/eventType/eventName/g' {} \;

# Update test files
find tests -type f -name "*.ts" -exec sed -i 's/eventType/eventName/g' {} \;

# Update documentation
find docs -type f -name "*.md" -exec sed -i 's/eventType/eventName/g' {} \;

echo "Migration complete! Please review changes and run tests."
```

**Usage:**

```bash
chmod +x migrate-events-v3.sh
./migrate-events-v3.sh
pnpm test  # Verify everything works
```

---

## Common Migration Scenarios

### Scenario 1: Custom Event Classes

**Before:**

```typescript
export class CustomDomainEvent extends DomainEvent<CustomData> {
  public readonly eventType = 'CustomDomain'; // ❌

  constructor(data: CustomData) {
    super(data, undefined, 'CustomDomain');
  }
}
```

**After:**

```typescript
export class CustomDomainEvent extends DomainEvent<CustomData> {
  public readonly eventName = 'CustomDomain'; // ✅

  constructor(data: CustomData) {
    super(data, undefined, 'CustomDomain');
  }
}
```

### Scenario 2: Event Type Filtering

**Before:**

```typescript
const orderEvents = allEvents.filter(e => e.eventType.startsWith('Order'));
```

**After:**

```typescript
const orderEvents = allEvents.filter(e => e.eventName.startsWith('Order'));
```

### Scenario 3: Event Routing

**Before:**

```typescript
switch (event.eventType) {
  case 'OrderCreated':
    return handleOrderCreated(event);
  case 'OrderUpdated':
    return handleOrderUpdated(event);
}
```

**After:**

```typescript
switch (event.eventName) {
  case 'OrderCreated':
    return handleOrderCreated(event);
  case 'OrderUpdated':
    return handleOrderUpdated(event);
}
```

---

## Testing Your Migration

### Verification Checklist

- [ ] All TypeScript files compile without errors
- [ ] All tests pass (`pnpm test`)
- [ ] Event handlers receive events correctly
- [ ] Event serialization/deserialization works
- [ ] Database queries return correct events
- [ ] Logging shows correct event names
- [ ] Integration with external systems still works

### Quick Test

```typescript
// Create a test event
const event = new OrderCreatedEvent({ orderId: '123' });

// Verify property name
console.assert(event.eventName === 'OrderCreatedEvent', 'Event name mismatch');
console.assert(event.eventType === undefined, 'Old property still exists');

// Verify serialization
const json = JSON.parse(event.serialize());
console.assert(json.eventName !== undefined, 'Serialization failed');
```

---

## Troubleshooting

### Issue: "Property 'eventType' does not exist"

**Cause:** Code still references old property name **Solution:** Search for all
`eventType` occurrences and replace with `eventName`

```bash
grep -r "eventType" src/
```

### Issue: Tests failing with type errors

**Cause:** Test mocks/stubs still use old interface **Solution:** Update test
fixtures:

```typescript
// ❌ Old test fixture
const mockEvent = { eventType: 'Test', payload: {} };

// ✅ New test fixture
const mockEvent = { eventName: 'Test', payload: {} };
```

### Issue: Persisted events not loading

**Cause:** Database still contains old `eventType` field **Solution:** Run
database migration script (see section 5)

---

## Migration Support

**Timeline:**

- **v2.x Support:** Until 2026-06-30
- **v3.0.0 Release:** 2026-01-25

**Questions?**

- GitHub Issues: https://github.com/vytches/ddd/issues
- Documentation: https://docs.vytches.com/ddd
- Discord Community: https://discord.gg/vytchesddd

---

## Summary

This migration is a **clean break** with improved naming consistency:

| Aspect           | v2.x        | v3.0        |
| ---------------- | ----------- | ----------- |
| Property Name    | `eventType` | `eventName` |
| Clarity          | Medium      | High        |
| Consistency      | Varies      | Unified     |
| Migration Effort | -           | 15-30 min   |

**Recommendation:** Migrate as soon as possible to benefit from improved clarity
and future features.
