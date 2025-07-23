# Advanced Value Objects - Use Cases

**Version**: 2025-01-21
**Package**: @vytches-ddd/value-objects  
**Complexity**: Advanced
**Focus**: Real-world business scenarios and advanced applications

## Overview

This document presents advanced business use cases where sophisticated value objects provide critical functionality for complex enterprise systems, design platforms, and geospatial applications.

## Use Case 1: Event Management Platform

**Business Context**: Large-scale event management system handling conferences, concerts, and corporate events with complex scheduling requirements.

**Challenge**: Managing overlapping events, resource conflicts, venue capacity, and time zone coordination across global locations.

### Implementation Strategy

```typescript
// Event scheduling system
import { TimePeriod } from '../advanced/time-period';

class EventScheduler {
  private events = new Map<string, ScheduledEvent>();
  private venues = new Map<string, Venue>();

  scheduleEvent(eventRequest: EventRequest): EventSchedulingResult {
    // 1. Check venue availability
    const venue = this.venues.get(eventRequest.venueId);
    if (!venue) {
      return { success: false, reason: 'Venue not found' };
    }

    // 2. Create time period for the event
    const eventPeriod = TimePeriod.create(
      eventRequest.startTime,
      eventRequest.endTime,
      venue.timezone
    );

    // 3. Check for conflicts with existing events
    const conflicts = this.findConflictingEvents(eventRequest.venueId, eventPeriod);
    if (conflicts.length > 0) {
      return { 
        success: false, 
        reason: 'Time conflicts detected',
        conflicts: conflicts.map(c => c.id)
      };
    }

    // 4. Adjust for business hours if needed
    const adjustedPeriod = eventRequest.requireBusinessHours 
      ? eventPeriod.adjustToBusinessHours('09:00', '18:00')
      : eventPeriod;

    // 5. Create recurring events if specified
    const periods = eventRequest.recurrence
      ? adjustedPeriod.expandRecurrence(eventRequest.recurrenceEndDate!, 52)
      : [adjustedPeriod];

    // 6. Schedule all periods
    periods.forEach((period, index) => {
      const eventId = `${eventRequest.id}-${index}`;
      this.events.set(eventId, {
        id: eventId,
        name: eventRequest.name,
        period,
        venueId: eventRequest.venueId,
        organizerId: eventRequest.organizerId
      });
    });

    return { 
      success: true, 
      scheduledPeriods: periods.length,
      totalDuration: periods.reduce((sum, p) => sum + p.getDurationInHours(), 0)
    };
  }

  findOptimalTimeSlot(
    venueId: string,
    duration: number,
    preferredDate: Date
  ): TimePeriod | null {
    const venue = this.venues.get(venueId);
    if (!venue) return null;

    // Find next available slot of required duration
    const searchStart = new Date(preferredDate);
    const searchEnd = new Date(preferredDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 1 week

    for (let day = new Date(searchStart); day <= searchEnd; day.setDate(day.getDate() + 1)) {
      const daySchedule = this.getDaySchedule(venueId, day);
      const availableSlot = this.findAvailableSlot(daySchedule, duration);
      
      if (availableSlot) {
        return availableSlot;
      }
    }

    return null;
  }

  private findConflictingEvents(venueId: string, period: TimePeriod): ScheduledEvent[] {
    return Array.from(this.events.values())
      .filter(event => 
        event.venueId === venueId && 
        event.period.conflictsWith(period)
      );
  }

  private getDaySchedule(venueId: string, date: Date): TimePeriod[] {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return Array.from(this.events.values())
      .filter(event => event.venueId === venueId)
      .map(event => event.period)
      .filter(period => {
        const dayPeriod = TimePeriod.create(dayStart, dayEnd);
        return period.conflictsWith(dayPeriod);
      });
  }

  private findAvailableSlot(existingSlots: TimePeriod[], requiredDuration: number): TimePeriod | null {
    // Simple implementation - find gaps between existing slots
    const sorted = existingSlots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i].gap(sorted[i + 1]);
      if (gap && gap.getDurationInMinutes() >= requiredDuration) {
        return TimePeriod.create(
          gap.startTime,
          new Date(gap.startTime.getTime() + (requiredDuration * 60 * 1000))
        );
      }
    }

    return null;
  }
}

interface EventRequest {
  id: string;
  name: string;
  venueId: string;
  organizerId: string;
  startTime: Date;
  endTime: Date;
  recurrence?: {
    frequency: 'weekly' | 'monthly';
    interval: number;
  };
  recurrenceEndDate?: Date;
  requireBusinessHours: boolean;
}

interface ScheduledEvent {
  id: string;
  name: string;
  period: TimePeriod;
  venueId: string;
  organizerId: string;
}

interface Venue {
  id: string;
  name: string;
  timezone: string;
  capacity: number;
}
```

**Business Benefits**:
- Eliminates double-booking conflicts
- Optimizes venue utilization  
- Handles complex recurring events
- Supports global timezone coordination
- Provides intelligent scheduling recommendations

## Use Case 2: Brand Management & Design System

**Business Context**: Enterprise design system managing brand consistency across multiple products, themes, and accessibility requirements.

**Challenge**: Ensuring color consistency, accessibility compliance, automated palette generation, and maintaining brand guidelines across teams.

### Implementation Strategy

```typescript
// Brand management system
import { Color } from '../advanced/color';

class BrandManager {
  private brandColors = new Map<string, BrandColorDefinition>();
  private themes = new Map<string, Theme>();

  defineBrandColor(definition: BrandColorDefinition): void {
    // Validate color meets brand standards
    const validationResult = this.validateBrandColor(definition);
    if (!validationResult.valid) {
      throw new Error(`Brand color validation failed: ${validationResult.errors.join(', ')}`);
    }

    this.brandColors.set(definition.name, definition);
    
    // Auto-generate color variants
    this.generateColorVariants(definition);
  }

  createTheme(name: string, type: 'light' | 'dark', primaryColor: string): Theme {
    const primary = this.getBrandColor(primaryColor);
    if (!primary) {
      throw new Error(`Brand color '${primaryColor}' not found`);
    }

    const theme: Theme = {
      name,
      type,
      colors: new Map()
    };

    // Generate semantic color palette
    const palette = this.generateSemanticPalette(primary.color, type);
    
    // Validate accessibility for all color combinations
    const accessibilityReport = this.validateThemeAccessibility(palette, type);
    if (!accessibilityReport.allPass) {
      console.warn(`Theme '${name}' has accessibility issues:`, accessibilityReport.violations);
    }

    theme.colors = palette;
    this.themes.set(name, theme);
    
    return theme;
  }

  generateSemanticPalette(primaryColor: Color, themeType: 'light' | 'dark'): Map<string, Color> {
    const palette = new Map<string, Color>();

    // Primary color family
    palette.set('primary', primaryColor);
    palette.set('primary-light', primaryColor.lighten(20));
    palette.set('primary-dark', primaryColor.darken(20));

    // Secondary colors (complementary and triadic)
    const complementary = primaryColor.getComplementary();
    const [triadic1, triadic2] = primaryColor.getTriadic();

    palette.set('secondary', complementary);
    palette.set('accent-1', triadic1);
    palette.set('accent-2', triadic2);

    // Status colors
    palette.set('success', Color.fromHSL(120, 60, themeType === 'light' ? 45 : 55));
    palette.set('warning', Color.fromHSL(45, 90, themeType === 'light' ? 55 : 65));
    palette.set('error', Color.fromHSL(0, 80, themeType === 'light' ? 50 : 60));
    palette.set('info', Color.fromHSL(210, 70, themeType === 'light' ? 50 : 60));

    // Neutral colors
    const neutralHue = primaryColor.toHSL().hue;
    if (themeType === 'light') {
      palette.set('background', Color.fromHex('#FFFFFF'));
      palette.set('surface', Color.fromHSL(neutralHue, 5, 98));
      palette.set('text-primary', Color.fromHSL(neutralHue, 10, 15));
      palette.set('text-secondary', Color.fromHSL(neutralHue, 5, 40));
      palette.set('border', Color.fromHSL(neutralHue, 10, 90));
    } else {
      palette.set('background', Color.fromHSL(neutralHue, 5, 8));
      palette.set('surface', Color.fromHSL(neutralHue, 5, 12));
      palette.set('text-primary', Color.fromHex('#FFFFFF'));
      palette.set('text-secondary', Color.fromHSL(neutralHue, 5, 70));
      palette.set('border', Color.fromHSL(neutralHue, 5, 20));
    }

    return palette;
  }

  validateThemeAccessibility(palette: Map<string, Color>, themeType: 'light' | 'dark'): AccessibilityReport {
    const violations: AccessibilityViolation[] = [];
    const background = palette.get('background')!;
    
    const textColors = ['text-primary', 'text-secondary'];
    const interactiveColors = ['primary', 'secondary', 'accent-1', 'accent-2'];
    
    // Check text contrast
    textColors.forEach(colorName => {
      const textColor = palette.get(colorName);
      if (textColor) {
        const contrast = textColor.getContrastRatio(background);
        
        if (!textColor.meetsWCAGContrastAA(background, false)) {
          violations.push({
            type: 'contrast',
            description: `${colorName} does not meet WCAG AA contrast requirements`,
            colors: [colorName, 'background'],
            currentRatio: contrast,
            requiredRatio: 4.5
          });
        }
      }
    });

    // Check interactive element contrast
    interactiveColors.forEach(colorName => {
      const color = palette.get(colorName);
      if (color) {
        const contrast = color.getContrastRatio(background);
        
        if (contrast < 3) { // WCAG AA for large text/UI elements
          violations.push({
            type: 'contrast',
            description: `${colorName} may have insufficient contrast for UI elements`,
            colors: [colorName, 'background'],
            currentRatio: contrast,
            requiredRatio: 3
          });
        }
      }
    });

    return {
      allPass: violations.length === 0,
      violations,
      totalChecks: textColors.length + interactiveColors.length,
      passedChecks: (textColors.length + interactiveColors.length) - violations.length
    };
  }

  exportDesignTokens(themeName: string, format: 'css' | 'json' | 'scss' = 'css'): string {
    const theme = this.themes.get(themeName);
    if (!theme) {
      throw new Error(`Theme '${themeName}' not found`);
    }

    switch (format) {
      case 'css':
        return this.exportAsCSSVariables(theme);
      case 'json':
        return this.exportAsJSON(theme);
      case 'scss':
        return this.exportAsSCSS(theme);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private validateBrandColor(definition: BrandColorDefinition): ValidationResult {
    const errors: string[] = [];

    // Check if color meets brand luminance requirements
    const luminance = definition.color.getLuminance();
    if (definition.usage.includes('primary') && (luminance < 0.1 || luminance > 0.9)) {
      errors.push('Primary brand colors should have moderate luminance (0.1-0.9)');
    }

    // Check if color has sufficient distinction from existing brand colors
    for (const [existingName, existing] of this.brandColors) {
      if (existingName === definition.name) continue;
      
      const distance = this.calculateColorDistance(definition.color, existing.color);
      if (distance < 30) { // Minimum perceptual difference
        errors.push(`Color too similar to existing brand color '${existingName}'`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private calculateColorDistance(color1: Color, color2: Color): number {
    // Simple RGB Euclidean distance (in production use Delta E)
    const rgb1 = color1.toRGB();
    const rgb2 = color2.toRGB();
    
    const dr = rgb1.red - rgb2.red;
    const dg = rgb1.green - rgb2.green;
    const db = rgb1.blue - rgb2.blue;
    
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  private generateColorVariants(definition: BrandColorDefinition): void {
    const baseColor = definition.color;
    
    // Generate standard variants
    const variants = [
      { suffix: '-50', color: baseColor.lighten(40) },
      { suffix: '-100', color: baseColor.lighten(30) },
      { suffix: '-200', color: baseColor.lighten(20) },
      { suffix: '-300', color: baseColor.lighten(10) },
      { suffix: '-400', color: baseColor },
      { suffix: '-500', color: baseColor },
      { suffix: '-600', color: baseColor.darken(10) },
      { suffix: '-700', color: baseColor.darken(20) },
      { suffix: '-800', color: baseColor.darken(30) },
      { suffix: '-900', color: baseColor.darken(40) }
    ];

    variants.forEach(variant => {
      this.brandColors.set(`${definition.name}${variant.suffix}`, {
        name: `${definition.name}${variant.suffix}`,
        color: variant.color,
        usage: ['variant'],
        description: `${definition.description} - ${variant.suffix.replace('-', '')} variant`
      });
    });
  }

  private getBrandColor(name: string): BrandColorDefinition | undefined {
    return this.brandColors.get(name);
  }

  private exportAsCSSVariables(theme: Theme): string {
    let css = `:root[data-theme="${theme.name}"] {\n`;
    
    theme.colors.forEach((color, name) => {
      const varName = `--color-${name.replace(/\s+/g, '-')}`;
      css += `  ${varName}: ${color.toHex()};\n`;
      
      // Include RGB values for opacity manipulation
      const rgb = color.toRGB();
      css += `  ${varName}-rgb: ${rgb.red}, ${rgb.green}, ${rgb.blue};\n`;
    });
    
    css += '}';
    return css;
  }

  private exportAsJSON(theme: Theme): string {
    const tokens: Record<string, any> = {};
    
    theme.colors.forEach((color, name) => {
      tokens[name.replace(/\s+/g, '-')] = {
        value: color.toHex(),
        type: 'color',
        rgb: color.toRGB(),
        hsl: color.toHSL()
      };
    });
    
    return JSON.stringify({ [theme.name]: tokens }, null, 2);
  }

  private exportAsSCSS(theme: Theme): string {
    let scss = `// ${theme.name} theme colors\n`;
    
    theme.colors.forEach((color, name) => {
      const varName = `$color-${name.replace(/\s+/g, '-')}`;
      scss += `${varName}: ${color.toHex()};\n`;
    });
    
    return scss;
  }
}

interface BrandColorDefinition {
  name: string;
  color: Color;
  usage: Array<'primary' | 'secondary' | 'accent' | 'neutral' | 'status' | 'variant'>;
  description: string;
}

interface Theme {
  name: string;
  type: 'light' | 'dark';
  colors: Map<string, Color>;
}

interface AccessibilityViolation {
  type: 'contrast' | 'luminance' | 'color-blind';
  description: string;
  colors: string[];
  currentRatio: number;
  requiredRatio: number;
}

interface AccessibilityReport {
  allPass: boolean;
  violations: AccessibilityViolation[];
  totalChecks: number;
  passedChecks: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

**Business Benefits**:
- Ensures brand consistency across products
- Automates accessibility compliance checking
- Reduces design system maintenance overhead
- Provides automated color palette generation
- Supports multiple export formats for different platforms

## Use Case 3: Smart Logistics & Delivery Platform

**Business Context**: Last-mile delivery service optimizing routes, managing delivery zones, and coordinating drivers across metropolitan areas.

**Challenge**: Dynamic route optimization, real-time location tracking, geofencing for delivery zones, and customer location management with high precision.

### Implementation Strategy

```typescript
// Smart delivery system
import { Coordinates } from '../advanced/coordinates';

class SmartDeliverySystem {
  private deliveryHubs = new Map<string, DeliveryHub>();
  private activeDeliveries = new Map<string, ActiveDelivery>();
  private deliveryZones = new Map<string, DeliveryZone>();

  createDeliveryZone(
    hubId: string,
    maxRadius: number,
    priorityAreas: Coordinates[][],
    restrictedAreas: Coordinates[][]
  ): DeliveryZone {
    const hub = this.deliveryHubs.get(hubId);
    if (!hub) {
      throw new Error(`Hub ${hubId} not found`);
    }

    const zone: DeliveryZone = {
      id: `zone-${hubId}`,
      hubId,
      center: hub.location,
      maxRadius,
      priorityAreas,
      restrictedAreas,
      averageDeliveryTime: 30 // minutes
    };

    this.deliveryZones.set(zone.id, zone);
    return zone;
  }

  optimizeDeliveryRoute(
    driverId: string,
    deliveries: PendingDelivery[]
  ): OptimizedRoute {
    const driver = this.findDriver(driverId);
    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    // Start from driver's current location
    let currentLocation = driver.currentLocation;
    const optimizedStops: RouteStop[] = [];
    const remaining = [...deliveries];
    let totalDistance = 0;
    let estimatedDuration = 0;

    // Greedy nearest-neighbor optimization
    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = currentLocation.distanceTo(remaining[0].deliveryLocation);

      // Find nearest delivery
      for (let i = 1; i < remaining.length; i++) {
        const distance = currentLocation.distanceTo(remaining[i].deliveryLocation);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      const nextDelivery = remaining[nearestIndex];
      
      // Calculate travel time (assuming 40 km/h average speed in city)
      const travelTime = (nearestDistance / 40) * 60; // minutes
      
      optimizedStops.push({
        deliveryId: nextDelivery.id,
        location: nextDelivery.deliveryLocation,
        distanceFromPrevious: nearestDistance,
        estimatedArrival: new Date(Date.now() + (estimatedDuration + travelTime) * 60000),
        deliveryTimeWindow: nextDelivery.timeWindow,
        priority: this.calculateDeliveryPriority(nextDelivery)
      });

      totalDistance += nearestDistance;
      estimatedDuration += travelTime + nextDelivery.estimatedServiceTime;
      currentLocation = nextDelivery.deliveryLocation;
      
      remaining.splice(nearestIndex, 1);
    }

    // Apply traffic and time-based adjustments
    const adjustedRoute = this.applyTrafficAdjustments(optimizedStops);

    return {
      driverId,
      stops: adjustedRoute,
      totalDistance: parseFloat(totalDistance.toFixed(2)),
      estimatedDuration: Math.round(estimatedDuration),
      optimizationScore: this.calculateOptimizationScore(adjustedRoute),
      createdAt: new Date()
    };
  }

  trackDeliveryProgress(deliveryId: string, driverLocation: Coordinates): DeliveryStatus {
    const delivery = this.activeDeliveries.get(deliveryId);
    if (!delivery) {
      throw new Error(`Active delivery ${deliveryId} not found`);
    }

    const distanceToDestination = driverLocation.distanceTo(delivery.destinationLocation);
    const isInDeliveryZone = distanceToDestination <= 0.1; // 100m radius
    
    // Update ETA based on current location
    const remainingDistance = distanceToDestination;
    const estimatedArrivalTime = new Date(Date.now() + (remainingDistance / 40) * 60 * 60000);

    // Check if delivery is behind schedule
    const originalETA = delivery.estimatedArrival;
    const isDelayed = estimatedArrivalTime > originalETA;
    const delayMinutes = isDelayed 
      ? Math.round((estimatedArrivalTime.getTime() - originalETA.getTime()) / 60000)
      : 0;

    const status: DeliveryStatus = {
      deliveryId,
      currentLocation: driverLocation,
      distanceToDestination,
      isInDeliveryZone,
      estimatedArrival: estimatedArrivalTime,
      isDelayed,
      delayMinutes,
      status: isInDeliveryZone ? 'arriving' : 'in-transit'
    };

    // Send notifications if significant delays
    if (isDelayed && delayMinutes > 15) {
      this.notifyCustomerOfDelay(delivery.customerId, delayMinutes);
    }

    return status;
  }

  findOptimalHub(customerLocation: Coordinates): {
    hub: DeliveryHub;
    distance: number;
    estimatedDeliveryTime: number;
  } | null {
    let optimalHub: DeliveryHub | null = null;
    let shortestDistance = Infinity;
    let bestDeliveryTime = Infinity;

    for (const hub of this.deliveryHubs.values()) {
      const distance = hub.location.distanceTo(customerLocation);
      
      // Check if location is within hub's service area
      if (distance > hub.maxServiceRadius) {
        continue;
      }

      // Find which delivery zone this location belongs to
      const applicableZone = Array.from(this.deliveryZones.values())
        .find(zone => 
          zone.hubId === hub.id && 
          customerLocation.isWithinRadius(zone.center, zone.maxRadius)
        );

      if (applicableZone) {
        // Check if in priority area (faster delivery)
        const inPriorityArea = applicableZone.priorityAreas.some(area =>
          customerLocation.isWithinPolygon(area)
        );

        // Check if in restricted area
        const inRestrictedArea = applicableZone.restrictedAreas.some(area =>
          customerLocation.isWithinPolygon(area)
        );

        if (inRestrictedArea) {
          continue; // Skip restricted areas
        }

        // Calculate estimated delivery time
        const baseDeliveryTime = applicableZone.averageDeliveryTime;
        const deliveryTime = inPriorityArea 
          ? baseDeliveryTime * 0.8 // 20% faster in priority areas
          : baseDeliveryTime;

        // Consider current hub load
        const loadFactor = this.calculateHubLoadFactor(hub.id);
        const adjustedDeliveryTime = deliveryTime * (1 + loadFactor);

        if (adjustedDeliveryTime < bestDeliveryTime) {
          optimalHub = hub;
          shortestDistance = distance;
          bestDeliveryTime = adjustedDeliveryTime;
        }
      }
    }

    return optimalHub ? {
      hub: optimalHub,
      distance: shortestDistance,
      estimatedDeliveryTime: Math.round(bestDeliveryTime)
    } : null;
  }

  analyzeDeliveryPerformance(hubId: string, timeRange: { start: Date; end: Date }): PerformanceReport {
    const completedDeliveries = this.getCompletedDeliveries(hubId, timeRange);
    
    if (completedDeliveries.length === 0) {
      return {
        hubId,
        timeRange,
        totalDeliveries: 0,
        averageDeliveryTime: 0,
        onTimePercentage: 0,
        averageDistance: 0,
        customerSatisfactionScore: 0
      };
    }

    const totalDeliveries = completedDeliveries.length;
    
    // Calculate average delivery time
    const totalDeliveryTime = completedDeliveries.reduce((sum, delivery) => 
      sum + delivery.actualDeliveryTime, 0
    );
    const averageDeliveryTime = totalDeliveryTime / totalDeliveries;

    // Calculate on-time percentage
    const onTimeDeliveries = completedDeliveries.filter(delivery => 
      delivery.deliveredAt <= delivery.promisedDeliveryTime
    ).length;
    const onTimePercentage = (onTimeDeliveries / totalDeliveries) * 100;

    // Calculate average distance
    const totalDistance = completedDeliveries.reduce((sum, delivery) => 
      sum + delivery.totalDistance, 0
    );
    const averageDistance = totalDistance / totalDeliveries;

    // Simple customer satisfaction based on delivery performance
    let satisfactionScore = 5.0;
    if (onTimePercentage < 90) satisfactionScore -= 0.5;
    if (onTimePercentage < 80) satisfactionScore -= 0.5;
    if (averageDeliveryTime > 45) satisfactionScore -= 0.3;
    
    return {
      hubId,
      timeRange,
      totalDeliveries,
      averageDeliveryTime: Math.round(averageDeliveryTime),
      onTimePercentage: Math.round(onTimePercentage * 100) / 100,
      averageDistance: Math.round(averageDistance * 100) / 100,
      customerSatisfactionScore: Math.round(satisfactionScore * 100) / 100
    };
  }

  private calculateDeliveryPriority(delivery: PendingDelivery): number {
    let priority = 0;
    
    // Time-sensitive deliveries
    if (delivery.timeWindow) {
      const timeUntilDeadline = delivery.timeWindow.end.getTime() - Date.now();
      const hoursUntilDeadline = timeUntilDeadline / (60 * 60 * 1000);
      
      if (hoursUntilDeadline < 2) priority += 50;
      else if (hoursUntilDeadline < 4) priority += 30;
      else if (hoursUntilDeadline < 8) priority += 10;
    }

    // Premium customers
    if (delivery.customerType === 'premium') priority += 20;
    
    // High-value packages
    if (delivery.packageValue > 1000) priority += 15;
    
    return priority;
  }

  private applyTrafficAdjustments(stops: RouteStop[]): RouteStop[] {
    // Simple traffic adjustment based on time of day
    return stops.map(stop => {
      const hour = stop.estimatedArrival.getHours();
      let trafficMultiplier = 1.0;
      
      // Rush hour traffic
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        trafficMultiplier = 1.3;
      }
      
      return {
        ...stop,
        estimatedArrival: new Date(
          stop.estimatedArrival.getTime() + 
          (stop.distanceFromPrevious / 40 * 60 * 60000 * (trafficMultiplier - 1))
        )
      };
    });
  }

  private calculateOptimizationScore(stops: RouteStop[]): number {
    if (stops.length <= 1) return 100;

    // Calculate total distance
    const totalDistance = stops.reduce((sum, stop) => sum + stop.distanceFromPrevious, 0);
    
    // Calculate theoretical minimum distance (straight-line distances)
    let theoreticalDistance = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      theoreticalDistance += stops[i].location.distanceTo(stops[i + 1].location);
    }

    // Score based on how close we are to optimal
    const efficiency = theoreticalDistance / totalDistance;
    return Math.round(efficiency * 100);
  }

  private calculateHubLoadFactor(hubId: string): number {
    // Simple load calculation based on active deliveries
    const activeCount = Array.from(this.activeDeliveries.values())
      .filter(delivery => delivery.hubId === hubId).length;
      
    const hub = this.deliveryHubs.get(hubId);
    if (!hub) return 0;

    const loadPercentage = activeCount / hub.maxConcurrentDeliveries;
    return Math.min(loadPercentage, 1.0); // Cap at 100%
  }

  private findDriver(driverId: string): Driver | null {
    // Implementation would look up driver from database
    return null; // Placeholder
  }

  private notifyCustomerOfDelay(customerId: string, delayMinutes: number): void {
    // Implementation would send notification to customer
    console.log(`Notifying customer ${customerId} of ${delayMinutes} minute delay`);
  }

  private getCompletedDeliveries(hubId: string, timeRange: { start: Date; end: Date }): CompletedDelivery[] {
    // Implementation would query completed deliveries from database
    return []; // Placeholder
  }
}

// Supporting interfaces
interface DeliveryHub {
  id: string;
  location: Coordinates;
  maxServiceRadius: number;
  maxConcurrentDeliveries: number;
}

interface DeliveryZone {
  id: string;
  hubId: string;
  center: Coordinates;
  maxRadius: number;
  priorityAreas: Coordinates[][];
  restrictedAreas: Coordinates[][];
  averageDeliveryTime: number;
}

interface PendingDelivery {
  id: string;
  customerId: string;
  deliveryLocation: Coordinates;
  timeWindow?: { start: Date; end: Date };
  estimatedServiceTime: number;
  packageValue: number;
  customerType: 'standard' | 'premium';
}

interface RouteStop {
  deliveryId: string;
  location: Coordinates;
  distanceFromPrevious: number;
  estimatedArrival: Date;
  deliveryTimeWindow?: { start: Date; end: Date };
  priority: number;
}

interface OptimizedRoute {
  driverId: string;
  stops: RouteStop[];
  totalDistance: number;
  estimatedDuration: number;
  optimizationScore: number;
  createdAt: Date;
}

interface ActiveDelivery {
  id: string;
  hubId: string;
  customerId: string;
  destinationLocation: Coordinates;
  estimatedArrival: Date;
}

interface DeliveryStatus {
  deliveryId: string;
  currentLocation: Coordinates;
  distanceToDestination: number;
  isInDeliveryZone: boolean;
  estimatedArrival: Date;
  isDelayed: boolean;
  delayMinutes: number;
  status: 'in-transit' | 'arriving' | 'delivered';
}

interface Driver {
  id: string;
  currentLocation: Coordinates;
}

interface CompletedDelivery {
  id: string;
  actualDeliveryTime: number;
  deliveredAt: Date;
  promisedDeliveryTime: Date;
  totalDistance: number;
}

interface PerformanceReport {
  hubId: string;
  timeRange: { start: Date; end: Date };
  totalDeliveries: number;
  averageDeliveryTime: number;
  onTimePercentage: number;
  averageDistance: number;
  customerSatisfactionScore: number;
}
```

**Business Benefits**:
- Optimizes delivery routes for cost and time efficiency
- Provides real-time tracking and customer updates
- Manages complex delivery zones with priority areas
- Enables data-driven performance optimization
- Scales to handle metropolitan-level logistics

## Key Success Factors

1. **Domain Expertise**: Advanced value objects require deep understanding of the business domain
2. **Performance Considerations**: Complex calculations need optimization for production use
3. **Extensibility**: Design for future requirements and integrations
4. **Testing Strategy**: Comprehensive testing including edge cases and performance scenarios
5. **Documentation**: Clear documentation for complex business logic and calculations

These advanced use cases demonstrate how sophisticated value objects can solve real-world business challenges while maintaining clean domain modeling principles.