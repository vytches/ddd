# Saga Pattern Implementation

**Version**: 1.0.0  
**Package**: @vytches-ddd/messaging  
**Complexity**: Intermediate  
**Domain**: Travel Booking System  
**Patterns**: Saga Pattern, Compensating Transactions, State Machine  
**Dependencies**: @vytches-ddd/messaging, @vytches-ddd/events, @vytches-ddd/core

## Description

This example demonstrates implementing the Saga pattern for managing distributed transactions across multiple services. It shows how to coordinate complex workflows with compensating actions when failures occur.

## Business Context

A travel booking system needs to coordinate flight booking, hotel reservation, and car rental. If any step fails, previous steps must be compensated (cancelled). The saga pattern ensures consistency across these distributed services without using distributed transactions.

## Code Example

```typescript
// travel-booking-saga.ts
import { BaseSaga, SagaStatus, ISagaExecutionContext } from '@vytches-ddd/messaging';
import { IExtendedDomainEvent } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { Order, Customer } from './types';

export class TravelBookingSaga extends BaseSaga {
  constructor() {
    super('TravelBookingSaga', 'Travel Booking Coordination');
  }

  // Define saga workflow steps
  protected defineSteps(): void {
    this.addStep({
      name: 'ReserveFlight',
      handler: this.reserveFlight.bind(this),
      compensator: this.cancelFlight.bind(this),
      timeout: 30000
    });

    this.addStep({
      name: 'ReserveHotel',
      handler: this.reserveHotel.bind(this),
      compensator: this.cancelHotel.bind(this),
      timeout: 20000
    });

    this.addStep({
      name: 'ReserveCar',
      handler: this.reserveCar.bind(this),
      compensator: this.cancelCar.bind(this),
      timeout: 15000
    });

    this.addStep({
      name: 'ProcessPayment',
      handler: this.processPayment.bind(this),
      compensator: this.refundPayment.bind(this),
      timeout: 45000
    });

    this.addStep({
      name: 'SendConfirmation',
      handler: this.sendConfirmation.bind(this),
      compensator: undefined, // No compensation needed
      timeout: 5000
    });
  }

  async handleEvent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    switch (event.eventType) {
      case 'BookingRequested':
        return this.startBookingProcess(event, context);
      
      case 'FlightReserved':
        return this.continueToHotel(event, context);
      
      case 'HotelReserved':
        return this.continueToCar(event, context);
      
      case 'CarReserved':
        return this.continueToPayment(event, context);
      
      case 'PaymentCompleted':
        return this.completeBooking(event, context);
      
      case 'StepFailed':
        return this.handleFailure(event, context);
      
      default:
        return { success: false, error: { message: 'Unknown event' } };
    }
  }

  private async reserveFlight(context: ISagaExecutionContext): Promise<ISagaActionResult> {
    const bookingData = context.sagaData as TravelBookingData;
    
    try {
      const flightService = context.getService<IFlightService>('flightService');
      const reservation = await flightService.reserve({
        from: bookingData.origin,
        to: bookingData.destination,
        date: bookingData.departureDate,
        passengers: bookingData.passengers
      });

      return {
        success: true,
        events: [{
          eventType: 'FlightReserved',
          payload: { 
            reservationId: reservation.id,
            flightNumber: reservation.flightNumber,
            price: reservation.price
          }
        }],
        updatedData: {
          ...context.sagaData,
          flightReservationId: reservation.id,
          flightPrice: reservation.price
        }
      };
    } catch (error) {
      return {
        success: false,
        error: { message: `Flight reservation failed: ${error.message}` }
      };
    }
  }

  private async cancelFlight(context: ISagaExecutionContext): Promise<ISagaActionResult> {
    const { flightReservationId } = context.sagaData as TravelBookingData;
    if (!flightReservationId) return { success: true };

    try {
      const flightService = context.getService<IFlightService>('flightService');
      await flightService.cancelReservation(flightReservationId);
      
      return {
        success: true,
        events: [{
          eventType: 'FlightCancelled',
          payload: { reservationId: flightReservationId }
        }]
      };
    } catch (error) {
      // Log but don't fail compensation
      console.error('Flight cancellation failed:', error);
      return { success: true };
    }
  }

  private async handleFailure(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    const { failedStep, error } = event.payload;
    
    // Start compensation from the failed step
    this.updateState({
      status: SagaStatus.COMPENSATING,
      currentStep: failedStep,
      error: error
    });

    // Trigger compensation process
    return {
      success: true,
      commands: [{
        type: 'StartCompensation',
        payload: { 
          sagaId: this.id,
          fromStep: failedStep
        }
      }],
      events: [{
        eventType: 'CompensationStarted',
        payload: { 
          sagaId: this.id,
          reason: error,
          failedStep
        }
      }]
    };
  }
}

// Service orchestrating saga execution
export class TravelBookingService {
  constructor(
    private sagaOrchestrator: ISagaOrchestrator,
    private eventBus: IEventBus
  ) {}

  async bookTravel(request: TravelBookingRequest): Promise<Result<BookingConfirmation, Error>> {
    // Create saga instance
    const saga = new TravelBookingSaga();
    saga.initialize({
      correlationId: request.requestId,
      userId: request.customerId,
      sagaData: {
        ...request,
        totalPrice: 0,
        status: 'pending'
      }
    });

    // Start saga execution
    await this.sagaOrchestrator.startSaga(saga);

    // Publish initiating event
    await this.eventBus.publish({
      eventType: 'BookingRequested',
      aggregateId: request.requestId,
      payload: request,
      metadata: {
        sagaId: saga.id,
        correlationId: request.requestId
      }
    });

    // Return saga ID for tracking
    return Result.success({
      bookingId: saga.id,
      status: 'processing',
      trackingUrl: `/bookings/${saga.id}/status`
    });
  }

  async getBookingStatus(sagaId: string): Promise<BookingStatus> {
    const saga = await this.sagaOrchestrator.getSaga(sagaId);
    
    return {
      id: saga.id,
      status: saga.getState().status,
      completedSteps: saga.getState().completedSteps,
      currentStep: saga.getState().currentStep,
      data: saga.getState().sagaData,
      error: saga.getState().error
    };
  }
}
```

## Key Features

- **Distributed Transaction Coordination**: Manages multi-service workflows
- **Automatic Compensation**: Rollback previous steps on failure
- **State Persistence**: Saga state survives service restarts
- **Timeout Handling**: Each step has configurable timeout
- **Event-Driven**: Loosely coupled communication between services

## Common Pitfalls

- **Missing Idempotency**: Both forward and compensating actions must be idempotent
- **Partial Failures**: Compensation might fail - need monitoring and manual intervention
- **State Consistency**: Ensure saga state is persisted before executing steps
- **Timeout Configuration**: Set appropriate timeouts based on service SLAs

## Related Examples

- [Advanced Saga Orchestration](/packages/messaging/src/examples/advanced/example-1.md)
- [Event Choreography](/packages/events/src/examples/intermediate/example-1.md)
- [Resilient Service Integration](/packages/resilience/src/examples/intermediate/example-1.md)