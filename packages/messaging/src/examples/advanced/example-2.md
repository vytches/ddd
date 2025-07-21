# Real-time Stream Processing with Complex Event Processing

**Version**: 1.0.0  
**Package**: @vytches-ddd/messaging  
**Complexity**: Advanced  
**Domain**: IoT and Smart City Infrastructure  
**Patterns**: Complex Event Processing (CEP), Stream Processing, Pattern Detection  
**Dependencies**: @vytches-ddd/messaging, @vytches-ddd/events, @vytches-ddd/policies

## Description

This example demonstrates building a sophisticated stream processing system that can detect complex patterns in real-time event streams, aggregate data from multiple sources, and trigger automated responses based on detected patterns.

## Business Context

A smart city platform processes millions of events from IoT sensors, traffic systems, and public services. The system must detect patterns like traffic congestion, emergency situations, and infrastructure failures in real-time to enable immediate response.

## Code Example

```typescript
// complex-event-processor.ts
import { 
  StreamProcessor,
  EventPattern,
  WindowedAggregator,
  PatternMatcher
} from '@vytches-ddd/messaging';
import { PolicyEngine } from '@vytches-ddd/policies';

export class ComplexEventProcessor {
  private patterns: Map<string, EventPattern> = new Map();
  private aggregators: Map<string, WindowedAggregator> = new Map();

  constructor(
    private policyEngine: PolicyEngine,
    private actionDispatcher: IActionDispatcher
  ) {
    this.initializePatterns();
    this.initializeAggregators();
  }

  private initializePatterns(): void {
    // Traffic congestion pattern
    this.patterns.set('traffic-congestion', {
      name: 'TrafficCongestionPattern',
      conditions: [
        {
          eventType: 'VehicleSpeedReading',
          window: { duration: 300000, type: 'sliding' }, // 5 minutes
          aggregate: 'average',
          predicate: (avg) => avg < 10 // km/h
        },
        {
          eventType: 'TrafficDensityReading',
          window: { duration: 300000, type: 'sliding' },
          aggregate: 'percentile',
          percentile: 90,
          predicate: (p90) => p90 > 0.8 // 80% capacity
        }
      ],
      correlation: 'location.district',
      action: this.handleTrafficCongestion.bind(this)
    });

    // Emergency response pattern
    this.patterns.set('emergency-cascade', {
      name: 'EmergencyCascadePattern',
      sequence: [
        {
          eventType: 'EmergencyCall',
          within: 0 // Start of sequence
        },
        {
          eventType: 'AmbulanceDispatched',
          within: 120000 // Within 2 minutes
        },
        {
          eventType: 'TrafficLightOverride',
          within: 30000, // Within 30 seconds of dispatch
          optional: true
        }
      ],
      timeout: 300000, // 5 minute window
      action: this.optimizeEmergencyResponse.bind(this)
    });

    // Infrastructure failure pattern
    this.patterns.set('infrastructure-failure', {
      name: 'InfrastructureFailurePattern',
      complex: {
        expression: `
          (PowerOutage WHERE duration > 60000) 
          AND 
          (NetworkFailure WHERE affected_nodes > 10)
          WITHIN 5 MINUTES
        `,
        variables: {
          PowerOutage: { eventType: 'PowerGridEvent', severity: 'critical' },
          NetworkFailure: { eventType: 'NetworkEvent', status: 'down' }
        }
      },
      action: this.handleInfrastructureFailure.bind(this)
    });
  }

  // Process incoming event stream
  async processEventStream(eventStream: AsyncIterable<Event>): Promise<void> {
    const matcher = new PatternMatcher(this.patterns);
    
    for await (const event of eventStream) {
      // Update aggregators
      await this.updateAggregators(event);
      
      // Check for pattern matches
      const matches = await matcher.match(event);
      
      for (const match of matches) {
        await this.handlePatternMatch(match);
      }
      
      // Real-time anomaly detection
      await this.detectAnomalies(event);
    }
  }

  // Windowed aggregation for real-time analytics
  private initializeAggregators(): void {
    // Traffic flow aggregator
    this.aggregators.set('traffic-flow', new WindowedAggregator({
      windowSize: 300000, // 5 minutes
      slideInterval: 60000, // 1 minute
      aggregations: [
        {
          name: 'avgSpeed',
          type: 'average',
          field: 'speed'
        },
        {
          name: 'vehicleCount',
          type: 'count'
        },
        {
          name: 'congestionIndex',
          type: 'custom',
          calculator: (events) => {
            const avgSpeed = events.avg('speed');
            const density = events.count() / events.get('laneCapacity');
            return (1 - avgSpeed / 50) * density; // Custom formula
          }
        }
      ]
    }));

    // Energy consumption aggregator
    this.aggregators.set('energy-consumption', new WindowedAggregator({
      windowSize: 3600000, // 1 hour
      slideInterval: 300000, // 5 minutes
      aggregations: [
        {
          name: 'totalConsumption',
          type: 'sum',
          field: 'consumption'
        },
        {
          name: 'peakDemand',
          type: 'max',
          field: 'demand'
        },
        {
          name: 'efficiency',
          type: 'custom',
          calculator: (events) => {
            const produced = events.sum('production');
            const consumed = events.sum('consumption');
            return produced > 0 ? (consumed / produced) : 0;
          }
        }
      ]
    }));
  }

  // Handle detected traffic congestion
  private async handleTrafficCongestion(match: PatternMatch): Promise<void> {
    const { location, severity, data } = match;
    
    // Apply traffic management policy
    const policy = await this.policyEngine.evaluate('traffic-management', {
      location,
      severity,
      timeOfDay: new Date().getHours(),
      currentConditions: data
    });

    const actions = policy.recommendedActions;
    
    // Execute coordinated response
    await Promise.all([
      // Adjust traffic light timing
      this.actionDispatcher.dispatch({
        type: 'AdjustTrafficLights',
        payload: {
          district: location.district,
          pattern: actions.lightPattern,
          duration: actions.duration
        }
      }),
      
      // Update navigation systems
      this.actionDispatcher.dispatch({
        type: 'UpdateNavigation',
        payload: {
          affectedRoutes: actions.affectedRoutes,
          alternativeRoutes: actions.alternatives,
          estimatedClearTime: actions.estimatedClearTime
        }
      }),
      
      // Notify public transport
      this.actionDispatcher.dispatch({
        type: 'NotifyPublicTransport',
        payload: {
          routes: actions.affectedBusRoutes,
          action: 'reroute',
          reason: 'congestion'
        }
      })
    ]);
  }

  // Machine learning anomaly detection
  private async detectAnomalies(event: Event): Promise<void> {
    const aggregator = this.aggregators.get(event.source);
    if (!aggregator) return;

    const statistics = aggregator.getStatistics();
    const prediction = await this.mlModel.predict({
      current: event.value,
      historical: statistics,
      contextual: await this.getContextualData(event)
    });

    if (prediction.isAnomaly && prediction.confidence > 0.9) {
      await this.handleAnomaly({
        event,
        prediction,
        severity: this.calculateSeverity(prediction),
        suggestedActions: await this.generateResponseActions(prediction)
      });
    }
  }

  // Complex stream joining and correlation
  async createMultiStreamProcessor(): Promise<MultiStreamProcessor> {
    return new MultiStreamProcessor({
      streams: [
        {
          name: 'traffic',
          source: 'traffic-sensors',
          keyExtractor: (e) => e.location.intersection
        },
        {
          name: 'weather',
          source: 'weather-stations',
          keyExtractor: (e) => e.location.district
        },
        {
          name: 'events',
          source: 'city-events',
          keyExtractor: (e) => e.venue.district
        }
      ],
      
      joinStrategy: 'temporal', // Join events within time window
      joinWindow: 600000, // 10 minutes
      
      processor: async (joined) => {
        // Correlate traffic with weather and events
        const analysis = {
          traffic: joined.traffic,
          weather: joined.weather,
          events: joined.events,
          correlation: this.calculateCorrelation(joined)
        };

        // Predictive analysis
        if (analysis.correlation.weatherImpact > 0.7) {
          await this.triggerWeatherResponse(analysis);
        }

        if (analysis.correlation.eventImpact > 0.8) {
          await this.triggerEventTrafficManagement(analysis);
        }

        return analysis;
      }
    });
  }
}

// Stream processing pipeline
export class SmartCityStreamPipeline {
  private processors: StreamProcessor[] = [];

  async buildPipeline(): Promise<void> {
    // Stage 1: Data ingestion and validation
    this.addProcessor(new ValidationProcessor({
      schemas: this.loadSchemas(),
      onInvalid: async (event) => {
        await this.dlq.send(event);
      }
    }));

    // Stage 2: Enrichment
    this.addProcessor(new EnrichmentProcessor({
      enrichers: [
        new LocationEnricher(), // Add geo data
        new HistoricalEnricher(), // Add historical context
        new MLPredictionEnricher() // Add ML predictions
      ]
    }));

    // Stage 3: Complex event processing
    this.addProcessor(new ComplexEventProcessor(
      this.policyEngine,
      this.actionDispatcher
    ));

    // Stage 4: Real-time analytics
    this.addProcessor(new AnalyticsProcessor({
      metrics: ['throughput', 'latency', 'accuracy'],
      dashboards: ['operations', 'executive', 'public']
    }));
  }

  async processStream(input: EventStream): Promise<void> {
    let stream = input;
    
    for (const processor of this.processors) {
      stream = await processor.process(stream);
    }
  }
}
```

## Key Features

- **Complex Event Processing**: Detect patterns across multiple event streams
- **Windowed Aggregation**: Real-time analytics with sliding windows
- **Pattern Matching**: Sophisticated pattern detection with temporal constraints
- **Stream Correlation**: Join and correlate multiple event streams
- **ML Integration**: Anomaly detection and predictive analytics

## Common Pitfalls

- **Memory Management**: Windowed aggregations can consume significant memory
- **Pattern Complexity**: Overly complex patterns can impact performance
- **Late Events**: Handle out-of-order events in stream processing
- **State Management**: Ensure pattern state survives processor restarts

## Related Examples

- [Event Store Streaming](/packages/event-store/src/examples/advanced/example-2.md)
- [Real-time CQRS Projections](/packages/projections/src/examples/advanced/example-1.md)
- [Policy-Driven Automation](/packages/policies/src/examples/advanced/example-2.md)