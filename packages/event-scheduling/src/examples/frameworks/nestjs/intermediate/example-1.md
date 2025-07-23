# NestJS Advanced DI Integration - VytchesDDD Dependency Injection

**Version**: 1.0.0 **Package**: @vytches-ddd/event-scheduling **Framework**:
NestJS **Complexity**: intermediate **Integration**: Advanced VytchesDDD DI
integration with enterprise scheduling features

## Description

Advanced NestJS integration using @vytches-ddd/di for sophisticated dependency
injection, distributed scheduling capabilities, and enterprise-grade event
management with comprehensive monitoring and health checks.

## Business Context

Enterprise e-commerce platform requiring advanced scheduling capabilities
including distributed coordination, sophisticated retry policies, and
integration with the VytchesDDD ecosystem for complex business workflows and
event-driven architecture.

## Code Example

```typescript
// enterprise-scheduling.service.ts
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { VytchesDDD, DomainService, ServiceLifetime } from '@vytches-ddd/di';
import {
  DistributedSchedulerService,
  DistributedScheduledEvent,
  HAScheduledEvent,
} from '@vytches-ddd/event-scheduling';
import { Result } from '@vytches-ddd/utils';
import {
  EnterpriseOrderData,
  ComplianceSchedulingData,
  DistributedSchedulingConfig,
  SchedulingMetrics,
} from './types'; // From your app

// ⭐ FOCUS: Domain service with VytchesDDD DI
@DomainService('enterpriseSchedulingService', {
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderManagement',
  dependencies: ['distributedCoordinator', 'complianceManager'],
})
export class EnterpriseSchedulingService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EnterpriseSchedulingService.name);
  private distributedScheduler: DistributedSchedulerService;
  private isInitialized = false;

  constructor() {
    // ⭐ FOCUS: Services resolved through VytchesDDD container
    // Dependencies will be injected automatically by VytchesDDD
  }

  async onModuleInit(): Promise<void> {
    try {
      // ⭐ FOCUS: Initialize VytchesDDD container integration
      const distributedConfig: DistributedSchedulingConfig = {
        nodes: ['node-1', 'node-2', 'node-3'],
        partitionCount: 16,
        replicationFactor: 2,
        leaderElectionTimeout: 10000,
      };

      // Get distributed scheduler from VytchesDDD container
      this.distributedScheduler =
        VytchesDDD.resolve<DistributedSchedulerService>(
          'distributedSchedulerService'
        ) || new DistributedSchedulerService('node-1', distributedConfig);

      await this.distributedScheduler.start();
      this.isInitialized = true;

      this.logger.log(
        'Enterprise scheduling service initialized with VytchesDDD DI'
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize enterprise scheduling service: ${error.message}`
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.distributedScheduler && this.isInitialized) {
        await this.distributedScheduler.stop();
      }
      this.logger.log('Enterprise scheduling service destroyed');
    } catch (error) {
      this.logger.error(
        `Error destroying enterprise scheduling service: ${error.message}`
      );
    }
  }

  // ✅ FOCUS: Schedule enterprise order with distributed coordination
  async scheduleEnterpriseOrder(
    orderId: string,
    orderData: EnterpriseOrderData,
    processingDelayMinutes: number = 15
  ): Promise<Result<string, Error>> {
    try {
      if (!this.isInitialized) {
        return Result.fail(
          new Error('Enterprise scheduling service not initialized')
        );
      }

      // Create distributed scheduled event with high availability
      const distributedEvent = new DistributedScheduledEvent(
        orderId,
        new Date(Date.now() + processingDelayMinutes * 60 * 1000),
        {
          type: 'enterprise-order-processing',
          ...orderData,
          scheduledAt: new Date(),
          priority: orderData.customerTier === 'enterprise' ? 'high' : 'normal',
          complianceRequired: orderData.regulatedIndustry,
        },
        `customer-${orderData.customerId}`, // Partition by customer
        3 // High replication for enterprise orders
      );

      const result =
        await this.distributedScheduler.scheduleDistributedEvent(
          distributedEvent
        );

      if (result.isSuccess()) {
        this.logger.log(
          `Enterprise order scheduled: ${orderId} -> ${result.value}`
        );

        // Emit domain event for audit trail
        await this.emitOrderScheduledEvent(orderId, orderData);

        return Result.ok(result.value);
      } else {
        return result;
      }
    } catch (error) {
      this.logger.error(
        `Failed to schedule enterprise order: ${error.message}`
      );
      return Result.fail(
        new Error(`Enterprise order scheduling failed: ${error.message}`)
      );
    }
  }

  // ✅ FOCUS: Schedule compliance reporting with regulatory requirements
  async scheduleComplianceReporting(
    reportType: string,
    complianceData: ComplianceSchedulingData,
    deadlineDate: Date
  ): Promise<Result<string, Error>> {
    try {
      // Schedule 24 hours before deadline for preparation
      const scheduleAt = new Date(deadlineDate.getTime() - 24 * 60 * 60 * 1000);

      // Use HA scheduled event for critical compliance
      const complianceEvent = new HAScheduledEvent(
        `compliance-${reportType}-${Date.now()}`,
        scheduleAt,
        {
          type: 'compliance-reporting',
          reportType,
          ...complianceData,
          regulatoryDeadline: deadlineDate,
          auditTrail: true,
          encryptionRequired: true,
        },
        5, // Maximum replication for compliance
        'linearizable', // Strongest consistency
        'emergency' // Emergency criticality
      );

      // Get HA scheduler from VytchesDDD container
      const haScheduler = VytchesDDD.resolve<any>('haSchedulingService');
      if (!haScheduler) {
        return Result.fail(new Error('HA scheduling service not available'));
      }

      const result = await haScheduler.scheduleWithHA(complianceEvent);

      if (result.isSuccess()) {
        this.logger.log(`Compliance reporting scheduled: ${reportType}`);
        return Result.ok(result.value.eventId);
      } else {
        return Result.fail(result.error);
      }
    } catch (error) {
      this.logger.error(
        `Failed to schedule compliance reporting: ${error.message}`
      );
      return Result.fail(
        new Error(`Compliance scheduling failed: ${error.message}`)
      );
    }
  }

  // ✅ FOCUS: Schedule cross-border transaction processing
  async scheduleCrossBorderTransaction(
    transactionId: string,
    sourceRegion: string,
    destinationRegion: string,
    transactionData: any,
    processingDelayMinutes: number = 30
  ): Promise<Result<string, Error>> {
    try {
      // Use global coordination manager for cross-border transactions
      const globalCoordinator = VytchesDDD.resolve<any>(
        'globalCoordinationManager'
      );

      if (!globalCoordinator) {
        return Result.fail(
          new Error('Global coordination manager not available')
        );
      }

      const result = await globalCoordinator.scheduleCrossBorderTransaction(
        transactionId,
        {
          ...transactionData,
          sourceRegion,
          destinationRegion,
          scheduledAt: new Date(),
          complianceChecks: ['AML', 'KYC', 'OFAC'],
        },
        sourceRegion as any,
        destinationRegion as any,
        processingDelayMinutes * 60 * 1000
      );

      if (result.isSuccess()) {
        this.logger.log(`Cross-border transaction scheduled: ${transactionId}`);
        return Result.ok(result.value.globalEventId);
      } else {
        return result;
      }
    } catch (error) {
      this.logger.error(
        `Failed to schedule cross-border transaction: ${error.message}`
      );
      return Result.fail(
        new Error(
          `Cross-border transaction scheduling failed: ${error.message}`
        )
      );
    }
  }

  // ✅ FOCUS: Get comprehensive scheduling metrics
  async getEnterpriseMetrics(): Promise<SchedulingMetrics> {
    try {
      if (!this.distributedScheduler) {
        throw new Error('Distributed scheduler not initialized');
      }

      const distributedMetrics =
        await this.distributedScheduler.getDistributedMetrics();
      const clusterStatus = this.distributedScheduler.getClusterStatus();

      // Get additional metrics from VytchesDDD services
      const haScheduler = VytchesDDD.resolve<any>('haSchedulingService');
      const haMetrics = haScheduler ? await haScheduler.getHAMetrics() : null;

      return {
        distributed: distributedMetrics,
        cluster: clusterStatus,
        highAvailability: haMetrics,
        enterprise: {
          totalNodes: clusterStatus.totalNodes,
          healthyNodes: clusterStatus.healthyNodes,
          activePartitions: distributedMetrics.partitions?.length || 0,
          crossRegionEvents: distributedMetrics.cluster?.globalEventCount || 0,
          complianceJobs: await this.getActiveComplianceJobs(),
          averageLatency: distributedMetrics.cluster?.averageLatency || 0,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get enterprise metrics: ${error.message}`);
      return {
        enterprise: {
          totalNodes: 0,
          healthyNodes: 0,
          activePartitions: 0,
          crossRegionEvents: 0,
          complianceJobs: 0,
          averageLatency: 0,
        },
        timestamp: new Date(),
      };
    }
  }

  // ✅ FOCUS: Advanced health check with dependency validation
  async performAdvancedHealthCheck(): Promise<EnterpriseHealthStatus> {
    try {
      const healthStatus: EnterpriseHealthStatus = {
        overall: 'healthy',
        services: {},
        dependencies: {},
        metrics: {},
        timestamp: new Date(),
      };

      // Check distributed scheduler health
      if (this.distributedScheduler && this.isInitialized) {
        try {
          const clusterStatus = this.distributedScheduler.getClusterStatus();
          healthStatus.services.distributedScheduler = {
            status: clusterStatus.isHealthy ? 'healthy' : 'unhealthy',
            details: {
              totalNodes: clusterStatus.totalNodes,
              healthyNodes: clusterStatus.healthyNodes,
              hasQuorum:
                clusterStatus.healthyNodes >
                Math.floor(clusterStatus.totalNodes / 2),
            },
          };
        } catch (error) {
          healthStatus.services.distributedScheduler = {
            status: 'unhealthy',
            error: error.message,
          };
          healthStatus.overall = 'degraded';
        }
      } else {
        healthStatus.services.distributedScheduler = {
          status: 'not-initialized',
        };
        healthStatus.overall = 'unhealthy';
      }

      // Check VytchesDDD container dependencies
      const dependencyChecks = [
        'globalCoordinationManager',
        'haSchedulingService',
        'complianceManager',
        'distributedCoordinator',
      ];

      for (const dependency of dependencyChecks) {
        try {
          const service = VytchesDDD.resolve<any>(dependency);
          healthStatus.dependencies[dependency] = {
            status: service ? 'available' : 'unavailable',
            type: service?.constructor?.name || 'unknown',
          };

          if (!service) {
            healthStatus.overall = 'degraded';
          }
        } catch (error) {
          healthStatus.dependencies[dependency] = {
            status: 'error',
            error: error.message,
          };
          healthStatus.overall = 'degraded';
        }
      }

      // Get performance metrics for health assessment
      try {
        const metrics = await this.getEnterpriseMetrics();
        healthStatus.metrics = {
          averageLatency: metrics.enterprise.averageLatency,
          healthyNodesRatio:
            metrics.enterprise.totalNodes > 0
              ? metrics.enterprise.healthyNodes / metrics.enterprise.totalNodes
              : 0,
          activePartitions: metrics.enterprise.activePartitions,
        };

        // Check if performance is degraded
        if (healthStatus.metrics.averageLatency > 1000) {
          // > 1 second latency
          healthStatus.overall = 'degraded';
        }
      } catch (error) {
        healthStatus.metrics = { error: error.message };
      }

      return healthStatus;
    } catch (error) {
      this.logger.error(`Advanced health check failed: ${error.message}`);
      return {
        overall: 'unhealthy',
        services: {},
        dependencies: {},
        metrics: { error: error.message },
        timestamp: new Date(),
      };
    }
  }

  private async emitOrderScheduledEvent(
    orderId: string,
    orderData: EnterpriseOrderData
  ): Promise<void> {
    try {
      // Emit domain event through VytchesDDD event system
      const eventBus = VytchesDDD.resolve<any>('eventBus');
      if (eventBus) {
        await eventBus.publish({
          type: 'OrderScheduled',
          aggregateId: orderId,
          payload: {
            orderId,
            customerId: orderData.customerId,
            scheduledAt: new Date(),
            processingType: 'enterprise',
          },
          version: 1,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to emit order scheduled event: ${error.message}`
      );
    }
  }

  private async getActiveComplianceJobs(): Promise<number> {
    try {
      const complianceManager = VytchesDDD.resolve<any>('complianceManager');
      return complianceManager
        ? await complianceManager.getActiveJobCount()
        : 0;
    } catch (error) {
      return 0;
    }
  }
}
```

```typescript
// enterprise-scheduling.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VytchesDDD } from '@vytches-ddd/di';
import { Result } from '@vytches-ddd/utils';
import {
  ScheduleEnterpriseOrderDto,
  ScheduleComplianceReportDto,
  ScheduleCrossBorderTransactionDto,
  EnterpriseMetricsDto,
} from './dto'; // From your app

@ApiTags('enterprise-scheduling')
@Controller('enterprise-scheduling')
@ApiBearerAuth()
export class EnterpriseSchedulingController {
  // ⭐ FOCUS: Service resolution through VytchesDDD container
  private get enterpriseSchedulingService() {
    return VytchesDDD.resolve<EnterpriseSchedulingService>(
      'enterpriseSchedulingService'
    );
  }

  @Post('enterprise-order')
  @ApiOperation({ summary: 'Schedule enterprise order processing' })
  @ApiResponse({
    status: 201,
    description: 'Enterprise order scheduled successfully',
  })
  async scheduleEnterpriseOrder(@Body() dto: ScheduleEnterpriseOrderDto) {
    const service = this.enterpriseSchedulingService;
    if (!service) {
      throw new Error('Enterprise scheduling service not available');
    }

    const result = await service.scheduleEnterpriseOrder(
      dto.orderId,
      {
        orderId: dto.orderId,
        customerId: dto.customerId,
        customerTier: dto.customerTier,
        orderValue: dto.orderValue,
        currency: dto.currency,
        regulatedIndustry: dto.regulatedIndustry,
        complianceLevel: dto.complianceLevel,
        priorityProcessing: dto.priorityProcessing,
        crossBorderTransaction: dto.crossBorderTransaction,
      },
      dto.processingDelayMinutes
    );

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return {
      success: true,
      jobId: result.value,
      message: 'Enterprise order scheduled successfully',
      distributedCoordination: true,
    };
  }

  @Post('compliance-report')
  @ApiOperation({ summary: 'Schedule compliance reporting' })
  @ApiResponse({
    status: 201,
    description: 'Compliance report scheduled successfully',
  })
  async scheduleComplianceReport(@Body() dto: ScheduleComplianceReportDto) {
    const service = this.enterpriseSchedulingService;
    if (!service) {
      throw new Error('Enterprise scheduling service not available');
    }

    const result = await service.scheduleComplianceReporting(
      dto.reportType,
      {
        regulationType: dto.regulationType,
        regulatoryDeadline: new Date(dto.deadline),
        originRegion: dto.originRegion,
        dataRequirements: dto.dataRequirements,
        auditTrail: dto.auditTrailRequired,
        encryptionRequired: dto.encryptionRequired,
        retentionPeriod: dto.retentionYears,
      },
      new Date(dto.deadline)
    );

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return {
      success: true,
      reportId: result.value,
      message: 'Compliance report scheduled successfully',
      highAvailability: true,
      deadline: dto.deadline,
    };
  }

  @Post('cross-border-transaction')
  @ApiOperation({ summary: 'Schedule cross-border transaction' })
  @ApiResponse({
    status: 201,
    description: 'Cross-border transaction scheduled successfully',
  })
  async scheduleCrossBorderTransaction(
    @Body() dto: ScheduleCrossBorderTransactionDto
  ) {
    const service = this.enterpriseSchedulingService;
    if (!service) {
      throw new Error('Enterprise scheduling service not available');
    }

    const result = await service.scheduleCrossBorderTransaction(
      dto.transactionId,
      dto.sourceRegion,
      dto.destinationRegion,
      {
        amount: dto.amount,
        sourceCurrency: dto.sourceCurrency,
        targetCurrency: dto.targetCurrency,
        transactionType: dto.transactionType,
        complianceChecks: dto.complianceChecks,
        regulatoryRequirements: dto.regulatoryRequirements,
      },
      dto.processingDelayMinutes
    );

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return {
      success: true,
      globalEventId: result.value,
      message: 'Cross-border transaction scheduled successfully',
      globalCoordination: true,
      sourceRegion: dto.sourceRegion,
      destinationRegion: dto.destinationRegion,
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get comprehensive enterprise scheduling metrics' })
  @ApiResponse({
    status: 200,
    description: 'Enterprise metrics retrieved successfully',
  })
  async getEnterpriseMetrics(): Promise<EnterpriseMetricsDto> {
    const service = this.enterpriseSchedulingService;
    if (!service) {
      throw new Error('Enterprise scheduling service not available');
    }

    const metrics = await service.getEnterpriseMetrics();

    return {
      distributed: {
        totalNodes: metrics.enterprise.totalNodes,
        healthyNodes: metrics.enterprise.healthyNodes,
        clusterHealth:
          metrics.enterprise.healthyNodes > 0 ? 'healthy' : 'unhealthy',
      },
      enterprise: {
        activePartitions: metrics.enterprise.activePartitions,
        crossRegionEvents: metrics.enterprise.crossRegionEvents,
        complianceJobs: metrics.enterprise.complianceJobs,
        averageLatency: metrics.enterprise.averageLatency,
      },
      timestamp: metrics.timestamp,
    };
  }

  @Get('health/advanced')
  @ApiOperation({ summary: 'Perform advanced health check' })
  @ApiResponse({ status: 200, description: 'Advanced health status' })
  async getAdvancedHealth() {
    const service = this.enterpriseSchedulingService;
    if (!service) {
      return {
        overall: 'unhealthy',
        reason: 'Enterprise scheduling service not available',
        timestamp: new Date(),
      };
    }

    return await service.performAdvancedHealthCheck();
  }

  @Get('cluster/status')
  @ApiOperation({ summary: 'Get cluster status' })
  @ApiResponse({ status: 200, description: 'Cluster status information' })
  async getClusterStatus() {
    const service = this.enterpriseSchedulingService;
    if (!service) {
      throw new Error('Enterprise scheduling service not available');
    }

    const metrics = await service.getEnterpriseMetrics();

    return {
      cluster: metrics.cluster,
      distributed: metrics.distributed,
      timestamp: new Date(),
    };
  }
}
```

```typescript
// enterprise-scheduling.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { VytchesDDD, NestJSContainerAdapter } from '@vytches-ddd/di';
import { EnterpriseSchedulingService } from './enterprise-scheduling.service';
import { EnterpriseSchedulingController } from './enterprise-scheduling.controller';

@Module({
  providers: [EnterpriseSchedulingService],
  controllers: [EnterpriseSchedulingController],
  exports: [EnterpriseSchedulingService],
})
export class EnterpriseSchedulingModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit(): Promise<void> {
    // ⭐ FOCUS: Initialize VytchesDDD container with NestJS adapter
    try {
      const adapter = new NestJSContainerAdapter(this.moduleRef);
      await VytchesDDD.configure(adapter);

      console.log('✅ VytchesDDD container configured with NestJS adapter');

      // Register additional enterprise services
      await this.registerEnterpriseServices();
    } catch (error) {
      console.error(
        '❌ Failed to configure VytchesDDD container:',
        error.message
      );
      throw error;
    }
  }

  private async registerEnterpriseServices(): Promise<void> {
    // Register enterprise-specific services in VytchesDDD container
    // These would typically be imported from other modules
    console.log('🏢 Enterprise services registered in VytchesDDD container');
  }
}
```

```typescript
// dto/enterprise-scheduling.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
} from 'class-validator';

export class ScheduleEnterpriseOrderDto {
  @ApiProperty({ description: 'Enterprise order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  customerId: string;

  @ApiProperty({ description: 'Customer tier' })
  @IsIn(['basic', 'premium', 'enterprise'])
  customerTier: 'basic' | 'premium' | 'enterprise';

  @ApiProperty({ description: 'Order value' })
  @IsNumber()
  orderValue: number;

  @ApiProperty({ description: 'Order currency' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Regulated industry flag' })
  @IsBoolean()
  regulatedIndustry: boolean;

  @ApiProperty({ description: 'Compliance level required' })
  @IsIn(['standard', 'high', 'critical'])
  complianceLevel: 'standard' | 'high' | 'critical';

  @ApiProperty({ description: 'Priority processing flag' })
  @IsBoolean()
  priorityProcessing: boolean;

  @ApiProperty({ description: 'Cross-border transaction flag' })
  @IsBoolean()
  crossBorderTransaction: boolean;

  @ApiProperty({ description: 'Processing delay in minutes', default: 15 })
  @IsNumber()
  @IsOptional()
  processingDelayMinutes?: number;
}

export class ScheduleComplianceReportDto {
  @ApiProperty({ description: 'Report type' })
  @IsString()
  reportType: string;

  @ApiProperty({ description: 'Regulation type' })
  @IsString()
  regulationType: string;

  @ApiProperty({ description: 'Regulatory deadline' })
  @IsDateString()
  deadline: string;

  @ApiProperty({ description: 'Origin region' })
  @IsString()
  originRegion: string;

  @ApiProperty({ description: 'Data requirements' })
  @IsArray()
  dataRequirements: string[];

  @ApiProperty({ description: 'Audit trail required' })
  @IsBoolean()
  auditTrailRequired: boolean;

  @ApiProperty({ description: 'Encryption required' })
  @IsBoolean()
  encryptionRequired: boolean;

  @ApiProperty({ description: 'Retention period in years' })
  @IsNumber()
  retentionYears: number;
}

export class ScheduleCrossBorderTransactionDto {
  @ApiProperty({ description: 'Transaction ID' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: 'Source region' })
  @IsString()
  sourceRegion: string;

  @ApiProperty({ description: 'Destination region' })
  @IsString()
  destinationRegion: string;

  @ApiProperty({ description: 'Transaction amount' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Source currency' })
  @IsString()
  sourceCurrency: string;

  @ApiProperty({ description: 'Target currency' })
  @IsString()
  targetCurrency: string;

  @ApiProperty({ description: 'Transaction type' })
  @IsString()
  transactionType: string;

  @ApiProperty({ description: 'Compliance checks required' })
  @IsArray()
  complianceChecks: string[];

  @ApiProperty({ description: 'Regulatory requirements' })
  @IsArray()
  regulatoryRequirements: string[];

  @ApiProperty({ description: 'Processing delay in minutes', default: 30 })
  @IsNumber()
  @IsOptional()
  processingDelayMinutes?: number;
}

export class EnterpriseMetricsDto {
  @ApiProperty({ description: 'Distributed cluster metrics' })
  distributed: {
    totalNodes: number;
    healthyNodes: number;
    clusterHealth: string;
  };

  @ApiProperty({ description: 'Enterprise-specific metrics' })
  enterprise: {
    activePartitions: number;
    crossRegionEvents: number;
    complianceJobs: number;
    averageLatency: number;
  };

  @ApiProperty({ description: 'Metrics timestamp' })
  timestamp: Date;
}
```

## Usage Example

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { EnterpriseSchedulingModule } from './enterprise-scheduling/enterprise-scheduling.module';

@Module({
  imports: [
    EnterpriseSchedulingModule,
    // Other enterprise modules...
  ],
})
export class AppModule {}
```

```typescript
// usage-example.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { EnterpriseSchedulingService } from './enterprise-scheduling/enterprise-scheduling.service';

@Injectable()
export class EnterpriseUsageService {
  private readonly logger = new Logger(EnterpriseUsageService.name);

  async demonstrateEnterpriseScheduling(): Promise<void> {
    try {
      // ⭐ FOCUS: Get service through VytchesDDD container
      const enterpriseScheduler =
        VytchesDDD.resolve<EnterpriseSchedulingService>(
          'enterpriseSchedulingService'
        );

      if (!enterpriseScheduler) {
        throw new Error('Enterprise scheduling service not available');
      }

      // Schedule enterprise order with distributed coordination
      const enterpriseOrderResult =
        await enterpriseScheduler.scheduleEnterpriseOrder(
          'ENT-ORDER-789',
          {
            orderId: 'ENT-ORDER-789',
            customerId: 'ENTERPRISE-CLIENT-456',
            customerTier: 'enterprise',
            orderValue: 500000,
            currency: 'USD',
            regulatedIndustry: true,
            complianceLevel: 'critical',
            priorityProcessing: true,
            crossBorderTransaction: true,
          },
          30 // 30 minutes processing delay
        );

      if (enterpriseOrderResult.isSuccess()) {
        this.logger.log(
          `Enterprise order scheduled: ${enterpriseOrderResult.value}`
        );
      }

      // Schedule compliance reporting
      const complianceResult =
        await enterpriseScheduler.scheduleComplianceReporting(
          'SOX-404-Q4',
          {
            regulationType: 'SOX-404',
            regulatoryDeadline: new Date('2024-01-31'),
            originRegion: 'us-east-1',
            dataRequirements: ['financial-statements', 'internal-controls'],
            auditTrail: true,
            encryptionRequired: true,
            retentionPeriod: 7,
          },
          new Date('2024-01-31')
        );

      if (complianceResult.isSuccess()) {
        this.logger.log(
          `Compliance report scheduled: ${complianceResult.value}`
        );
      }

      // Schedule cross-border transaction
      const crossBorderResult =
        await enterpriseScheduler.scheduleCrossBorderTransaction(
          'XBORDER-TXN-123',
          'us-east-1',
          'eu-west-1',
          {
            amount: 1000000,
            sourceCurrency: 'USD',
            targetCurrency: 'EUR',
            transactionType: 'wire-transfer',
            complianceChecks: ['AML', 'KYC', 'OFAC'],
            regulatoryRequirements: ['MiFID-II', 'PSD2'],
          },
          60 // 1 hour processing delay
        );

      if (crossBorderResult.isSuccess()) {
        this.logger.log(
          `Cross-border transaction scheduled: ${crossBorderResult.value}`
        );
      }

      // Get comprehensive enterprise metrics
      const metrics = await enterpriseScheduler.getEnterpriseMetrics();
      this.logger.log('Enterprise Metrics:', {
        totalNodes: metrics.enterprise.totalNodes,
        activePartitions: metrics.enterprise.activePartitions,
        crossRegionEvents: metrics.enterprise.crossRegionEvents,
        averageLatency: metrics.enterprise.averageLatency,
      });

      // Perform advanced health check
      const healthStatus =
        await enterpriseScheduler.performAdvancedHealthCheck();
      this.logger.log(`Enterprise scheduler health: ${healthStatus.overall}`);
    } catch (error) {
      this.logger.error(
        `Enterprise scheduling demonstration failed: ${error.message}`
      );
    }
  }
}
```

## Key Features

- **VytchesDDD Integration**: Full integration with @vytches-ddd/di container
  and service resolution
- **Distributed Scheduling**: Multi-node coordination with partition management
  and leader election
- **High Availability**: Critical events use HA scheduling with replication and
  consensus
- **Enterprise Compliance**: Built-in regulatory compliance with audit trails
  and encryption
- **Global Coordination**: Cross-region transaction processing with regulatory
  compliance
- **Advanced Health Checks**: Comprehensive health monitoring with dependency
  validation
- **Enterprise Metrics**: Detailed performance and operational metrics
- **Domain Events**: Integration with VytchesDDD event system for audit trails

## Common Pitfalls

- **Container Initialization**: Ensure VytchesDDD container is configured before
  service resolution
- **Service Dependencies**: Verify all required services are registered in the
  container
- **Module Lifecycle**: Properly handle async initialization in OnModuleInit
- **Error Handling**: Handle service resolution failures gracefully
- **Resource Management**: Monitor distributed scheduler resources and health

## Related Examples

- [Basic NestJS Integration](../basic/example-1.md) - Simple manual setup
  patterns
- [NestJS Enterprise Platform](../advanced/example-1.md) - Full enterprise
  architecture
- [Distributed Event Scheduling](../../../intermediate/example-1.md) - Core
  distributed concepts
- [Enterprise Scheduling Platform](../../../advanced/example-1.md) - Global
  coordination patterns
