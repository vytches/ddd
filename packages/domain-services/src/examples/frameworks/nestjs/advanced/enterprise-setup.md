# Enterprise NestJS Integration - Advanced

**Focus**: Complete enterprise setup with all features **Base Example**:
[Enterprise Domain Service](../../../advanced/example-3.md) **Dependencies**:
@nestjs/common, @vytches/ddd-core, @vytches/ddd-enterprise

## Service Implementation

```typescript
// enterprise-order-nestjs.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { Logger } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';
import {
  Order,
  CreateOrderCommand,
  OrderProcessingResult,
  OrderProcessingContext,
  EnterpriseOrderService,
} from '../types';

@Injectable()
export class EnterpriseOrderNestJSService {
  private readonly enterpriseOrderService: EnterpriseOrderService;
  private readonly logger: Logger;

  constructor() {
    // ⭐ FOCUS: Enterprise service resolution
    this.enterpriseOrderService = VytchesDDD.resolve<EnterpriseOrderService>(
      'enterpriseOrderService'
    );
    this.logger = Logger.forContext('EnterpriseOrderNestJSService');
  }

  /**
   * Processes enterprise order with full NestJS integration
   */
  async processEnterpriseOrder(
    command: CreateOrderCommand,
    correlationId: string,
    userId: string,
    requestId: string
  ): Promise<Result<OrderProcessingResult, Error>> {
    this.logger.info('Processing enterprise order through NestJS', {
      orderId: command.orderId,
      correlationId,
      userId,
      requestId,
    });

    try {
      // ⭐ FOCUS: Context preparation for enterprise service
      const context: OrderProcessingContext = {
        userId,
        correlationId,
        requestId,
        timestamp: new Date(),
        source: 'NestJS-API',
        priority: 'normal',
      };

      // ⭐ FOCUS: Delegate to enterprise domain service
      const result = await this.enterpriseOrderService.processEnterpriseOrder(
        command,
        context
      );

      if (result.isFailure()) {
        this.logger.error('Enterprise order processing failed', {
          orderId: command.orderId,
          correlationId,
          error: result.error.message,
        });

        return Result.failure(result.error);
      }

      this.logger.info('Enterprise order processed successfully', {
        orderId: result.value.orderId,
        correlationId,
        status: result.value.status,
      });

      return Result.success(result.value);
    } catch (error) {
      this.logger.error('Unexpected error in NestJS service', {
        orderId: command.orderId,
        correlationId,
        error: error.message,
      });

      return Result.failure(
        new Error(`NestJS service error: ${error.message}`)
      );
    }
  }

  /**
   * Gets service health status
   */
  async getHealthStatus(): Promise<Result<any, Error>> {
    try {
      // ⭐ FOCUS: Health check delegation
      const healthResult = await this.enterpriseOrderService.healthCheck();

      if (healthResult.isFailure()) {
        return Result.failure(healthResult.error);
      }

      return Result.success({
        ...healthResult.value,
        nestjsIntegration: 'healthy',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return Result.failure(new Error(`Health check failed: ${error.message}`));
    }
  }

  /**
   * Gets comprehensive service metrics
   */
  async getServiceMetrics(): Promise<any> {
    try {
      // ⭐ FOCUS: Metrics aggregation
      const enterpriseMetrics =
        await this.enterpriseOrderService.getServiceMetrics();

      return {
        ...enterpriseMetrics,
        nestjsIntegration: {
          version: process.env.npm_package_version,
          nodeVersion: process.version,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get service metrics', {
        error: error.message,
      });

      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
```

## Controller Integration

```typescript
// enterprise-order.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EnterpriseOrderNestJSService } from './enterprise-order-nestjs.service';
import { CreateOrderCommand } from '../types';

@Controller('enterprise/orders')
export class EnterpriseOrderController {
  constructor(
    private readonly enterpriseOrderService: EnterpriseOrderNestJSService
  ) {}

  @Post()
  async processOrder(
    @Body() command: CreateOrderCommand,
    @Headers('x-correlation-id') correlationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-request-id') requestId: string
  ) {
    // ⭐ FOCUS: Enterprise request handling
    const result = await this.enterpriseOrderService.processEnterpriseOrder(
      command,
      correlationId || this.generateCorrelationId(),
      userId,
      requestId || this.generateRequestId()
    );

    if (result.isFailure()) {
      throw new HttpException(
        {
          message: result.error.message,
          correlationId,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return {
      success: true,
      data: result.value,
      correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  async healthCheck() {
    // ⭐ FOCUS: Health check endpoint
    const result = await this.enterpriseOrderService.getHealthStatus();

    if (result.isFailure()) {
      throw new HttpException(
        {
          message: 'Service unhealthy',
          error: result.error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    return {
      success: true,
      data: result.value,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  async getMetrics() {
    // ⭐ FOCUS: Metrics endpoint
    const metrics = await this.enterpriseOrderService.getServiceMetrics();

    return {
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    };
  }

  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Module Configuration

```typescript
// enterprise-order.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { Logger } from '@vytches/ddd-logging';
import { EnterpriseOrderController } from './enterprise-order.controller';
import { EnterpriseOrderNestJSService } from './enterprise-order-nestjs.service';

@Module({
  controllers: [EnterpriseOrderController],
  providers: [EnterpriseOrderNestJSService],
  exports: [EnterpriseOrderNestJSService],
})
export class EnterpriseOrderModule implements OnModuleInit {
  private readonly logger = Logger.forContext('EnterpriseOrderModule');

  async onModuleInit() {
    try {
      // ⭐ CRITICAL: Initialize VytchesDDD enterprise features
      await VytchesDDD.configure({
        enableAutoDiscovery: true,
        enableLogging: true,
        enableMetrics: true,
        enableHealthChecks: true,
        contexts: [
          'OrderManagement',
          'PaymentProcessing',
          'InventoryManagement',
        ],
      });

      this.logger.info('Enterprise module initialized successfully', {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to initialize enterprise module', {
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }
}
```

## Application Bootstrap

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { Logger } from '@vytches/ddd-logging';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = Logger.forContext('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);

    // ⭐ FOCUS: Enterprise application setup
    app.enableCors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-correlation-id',
        'x-user-id',
        'x-request-id',
      ],
    });

    // Global middleware for enterprise features
    app.use((req, res, next) => {
      // Add correlation ID if not present
      if (!req.headers['x-correlation-id']) {
        req.headers['x-correlation-id'] =
          `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Add request ID if not present
      if (!req.headers['x-request-id']) {
        req.headers['x-request-id'] =
          `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      next();
    });

    const port = process.env.PORT || 3000;
    await app.listen(port);

    logger.info('Enterprise application started successfully', {
      port,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to start enterprise application', {
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    process.exit(1);
  }
}

bootstrap();
```

## Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build application
RUN npm run build

# Production image
FROM node:18-alpine AS production

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/enterprise/orders/health || exit 1

# Run application
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## Environment Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  enterprise-order-service:
    build: .
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - PORT=3000
      - ALLOWED_ORIGINS=http://localhost:3000,https://app.company.com
      - LOG_LEVEL=info
      - ENABLE_METRICS=true
      - ENABLE_HEALTH_CHECKS=true
    networks:
      - enterprise-network
    depends_on:
      - postgres
      - redis
      - eventstore

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=orders
      - POSTGRES_USER=orderuser
      - POSTGRES_PASSWORD=orderpass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - enterprise-network

  redis:
    image: redis:7-alpine
    networks:
      - enterprise-network

  eventstore:
    image: eventstore/eventstore:21.10.0-buster-slim
    environment:
      - EVENTSTORE_CLUSTER_SIZE=1
      - EVENTSTORE_RUN_PROJECTIONS=All
      - EVENTSTORE_START_STANDARD_PROJECTIONS=true
    ports:
      - '2113:2113'
    networks:
      - enterprise-network

volumes:
  postgres_data:

networks:
  enterprise-network:
    driver: bridge
```

## Key Points

- **Enterprise Integration**: Complete enterprise setup with all VytchesDDD
  features
- **Service Resolution**: Uses VytchesDDD.resolve() for enterprise service
  access
- **Context Propagation**: Proper context creation and propagation
- **Health Checks**: Comprehensive health monitoring
- **Metrics Collection**: Enterprise-grade metrics aggregation
- **Correlation Tracking**: Full request correlation and tracing
- **Docker Support**: Production-ready containerization
- **Environment Configuration**: Complete deployment setup

## Related Examples

- [DI Integration](../intermediate/di-integration.md) - Advanced dependency
  injection
- [Enterprise Domain Service](../../../advanced/example-3.md) - Core enterprise
  patterns
- [Enterprise examples](../../../../../enterprise/examples/) - Complete
  enterprise features
