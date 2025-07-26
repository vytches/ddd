# NestJS Advanced ACL with VytchesDDD DI Integration

**Version**: 1.0.0  
**Package**: @vytches/ddd-acl  
**Framework**: NestJS  
**Complexity**: Intermediate  
**Focus**: VytchesDDD DI integration with enterprise ACL patterns

## Description

This example demonstrates advanced NestJS integration using VytchesDDD
dependency injection for sophisticated ACL orchestration with caching,
resilience patterns, and cross-cutting concerns.

## Business Context

An enterprise NestJS application requires sophisticated integration with
multiple external systems using advanced ACL patterns including caching, circuit
breakers, and automatic service discovery through VytchesDDD DI.

## Code Example

```typescript
// enterprise-customer-acl.service.ts - VytchesDDD DI managed service
import { DomainService, ServiceLifetime, VytchesDDD } from '@vytches/ddd-di';
import { CircuitBreaker, RetryPolicy } from '@vytches/ddd-resilience';
import { AntiCorruptionLayer, CachingACLDecorator } from '@vytches/ddd-acl';
import { Result } from '@vytches/ddd-utils';
import { Customer, ExternalCustomerData, CustomerSyncRequest } from '../types'; // From your application

@DomainService({
  serviceId: 'enterpriseCustomerACL',
  lifetime: ServiceLifetime.Singleton,
  context: 'CustomerManagement',
  dependencies: ['circuitBreaker', 'cacheManager', 'metricsCollector'],
  timeout: 30000,
})
export class EnterpriseCustomerACLService extends AntiCorruptionLayer<
  ExternalCustomerData,
  Customer
> {
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: RetryPolicy;
  private cachedACL: CachingACLDecorator<ExternalCustomerData, Customer>;

  constructor() {
    super(new CustomerDataTranslator());

    // Advanced resilience configuration
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 30000,
    });

    this.retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 1000,
      backoffStrategy: 'exponential',
      maxDelay: 10000,
    });

    // Caching decorator for performance
    this.cachedACL = new CachingACLDecorator(this, {
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      keyGenerator: (method, args) => `customer_${method}_${args.join('_')}`,
    });

    this.initializeMetrics();
  }

  @Resilience({
    circuitBreaker: { failureThreshold: 5 },
    retry: { maxAttempts: 3 },
  })
  async getCustomerWithResilience(
    customerId: string
  ): Promise<Result<Customer, Error>> {
    return this.circuitBreaker.execute(async () => {
      return this.retryPolicy.execute(async () => {
        return this.cachedACL.execute('getCustomer', [customerId]);
      });
    });
  }

  async bulkSyncCustomers(
    request: CustomerSyncRequest
  ): Promise<Result<CustomerSyncResult, Error>> {
    const externalAPI = VytchesDDD.resolve<ExternalCustomerAPI>(
      'externalCustomerAPI'
    );
    const metricsCollector =
      VytchesDDD.resolve<MetricsCollector>('metricsCollector');

    try {
      const startTime = Date.now();

      // Get customers from external system
      const externalCustomers = await externalAPI.getCustomersByFilter({
        lastSyncTime: request.lastSyncTime,
        customerIds: request.customerIds,
        includeInactive: request.includeInactive || false,
      });

      const syncResult: CustomerSyncResult = {
        processedCount: 0,
        errorCount: 0,
        errors: [],
        customers: [],
        lastSyncTime: new Date(),
      };

      // Process customers in batches for better performance
      const batchSize = 50;
      for (let i = 0; i < externalCustomers.length; i += batchSize) {
        const batch = externalCustomers.slice(i, i + batchSize);
        const batchResults = await this.processBatch(batch);

        syncResult.processedCount += batchResults.succeeded.length;
        syncResult.errorCount += batchResults.failed.length;
        syncResult.customers.push(...batchResults.succeeded);
        syncResult.errors.push(...batchResults.failed);
      }

      // Record metrics
      const duration = Date.now() - startTime;
      await metricsCollector.recordSyncOperation({
        duration,
        processedCount: syncResult.processedCount,
        errorCount: syncResult.errorCount,
        batchCount: Math.ceil(externalCustomers.length / batchSize),
      });

      return Result.success(syncResult);
    } catch (error) {
      return Result.failure(new Error(`Bulk sync failed: ${error.message}`));
    }
  }

  private async processBatch(
    customers: ExternalCustomerData[]
  ): Promise<BatchProcessingResult> {
    const promises = customers.map(async externalCustomer => {
      const result = this.translateData(externalCustomer);
      return {
        id: externalCustomer.customer_id,
        result,
      };
    });

    const results = await Promise.allSettled(promises);

    const succeeded: Customer[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    results.forEach((promiseResult, index) => {
      if (promiseResult.status === 'fulfilled') {
        const { id, result } = promiseResult.value;
        if (result.isSuccess()) {
          succeeded.push(result.value);
        } else {
          failed.push({ id, error: result.error.message });
        }
      } else {
        failed.push({
          id: customers[index].customer_id,
          error: promiseResult.reason.message,
        });
      }
    });

    return { succeeded, failed };
  }

  private async initializeMetrics(): Promise<void> {
    const metricsCollector =
      VytchesDDD.resolve<MetricsCollector>('metricsCollector');

    // Register custom metrics for ACL operations
    await metricsCollector.registerMetric(
      'acl_translation_duration',
      'histogram'
    );
    await metricsCollector.registerMetric('acl_cache_hit_rate', 'gauge');
    await metricsCollector.registerMetric('acl_error_rate', 'counter');
  }
}

// customer-bridge.service.ts - NestJS bridge service
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { EnterpriseCustomerACLService } from './enterprise-customer-acl.service';
import { CustomerSyncRequest, Customer } from '../types'; // From your application

@Injectable()
export class CustomerBridgeService {
  private customerACL: EnterpriseCustomerACLService;

  constructor() {
    // ⭐ Bridge Pattern: Get VytchesDDD managed instance
    this.customerACL = VytchesDDD.resolve<EnterpriseCustomerACLService>(
      'enterpriseCustomerACL'
    );
  }

  async getCustomer(customerId: string): Promise<Customer> {
    const result = await this.customerACL.getCustomerWithResilience(customerId);

    if (result.isFailure()) {
      throw new Error(`Failed to get customer: ${result.error.message}`);
    }

    return result.value;
  }

  async syncCustomers(
    request: CustomerSyncRequest
  ): Promise<CustomerSyncResult> {
    const result = await this.customerACL.bulkSyncCustomers(request);

    if (result.isFailure()) {
      throw new Error(`Sync failed: ${result.error.message}`);
    }

    return result.value;
  }

  async getCustomerMetrics(): Promise<CustomerMetrics> {
    const metricsCollector =
      VytchesDDD.resolve<MetricsCollector>('metricsCollector');

    return {
      totalCustomers: await metricsCollector.getMetric('total_customers'),
      syncSuccessRate: await metricsCollector.getMetric('sync_success_rate'),
      averageResponseTime:
        await metricsCollector.getMetric('avg_response_time'),
      cacheHitRate: await metricsCollector.getMetric('acl_cache_hit_rate'),
    };
  }
}

// customer-admin.controller.ts - NestJS controller with advanced operations
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { CustomerBridgeService } from './customer-bridge.service';
import { CustomerSyncRequestDto, CustomerMetricsDto } from './dto'; // From your application

@Controller('admin/customers')
export class CustomerAdminController {
  constructor(private readonly customerBridge: CustomerBridgeService) {}

  @Get(':id')
  async getCustomer(@Param('id') customerId: string) {
    try {
      const customer = await this.customerBridge.getCustomer(customerId);
      return { success: true, data: customer };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('sync')
  async syncCustomers(@Body() syncRequest: CustomerSyncRequestDto) {
    try {
      const result = await this.customerBridge.syncCustomers(syncRequest);
      return {
        success: true,
        data: {
          processedCount: result.processedCount,
          errorCount: result.errorCount,
          successRate:
            (result.processedCount /
              (result.processedCount + result.errorCount)) *
            100,
          errors: result.errors.slice(0, 10), // Limit error details
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('metrics/overview')
  async getMetrics() {
    try {
      const metrics = await this.customerBridge.getCustomerMetrics();
      return { success: true, data: metrics };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('cache/clear')
  async clearCache() {
    try {
      const cacheManager = VytchesDDD.resolve<CacheManager>('cacheManager');
      await cacheManager.clear('customer_*');
      return { success: true, message: 'Cache cleared successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// customer-enterprise.module.ts - NestJS module with VytchesDDD integration
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { CustomerAdminController } from './customer-admin.controller';
import { CustomerBridgeService } from './customer-bridge.service';

@Module({
  controllers: [CustomerAdminController],
  providers: [CustomerBridgeService],
  exports: [CustomerBridgeService],
})
export class CustomerEnterpriseModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD with enterprise configuration
    await VytchesDDD.configure({
      enableAutoDiscovery: true,
      enableMetrics: true,
      enableCaching: true,
      context: 'CustomerManagement',
      resilience: {
        defaultTimeout: 30000,
        defaultRetryAttempts: 3,
        defaultCircuitBreakerThreshold: 5,
      },
    });
  }
}

// Supporting domain services with VytchesDDD DI
@DomainService({
  serviceId: 'metricsCollector',
  lifetime: ServiceLifetime.Singleton,
  context: 'Infrastructure',
})
export class MetricsCollector {
  async recordSyncOperation(metrics: SyncMetrics): Promise<void> {
    // Implementation for metrics collection
  }

  async registerMetric(
    name: string,
    type: 'counter' | 'gauge' | 'histogram'
  ): Promise<void> {
    // Implementation for metric registration
  }

  async getMetric(name: string): Promise<number> {
    // Implementation for metric retrieval
    return 0;
  }
}

@DomainService({
  serviceId: 'cacheManager',
  lifetime: ServiceLifetime.Singleton,
  context: 'Infrastructure',
})
export class CacheManager {
  async clear(pattern: string): Promise<void> {
    // Implementation for cache clearing
  }
}

@DomainService({
  serviceId: 'externalCustomerAPI',
  lifetime: ServiceLifetime.Singleton,
  context: 'ExternalIntegration',
})
export class ExternalCustomerAPI {
  async getCustomersByFilter(
    filter: CustomerFilter
  ): Promise<ExternalCustomerData[]> {
    // Implementation for external API calls
    return [];
  }
}

// Supporting types
interface CustomerSyncResult {
  processedCount: number;
  errorCount: number;
  errors: Array<{ id: string; error: string }>;
  customers: Customer[];
  lastSyncTime: Date;
}

interface BatchProcessingResult {
  succeeded: Customer[];
  failed: Array<{ id: string; error: string }>;
}

interface CustomerMetrics {
  totalCustomers: number;
  syncSuccessRate: number;
  averageResponseTime: number;
  cacheHitRate: number;
}

interface SyncMetrics {
  duration: number;
  processedCount: number;
  errorCount: number;
  batchCount: number;
}

interface CustomerFilter {
  lastSyncTime?: Date;
  customerIds?: string[];
  includeInactive: boolean;
}
```

## Key Features

- **VytchesDDD DI Integration**: Enterprise service management with
  auto-discovery
- **Bridge Pattern**: Clean separation between NestJS and business logic
- **Advanced Resilience**: Circuit breakers, retry policies, and timeouts
- **Performance Optimization**: Caching, batch processing, and metrics
- **Cross-Cutting Concerns**: Automatic metrics, caching, and error handling

## Common Pitfalls

- **Service Resolution**: Always resolve services after VytchesDDD configuration
- **Bridge Complexity**: Keep bridge services thin - delegate to domain services
- **Initialization Order**: Initialize VytchesDDD before NestJS service
  resolution

## Related Examples

- [Basic NestJS Integration](/packages/acl/src/examples/frameworks/nestjs/basic/example-1.md)
- [Enterprise ACL Orchestration](/packages/acl/src/examples/advanced/example-1.md)
