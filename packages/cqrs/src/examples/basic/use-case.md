# CQRS Package - Basic Use Cases

**Version**: 1.0.0  
**Package**: @vytches-ddd/cqrs  
**Complexity**: beginner  
**Domain**: Multiple  
**Patterns**: command-query-responsibility-segregation, mediator-pattern, middleware-pipeline

## Overview

The CQRS package implements Command Query Responsibility Segregation with automatic handler registration, middleware pipeline, and performance optimization. It separates write operations (commands) from read operations (queries) for better scalability and maintainability.

## Primary Use Cases

### 1. **User Management with Role-Based Operations**

**Business Need**: User management systems require different handling for write operations (create, update, deactivate) and read operations (search, lists, profiles) with role-based permissions and audit trails.

**Solution**: CQRS separates user commands from queries, enabling optimized write validation and read performance with different data models and caching strategies.

**Example Flow**:
```
Write Side: CreateUserCommand → ValidationMiddleware → CommandHandler → Database
Read Side:  GetUserQuery → CacheMiddleware → QueryHandler → Optimized ReadModel
```

**Key Benefits**:
- ✅ Write operations focus on validation and business rules
- ✅ Read operations optimized for performance and caching
- ✅ Different data models for commands vs queries
- ✅ Comprehensive audit trails for all operations

### 2. **E-commerce Order Processing**

**Business Need**: Order management requires complex write operations with validation, inventory checks, and payment processing, while read operations need fast access to order history, reports, and dashboards.

**Solution**: Commands handle order lifecycle with business rules, while queries provide optimized views for customer portals, admin dashboards, and reporting systems.

**Example Flow**:
```
Commands: CreateOrder → InventoryCheck → PaymentValidation → OrderCreated
Queries:  OrderHistory → CachedResults, OrderReports → AggregatedData
```

**Key Benefits**:
- ✅ Complex business logic isolated in command handlers
- ✅ Fast dashboard queries with pre-computed aggregations
- ✅ Independent scaling of read and write operations
- ✅ Real-time order tracking with optimized queries

### 3. **Content Management System**

**Business Need**: Content platforms need robust content creation, editing, and publishing workflows while providing fast content delivery and search capabilities for end users.

**Solution**: Commands manage content lifecycle with workflow validation, while queries serve content efficiently with caching, search indexing, and CDN integration.

**Example Flow**:
```
Content Creation: CreateArticleCommand → WorkflowValidation → ContentStored
Content Delivery: SearchContentQuery → SearchIndex → CachedResults
```

**Key Benefits**:
- ✅ Content workflow enforcement through command validation
- ✅ Fast content search and delivery through query optimization
- ✅ Separate editorial tools from public-facing performance
- ✅ Version control and audit trails for content changes

### 4. **Financial Transaction Processing**

**Business Need**: Financial systems require strict validation, compliance checks, and audit trails for transactions while providing fast account balance queries and transaction history.

**Solution**: Commands ensure transaction integrity with comprehensive validation, while queries provide real-time balance information and transaction reports.

**Example Flow**:
```
Transactions: TransferFundsCommand → ComplianceCheck → AuditLog → BalanceUpdate
Account Info:  GetBalanceQuery → CachedBalance, TransactionHistoryQuery → OptimizedView
```

**Key Benefits**:
- ✅ Strict transaction validation and compliance checking
- ✅ Fast balance queries without impacting transaction processing
- ✅ Comprehensive audit trails and regulatory reporting
- ✅ Real-time fraud detection and prevention

### 5. **Multi-Tenant SaaS Platform**

**Business Need**: SaaS platforms need tenant-specific business logic for operations while providing fast, isolated data access with proper tenant boundaries.

**Solution**: Commands handle tenant-specific business rules and data isolation, while queries provide optimized tenant data access with caching and performance monitoring.

**Example Flow**:
```
Tenant Operations: CreateResourceCommand → TenantValidation → IsolatedStorage
Tenant Queries:    GetTenantDataQuery → TenantCache → IsolatedResults
```

**Key Benefits**:
- ✅ Tenant isolation enforced at command level
- ✅ Optimized per-tenant query performance
- ✅ Scalable architecture supporting multiple tenants
- ✅ Tenant-specific customization and business rules

## Implementation Patterns

### **Command Pattern** (Write Operations)
- Commands represent business intentions (CreateUser, ProcessOrder)
- Comprehensive validation before execution
- Business rule enforcement and state changes
- Audit logging and compliance tracking
- Integration with domain events for side effects

### **Query Pattern** (Read Operations)  
- Queries represent data requests (GetUser, SearchOrders)
- Performance optimization with caching strategies
- Flexible filtering, pagination, and sorting
- Different data models optimized for reading
- Cache invalidation and consistency management

### **Middleware Pipeline Pattern**
- Cross-cutting concerns applied consistently
- Validation, logging, performance monitoring
- Security and authorization checks
- Error handling and transformation
- Configurable middleware ordering

## When to Use CQRS Package

✅ **Perfect For:**
- Applications with different read/write performance requirements
- Systems needing comprehensive audit trails and compliance
- Complex business logic requiring extensive validation
- High-traffic applications requiring independent read/write scaling
- Multi-tenant applications with isolated business logic

❌ **Consider Alternatives:**
- Simple CRUD applications without complex business rules
- Applications where read/write operations are tightly coupled
- Systems prioritizing simplicity over architectural benefits
- Real-time applications where command/query separation adds latency

## Architecture Benefits

### **Separation of Concerns**
- Write operations focus on business logic and validation
- Read operations optimized for performance and user experience
- Independent evolution of command and query models
- Clear boundaries between different types of operations

### **Performance Optimization**
- Read operations can use specialized data stores and caching
- Write operations can focus on consistency and validation
- Independent scaling strategies for reads vs writes
- Query result caching without affecting write performance

### **Maintainability and Testing**
- Commands and queries can be tested independently
- Business logic isolated in focused command handlers
- Read models can be optimized without affecting write logic
- Clear interfaces for mocking and unit testing

## Getting Started Journey

1. **Start with Simple Commands** - Create basic commands for state-changing operations
2. **Add Query Handlers** - Implement queries for data retrieval with performance optimization
3. **Implement Middleware** - Add validation, logging, and monitoring through middleware pipeline
4. **Explore Caching** - Optimize query performance with intelligent caching strategies
5. **Framework Integration** - Integrate with NestJS, Express, or other frameworks for production use
6. **Advanced Patterns** - Event integration, projections, and complex business workflows

## Command vs Query Characteristics

### **Commands (Write Operations)**
- **Purpose**: Change application state
- **Focus**: Validation, business rules, consistency
- **Return**: Success/failure result, minimal data
- **Caching**: Not cacheable (state changes)
- **Optimization**: Transaction safety, business rule enforcement
- **Examples**: CreateUser, ProcessPayment, UpdateInventory

### **Queries (Read Operations)**
- **Purpose**: Retrieve data without side effects
- **Focus**: Performance, caching, user experience
- **Return**: Rich data models optimized for consumption
- **Caching**: Highly cacheable with TTL strategies
- **Optimization**: Result caching, pagination, indexing
- **Examples**: GetUser, SearchProducts, GetOrderHistory

## Integration with Other Packages

- **@vytches-ddd/events**: Commands can trigger domain events automatically
- **@vytches-ddd/validation**: Command validation through middleware pipeline
- **@vytches-ddd/logging**: Comprehensive operation logging with correlation tracking
- **@vytches-ddd/di**: Automatic handler discovery and registration
- **@vytches-ddd/caching**: Query result caching for performance optimization
- **@vytches-ddd/resilience**: Circuit breaker and retry patterns for external dependencies

## Performance Considerations

### **Command Optimization**
- Focus on transaction safety and consistency
- Minimize external dependencies in command handlers
- Use event-driven patterns for side effects
- Implement proper error handling and rollback strategies

### **Query Optimization**
- Aggressive caching with intelligent invalidation
- Use read-optimized data models and indexes
- Implement pagination for large result sets
- Consider eventual consistency for performance gains

### **Middleware Performance**
- Keep middleware lightweight and focused
- Order middleware for optimal performance
- Use async patterns to avoid blocking
- Monitor middleware performance impact

The CQRS package provides a robust foundation for building scalable, maintainable applications with clear separation between read and write operations, comprehensive middleware support, and excellent performance characteristics.