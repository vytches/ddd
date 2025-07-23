# Event-Driven Message Routing

**Version**: 1.0.0  
**Package**: @vytches-ddd/messaging  
**Complexity**: Intermediate  
**Domain**: Multi-Tenant SaaS Platform  
**Patterns**: Message Routing, Content-Based Router, Message Enrichment  
**Dependencies**: @vytches-ddd/messaging, @vytches-ddd/events,
@vytches-ddd/policies

## Description

This example demonstrates sophisticated message routing based on content,
context, and business rules. It shows how to build a flexible routing system
that can dynamically determine message destinations and apply transformations.

## Business Context

A multi-tenant SaaS platform needs to route messages to different services based
on tenant configuration, message type, and business rules. Premium tenants get
priority routing, while standard tenants use regular queues. Messages may need
enrichment before routing.

## Code Example

```typescript
// message-router.service.ts
import {
  MessageRouter,
  RouteDefinition,
  MessageEnricher,
  RoutingContext,
} from '@vytches-ddd/messaging';
import { PolicyEngine, PolicyContext } from '@vytches-ddd/policies';
import { Customer, NotificationRequest } from './types';

// Content-based router with policy integration
export class TenantAwareMessageRouter extends MessageRouter {
  constructor(
    private tenantService: ITenantService,
    private policyEngine: PolicyEngine
  ) {
    super();
    this.configureRoutes();
  }

  private configureRoutes(): void {
    // Route based on tenant tier
    this.addRoute({
      name: 'premium-tenant-route',
      predicate: async (msg, context) => {
        const tenant = await this.tenantService.getTenant(context.tenantId);
        return tenant.tier === 'premium' || tenant.tier === 'enterprise';
      },
      destination: 'premium-processing-queue',
      priority: 'high',
      enrichers: [new TenantEnricher(), new PriorityEnricher()],
    });

    // Route based on message content
    this.addRoute({
      name: 'critical-notification-route',
      predicate: (msg: NotificationRequest) => {
        return msg.priority === 'critical' || msg.type === 'security-alert';
      },
      destination: 'critical-notifications-queue',
      priority: 'critical',
      transformers: [new SecurityNotificationTransformer()],
    });

    // Policy-based routing
    this.addRoute({
      name: 'compliance-route',
      predicate: async (msg, context) => {
        const policyResult = await this.policyEngine.evaluate(
          'data-residency-policy',
          { message: msg, context }
        );
        return policyResult.requiresSpecialHandling;
      },
      destination: context => `region-${context.dataRegion}-queue`,
      enrichers: [new ComplianceEnricher()],
    });

    // Default route
    this.addRoute({
      name: 'default-route',
      predicate: () => true,
      destination: 'standard-processing-queue',
      priority: 'normal',
    });
  }

  async routeMessage<T>(
    message: T,
    context: RoutingContext
  ): Promise<RoutingResult> {
    // Apply routing rules in order
    for (const route of this.routes) {
      if (await route.predicate(message, context)) {
        // Enrich message if needed
        let enrichedMessage = message;
        if (route.enrichers) {
          for (const enricher of route.enrichers) {
            enrichedMessage = await enricher.enrich(enrichedMessage, context);
          }
        }

        // Apply transformations
        if (route.transformers) {
          for (const transformer of route.transformers) {
            enrichedMessage = await transformer.transform(
              enrichedMessage,
              context
            );
          }
        }

        // Determine destination
        const destination =
          typeof route.destination === 'function'
            ? route.destination(context)
            : route.destination;

        return {
          routeName: route.name,
          destination,
          priority: route.priority || 'normal',
          message: enrichedMessage,
          metadata: {
            routedAt: new Date(),
            routingContext: context,
            appliedEnrichers: route.enrichers?.map(e => e.name) || [],
            appliedTransformers: route.transformers?.map(t => t.name) || [],
          },
        };
      }
    }

    throw new Error('No matching route found');
  }
}

// Message enrichers
export class TenantEnricher implements MessageEnricher {
  name = 'TenantEnricher';

  async enrich<T>(message: T, context: RoutingContext): Promise<T> {
    const tenant = await this.loadTenant(context.tenantId);

    return {
      ...message,
      _tenant: {
        id: tenant.id,
        name: tenant.name,
        tier: tenant.tier,
        settings: tenant.settings,
      },
    };
  }
}

export class ComplianceEnricher implements MessageEnricher {
  name = 'ComplianceEnricher';

  async enrich<T>(message: T, context: RoutingContext): Promise<T> {
    return {
      ...message,
      _compliance: {
        dataClassification: this.classifyData(message),
        retentionPolicy: this.getRetentionPolicy(context),
        encryptionRequired: this.requiresEncryption(message, context),
        auditLog: {
          processedAt: new Date(),
          processedBy: context.userId,
          complianceChecks: ['GDPR', 'SOC2', 'HIPAA'],
        },
      },
    };
  }

  private classifyData(message: any): string {
    // Implement data classification logic
    if (this.containsPII(message)) return 'sensitive';
    if (this.containsFinancialData(message)) return 'confidential';
    return 'public';
  }
}

// Service using the router
export class MessageDispatchService {
  private router: TenantAwareMessageRouter;

  constructor(
    tenantService: ITenantService,
    policyEngine: PolicyEngine,
    private messageQueue: IMessageQueue
  ) {
    this.router = new TenantAwareMessageRouter(tenantService, policyEngine);
  }

  async dispatchMessage<T>(
    message: T,
    metadata: MessageMetadata
  ): Promise<void> {
    const context: RoutingContext = {
      tenantId: metadata.tenantId,
      userId: metadata.userId,
      correlationId: metadata.correlationId,
      dataRegion: metadata.dataRegion || 'us-east-1',
      timestamp: new Date(),
    };

    try {
      // Route the message
      const routingResult = await this.router.routeMessage(message, context);

      // Send to determined destination
      await this.messageQueue.send(
        routingResult.destination,
        routingResult.message,
        {
          priority: routingResult.priority,
          metadata: {
            ...metadata,
            routing: routingResult.metadata,
          },
        }
      );

      // Log routing decision
      console.log(
        `Message routed via ${routingResult.routeName} to ${routingResult.destination}`
      );
    } catch (error) {
      // Handle routing failures
      await this.handleRoutingError(message, context, error);
    }
  }

  private async handleRoutingError<T>(
    message: T,
    context: RoutingContext,
    error: Error
  ): Promise<void> {
    // Send to dead letter queue with routing context
    await this.messageQueue.send('routing-dlq', {
      originalMessage: message,
      routingContext: context,
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      },
    });
  }
}
```

## Key Features

- **Content-Based Routing**: Route messages based on their content and metadata
- **Policy-Driven Decisions**: Integrate business policies into routing logic
- **Message Enrichment**: Add context and metadata during routing
- **Dynamic Destinations**: Calculate destinations at runtime based on context
- **Priority Handling**: Different queues and priorities based on tenant tier

## Common Pitfalls

- **Order Matters**: Route evaluation order affects which route is selected
- **Performance Impact**: Complex routing logic can slow down message processing
- **Missing Fallback**: Always include a default route to prevent message loss
- **Enrichment Side Effects**: Ensure enrichers don't modify original messages
  unintentionally

## Related Examples

- [Advanced Message Transformation](/packages/messaging/src/examples/advanced/example-2.md)
- [Policy-Based Routing](/packages/policies/src/examples/intermediate/example-2.md)
- [Multi-Tenant Event Processing](/packages/events/src/examples/advanced/example-1.md)
