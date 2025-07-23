# NestJS Enterprise Event Mesh with Global Coordination

**Version**: 1.0.0  
**Package**: @vytches-ddd/messaging  
**Framework**: NestJS  
**Complexity**: Advanced  
**Focus**: Enterprise event mesh architecture with VytchesDDD DI and global
coordination

## Description

This example demonstrates building an enterprise-scale event mesh in NestJS with
global coordination, multi-region saga orchestration, and advanced VytchesDDD DI
integration for complex distributed systems.

## Business Context

A global financial trading platform requires ultra-low latency event mesh
spanning multiple regions, coordinating trades, risk management, and regulatory
compliance across different markets with enterprise-grade service management.

## Code Example

```typescript
// global-event-mesh.service.ts - VytchesDDD DI managed service
import { DomainService, ServiceLifetime, VytchesDDD } from '@vytches-ddd/di';
import {
  EventMesh,
  GlobalSagaCoordinator,
  StreamProcessor,
} from '@vytches-ddd/messaging';
import { Resilience } from '@vytches-ddd/resilience';
import { TradeRequest, RiskMetrics } from './types'; // From your application

@DomainService({
  serviceId: 'globalEventMesh',
  lifetime: ServiceLifetime.Singleton,
  context: 'TradingPlatform',
  dependencies: ['riskEngine', 'complianceService'],
  timeout: 30000,
})
export class GlobalEventMeshService {
  private eventMesh: EventMesh;
  private sagaCoordinator: GlobalSagaCoordinator;

  constructor() {
    this.initializeEventMesh();
  }

  @Resilience({
    circuitBreaker: { failureThreshold: 5 },
    retry: { maxAttempts: 3 },
  })
  async initializeEventMesh(): Promise<void> {
    this.eventMesh = new EventMesh({
      topology: 'full-mesh',
      regions: [
        { id: 'us-east', location: 'NYSE' },
        { id: 'eu-west', location: 'LSE' },
        { id: 'asia-pac', location: 'TSE' },
      ],
    });

    this.sagaCoordinator = new GlobalSagaCoordinator({
      regions: ['us-east', 'eu-west', 'asia-pac'],
      serviceLocator: VytchesDDD.resolve.bind(VytchesDDD),
    });
  }

  async executeGlobalTrade(request: TradeRequest): Promise<TradeResult> {
    const saga = new CrossBorderTradeSaga({
      id: `trade-${request.id}`,
      regions: this.determineAffectedRegions(request),
    });

    return await this.sagaCoordinator.executeSaga(saga);
  }
}

// trade-coordination.service.ts - NestJS bridge service
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { TradeExecutionRequest } from './types'; // From your application

@Injectable()
export class TradeCoordinationService {
  private globalMesh: GlobalEventMeshService;

  constructor() {
    // ⭐ Bridge Pattern: Get VytchesDDD managed instance
    this.globalMesh =
      VytchesDDD.resolve<GlobalEventMeshService>('globalEventMesh');
  }

  async executeGlobalTrade(
    request: TradeExecutionRequest
  ): Promise<TradeResult> {
    return await this.globalMesh.executeGlobalTrade(request);
  }
}

// trading.controller.ts - NestJS controller
import { Controller, Post, Body } from '@nestjs/common';
import { TradeCoordinationService } from './trade-coordination.service';
import { ExecuteTradeDto } from './dto'; // From your application

@Controller('trading')
export class TradingController {
  constructor(private readonly tradeCoordination: TradeCoordinationService) {}

  @Post('execute-global')
  async executeGlobalTrade(@Body() dto: ExecuteTradeDto) {
    try {
      const result = await this.tradeCoordination.executeGlobalTrade(dto);
      return { success: true, trade: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// trading.module.ts - NestJS module with VytchesDDD integration
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { TradingController } from './trading.controller';
import { TradeCoordinationService } from './trade-coordination.service';

@Module({
  controllers: [TradingController],
  providers: [TradeCoordinationService],
})
export class TradingModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD with global coordination
    await VytchesDDD.configure({
      enableGlobalCoordination: true,
      regions: ['us-east', 'eu-west', 'asia-pac'],
    });
  }
}
```

## Key Features

- **Global Event Mesh**: Multi-region event coordination
- **Enterprise DI Integration**: VytchesDDD service locator with cross-cutting
  concerns
- **Distributed Sagas**: Cross-region saga coordination
- **Bridge Pattern**: Clean separation between NestJS and business logic

## Related Examples

- [Intermediate Saga Integration](/packages/messaging/src/examples/frameworks/nestjs/intermediate/example-1.md)
- [Enterprise Event Mesh](/packages/messaging/src/examples/advanced/example-1.md)
