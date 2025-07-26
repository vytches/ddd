# Bulkhead Pattern for Resource Isolation

**Version**: 1.0.0 **Package**: @vytches/ddd-resilience **Complexity**: Basic
**Domain**: Customer Service Management **Patterns**: Bulkhead Pattern, Resource
Isolation, Thread Pool Management **Dependencies**: @vytches/ddd-resilience

## Description

This example demonstrates the bulkhead pattern for isolating resources and
preventing cascading failures. Just like bulkheads in a ship prevent water from
flooding all compartments, this pattern prevents failures in one service area
from affecting others by dedicating separate resource pools.

## Business Context

A customer service platform handles multiple types of operations: user queries,
support tickets, and system notifications. During peak times or when one
operation type experiences issues, it shouldn't impact the others. The bulkhead
pattern ensures that heavy user query processing doesn't prevent critical
support tickets from being handled.

## Code Example

```typescript
// customer-service-manager.ts
import {
  BulkheadStrategy,
  ResiliencePolicyBuilder,
  ResilienceContext,
  BulkheadConfiguration,
} from '@vytches/ddd-resilience';
import { Customer, NotificationRequest } from './types'; // From your application

// Customer service manager with resource isolation
export class CustomerServiceManager {
  private userQueryBulkhead: BulkheadStrategy;
  private supportTicketBulkhead: BulkheadStrategy;
  private notificationBulkhead: BulkheadStrategy;

  constructor() {
    // High-capacity bulkhead for user queries (non-critical)
    this.userQueryBulkhead = ResiliencePolicyBuilder.create()
      .withBulkhead({
        maxConcurrency: 10, // Allow 10 concurrent queries
        queueSize: 50, // Queue up to 50 queries
        queueTimeout: 30000, // Wait max 30 seconds in queue
        rejectionStrategy: 'drop', // Drop excess queries
      })
      .build();

    // Medium-capacity bulkhead for support tickets (important)
    this.supportTicketBulkhead = ResiliencePolicyBuilder.create()
      .withBulkhead({
        maxConcurrency: 5, // Allow 5 concurrent tickets
        queueSize: 20, // Queue up to 20 tickets
        queueTimeout: 60000, // Wait max 60 seconds in queue
        rejectionStrategy: 'wait', // Wait for available slot
      })
      .build();

    // Low-capacity bulkhead for notifications (critical)
    this.notificationBulkhead = ResiliencePolicyBuilder.create()
      .withBulkhead({
        maxConcurrency: 3, // Allow 3 concurrent notifications
        queueSize: 10, // Queue up to 10 notifications
        queueTimeout: 15000, // Wait max 15 seconds in queue
        rejectionStrategy: 'fail', // Fail immediately if overloaded
      })
      .build();
  }

  async processUserQuery(
    customerId: string,
    query: string
  ): Promise<UserQueryResult> {
    const context: ResilienceContext = {
      operationId: 'process-user-query',
      correlationId: `query-${customerId}-${Date.now()}`,
      userId: customerId,
      startTime: new Date(),
      attempt: 1,
      previousAttempts: [],
    };

    try {
      const result = await this.userQueryBulkhead.execute(
        () => this.handleUserQuery(customerId, query),
        context
      );

      return {
        queryId: context.correlationId,
        customerId,
        success: true,
        response: result.response,
        confidence: result.confidence,
        processingTime: Date.now() - context.startTime.getTime(),
      };
    } catch (error) {
      console.warn(`User query failed for customer ${customerId}:`, error);

      return {
        queryId: context.correlationId,
        customerId,
        success: false,
        error: error.message,
        fallbackResponse:
          'We are experiencing high query volume. Please try again shortly or contact support.',
        processingTime: Date.now() - context.startTime.getTime(),
      };
    }
  }

  async processSupportTicket(
    ticket: SupportTicket
  ): Promise<SupportTicketResult> {
    const context: ResilienceContext = {
      operationId: 'process-support-ticket',
      correlationId: ticket.id,
      userId: ticket.customerId,
      startTime: new Date(),
      attempt: 1,
      previousAttempts: [],
    };

    try {
      const result = await this.supportTicketBulkhead.execute(
        () => this.handleSupportTicket(ticket),
        context
      );

      return {
        ticketId: ticket.id,
        customerId: ticket.customerId,
        success: true,
        assignedAgent: result.assignedAgent,
        priority: result.priority,
        estimatedResolution: result.estimatedResolution,
        processingTime: Date.now() - context.startTime.getTime(),
      };
    } catch (error) {
      console.error(
        `Support ticket processing failed for ${ticket.id}:`,
        error
      );

      // Support tickets are critical - try to handle gracefully
      return {
        ticketId: ticket.id,
        customerId: ticket.customerId,
        success: false,
        error: error.message,
        escalated: true,
        processingTime: Date.now() - context.startTime.getTime(),
      };
    }
  }

  async sendNotification(
    notification: NotificationRequest
  ): Promise<NotificationResult> {
    const context: ResilienceContext = {
      operationId: 'send-notification',
      correlationId: notification.id,
      userId: notification.recipientId,
      startTime: new Date(),
      attempt: 1,
      previousAttempts: [],
    };

    try {
      const result = await this.notificationBulkhead.execute(
        () => this.handleNotification(notification),
        context
      );

      return {
        notificationId: notification.id,
        recipientId: notification.recipientId,
        success: true,
        deliveryStatus: result.deliveryStatus,
        channel: notification.channel,
        processingTime: Date.now() - context.startTime.getTime(),
      };
    } catch (error) {
      console.error(`Notification failed for ${notification.id}:`, error);

      return {
        notificationId: notification.id,
        recipientId: notification.recipientId,
        success: false,
        error: error.message,
        channel: notification.channel,
        processingTime: Date.now() - context.startTime.getTime(),
      };
    }
  }

  private async handleUserQuery(
    customerId: string,
    query: string
  ): Promise<QueryResponse> {
    // Simulate AI-powered query processing
    console.log(`Processing user query for customer ${customerId}: "${query}"`);

    // Simulate variable processing time (1-5 seconds)
    await this.sleep(1000 + Math.random() * 4000);

    // Simulate different response qualities
    const responses = [
      {
        response: 'Based on your account, here are the available options...',
        confidence: 0.9,
      },
      {
        response: 'I found several relevant help articles for your question...',
        confidence: 0.8,
      },
      {
        response:
          'Let me connect you with a human agent for this complex question...',
        confidence: 0.6,
      },
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  private async handleSupportTicket(
    ticket: SupportTicket
  ): Promise<TicketProcessingResult> {
    console.log(
      `Processing support ticket ${ticket.id} with priority ${ticket.priority}`
    );

    // Simulate ticket analysis and routing (2-8 seconds)
    await this.sleep(2000 + Math.random() * 6000);

    // Determine agent assignment based on priority and category
    const agent = this.assignAgent(ticket.category, ticket.priority);
    const estimatedResolution = this.calculateResolutionTime(ticket.priority);

    return {
      assignedAgent: agent,
      priority: ticket.priority,
      estimatedResolution,
    };
  }

  private async handleNotification(
    notification: NotificationRequest
  ): Promise<DeliveryResult> {
    console.log(
      `Sending ${notification.type} notification via ${notification.channel}`
    );

    // Simulate notification delivery (500ms - 2 seconds)
    await this.sleep(500 + Math.random() * 1500);

    // Simulate delivery success/failure
    const deliverySuccess = Math.random() > 0.05; // 95% success rate

    return {
      deliveryStatus: deliverySuccess ? 'delivered' : 'failed',
      timestamp: new Date(),
    };
  }

  private assignAgent(category: string, priority: string): string {
    const agents = {
      billing: ['agent-billing-001', 'agent-billing-002'],
      technical: ['agent-tech-001', 'agent-tech-002', 'agent-tech-003'],
      general: ['agent-general-001', 'agent-general-002'],
    };

    const categoryAgents = agents[category] || agents.general;
    return categoryAgents[Math.floor(Math.random() * categoryAgents.length)];
  }

  private calculateResolutionTime(priority: string): Date {
    const hoursToAdd =
      priority === 'high' ? 4 : priority === 'medium' ? 24 : 72;
    return new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Monitor bulkhead status for each resource pool
  getBulkheadStatus(): BulkheadStatus {
    return {
      userQueries: {
        activeExecutions: this.userQueryBulkhead.getActiveExecutions(),
        queuedRequests: this.userQueryBulkhead.getQueuedRequests(),
        rejectedRequests: this.userQueryBulkhead.getRejectedRequests(),
        maxConcurrency: this.userQueryBulkhead.getMaxConcurrency(),
      },
      supportTickets: {
        activeExecutions: this.supportTicketBulkhead.getActiveExecutions(),
        queuedRequests: this.supportTicketBulkhead.getQueuedRequests(),
        rejectedRequests: this.supportTicketBulkhead.getRejectedRequests(),
        maxConcurrency: this.supportTicketBulkhead.getMaxConcurrency(),
      },
      notifications: {
        activeExecutions: this.notificationBulkhead.getActiveExecutions(),
        queuedRequests: this.notificationBulkhead.getQueuedRequests(),
        rejectedRequests: this.notificationBulkhead.getRejectedRequests(),
        maxConcurrency: this.notificationBulkhead.getMaxConcurrency(),
      },
    };
  }

  // Adjust bulkhead capacity during runtime
  async adjustBulkheadCapacity(
    bulkheadType: 'userQueries' | 'supportTickets' | 'notifications',
    newCapacity: number
  ): Promise<void> {
    switch (bulkheadType) {
      case 'userQueries':
        await this.userQueryBulkhead.updateConfiguration({
          maxConcurrency: newCapacity,
        });
        break;
      case 'supportTickets':
        await this.supportTicketBulkhead.updateConfiguration({
          maxConcurrency: newCapacity,
        });
        break;
      case 'notifications':
        await this.notificationBulkhead.updateConfiguration({
          maxConcurrency: newCapacity,
        });
        break;
    }

    console.log(`${bulkheadType} bulkhead capacity adjusted to ${newCapacity}`);
  }
}

// Supporting types
interface SupportTicket {
  id: string;
  customerId: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  subject: string;
  description: string;
  createdAt: Date;
}

interface UserQueryResult {
  queryId: string;
  customerId: string;
  success: boolean;
  response?: string;
  confidence?: number;
  error?: string;
  fallbackResponse?: string;
  processingTime: number;
}

interface SupportTicketResult {
  ticketId: string;
  customerId: string;
  success: boolean;
  assignedAgent?: string;
  priority?: string;
  estimatedResolution?: Date;
  error?: string;
  escalated?: boolean;
  processingTime: number;
}

interface NotificationResult {
  notificationId: string;
  recipientId: string;
  success: boolean;
  deliveryStatus?: string;
  channel: string;
  error?: string;
  processingTime: number;
}

interface QueryResponse {
  response: string;
  confidence: number;
}

interface TicketProcessingResult {
  assignedAgent: string;
  priority: string;
  estimatedResolution: Date;
}

interface DeliveryResult {
  deliveryStatus: string;
  timestamp: Date;
}

interface BulkheadStatus {
  userQueries: BulkheadMetrics;
  supportTickets: BulkheadMetrics;
  notifications: BulkheadMetrics;
}

interface BulkheadMetrics {
  activeExecutions: number;
  queuedRequests: number;
  rejectedRequests: number;
  maxConcurrency: number;
}

// Usage example
const customerServiceManager = new CustomerServiceManager();

// Process different types of operations concurrently
async function simulateCustomerServiceLoad() {
  const operations = [];

  // Simulate user queries (high volume)
  for (let i = 0; i < 15; i++) {
    operations.push(
      customerServiceManager.processUserQuery(
        `customer-${i}`,
        `How do I reset my password?`
      )
    );
  }

  // Simulate support tickets (medium volume)
  for (let i = 0; i < 8; i++) {
    operations.push(
      customerServiceManager.processSupportTicket({
        id: `ticket-${i}`,
        customerId: `customer-${i}`,
        category: 'technical',
        priority: i < 2 ? 'high' : 'medium',
        subject: 'Login issues',
        description: 'Cannot log into my account',
        createdAt: new Date(),
      })
    );
  }

  // Simulate notifications (low volume, critical)
  for (let i = 0; i < 5; i++) {
    operations.push(
      customerServiceManager.sendNotification({
        id: `notification-${i}`,
        recipientId: `customer-${i}`,
        type: 'account_security',
        channel: 'email',
        subject: 'Security Alert',
        content: 'Unusual login activity detected',
        priority: 'high',
      })
    );
  }

  // Execute all operations concurrently
  const results = await Promise.allSettled(operations);

  // Analyze results
  const successfulQueries = results
    .slice(0, 15)
    .filter(r => r.status === 'fulfilled').length;
  const successfulTickets = results
    .slice(15, 23)
    .filter(r => r.status === 'fulfilled').length;
  const successfulNotifications = results
    .slice(23, 28)
    .filter(r => r.status === 'fulfilled').length;

  console.log(
    `Results: Queries: ${successfulQueries}/15, Tickets: ${successfulTickets}/8, Notifications: ${successfulNotifications}/5`
  );

  // Check bulkhead status
  const status = customerServiceManager.getBulkheadStatus();
  console.log('Bulkhead Status:', JSON.stringify(status, null, 2));
}

// Run simulation
simulateCustomerServiceLoad()
  .then(() => console.log('Customer service simulation completed'))
  .catch(error => console.error('Simulation failed:', error));

// Monitor bulkhead status continuously
setInterval(() => {
  const status = customerServiceManager.getBulkheadStatus();
  console.log(
    'Active executions - Queries:',
    status.userQueries.activeExecutions,
    'Tickets:',
    status.supportTickets.activeExecutions,
    'Notifications:',
    status.notifications.activeExecutions
  );
}, 5000);
```

## Key Features

- **Resource Isolation**: Separate thread pools prevent interference
- **Queue Management**: Configurable queue sizes and timeouts
- **Rejection Strategies**: Different behaviors when capacity exceeded
- **Runtime Adjustment**: Dynamic capacity scaling
- **Comprehensive Monitoring**: Real-time bulkhead metrics
- **Graceful Degradation**: Fallback responses when resources exhausted

## Rejection Strategies

1. **Drop**: Silently discard excess requests
2. **Wait**: Queue requests until timeout
3. **Fail**: Immediately reject with error

## Common Pitfalls

- **Too Many Bulkheads**: Over-segmentation reducing efficiency
- **Wrong Capacity**: Under/over-provisioning resource pools
- **No Monitoring**: Not tracking bulkhead utilization
- **Rigid Configuration**: Not adjusting to changing load patterns

## Related Examples

- [Circuit Breaker Pattern](./example-1.md)
- [Retry Pattern](./example-2.md)
- [Timeout Strategy](../intermediate/example-1.md)
