# Value Objects - Intermediate Use Cases

**Version**: 2025-01-21 **Package**: @vytches/ddd-value-objects  
**Complexity**: Intermediate **Focus**: Advanced business scenarios and complex
domain modeling

## Overview

This document outlines intermediate-level use cases where value objects provide
sophisticated business logic and domain modeling capabilities. These scenarios
demonstrate complex validation, multi-object coordination, and advanced business
rules.

## Manufacturing Quality Control System

### **Scenario**: Automated quality inspection with statistical process control

```typescript
import { Measurement, DateRange } from '@vytches/ddd-value-objects';

// ✅ Product specification with tolerances
class ProductSpecification {
  constructor(
    public readonly partNumber: string,
    public readonly dimensions: Map<
      string,
      { target: Measurement; tolerance: number }
    >,
    public readonly material: string,
    public readonly qualityLevel: 'critical' | 'important' | 'standard'
  ) {}

  validateMeasurement(
    dimension: string,
    measured: Measurement
  ): {
    passes: boolean;
    deviation: number;
    severity: 'pass' | 'warning' | 'fail';
  } {
    const spec = this.dimensions.get(dimension);
    if (!spec) {
      throw new Error(`Unknown dimension: ${dimension}`);
    }

    const deviation = Math.abs(measured.getPercentageDifference(spec.target));
    const passes = deviation <= spec.tolerance;

    let severity: 'pass' | 'warning' | 'fail' = 'pass';
    if (deviation > spec.tolerance) {
      severity = 'fail';
    } else if (deviation > spec.tolerance * 0.8) {
      severity = 'warning';
    }

    return { passes, deviation, severity };
  }
}

// ✅ Quality control batch processing
class QualityControlBatch {
  private measurements: Map<string, Measurement[]> = new Map();
  private inspectionPeriod: DateRange;

  constructor(
    public readonly batchId: string,
    public readonly specification: ProductSpecification,
    startDate: Date,
    endDate: Date
  ) {
    this.inspectionPeriod = DateRange.create(startDate, endDate);
  }

  addMeasurement(dimension: string, measurement: Measurement): void {
    if (!this.measurements.has(dimension)) {
      this.measurements.set(dimension, []);
    }
    this.measurements.get(dimension)!.push(measurement);
  }

  getStatisticalAnalysis(): {
    dimensions: Map<
      string,
      {
        average: Measurement;
        standardDeviation: number;
        cpk: number; // Process capability index
        outOfSpec: number;
        trend: 'improving' | 'degrading' | 'stable';
      }
    >;
    overallQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
    recommendations: string[];
  } {
    const dimensionAnalysis = new Map();
    const recommendations: string[] = [];
    let totalOutOfSpec = 0;
    let totalMeasurements = 0;

    this.measurements.forEach((measurements, dimension) => {
      const spec = this.specification.dimensions.get(dimension)!;
      const average = Measurement.calculateAverage(measurements);
      const stdDev = Measurement.calculateStandardDeviation(measurements);

      // Calculate process capability (Cpk)
      const tolerance = (spec.target.value * spec.tolerance) / 100;
      const cpk = Math.min(
        Math.abs(spec.target.value + tolerance - average.value) / (3 * stdDev),
        Math.abs(average.value - (spec.target.value - tolerance)) / (3 * stdDev)
      );

      // Count out-of-spec measurements
      const outOfSpec = measurements.filter(m => {
        const validation = this.specification.validateMeasurement(dimension, m);
        return !validation.passes;
      }).length;

      // Determine trend (simplified - compare first vs second half)
      const midpoint = Math.floor(measurements.length / 2);
      const firstHalf = measurements.slice(0, midpoint);
      const secondHalf = measurements.slice(midpoint);

      const firstAvg = Measurement.calculateAverage(firstHalf);
      const secondAvg = Measurement.calculateAverage(secondHalf);

      const targetDistance1 = Math.abs(
        firstAvg.getPercentageDifference(spec.target)
      );
      const targetDistance2 = Math.abs(
        secondAvg.getPercentageDifference(spec.target)
      );

      let trend: 'improving' | 'degrading' | 'stable';
      if (Math.abs(targetDistance2 - targetDistance1) < 0.5) {
        trend = 'stable';
      } else {
        trend = targetDistance2 < targetDistance1 ? 'improving' : 'degrading';
      }

      dimensionAnalysis.set(dimension, {
        average,
        standardDeviation: stdDev,
        cpk,
        outOfSpec,
        trend,
      });

      totalOutOfSpec += outOfSpec;
      totalMeasurements += measurements.length;

      // Add recommendations based on analysis
      if (cpk < 1.0) {
        recommendations.push(
          `Improve process capability for ${dimension} (Cpk: ${cpk.toFixed(2)})`
        );
      }
      if (trend === 'degrading') {
        recommendations.push(
          `Process trending worse for ${dimension} - investigate root cause`
        );
      }
      if (outOfSpec > measurements.length * 0.05) {
        recommendations.push(
          `High defect rate for ${dimension} (${((outOfSpec / measurements.length) * 100).toFixed(1)}%)`
        );
      }
    });

    // Overall quality assessment
    const defectRate = totalOutOfSpec / totalMeasurements;
    let overallQuality: 'excellent' | 'good' | 'acceptable' | 'poor';

    if (defectRate < 0.01) overallQuality = 'excellent';
    else if (defectRate < 0.03) overallQuality = 'good';
    else if (defectRate < 0.05) overallQuality = 'acceptable';
    else overallQuality = 'poor';

    return {
      dimensions: dimensionAnalysis,
      overallQuality,
      recommendations,
    };
  }

  generateQualityReport(): {
    batchId: string;
    inspectionPeriod: DateRange;
    totalParts: number;
    passRate: number;
    analysis: ReturnType<QualityControlBatch['getStatisticalAnalysis']>;
    controlChartData: Array<{
      dimension: string;
      measurements: Array<{
        sequence: number;
        value: number;
        inControl: boolean;
      }>;
    }>;
  } {
    const analysis = this.getStatisticalAnalysis();
    const controlChartData: Array<{
      dimension: string;
      measurements: Array<{
        sequence: number;
        value: number;
        inControl: boolean;
      }>;
    }> = [];

    let totalPassed = 0;
    let totalMeasured = 0;

    this.measurements.forEach((measurements, dimension) => {
      const dimensionData = analysis.dimensions.get(dimension)!;
      const controlLimit = 3 * dimensionData.standardDeviation;

      const chartData = measurements.map((m, index) => {
        const deviation = Math.abs(
          m.getPercentageDifference(dimensionData.average)
        );
        const inControl = deviation <= controlLimit;

        const validation = this.specification.validateMeasurement(dimension, m);
        if (validation.passes) totalPassed++;
        totalMeasured++;

        return {
          sequence: index + 1,
          value: m.value,
          inControl,
        };
      });

      controlChartData.push({ dimension, measurements: chartData });
    });

    const passRate =
      totalMeasured > 0 ? (totalPassed / totalMeasured) * 100 : 0;

    return {
      batchId: this.batchId,
      inspectionPeriod: this.inspectionPeriod,
      totalParts: totalMeasured,
      passRate,
      analysis,
      controlChartData,
    };
  }
}

// Usage example
const spec = new ProductSpecification(
  'BEARING-001',
  new Map([
    [
      'outer_diameter',
      { target: Measurement.create(25.0, 'mm', 3), tolerance: 0.1 },
    ],
    [
      'inner_diameter',
      { target: Measurement.create(15.0, 'mm', 3), tolerance: 0.05 },
    ],
    [
      'thickness',
      { target: Measurement.create(5.0, 'mm', 3), tolerance: 0.02 },
    ],
  ]),
  'Steel-316L',
  'critical'
);

const batch = new QualityControlBatch(
  'BATCH-2025-001',
  spec,
  new Date('2025-01-21'),
  new Date('2025-01-21')
);

// Simulate measurements
const measurements = [
  { dim: 'outer_diameter', values: [25.01, 24.99, 25.0, 24.98, 25.02] },
  { dim: 'inner_diameter', values: [15.001, 14.998, 15.0, 14.999, 15.002] },
  { dim: 'thickness', values: [5.001, 4.999, 5.0, 4.998, 5.002] },
];

measurements.forEach(({ dim, values }) => {
  values.forEach(value => {
    batch.addMeasurement(dim, Measurement.create(value, 'mm', 3));
  });
});

const report = batch.generateQualityReport();
console.log(`Quality Report - Batch ${report.batchId}`);
console.log(`Pass Rate: ${report.passRate.toFixed(1)}%`);
console.log(`Overall Quality: ${report.analysis.overallQuality}`);
console.log(`Recommendations: ${report.analysis.recommendations.join('; ')}`);
```

### **Business Impact**:

- **Process Control**: Real-time statistical analysis prevents quality issues
- **Predictive Quality**: Trend analysis enables proactive adjustments
- **Compliance**: Automated documentation for quality certifications
- **Cost Reduction**: Early detection reduces waste and rework

---

## Healthcare Patient Monitoring System

### **Scenario**: Continuous vital signs monitoring with alert management

```typescript
import {
  Measurement,
  DateRange,
  UserProfile,
} from '@vytches/ddd-value-objects';

// ✅ Vital signs composite with medical context
class VitalSigns {
  constructor(
    public readonly patientId: string,
    public readonly timestamp: Date,
    public readonly heartRate: Measurement,
    public readonly bloodPressure: {
      systolic: Measurement;
      diastolic: Measurement;
    },
    public readonly temperature: Measurement,
    public readonly oxygenSaturation: Measurement,
    public readonly metadata?: {
      deviceId: string;
      wardLocation: string;
      attendingNurse?: string;
    }
  ) {
    this.validateVitalSigns();
  }

  private validateVitalSigns(): void {
    // Validate heart rate
    if (
      this.heartRate.unit !== 'bpm' ||
      this.heartRate.value < 20 ||
      this.heartRate.value > 250
    ) {
      throw new Error('Invalid heart rate measurement');
    }

    // Validate blood pressure
    if (
      this.bloodPressure.systolic.unit !== 'mmHg' ||
      this.bloodPressure.diastolic.unit !== 'mmHg'
    ) {
      throw new Error('Blood pressure must be in mmHg');
    }

    if (
      this.bloodPressure.systolic.value <= this.bloodPressure.diastolic.value
    ) {
      throw new Error('Systolic pressure must be greater than diastolic');
    }

    // Validate temperature range
    if (
      this.temperature.unitCategory !== 'temperature' ||
      (this.temperature.unit === 'C' &&
        (this.temperature.value < 30 || this.temperature.value > 45))
    ) {
      throw new Error('Temperature out of viable range');
    }

    // Validate oxygen saturation
    if (
      this.oxygenSaturation.unit !== '%' ||
      this.oxygenSaturation.value < 70 ||
      this.oxygenSaturation.value > 100
    ) {
      throw new Error('Invalid oxygen saturation');
    }
  }

  assessCriticalityLevel(): {
    level: 'stable' | 'watch' | 'warning' | 'critical' | 'emergency';
    alerts: string[];
    immediateActions: string[];
  } {
    const alerts: string[] = [];
    const immediateActions: string[] = [];
    let maxLevel: number = 0; // 0=stable, 1=watch, 2=warning, 3=critical, 4=emergency

    // Heart rate assessment
    const hr = this.heartRate.value;
    if (hr < 50 || hr > 120) {
      if (hr < 40 || hr > 150) {
        maxLevel = Math.max(maxLevel, 4);
        alerts.push(`Emergency heart rate: ${hr} bpm`);
        immediateActions.push('Call physician immediately');
      } else {
        maxLevel = Math.max(maxLevel, 3);
        alerts.push(`Critical heart rate: ${hr} bpm`);
        immediateActions.push('Notify attending physician');
      }
    } else if (hr < 60 || hr > 100) {
      maxLevel = Math.max(maxLevel, 2);
      alerts.push(`Abnormal heart rate: ${hr} bpm`);
    }

    // Blood pressure assessment
    const sys = this.bloodPressure.systolic.value;
    const dia = this.bloodPressure.diastolic.value;

    if (sys > 180 || dia > 120) {
      maxLevel = Math.max(maxLevel, 4);
      alerts.push(`Emergency hypertension: ${sys}/${dia} mmHg`);
      immediateActions.push('Hypertensive crisis protocol');
    } else if (sys > 160 || dia > 100) {
      maxLevel = Math.max(maxLevel, 3);
      alerts.push(`Severe hypertension: ${sys}/${dia} mmHg`);
    } else if (sys < 90 || dia < 60) {
      maxLevel = Math.max(maxLevel, 3);
      alerts.push(`Hypotension: ${sys}/${dia} mmHg`);
    }

    // Temperature assessment
    const temp =
      this.temperature.unit === 'C'
        ? this.temperature.value
        : ((this.temperature.value - 32) * 5) / 9;

    if (temp > 40 || temp < 35) {
      maxLevel = Math.max(maxLevel, 4);
      alerts.push(`Critical temperature: ${temp.toFixed(1)}°C`);
      immediateActions.push('Temperature management protocol');
    } else if (temp > 38.5 || temp < 36) {
      maxLevel = Math.max(maxLevel, 2);
      alerts.push(`Abnormal temperature: ${temp.toFixed(1)}°C`);
    }

    // Oxygen saturation assessment
    const spo2 = this.oxygenSaturation.value;
    if (spo2 < 85) {
      maxLevel = Math.max(maxLevel, 4);
      alerts.push(`Critical oxygen saturation: ${spo2}%`);
      immediateActions.push('Oxygen therapy immediately');
    } else if (spo2 < 90) {
      maxLevel = Math.max(maxLevel, 3);
      alerts.push(`Low oxygen saturation: ${spo2}%`);
      immediateActions.push('Assess respiratory status');
    } else if (spo2 < 95) {
      maxLevel = Math.max(maxLevel, 2);
      alerts.push(`Borderline oxygen saturation: ${spo2}%`);
    }

    const levels = [
      'stable',
      'watch',
      'warning',
      'critical',
      'emergency',
    ] as const;

    return {
      level: levels[maxLevel],
      alerts,
      immediateActions,
    };
  }

  calculateEarlyWarningScore(): {
    score: number;
    riskLevel: 'low' | 'medium' | 'high' | 'very_high';
    components: Array<{ parameter: string; value: number; points: number }>;
  } {
    const components: Array<{
      parameter: string;
      value: number;
      points: number;
    }> = [];
    let totalScore = 0;

    // Heart rate scoring
    const hr = this.heartRate.value;
    let hrPoints = 0;
    if (hr <= 40) hrPoints = 3;
    else if (hr <= 50) hrPoints = 1;
    else if (hr >= 131) hrPoints = 3;
    else if (hr >= 111) hrPoints = 2;
    else if (hr >= 101) hrPoints = 1;

    components.push({ parameter: 'Heart Rate', value: hr, points: hrPoints });
    totalScore += hrPoints;

    // Systolic BP scoring
    const sys = this.bloodPressure.systolic.value;
    let bpPoints = 0;
    if (sys <= 90) bpPoints = 3;
    else if (sys <= 100) bpPoints = 2;
    else if (sys <= 110) bpPoints = 1;
    else if (sys >= 220) bpPoints = 3;

    components.push({ parameter: 'Systolic BP', value: sys, points: bpPoints });
    totalScore += bpPoints;

    // Temperature scoring
    const temp =
      this.temperature.unit === 'C'
        ? this.temperature.value
        : ((this.temperature.value - 32) * 5) / 9;
    let tempPoints = 0;
    if (temp <= 35) tempPoints = 3;
    else if (temp >= 39.1) tempPoints = 2;
    else if (temp >= 38.1) tempPoints = 1;

    components.push({
      parameter: 'Temperature',
      value: temp,
      points: tempPoints,
    });
    totalScore += tempPoints;

    // Oxygen saturation scoring
    const spo2 = this.oxygenSaturation.value;
    let spo2Points = 0;
    if (spo2 <= 91) spo2Points = 3;
    else if (spo2 <= 93) spo2Points = 2;
    else if (spo2 <= 95) spo2Points = 1;

    components.push({ parameter: 'SpO2', value: spo2, points: spo2Points });
    totalScore += spo2Points;

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'very_high';
    if (totalScore >= 7) riskLevel = 'very_high';
    else if (totalScore >= 5) riskLevel = 'high';
    else if (totalScore >= 3) riskLevel = 'medium';
    else riskLevel = 'low';

    return { score: totalScore, riskLevel, components };
  }

  toString(): string {
    return (
      `Vitals: HR ${this.heartRate}, BP ${this.bloodPressure.systolic}/${this.bloodPressure.diastolic}, ` +
      `Temp ${this.temperature}, SpO2 ${this.oxygenSaturation}`
    );
  }
}

// ✅ Patient monitoring system
class PatientMonitor {
  private vitalHistory: Map<string, VitalSigns[]> = new Map();
  private alertCallbacks: Array<(alert: PatientAlert) => void> = [];

  addVitalSigns(vitals: VitalSigns): PatientAlert[] {
    // Store vital signs
    if (!this.vitalHistory.has(vitals.patientId)) {
      this.vitalHistory.set(vitals.patientId, []);
    }
    this.vitalHistory.get(vitals.patientId)!.push(vitals);

    // Assess current vitals
    const assessment = vitals.assessCriticalityLevel();
    const earlyWarning = vitals.calculateEarlyWarningScore();
    const alerts: PatientAlert[] = [];

    // Generate alerts
    if (assessment.level !== 'stable') {
      const alert = new PatientAlert(
        vitals.patientId,
        assessment.level,
        assessment.alerts,
        assessment.immediateActions,
        vitals
      );
      alerts.push(alert);
      this.notifyAlert(alert);
    }

    // Check for trends
    const trendAlerts = this.analyzeTrends(vitals.patientId);
    alerts.push(...trendAlerts);

    return alerts;
  }

  private analyzeTrends(patientId: string): PatientAlert[] {
    const history = this.vitalHistory.get(patientId) || [];
    if (history.length < 3) return []; // Need at least 3 readings for trend

    const recent = history.slice(-3); // Last 3 readings
    const alerts: PatientAlert[] = [];

    // Heart rate trend
    const hrTrend = this.calculateTrend(recent.map(v => v.heartRate.value));
    if (Math.abs(hrTrend) > 10) {
      // > 10 bpm change per reading
      alerts.push(
        new PatientAlert(
          patientId,
          'warning',
          [
            `Heart rate trending ${hrTrend > 0 ? 'up' : 'down'}: ${hrTrend.toFixed(1)} bpm/reading`,
          ],
          ['Monitor cardiac status'],
          recent[recent.length - 1]
        )
      );
    }

    // Temperature trend
    const tempValues = recent.map(v => {
      return v.temperature.unit === 'C'
        ? v.temperature.value
        : ((v.temperature.value - 32) * 5) / 9;
    });
    const tempTrend = this.calculateTrend(tempValues);
    if (Math.abs(tempTrend) > 0.5) {
      // > 0.5°C change per reading
      alerts.push(
        new PatientAlert(
          patientId,
          'warning',
          [
            `Temperature trending ${tempTrend > 0 ? 'up' : 'down'}: ${tempTrend.toFixed(1)}°C/reading`,
          ],
          ['Investigate cause of temperature change'],
          recent[recent.length - 1]
        )
      );
    }

    return alerts;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    // Simple linear trend calculation
    let sum = 0;
    for (let i = 1; i < values.length; i++) {
      sum += values[i] - values[i - 1];
    }
    return sum / (values.length - 1);
  }

  getPatientSummary(
    patientId: string,
    period: DateRange
  ): {
    totalReadings: number;
    averageVitals: {
      heartRate: number;
      systolicBP: number;
      diastolicBP: number;
      temperature: number;
      oxygenSaturation: number;
    };
    alertCounts: Map<string, number>;
    stabilityScore: number;
  } {
    const history = this.vitalHistory.get(patientId) || [];
    const periodReadings = history.filter(v => period.contains(v.timestamp));

    if (periodReadings.length === 0) {
      throw new Error('No readings in specified period');
    }

    // Calculate averages
    const averages = {
      heartRate:
        periodReadings.reduce((sum, v) => sum + v.heartRate.value, 0) /
        periodReadings.length,
      systolicBP:
        periodReadings.reduce(
          (sum, v) => sum + v.bloodPressure.systolic.value,
          0
        ) / periodReadings.length,
      diastolicBP:
        periodReadings.reduce(
          (sum, v) => sum + v.bloodPressure.diastolic.value,
          0
        ) / periodReadings.length,
      temperature:
        periodReadings.reduce((sum, v) => {
          const temp =
            v.temperature.unit === 'C'
              ? v.temperature.value
              : ((v.temperature.value - 32) * 5) / 9;
          return sum + temp;
        }, 0) / periodReadings.length,
      oxygenSaturation:
        periodReadings.reduce((sum, v) => sum + v.oxygenSaturation.value, 0) /
        periodReadings.length,
    };

    // Count alert levels
    const alertCounts = new Map<string, number>();
    let stabilityPoints = 0;

    periodReadings.forEach(vitals => {
      const assessment = vitals.assessCriticalityLevel();
      const count = alertCounts.get(assessment.level) || 0;
      alertCounts.set(assessment.level, count + 1);

      // Calculate stability score (0-100, higher is better)
      switch (assessment.level) {
        case 'stable':
          stabilityPoints += 10;
          break;
        case 'watch':
          stabilityPoints += 7;
          break;
        case 'warning':
          stabilityPoints += 4;
          break;
        case 'critical':
          stabilityPoints += 1;
          break;
        case 'emergency':
          stabilityPoints += 0;
          break;
      }
    });

    const stabilityScore =
      (stabilityPoints / (periodReadings.length * 10)) * 100;

    return {
      totalReadings: periodReadings.length,
      averageVitals: averages,
      alertCounts,
      stabilityScore,
    };
  }

  private notifyAlert(alert: PatientAlert): void {
    this.alertCallbacks.forEach(callback => callback(alert));
  }

  onAlert(callback: (alert: PatientAlert) => void): void {
    this.alertCallbacks.push(callback);
  }
}

class PatientAlert {
  constructor(
    public readonly patientId: string,
    public readonly severity:
      | 'stable'
      | 'watch'
      | 'warning'
      | 'critical'
      | 'emergency',
    public readonly messages: string[],
    public readonly actions: string[],
    public readonly vitals: VitalSigns,
    public readonly timestamp: Date = new Date()
  ) {}

  toString(): string {
    return `[${this.severity.toUpperCase()}] Patient ${this.patientId}: ${this.messages.join(', ')}`;
  }
}

// Usage example
const monitor = new PatientMonitor();

// Set up alert handling
monitor.onAlert(alert => {
  console.log(`🚨 ${alert}`);
  if (alert.actions.length > 0) {
    console.log(`   Actions: ${alert.actions.join('; ')}`);
  }
});

// Simulate patient monitoring
const patientVitals = new VitalSigns(
  'PATIENT-001',
  new Date(),
  Measurement.create(95, 'bpm'),
  {
    systolic: Measurement.create(140, 'mmHg'),
    diastolic: Measurement.create(90, 'mmHg'),
  },
  Measurement.create(38.5, 'C'),
  Measurement.create(92, '%'),
  {
    deviceId: 'MONITOR-A1',
    wardLocation: 'ICU-BED-3',
    attendingNurse: 'Sarah Johnson',
  }
);

const alerts = monitor.addVitalSigns(patientVitals);
const earlyWarning = patientVitals.calculateEarlyWarningScore();

console.log(`Patient vitals: ${patientVitals}`);
console.log(
  `Early Warning Score: ${earlyWarning.score} (${earlyWarning.riskLevel} risk)`
);
console.log(`Alerts generated: ${alerts.length}`);

// Generate summary report
const reportPeriod = DateRange.create(
  new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
  new Date()
);

setTimeout(() => {
  try {
    const summary = monitor.getPatientSummary('PATIENT-001', reportPeriod);
    console.log(`\n24-hour summary:`);
    console.log(`- Readings: ${summary.totalReadings}`);
    console.log(`- Stability Score: ${summary.stabilityScore.toFixed(1)}%`);
    console.log(
      `- Average HR: ${summary.averageVitals.heartRate.toFixed(0)} bpm`
    );
  } catch (error) {
    console.log('Not enough data for summary yet');
  }
}, 1000);
```

### **Business Impact**:

- **Patient Safety**: Early detection of deteriorating conditions
- **Resource Optimization**: Prioritizes nursing attention based on severity
- **Compliance**: Automated documentation for medical records
- **Predictive Care**: Trend analysis enables preventive interventions

---

## Smart City Environmental Monitoring

### **Scenario**: Multi-sensor environmental monitoring with quality assessment

```typescript
import {
  Measurement,
  DateRange,
  UserProfile,
} from '@vytches/ddd-value-objects';

// ✅ Environmental measurement station
class EnvironmentalStation {
  constructor(
    public readonly stationId: string,
    public readonly location: {
      latitude: number;
      longitude: number;
      elevation: number;
    },
    public readonly stationType:
      | 'urban'
      | 'industrial'
      | 'residential'
      | 'traffic',
    public readonly sensors: Map<string, SensorConfiguration>
  ) {}

  recordMeasurement(
    sensorType: string,
    value: number,
    unit: string,
    timestamp: Date = new Date()
  ): EnvironmentalReading {
    const sensorConfig = this.sensors.get(sensorType);
    if (!sensorConfig) {
      throw new Error(`Unknown sensor type: ${sensorType}`);
    }

    const measurement = Measurement.createWithEnvironment(
      value,
      unit,
      {
        temperature: 20, // Would be measured
        humidity: 50, // Would be measured
        pressure: 101325,
      },
      'automated',
      `${this.stationId}-${sensorType}`
    );

    return new EnvironmentalReading(
      this.stationId,
      sensorType,
      measurement,
      timestamp,
      sensorConfig
    );
  }
}

interface SensorConfiguration {
  description: string;
  accuracy: number;
  range: { min: number; max: number };
  calibrationDate: Date;
  maintenanceInterval: number; // days
  alertThresholds: {
    low?: number;
    high?: number;
    critical?: number;
  };
}

class EnvironmentalReading {
  constructor(
    public readonly stationId: string,
    public readonly sensorType: string,
    public readonly measurement: Measurement,
    public readonly timestamp: Date,
    public readonly sensorConfig: SensorConfiguration
  ) {}

  assessAirQuality(): {
    aqi: number; // Air Quality Index
    category:
      | 'good'
      | 'moderate'
      | 'unhealthy_sensitive'
      | 'unhealthy'
      | 'very_unhealthy'
      | 'hazardous';
    healthAdvice: string[];
    primaryPollutant?: string;
  } {
    let aqi = 0;
    let category:
      | 'good'
      | 'moderate'
      | 'unhealthy_sensitive'
      | 'unhealthy'
      | 'very_unhealthy'
      | 'hazardous' = 'good';
    const healthAdvice: string[] = [];
    let primaryPollutant: string | undefined;

    const value = this.measurement.value;

    // Calculate AQI based on sensor type
    switch (this.sensorType) {
      case 'pm2.5':
        // PM2.5 AQI calculation (µg/m³)
        if (value <= 12) aqi = this.calculateSubAQI(value, 0, 12, 0, 50);
        else if (value <= 35.4)
          aqi = this.calculateSubAQI(value, 12.1, 35.4, 51, 100);
        else if (value <= 55.4)
          aqi = this.calculateSubAQI(value, 35.5, 55.4, 101, 150);
        else if (value <= 150.4)
          aqi = this.calculateSubAQI(value, 55.5, 150.4, 151, 200);
        else if (value <= 250.4)
          aqi = this.calculateSubAQI(value, 150.5, 250.4, 201, 300);
        else aqi = this.calculateSubAQI(value, 250.5, 500.4, 301, 500);
        primaryPollutant = 'PM2.5';
        break;

      case 'no2':
        // NO2 AQI calculation (ppb)
        if (value <= 53) aqi = this.calculateSubAQI(value, 0, 53, 0, 50);
        else if (value <= 100)
          aqi = this.calculateSubAQI(value, 54, 100, 51, 100);
        else if (value <= 360)
          aqi = this.calculateSubAQI(value, 101, 360, 101, 150);
        else if (value <= 649)
          aqi = this.calculateSubAQI(value, 361, 649, 151, 200);
        else
          aqi = Math.min(500, this.calculateSubAQI(value, 650, 1249, 201, 300));
        primaryPollutant = 'NO2';
        break;

      case 'o3':
        // Ozone AQI calculation (ppb)
        if (value <= 54) aqi = this.calculateSubAQI(value, 0, 54, 0, 50);
        else if (value <= 70)
          aqi = this.calculateSubAQI(value, 55, 70, 51, 100);
        else if (value <= 85)
          aqi = this.calculateSubAQI(value, 71, 85, 101, 150);
        else if (value <= 105)
          aqi = this.calculateSubAQI(value, 86, 105, 151, 200);
        else aqi = this.calculateSubAQI(value, 106, 200, 201, 300);
        primaryPollutant = 'Ozone';
        break;

      default:
        aqi = 50; // Default moderate
    }

    // Determine category and health advice
    if (aqi <= 50) {
      category = 'good';
      healthAdvice.push('Air quality is satisfactory for most people');
    } else if (aqi <= 100) {
      category = 'moderate';
      healthAdvice.push('Sensitive individuals should limit outdoor activity');
    } else if (aqi <= 150) {
      category = 'unhealthy_sensitive';
      healthAdvice.push('Sensitive groups should avoid outdoor activity');
      healthAdvice.push(
        'Everyone else should limit prolonged outdoor exertion'
      );
    } else if (aqi <= 200) {
      category = 'unhealthy';
      healthAdvice.push('Everyone should avoid outdoor activity');
      healthAdvice.push('Sensitive groups should remain indoors');
    } else if (aqi <= 300) {
      category = 'very_unhealthy';
      healthAdvice.push('Health warnings for everyone');
      healthAdvice.push('Avoid all outdoor activity');
    } else {
      category = 'hazardous';
      healthAdvice.push('Emergency conditions - everyone affected');
      healthAdvice.push('Stay indoors and keep windows closed');
    }

    return { aqi, category, healthAdvice, primaryPollutant };
  }

  private calculateSubAQI(
    concentration: number,
    breakpointLow: number,
    breakpointHigh: number,
    indexLow: number,
    indexHigh: number
  ): number {
    return Math.round(
      ((indexHigh - indexLow) / (breakpointHigh - breakpointLow)) *
        (concentration - breakpointLow) +
        indexLow
    );
  }

  checkCalibrationStatus(): {
    isCalibrated: boolean;
    daysSinceCalibration: number;
    needsCalibration: boolean;
    maintenanceDue: boolean;
  } {
    const now = new Date();
    const daysSince = Math.floor(
      (now.getTime() - this.sensorConfig.calibrationDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const needsCalibration = daysSince > this.sensorConfig.maintenanceInterval;
    const maintenanceDue =
      daysSince > this.sensorConfig.maintenanceInterval * 0.8;

    return {
      isCalibrated: !needsCalibration,
      daysSinceCalibration: daysSince,
      needsCalibration,
      maintenanceDue,
    };
  }

  generateAlert(): EnvironmentalAlert | null {
    const thresholds = this.sensorConfig.alertThresholds;
    const value = this.measurement.value;

    if (thresholds.critical && value >= thresholds.critical) {
      return new EnvironmentalAlert(
        this.stationId,
        'critical',
        `${this.sensorType.toUpperCase()} critical level: ${this.measurement}`,
        ['Immediate action required', 'Notify emergency services'],
        this
      );
    }

    if (thresholds.high && value >= thresholds.high) {
      return new EnvironmentalAlert(
        this.stationId,
        'warning',
        `${this.sensorType.toUpperCase()} high level: ${this.measurement}`,
        ['Monitor closely', 'Consider public advisory'],
        this
      );
    }

    if (thresholds.low && value <= thresholds.low) {
      return new EnvironmentalAlert(
        this.stationId,
        'info',
        `${this.sensorType.toUpperCase()} unusually low: ${this.measurement}`,
        ['Check sensor calibration'],
        this
      );
    }

    return null;
  }

  toString(): string {
    return `[${this.stationId}] ${this.sensorType}: ${this.measurement} at ${this.timestamp.toISOString()}`;
  }
}

class EnvironmentalAlert {
  constructor(
    public readonly stationId: string,
    public readonly severity: 'info' | 'warning' | 'critical',
    public readonly message: string,
    public readonly actions: string[],
    public readonly reading: EnvironmentalReading,
    public readonly timestamp: Date = new Date()
  ) {}

  toString(): string {
    return `[${this.severity.toUpperCase()}] ${this.message}`;
  }
}

// ✅ Environmental monitoring network
class EnvironmentalNetwork {
  private stations: Map<string, EnvironmentalStation> = new Map();
  private readings: Map<string, EnvironmentalReading[]> = new Map();
  private alertCallbacks: Array<(alert: EnvironmentalAlert) => void> = [];

  addStation(station: EnvironmentalStation): void {
    this.stations.set(station.stationId, station);
    this.readings.set(station.stationId, []);
  }

  recordReading(reading: EnvironmentalReading): EnvironmentalAlert[] {
    const stationReadings = this.readings.get(reading.stationId);
    if (!stationReadings) {
      throw new Error(`Unknown station: ${reading.stationId}`);
    }

    stationReadings.push(reading);
    const alerts: EnvironmentalAlert[] = [];

    // Check for immediate alerts
    const immediateAlert = reading.generateAlert();
    if (immediateAlert) {
      alerts.push(immediateAlert);
      this.notifyAlert(immediateAlert);
    }

    // Check calibration status
    const calibration = reading.checkCalibrationStatus();
    if (calibration.needsCalibration) {
      const maintenanceAlert = new EnvironmentalAlert(
        reading.stationId,
        'warning',
        `Sensor ${reading.sensorType} needs calibration (${calibration.daysSinceCalibration} days)`,
        ['Schedule maintenance', 'Verify readings'],
        reading
      );
      alerts.push(maintenanceAlert);
      this.notifyAlert(maintenanceAlert);
    }

    return alerts;
  }

  getNetworkSummary(period: DateRange): {
    totalStations: number;
    totalReadings: number;
    stationSummaries: Array<{
      stationId: string;
      readingCount: number;
      averageAQI: number;
      alertCount: number;
      worstCategory: string;
      sensorStatus: Map<string, boolean>;
    }>;
    networkHealth: number;
  } {
    const summaries: Array<{
      stationId: string;
      readingCount: number;
      averageAQI: number;
      alertCount: number;
      worstCategory: string;
      sensorStatus: Map<string, boolean>;
    }> = [];

    let totalReadings = 0;
    let healthyStations = 0;

    this.stations.forEach((station, stationId) => {
      const stationReadings = this.readings.get(stationId) || [];
      const periodReadings = stationReadings.filter(r =>
        period.contains(r.timestamp)
      );

      if (periodReadings.length === 0) {
        summaries.push({
          stationId,
          readingCount: 0,
          averageAQI: 0,
          alertCount: 0,
          worstCategory: 'no_data',
          sensorStatus: new Map(),
        });
        return;
      }

      totalReadings += periodReadings.length;

      // Calculate AQI statistics
      const aqiReadings = periodReadings
        .filter(r => ['pm2.5', 'no2', 'o3'].includes(r.sensorType))
        .map(r => r.assessAirQuality());

      const averageAQI =
        aqiReadings.length > 0
          ? aqiReadings.reduce((sum, aqi) => sum + aqi.aqi, 0) /
            aqiReadings.length
          : 0;

      // Find worst category
      const categories = [
        'good',
        'moderate',
        'unhealthy_sensitive',
        'unhealthy',
        'very_unhealthy',
        'hazardous',
      ];
      const worstCategoryIndex = Math.max(
        ...aqiReadings.map(aqi => categories.indexOf(aqi.category))
      );
      const worstCategory =
        worstCategoryIndex >= 0 ? categories[worstCategoryIndex] : 'unknown';

      // Count alerts (simplified)
      const alertCount = periodReadings.filter(
        r => r.generateAlert() !== null
      ).length;

      // Check sensor status
      const sensorStatus = new Map<string, boolean>();
      station.sensors.forEach((config, sensorType) => {
        const latestReading = periodReadings
          .filter(r => r.sensorType === sensorType)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        const isHealthy = latestReading
          ? !latestReading.checkCalibrationStatus().needsCalibration
          : false;
        sensorStatus.set(sensorType, isHealthy);
      });

      const stationHealthy = Array.from(sensorStatus.values()).every(
        status => status
      );
      if (stationHealthy) healthyStations++;

      summaries.push({
        stationId,
        readingCount: periodReadings.length,
        averageAQI,
        alertCount,
        worstCategory,
        sensorStatus,
      });
    });

    const networkHealth =
      this.stations.size > 0 ? (healthyStations / this.stations.size) * 100 : 0;

    return {
      totalStations: this.stations.size,
      totalReadings,
      stationSummaries: summaries,
      networkHealth,
    };
  }

  private notifyAlert(alert: EnvironmentalAlert): void {
    this.alertCallbacks.forEach(callback => callback(alert));
  }

  onAlert(callback: (alert: EnvironmentalAlert) => void): void {
    this.alertCallbacks.push(callback);
  }
}

// Usage example
const network = new EnvironmentalNetwork();

// Create monitoring station
const downtownStation = new EnvironmentalStation(
  'DOWNTOWN-001',
  { latitude: 40.7128, longitude: -74.006, elevation: 10 },
  'urban',
  new Map([
    [
      'pm2.5',
      {
        description: 'Particulate Matter 2.5µm',
        accuracy: 0.95,
        range: { min: 0, max: 500 },
        calibrationDate: new Date('2025-01-01'),
        maintenanceInterval: 90,
        alertThresholds: { high: 35, critical: 100 },
      },
    ],
    [
      'no2',
      {
        description: 'Nitrogen Dioxide',
        accuracy: 0.92,
        range: { min: 0, max: 1000 },
        calibrationDate: new Date('2025-01-01'),
        maintenanceInterval: 90,
        alertThresholds: { high: 100, critical: 300 },
      },
    ],
    [
      'o3',
      {
        description: 'Ground-level Ozone',
        accuracy: 0.88,
        range: { min: 0, max: 300 },
        calibrationDate: new Date('2025-01-01'),
        maintenanceInterval: 90,
        alertThresholds: { high: 70, critical: 105 },
      },
    ],
  ])
);

network.addStation(downtownStation);

// Set up alert monitoring
network.onAlert(alert => {
  console.log(`🌍 ${alert}`);
  if (alert.actions.length > 0) {
    console.log(`   Actions: ${alert.actions.join('; ')}`);
  }
});

// Simulate environmental readings
const pm25Reading = downtownStation.recordMeasurement('pm2.5', 45, 'µg/m³');
const no2Reading = downtownStation.recordMeasurement('no2', 85, 'ppb');
const o3Reading = downtownStation.recordMeasurement('o3', 65, 'ppb');

[pm25Reading, no2Reading, o3Reading].forEach(reading => {
  const alerts = network.recordReading(reading);
  const airQuality = reading.assessAirQuality();

  console.log(`${reading}`);
  console.log(`  AQI: ${airQuality.aqi} (${airQuality.category})`);
  if (airQuality.primaryPollutant) {
    console.log(`  Primary pollutant: ${airQuality.primaryPollutant}`);
  }
  console.log(`  Health advice: ${airQuality.healthAdvice.join('; ')}`);
  console.log(`  Alerts: ${alerts.length}`);
});

// Generate network summary
const reportPeriod = DateRange.create(
  new Date(Date.now() - 24 * 60 * 60 * 1000),
  new Date()
);

setTimeout(() => {
  const summary = network.getNetworkSummary(reportPeriod);
  console.log(`\nNetwork Summary:`);
  console.log(`- Total stations: ${summary.totalStations}`);
  console.log(`- Network health: ${summary.networkHealth.toFixed(1)}%`);
  console.log(`- Total readings: ${summary.totalReadings}`);

  summary.stationSummaries.forEach(station => {
    console.log(`\nStation ${station.stationId}:`);
    console.log(`  - Readings: ${station.readingCount}`);
    console.log(`  - Average AQI: ${station.averageAQI.toFixed(0)}`);
    console.log(`  - Worst category: ${station.worstCategory}`);
    console.log(`  - Alerts: ${station.alertCount}`);
  });
}, 1000);
```

### **Business Impact**:

- **Public Health**: Real-time air quality monitoring protects citizens
- **Environmental Compliance**: Automated regulatory reporting
- **Smart City Integration**: Data feeds urban planning decisions
- **Predictive Analytics**: Trend analysis enables proactive measures

---

## Summary

These intermediate use cases demonstrate how value objects enable:

1. **Complex Domain Logic**: Multi-object validation and business rule
   enforcement
2. **Statistical Analysis**: Built-in calculation capabilities for quality
   control
3. **Trend Detection**: Time-series analysis and alerting systems
4. **System Integration**: Coordination between multiple domain objects
5. **Quality Assessment**: Automated evaluation and scoring systems
6. **Real-time Monitoring**: Continuous validation with intelligent alerting

The examples show how value objects can encapsulate sophisticated business
intelligence while maintaining immutability and ensuring data integrity across
complex workflows.
