# NestJS Saga Orchestration with VytchesDDD DI Integration

**Version**: 1.0.0  
**Package**: @vytches-ddd/messaging  
**Framework**: NestJS  
**Complexity**: Intermediate  
**Focus**: Advanced DI integration using @vytches-ddd/di with saga orchestration

## Description

This example demonstrates advanced integration of saga orchestration with NestJS
using @vytches-ddd/di service locator pattern, showcasing the bridge pattern for
enterprise-grade dependency management.

## Business Context

A travel booking platform orchestrates complex multi-service transactions
(flights, hotels, cars) using sagas with VytchesDDD DI for enterprise-grade
service management and cross-cutting concerns.

## Code Example

```typescript
// travel-booking-saga.service.ts - VytchesDDD DI managed
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { BaseSaga, ISagaExecutionContext } from '@vytches-ddd/messaging';
import { Result } from '@vytches-ddd/utils';
import { TravelBookingData } from './types'; // From your application

@DomainService({
  serviceId: 'travelBookingSaga',
  lifetime: ServiceLifetime.Transient,
  context: 'TravelBooking',
  dependencies: [
    'flightService',
    'hotelService',
    'carService',
    'paymentService',
  ],
})
export class TravelBookingSagaService extends BaseSaga {
  constructor() {
    super('TravelBookingSaga', 'Travel Booking Orchestration');
    this.defineSteps();
  }

  protected defineSteps(): void {
    this.addStep({
      name: 'ReserveFlight',
      handler: async ctx => {
        const flightService =
          VytchesDDD.resolve<IFlightService>('flightService');
        const reservation = await flightService.reserve(
          ctx.sagaData.flightData
        );

        return {
          success: true,
          updatedData: {
            ...ctx.sagaData,
            flightReservationId: reservation.id,
          },
          events: [
            {
              eventType: 'FlightReserved',
              payload: reservation,
            },
          ],
        };
      },
      compensator: async ctx => {
        const flightService =
          VytchesDDD.resolve<IFlightService>('flightService');
        await flightService.cancel(ctx.sagaData.flightReservationId);
        return { success: true };
      },
    });

    this.addStep({
      name: 'ReserveHotel',
      handler: async ctx => {
        const hotelService = VytchesDDD.resolve<IHotelService>('hotelService');
        const reservation = await hotelService.reserve(ctx.sagaData.hotelData);

        return {
          success: true,
          updatedData: {
            ...ctx.sagaData,
            hotelReservationId: reservation.id,
          },
        };
      },
      compensator: async ctx => {
        const hotelService = VytchesDDD.resolve<IHotelService>('hotelService');
        await hotelService.cancel(ctx.sagaData.hotelReservationId);
        return { success: true };
      },
    });
  }
}

// travel-booking.service.ts - NestJS bridge service
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { Result } from '@vytches-ddd/utils';
import { TravelBookingRequest, BookingConfirmation } from './types'; // From your application

@Injectable()
export class TravelBookingService {
  private sagaService: TravelBookingSagaService;

  constructor() {
    // ⭐ Bridge Pattern: Get VytchesDDD managed instance
    this.sagaService =
      VytchesDDD.resolve<TravelBookingSagaService>('travelBookingSaga');
  }

  async bookTravel(
    request: TravelBookingRequest
  ): Promise<Result<BookingConfirmation, Error>> {
    try {
      // Delegate to VytchesDDD managed saga service
      const result = await this.sagaService.executeSaga({
        correlationId: request.id,
        sagaData: request,
        timeout: 300000,
      });

      if (result.success) {
        return Result.success({
          bookingId: result.sagaId,
          status: 'completed',
          confirmations: result.completedSteps,
        });
      }

      return Result.failure(new Error(result.error));
    } catch (error) {
      return Result.failure(error);
    }
  }
}

// travel-booking.controller.ts - Standard NestJS controller
import { Controller, Post, Body } from '@nestjs/common';
import { TravelBookingService } from './travel-booking.service';
import { BookTravelDto } from './dto'; // From your application

@Controller('travel')
export class TravelBookingController {
  constructor(private readonly bookingService: TravelBookingService) {}

  @Post('book')
  async bookTravel(@Body() dto: BookTravelDto) {
    const result = await this.bookingService.bookTravel(dto);

    if (result.isSuccess()) {
      return {
        success: true,
        booking: result.getValue(),
      };
    }

    return {
      success: false,
      error: result.getError().message,
    };
  }
}

// domain-services.ts - VytchesDDD managed domain services
import { DomainService, VytchesDDD } from '@vytches-ddd/di';
import { Resilience } from '@vytches-ddd/resilience';

@DomainService('flightService', {
  lifetime: ServiceLifetime.Singleton,
  timeout: 30000,
})
export class FlightService implements IFlightService {
  @Resilience({ circuitBreaker: true, retry: { maxAttempts: 3 } })
  async reserve(flightData: FlightData): Promise<FlightReservation> {
    // Integration with flight booking API
    return await this.externalFlightApi.reserve(flightData);
  }

  async cancel(reservationId: string): Promise<void> {
    await this.externalFlightApi.cancel(reservationId);
  }
}

@DomainService('hotelService', {
  lifetime: ServiceLifetime.Singleton,
  dependencies: ['hotelApiClient'],
})
export class HotelService implements IHotelService {
  async reserve(hotelData: HotelData): Promise<HotelReservation> {
    const apiClient = VytchesDDD.resolve<IHotelApiClient>('hotelApiClient');
    return await apiClient.makeReservation(hotelData);
  }

  async cancel(reservationId: string): Promise<void> {
    const apiClient = VytchesDDD.resolve<IHotelApiClient>('hotelApiClient');
    await apiClient.cancelReservation(reservationId);
  }
}

// travel.module.ts - NestJS module with VytchesDDD integration
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { TravelBookingController } from './travel-booking.controller';
import { TravelBookingService } from './travel-booking.service';

@Module({
  controllers: [TravelBookingController],
  providers: [TravelBookingService],
})
export class TravelModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD before framework DI
    await VytchesDDD.configure();
  }
}
```

## Key Features

- **VytchesDDD DI Integration**: Use @DomainService decorators for enterprise
  service management
- **Bridge Pattern**: NestJS services delegate to VytchesDDD managed instances
- **Cross-Cutting Concerns**: Automatic timeout, resilience, and dependency
  management
- **Service Locator**: Resolve dependencies through VytchesDDD.resolve()
- **Enterprise Architecture**: Single source of truth for business services

## Benefits of VytchesDDD DI Integration

- **Enterprise Features**: Automatic timeout, retry, circuit breaker patterns
- **Context Isolation**: Bounded context support for complex domains
- **Auto-Discovery**: Services automatically registered through decorators
- **Centralized Management**: Single service locator for all business services

## Bridge Pattern Best Practices

1. **VytchesDDD First**: Always initialize VytchesDDD container before NestJS
2. **Single Instance**: Use factory pattern to get existing instances
3. **No Dual Decorators**: Either @DomainService OR @Injectable, never both
4. **Business Logic in Domain**: Keep functionality in @DomainService classes

## Related Examples

- [Manual Setup](/packages/messaging/src/examples/frameworks/nestjs/basic/example-1.md)
- [DI Integration Patterns](/packages/di/src/examples/frameworks/nestjs/intermediate/example-1.md)
- [Advanced Saga Patterns](/packages/messaging/src/examples/advanced/example-1.md)
