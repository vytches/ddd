# Intermediate Use Cases

**Version**: 1.0.0
**Package**: @vytches-ddd/utils
**Complexity**: intermediate
**Domain**: Infrastructure
**Patterns**: Enterprise scenarios, complex workflows, system integration
**Dependencies**: @vytches-ddd/utils

## Description

Real-world enterprise use cases demonstrating intermediate-level utility patterns. These examples show how to handle complex business scenarios including data migration, API integration, batch processing, and multi-system workflows using advanced Result patterns and error handling.

## Business Context

Enterprise applications face complex scenarios:
- Data migration between systems with validation and transformation
- Integration with multiple external APIs and services
- Bulk processing of business data with partial failure handling
- Complex workflows spanning multiple systems and domains
- Error recovery and system resilience requirements

These use cases demonstrate how utilities can handle enterprise complexity while maintaining reliability and observability.

## Code Example

```typescript
// intermediate-use-cases.ts
import { Result, safeRun, LibUtils } from '@vytches-ddd/utils';
import { 
  UserData, 
  ValidationError, 
  ServiceResponse,
  ApiResponse,
  AggregatedError,
  AsyncResult 
} from '../types';

// ✅ FOCUS: Enterprise use case implementations
export class IntermediateUseCases {

  // USE CASE 1: Customer Data Migration
  async migrateCustomerData(
    sourceData: any[], 
    options: {
      batchSize?: number;
      validateOnly?: boolean;
      continueOnError?: boolean;
      transformationRules?: any;
    } = {}
  ): Promise<ServiceResponse<any>> {
    const migrationId = LibUtils.getUUID();
    const startTime = Date.now();
    
    console.log(`Starting migration ${migrationId} with ${sourceData.length} records`);

    const results = {
      validated: [] as any[],
      transformed: [] as UserData[],
      migrated: [] as UserData[],
      errors: [] as Array<{ index: number; stage: string; error: string; data: any }>,
      summary: {
        total: sourceData.length,
        processed: 0,
        successful: 0,
        failed: 0,
      },
    };

    try {
      const batchSize = options.batchSize || 50;
      
      for (let i = 0; i < sourceData.length; i += batchSize) {
        const batch = sourceData.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(sourceData.length / batchSize)}`);

        // Stage 1: Validation
        const validationResults = await this.validateMigrationBatch(batch, i);
        results.validated.push(...validationResults.valid);
        results.errors.push(...validationResults.errors);

        if (!options.validateOnly) {
          // Stage 2: Data Transformation
          const transformationResults = await this.transformMigrationData(
            validationResults.valid, 
            options.transformationRules || {},
            i
          );
          results.transformed.push(...transformationResults.transformed);
          results.errors.push(...transformationResults.errors);

          // Stage 3: Data Migration (actual persistence)
          if (!options.validateOnly) {
            const migrationResults = await this.persistMigratedData(
              transformationResults.transformed,
              i
            );
            results.migrated.push(...migrationResults.migrated);
            results.errors.push(...migrationResults.errors);
          }
        }

        results.summary.processed += batch.length;
        results.summary.successful = results.migrated.length;
        results.summary.failed = results.errors.length;

        // Progress reporting
        const progress = (results.summary.processed / results.summary.total) * 100;
        console.log(`Migration progress: ${progress.toFixed(1)}% (${results.summary.successful} successful, ${results.summary.failed} failed)`);

        // Respect rate limits
        if (i + batchSize < sourceData.length) {
          await LibUtils.sleep(200);
        }
      }

      const hasErrors = results.errors.length > 0;
      const hasPartialSuccess = results.migrated.length > 0;

      return {
        success: !hasErrors || (hasPartialSuccess && options.continueOnError),
        data: {
          migrationId,
          results,
          validationOnly: options.validateOnly || false,
        },
        error: hasErrors ? {
          code: hasPartialSuccess ? 'PARTIAL_MIGRATION_SUCCESS' : 'MIGRATION_FAILED',
          message: `Migration completed with ${results.errors.length} errors`,
          details: {
            sampleErrors: results.errors.slice(0, 5),
            totalErrors: results.errors.length,
            errorsByStage: this.categorizeErrorsByStage(results.errors),
          },
        } : undefined,
        metadata: {
          timestamp: new Date(),
          requestId: migrationId,
          duration: Date.now() - startTime,
          batchSize,
          totalBatches: Math.ceil(sourceData.length / batchSize),
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MIGRATION_SYSTEM_ERROR',
          message: 'Migration failed due to system error',
          details: { migrationId, error: (error as Error).message },
        },
        metadata: {
          timestamp: new Date(),
          requestId: migrationId,
          duration: Date.now() - startTime,
        },
      };
    }
  }

  private async validateMigrationBatch(batch: any[], startIndex: number): Promise<any> {
    const valid: any[] = [];
    const errors: any[] = [];

    const validationPromises = batch.map(async (record, batchIndex) => {
      const globalIndex = startIndex + batchIndex;
      
      const [validationError, validationResult] = await safeRun(async () => {
        // Comprehensive validation
        if (!record || typeof record !== 'object') {
          throw new Error('Invalid record format');
        }

        if (LibUtils.isEmpty(record.email)) {
          throw new Error('Email is required');
        }

        if (!record.email.includes('@')) {
          throw new Error('Invalid email format');
        }

        if (LibUtils.isEmpty(record.firstName) && LibUtils.isEmpty(record.fullName)) {
          throw new Error('Name is required (firstName or fullName)');
        }

        return {
          originalIndex: globalIndex,
          email: record.email.toLowerCase().trim(),
          firstName: record.firstName?.trim() || '',
          lastName: record.lastName?.trim() || '',
          fullName: record.fullName?.trim() || '',
          phone: record.phone?.trim() || '',
          customerId: record.id || record.customerId || LibUtils.getUUID(),
          legacyData: record,
        };
      });

      return { index: globalIndex, error: validationError, result: validationResult };
    });

    const results = await Promise.all(validationPromises);
    
    results.forEach(({ index, error, result }) => {
      if (error) {
        errors.push({
          index,
          stage: 'validation',
          error: error.message,
          data: batch[index - startIndex],
        });
      } else {
        valid.push(result);
      }
    });

    return { valid, errors };
  }

  private async transformMigrationData(validRecords: any[], rules: any, startIndex: number): Promise<any> {
    const transformed: UserData[] = [];
    const errors: any[] = [];

    const transformationPromises = validRecords.map(async (record) => {
      const [transformError, transformedRecord] = await safeRun(async () => {
        // Apply transformation rules
        const name = record.fullName || `${record.firstName} ${record.lastName}`.trim();
        
        if (name.length < 2) {
          throw new Error('Transformed name is too short');
        }

        const transformedUser: UserData = {
          id: record.customerId,
          email: record.email,
          name: name,
          role: rules.defaultRole || 'customer',
          createdAt: new Date(),
        };

        // Apply additional transformation rules
        if (rules.emailDomainWhitelist) {
          const domain = transformedUser.email.split('@')[1];
          if (!rules.emailDomainWhitelist.includes(domain)) {
            throw new Error(`Email domain ${domain} not allowed`);
          }
        }

        return transformedUser;
      });

      return { record, error: transformError, result: transformedRecord };
    });

    const results = await Promise.all(transformationPromises);
    
    results.forEach(({ record, error, result }) => {
      if (error) {
        errors.push({
          index: record.originalIndex,
          stage: 'transformation',
          error: error.message,
          data: record,
        });
      } else {
        transformed.push(result);
      }
    });

    return { transformed, errors };
  }

  private async persistMigratedData(transformedData: UserData[], startIndex: number): Promise<any> {
    const migrated: UserData[] = [];
    const errors: any[] = [];

    // Simulate database persistence with potential failures
    const persistencePromises = transformedData.map(async (userData) => {
      const [persistError, persistedUser] = await safeRun(async () => {
        // Simulate database operation
        await LibUtils.sleep(Math.random() * 100 + 50);
        
        // Simulate some failures
        if (userData.email.includes('fail')) {
          throw new Error('Database constraint violation');
        }

        if (Math.random() < 0.02) { // 2% random failure rate
          throw new Error('Database connection timeout');
        }

        return {
          ...userData,
          createdAt: new Date(),
        };
      });

      return { userData, error: persistError, result: persistedUser };
    });

    const results = await Promise.all(persistencePromises);
    
    results.forEach(({ userData, error, result }) => {
      if (error) {
        errors.push({
          index: transformedData.indexOf(userData) + startIndex,
          stage: 'persistence',
          error: error.message,
          data: userData,
        });
      } else {
        migrated.push(result);
      }
    });

    return { migrated, errors };
  }

  private categorizeErrorsByStage(errors: any[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      acc[error.stage] = (acc[error.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  // USE CASE 2: Multi-API Integration with Circuit Breaker
  async integrateCustomerProfile(customerId: string): Promise<ServiceResponse<any>> {
    const integrationId = LibUtils.getUUID();
    const startTime = Date.now();

    const apiServices = [
      { name: 'customer-service', url: '/api/customers', priority: 'high' },
      { name: 'order-service', url: '/api/orders', priority: 'medium' },
      { name: 'preference-service', url: '/api/preferences', priority: 'low' },
      { name: 'analytics-service', url: '/api/analytics', priority: 'low' },
    ];

    const results = {
      successful: [] as any[],
      failed: [] as any[],
      profile: {} as any,
    };

    try {
      // Fetch data from multiple services with different error handling strategies
      const servicePromises = apiServices.map(async (service) => {
        const retryCount = service.priority === 'high' ? 3 : 1;
        const timeout = service.priority === 'high' ? 5000 : 2000;
        
        return await this.fetchFromServiceWithRetry(
          service, 
          customerId, 
          retryCount, 
          timeout
        );
      });

      const serviceResults = await Promise.allSettled(servicePromises);

      // Process results with different strategies based on priority
      serviceResults.forEach((result, index) => {
        const service = apiServices[index];
        
        if (result.status === 'fulfilled' && result.value.isSuccess) {
          results.successful.push({
            service: service.name,
            data: result.value.value,
            priority: service.priority,
          });
          
          // Merge data into profile based on service type
          this.mergeServiceDataIntoProfile(results.profile, service.name, result.value.value);
          
        } else {
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          results.failed.push({
            service: service.name,
            error: error.message,
            priority: service.priority,
          });

          // Handle critical service failures
          if (service.priority === 'high') {
            return {
              success: false,
              error: {
                code: 'CRITICAL_SERVICE_FAILURE',
                message: `Critical service ${service.name} failed`,
                details: { integrationId, error: error.message },
              },
              metadata: {
                timestamp: new Date(),
                requestId: integrationId,
                duration: Date.now() - startTime,
              },
            };
          }
        }
      });

      // Apply fallback data for failed non-critical services
      this.applyFallbackData(results.profile, results.failed);

      const hasHighPriorityFailures = results.failed.some(f => f.priority === 'high');
      const hasData = results.successful.length > 0;

      return {
        success: !hasHighPriorityFailures && hasData,
        data: {
          integrationId,
          profile: results.profile,
          serviceResults: {
            successful: results.successful.length,
            failed: results.failed.length,
            details: results.failed.length > 0 ? results.failed : undefined,
          },
        },
        error: hasHighPriorityFailures || !hasData ? {
          code: 'INTEGRATION_INCOMPLETE',
          message: 'Customer profile integration incomplete',
          details: {
            failedServices: results.failed,
            successfulServices: results.successful.map(s => s.service),
          },
        } : undefined,
        metadata: {
          timestamp: new Date(),
          requestId: integrationId,
          duration: Date.now() - startTime,
          servicesQueried: apiServices.length,
          servicesSuccessful: results.successful.length,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTEGRATION_SYSTEM_ERROR',
          message: 'System error during integration',
          details: { integrationId, error: (error as Error).message },
        },
        metadata: {
          timestamp: new Date(),
          requestId: integrationId,
          duration: Date.now() - startTime,
        },
      };
    }
  }

  private async fetchFromServiceWithRetry(
    service: any, 
    customerId: string, 
    maxRetries: number, 
    timeoutMs: number
  ): Promise<Result<any, Error>> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.fetchFromService(service, customerId, timeoutMs);
      
      if (result.isSuccess) {
        return result;
      }

      // Don't retry on client errors
      if (result.error.message.includes('404') || result.error.message.includes('401')) {
        break;
      }

      // Exponential backoff for retries
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await LibUtils.sleep(delay);
      }
    }

    return Result.fail(new Error(`Service ${service.name} failed after ${maxRetries} attempts`));
  }

  private async fetchFromService(service: any, customerId: string, timeoutMs: number): Promise<Result<any, Error>> {
    return await Result.tryAsync(async () => {
      // Simulate API call with timeout
      const apiPromise = this.simulateApiCall(service, customerId);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });

      return await Promise.race([apiPromise, timeoutPromise]);
    });
  }

  private async simulateApiCall(service: any, customerId: string): Promise<any> {
    // Simulate network delay
    await LibUtils.sleep(Math.random() * 1000 + 200);
    
    // Simulate different types of responses based on service
    switch (service.name) {
      case 'customer-service':
        if (customerId === 'not-found') {
          throw new Error('Customer not found (404)');
        }
        return {
          id: customerId,
          name: 'John Doe',
          email: 'john@example.com',
          status: 'active',
        };

      case 'order-service':
        if (Math.random() < 0.1) {
          throw new Error('Service temporarily unavailable (503)');
        }
        return {
          totalOrders: 15,
          lastOrderDate: new Date(),
          orderValue: 1250.50,
        };

      case 'preference-service':
        return {
          theme: 'dark',
          notifications: true,
          language: 'en',
        };

      case 'analytics-service':
        if (Math.random() < 0.15) {
          throw new Error('Analytics service timeout');
        }
        return {
          engagement: 'high',
          lastActivity: new Date(),
          score: 85,
        };

      default:
        throw new Error('Unknown service');
    }
  }

  private mergeServiceDataIntoProfile(profile: any, serviceName: string, data: any): void {
    switch (serviceName) {
      case 'customer-service':
        Object.assign(profile, data);
        break;
      case 'order-service':
        profile.orderHistory = data;
        break;
      case 'preference-service':
        profile.preferences = data;
        break;
      case 'analytics-service':
        profile.analytics = data;
        break;
    }
  }

  private applyFallbackData(profile: any, failedServices: any[]): void {
    failedServices.forEach(failure => {
      switch (failure.service) {
        case 'preference-service':
          profile.preferences = profile.preferences || {
            theme: 'light',
            notifications: false,
            language: 'en',
          };
          break;
        case 'analytics-service':
          profile.analytics = profile.analytics || {
            engagement: 'unknown',
            lastActivity: null,
            score: 0,
          };
          break;
      }
    });
  }

  // USE CASE 3: Complex Report Generation with Aggregation
  async generateCustomerReport(
    filters: any, 
    options: { format?: 'json' | 'csv' | 'excel'; includeDetails?: boolean }
  ): Promise<ServiceResponse<any>> {
    const reportId = LibUtils.getUUID();
    const startTime = Date.now();

    try {
      // Phase 1: Data collection
      console.log(`Starting report generation ${reportId}`);
      const dataCollectionResult = await this.collectReportData(filters);
      
      if (dataCollectionResult.isFailure) {
        return {
          success: false,
          error: {
            code: 'DATA_COLLECTION_FAILED',
            message: 'Failed to collect report data',
            details: { reportId, error: dataCollectionResult.error.message },
          },
          metadata: {
            timestamp: new Date(),
            requestId: reportId,
            duration: Date.now() - startTime,
          },
        };
      }

      const rawData = dataCollectionResult.value;

      // Phase 2: Data processing and aggregation
      const processingResult = await this.processReportData(rawData, options);
      
      if (processingResult.isFailure) {
        return {
          success: false,
          error: {
            code: 'DATA_PROCESSING_FAILED',
            message: 'Failed to process report data',
            details: { reportId, error: processingResult.error.message },
          },
          metadata: {
            timestamp: new Date(),
            requestId: reportId,
            duration: Date.now() - startTime,
          },
        };
      }

      const processedData = processingResult.value;

      // Phase 3: Format generation
      const formattingResult = await this.formatReportOutput(processedData, options.format || 'json');
      
      if (formattingResult.isFailure) {
        return {
          success: false,
          error: {
            code: 'REPORT_FORMATTING_FAILED',
            message: 'Failed to format report output',
            details: { reportId, error: formattingResult.error.message },
          },
          metadata: {
            timestamp: new Date(),
            requestId: reportId,
            duration: Date.now() - startTime,
          },
        };
      }

      return {
        success: true,
        data: {
          reportId,
          format: options.format || 'json',
          generatedAt: new Date(),
          data: formattingResult.value,
          summary: {
            totalRecords: rawData.length,
            processedRecords: processedData.summary.processed,
            filters: filters,
          },
        },
        metadata: {
          timestamp: new Date(),
          requestId: reportId,
          duration: Date.now() - startTime,
          dataPoints: rawData.length,
          format: options.format || 'json',
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REPORT_GENERATION_ERROR',
          message: 'Report generation failed unexpectedly',
          details: { reportId, error: (error as Error).message },
        },
        metadata: {
          timestamp: new Date(),
          requestId: reportId,
          duration: Date.now() - startTime,
        },
      };
    }
  }

  private async collectReportData(filters: any): Promise<Result<any[], Error>> {
    return await Result.tryAsync(async () => {
      // Simulate data collection from multiple sources
      await LibUtils.sleep(500);
      
      // Generate sample data based on filters
      const data = Array.from({ length: filters.limit || 100 }, (_, index) => ({
        id: LibUtils.getUUID(),
        customerId: `customer-${index + 1}`,
        orderDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        orderValue: Math.random() * 1000 + 50,
        status: ['completed', 'pending', 'cancelled'][Math.floor(Math.random() * 3)],
        region: ['North', 'South', 'East', 'West'][Math.floor(Math.random() * 4)],
      }));

      return data.filter(item => {
        // Apply filters
        if (filters.status && item.status !== filters.status) return false;
        if (filters.region && item.region !== filters.region) return false;
        if (filters.minValue && item.orderValue < filters.minValue) return false;
        return true;
      });
    });
  }

  private async processReportData(rawData: any[], options: any): Promise<Result<any, Error>> {
    return await Result.tryAsync(async () => {
      await LibUtils.sleep(200);
      
      const summary = {
        totalOrders: rawData.length,
        totalValue: rawData.reduce((sum, item) => sum + item.orderValue, 0),
        averageOrderValue: rawData.length > 0 ? rawData.reduce((sum, item) => sum + item.orderValue, 0) / rawData.length : 0,
        processed: rawData.length,
        byStatus: {} as Record<string, number>,
        byRegion: {} as Record<string, number>,
      };

      // Aggregate by status
      rawData.forEach(item => {
        summary.byStatus[item.status] = (summary.byStatus[item.status] || 0) + 1;
        summary.byRegion[item.region] = (summary.byRegion[item.region] || 0) + 1;
      });

      return {
        summary,
        details: options.includeDetails ? rawData : undefined,
        trends: {
          dailyAverages: this.calculateDailyAverages(rawData),
          topRegions: Object.entries(summary.byRegion)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3),
        },
      };
    });
  }

  private async formatReportOutput(processedData: any, format: string): Promise<Result<any, Error>> {
    return await Result.tryAsync(async () => {
      await LibUtils.sleep(100);
      
      switch (format) {
        case 'json':
          return processedData;
        
        case 'csv':
          return this.convertToCsv(processedData);
        
        case 'excel':
          return this.convertToExcel(processedData);
        
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    });
  }

  private calculateDailyAverages(data: any[]): any[] {
    const dailyData = new Map();
    
    data.forEach(item => {
      const day = item.orderDate.toISOString().split('T')[0];
      if (!dailyData.has(day)) {
        dailyData.set(day, { total: 0, count: 0 });
      }
      const dayData = dailyData.get(day);
      dayData.total += item.orderValue;
      dayData.count += 1;
    });

    return Array.from(dailyData.entries()).map(([day, data]) => ({
      date: day,
      averageValue: data.total / data.count,
      orderCount: data.count,
    }));
  }

  private convertToCsv(data: any): string {
    // Simplified CSV conversion
    const headers = ['Date', 'Average Order Value', 'Order Count'];
    const rows = data.trends.dailyAverages.map((item: any) => 
      [item.date, item.averageValue.toFixed(2), item.orderCount].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  private convertToExcel(data: any): any {
    // Simplified Excel structure representation
    return {
      sheets: {
        Summary: data.summary,
        Trends: data.trends,
        Details: data.details || [],
      },
      format: 'excel',
      note: 'This would be converted to actual Excel format in a real implementation',
    };
  }
}
```

## Key Use Cases

### 1. Customer Data Migration
- **Challenge**: Migrate customer data between systems with validation
- **Solution**: Batch processing with comprehensive error handling
- **Benefits**: Data integrity, progress tracking, partial success handling

### 2. Multi-API Integration
- **Challenge**: Aggregate data from multiple services with different reliability
- **Solution**: Prioritized service calls with circuit breaker patterns
- **Benefits**: Graceful degradation, fallback mechanisms, critical path protection

### 3. Complex Report Generation
- **Challenge**: Generate reports from multiple data sources with different formats
- **Solution**: Multi-phase processing with format transformation
- **Benefits**: Flexible output formats, error isolation, progress visibility

## Real-World Benefits

- **Data Integrity**: Comprehensive validation ensures data quality
- **System Resilience**: Graceful handling of partial failures
- **Operational Visibility**: Detailed logging and progress tracking
- **Business Continuity**: Fallback mechanisms maintain service availability
- **Scalable Processing**: Batch processing handles large datasets efficiently

## Implementation Strategies

- **Batch Processing**: Handle large datasets in manageable chunks
- **Error Categorization**: Group errors for actionable reporting
- **Priority-Based Handling**: Treat critical and non-critical services differently
- **Progressive Enhancement**: Start with basic functionality, add advanced features
- **Monitoring Integration**: Built-in observability for operations teams

## Common Scenarios

- Customer data synchronization between CRM and billing systems
- Product catalog updates across multiple sales channels
- Financial reporting aggregation from multiple business units
- User activity analysis across distributed microservices
- Compliance reporting with data from multiple regulatory systems

## Related Examples

- [Advanced Result Patterns](./example-1.md)
- [Async Result Patterns](./example-2.md)
- [Error Aggregation Patterns](./example-3.md)
- [Intermediate Implementation Guide](./implementation.md)