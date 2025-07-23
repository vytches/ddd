# Basic Use Cases

**Version**: 1.0.0
**Package**: @vytches-ddd/projections
**Complexity**: basic
**Domain**: Event Sourcing
**Patterns**: Real-world scenarios, business applications
**Dependencies**: @vytches-ddd/projections, @vytches-ddd/events

## Description

Real-world use cases demonstrating basic event projection patterns in common business scenarios. These examples show practical applications of projections for building read models, dashboards, and analytics across different industries and domains.

## Business Context

Event projections solve common business challenges:
- Creating optimized views for different user interfaces
- Building real-time dashboards and analytics
- Supporting complex queries without impacting write performance
- Maintaining denormalized data for fast reporting
- Tracking business metrics and KPIs in real-time

These use cases demonstrate how projections transform event streams into valuable business insights.

## Use Case Examples

### **Use Case 1: E-Commerce Customer Dashboard**

```typescript
// customer-dashboard-projection.ts
import { ProjectionBase, EventHandler } from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';
import { UserData, OrderData, ServiceResponse } from '../types';

// Business Requirement: Real-time customer dashboard showing:
// - Customer profile and activity
// - Order history and status
// - Purchase patterns and recommendations
// - Support ticket status

export class CustomerDashboardProjection extends ProjectionBase<any> {
  constructor() {
    super('CustomerDashboardProjection', 'v1.0');
    this.setState({
      customerDashboards: new Map<string, any>(),
      lastUpdated: new Date()
    });
  }

  @EventHandler('CustomerRegistered')
  async onCustomerRegistered(event: IDomainEvent): Promise<void> {
    const customerData = event.payload;
    const dashboard = {
      customerId: customerData.customerId,
      profile: {
        name: customerData.name,
        email: customerData.email,
        registrationDate: new Date(event.timestamp),
        tier: 'Bronze',
        loyaltyPoints: 0
      },
      orderSummary: {
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        lastOrderDate: null,
        favoriteCategories: []
      },
      recentActivity: [],
      supportTickets: {
        open: 0,
        resolved: 0,
        averageResolutionTime: 0
      },
      recommendations: []
    };

    const state = this.getState();
    state.customerDashboards.set(customerData.customerId, dashboard);
    state.lastUpdated = new Date();
    this.setState(state);

    console.log(`Customer dashboard created for: ${customerData.name}`);
  }

  @EventHandler('OrderPlaced')
  async onOrderPlaced(event: IDomainEvent): Promise<void> {
    const orderData = event.payload;
    const state = this.getState();
    const dashboard = state.customerDashboards.get(orderData.customerId);

    if (dashboard) {
      // Update order summary
      dashboard.orderSummary.totalOrders += 1;
      dashboard.orderSummary.totalSpent += orderData.total;
      dashboard.orderSummary.averageOrderValue = 
        dashboard.orderSummary.totalSpent / dashboard.orderSummary.totalOrders;
      dashboard.orderSummary.lastOrderDate = new Date(event.timestamp);

      // Update tier based on spending
      dashboard.profile.tier = this.calculateCustomerTier(dashboard.orderSummary.totalSpent);

      // Track category preferences
      orderData.items?.forEach((item: any) => {
        this.updateCategoryPreference(dashboard.orderSummary.favoriteCategories, item.category);
      });

      // Add to recent activity
      dashboard.recentActivity.unshift({
        type: 'order_placed',
        orderId: orderData.orderId,
        amount: orderData.total,
        timestamp: new Date(event.timestamp)
      });

      // Keep only last 10 activities
      dashboard.recentActivity = dashboard.recentActivity.slice(0, 10);

      // Update recommendations based on purchase history
      dashboard.recommendations = this.generateRecommendations(dashboard);

      state.customerDashboards.set(orderData.customerId, dashboard);
      state.lastUpdated = new Date();
      this.setState(state);
    }
  }

  @EventHandler('SupportTicketOpened')
  async onSupportTicketOpened(event: IDomainEvent): Promise<void> {
    const ticketData = event.payload;
    const state = this.getState();
    const dashboard = state.customerDashboards.get(ticketData.customerId);

    if (dashboard) {
      dashboard.supportTickets.open += 1;
      
      dashboard.recentActivity.unshift({
        type: 'support_ticket_opened',
        ticketId: ticketData.ticketId,
        subject: ticketData.subject,
        timestamp: new Date(event.timestamp)
      });

      state.customerDashboards.set(ticketData.customerId, dashboard);
      this.setState(state);
    }
  }

  // Query methods for dashboard API
  getCustomerDashboard(customerId: string): any {
    return this.getState().customerDashboards.get(customerId);
  }

  getCustomersByTier(tier: string): any[] {
    return Array.from(this.getState().customerDashboards.values())
      .filter(dashboard => dashboard.profile.tier === tier);
  }

  private calculateCustomerTier(totalSpent: number): string {
    if (totalSpent >= 10000) return 'Platinum';
    if (totalSpent >= 5000) return 'Gold';
    if (totalSpent >= 1000) return 'Silver';
    return 'Bronze';
  }

  private updateCategoryPreference(categories: any[], category: string): void {
    const existing = categories.find(c => c.name === category);
    if (existing) {
      existing.count += 1;
    } else {
      categories.push({ name: category, count: 1 });
    }
    
    // Sort by count and keep top 5
    categories.sort((a, b) => b.count - a.count);
    categories.splice(5);
  }

  private generateRecommendations(dashboard: any): any[] {
    // Simple recommendation logic based on favorite categories
    const topCategories = dashboard.orderSummary.favoriteCategories.slice(0, 3);
    return topCategories.map((cat: any) => ({
      type: 'category_recommendation',
      category: cat.name,
      reason: `Based on your ${cat.count} previous purchases in ${cat.name}`
    }));
  }
}
```

### **Use Case 2: SaaS Application Analytics**

```typescript
// saas-analytics-projection.ts
import { ProjectionBase, EventHandler } from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';

// Business Requirement: SaaS platform analytics showing:
// - User engagement and feature usage
// - Subscription metrics and churn analysis
// - Performance and system health metrics
// - Revenue and growth tracking

export class SaaSAnalyticsProjection extends ProjectionBase<any> {
  constructor() {
    super('SaaSAnalyticsProjection', 'v1.0');
    this.setState({
      tenants: new Map<string, any>(),
      dailyMetrics: new Map<string, any>(),
      featureUsage: new Map<string, any>(),
      subscriptionMetrics: {
        activeSubscriptions: 0,
        totalRevenue: 0,
        churnRate: 0,
        averageRevenuePerUser: 0
      },
      lastUpdated: new Date()
    });
  }

  @EventHandler('TenantRegistered')
  async onTenantRegistered(event: IDomainEvent): Promise<void> {
    const tenantData = event.payload;
    const state = this.getState();

    const tenant = {
      tenantId: tenantData.tenantId,
      name: tenantData.companyName,
      plan: tenantData.subscriptionPlan,
      registrationDate: new Date(event.timestamp),
      users: 0,
      monthlyRevenue: tenantData.monthlyFee || 0,
      features: {
        totalFeatureUsage: 0,
        mostUsedFeatures: []
      },
      engagement: {
        dailyActiveUsers: 0,
        monthlyActiveUsers: 0,
        lastActivityDate: null
      },
      status: 'active'
    };

    state.tenants.set(tenantData.tenantId, tenant);
    
    // Update subscription metrics
    state.subscriptionMetrics.activeSubscriptions += 1;
    state.subscriptionMetrics.totalRevenue += tenant.monthlyRevenue;
    state.subscriptionMetrics.averageRevenuePerUser = 
      state.subscriptionMetrics.totalRevenue / state.subscriptionMetrics.activeSubscriptions;

    state.lastUpdated = new Date();
    this.setState(state);

    console.log(`SaaS tenant registered: ${tenantData.companyName}`);
  }

  @EventHandler('FeatureUsed')
  async onFeatureUsed(event: IDomainEvent): Promise<void> {
    const usageData = event.payload;
    const state = this.getState();
    const tenant = state.tenants.get(usageData.tenantId);

    if (tenant) {
      // Update tenant feature usage
      tenant.features.totalFeatureUsage += 1;
      tenant.engagement.lastActivityDate = new Date(event.timestamp);
      
      // Track feature popularity
      const featureName = usageData.featureName;
      const currentUsage = state.featureUsage.get(featureName) || {
        name: featureName,
        totalUsage: 0,
        uniqueUsers: new Set(),
        averageUsagePerUser: 0
      };
      
      currentUsage.totalUsage += 1;
      currentUsage.uniqueUsers.add(usageData.userId);
      currentUsage.averageUsagePerUser = currentUsage.totalUsage / currentUsage.uniqueUsers.size;
      
      state.featureUsage.set(featureName, currentUsage);

      // Update daily metrics
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      const dailyMetric = state.dailyMetrics.get(date) || {
        date,
        activeUsers: new Set(),
        featureUsage: 0,
        newTenants: 0,
        revenue: 0
      };
      
      dailyMetric.activeUsers.add(usageData.userId);
      dailyMetric.featureUsage += 1;
      
      state.dailyMetrics.set(date, dailyMetric);
      state.tenants.set(usageData.tenantId, tenant);
      state.lastUpdated = new Date();
      this.setState(state);
    }
  }

  @EventHandler('SubscriptionCancelled')
  async onSubscriptionCancelled(event: IDomainEvent): Promise<void> {
    const cancellationData = event.payload;
    const state = this.getState();
    const tenant = state.tenants.get(cancellationData.tenantId);

    if (tenant) {
      tenant.status = 'cancelled';
      tenant.cancellationDate = new Date(event.timestamp);
      tenant.cancellationReason = cancellationData.reason;

      // Update subscription metrics
      state.subscriptionMetrics.activeSubscriptions -= 1;
      state.subscriptionMetrics.totalRevenue -= tenant.monthlyRevenue;
      
      if (state.subscriptionMetrics.activeSubscriptions > 0) {
        state.subscriptionMetrics.averageRevenuePerUser = 
          state.subscriptionMetrics.totalRevenue / state.subscriptionMetrics.activeSubscriptions;
      }

      // Update churn rate (simplified calculation)
      const totalTenants = state.tenants.size;
      const cancelledTenants = Array.from(state.tenants.values())
        .filter(t => t.status === 'cancelled').length;
      state.subscriptionMetrics.churnRate = (cancelledTenants / totalTenants) * 100;

      state.tenants.set(cancellationData.tenantId, tenant);
      state.lastUpdated = new Date();
      this.setState(state);
    }
  }

  // Analytics query methods
  getDashboardMetrics(): any {
    const state = this.getState();
    const activeTenants = Array.from(state.tenants.values())
      .filter(t => t.status === 'active');

    return {
      subscriptionMetrics: state.subscriptionMetrics,
      tenantMetrics: {
        activeTenants: activeTenants.length,
        totalTenants: state.tenants.size,
        averageUsersPerTenant: activeTenants.reduce((sum, t) => sum + t.users, 0) / activeTenants.length
      },
      topFeatures: this.getTopFeatures(5),
      growthMetrics: this.calculateGrowthMetrics()
    };
  }

  getTopFeatures(limit: number): any[] {
    return Array.from(this.getState().featureUsage.values())
      .sort((a, b) => b.totalUsage - a.totalUsage)
      .slice(0, limit)
      .map(feature => ({
        name: feature.name,
        usage: feature.totalUsage,
        uniqueUsers: feature.uniqueUsers.size
      }));
  }

  getTenantAnalytics(tenantId: string): any {
    const tenant = this.getState().tenants.get(tenantId);
    if (!tenant) return null;

    return {
      ...tenant,
      healthScore: this.calculateTenantHealthScore(tenant),
      riskLevel: this.assessChurnRisk(tenant)
    };
  }

  private calculateGrowthMetrics(): any {
    const last30Days = Array.from(this.getState().dailyMetrics.values())
      .filter(metric => {
        const metricDate = new Date(metric.date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return metricDate >= thirtyDaysAgo;
      });

    const totalNewTenants = last30Days.reduce((sum, metric) => sum + metric.newTenants, 0);
    const averageDailyActiveUsers = last30Days.reduce((sum, metric) => 
      sum + metric.activeUsers.size, 0) / Math.max(last30Days.length, 1);

    return {
      newTenantsLast30Days: totalNewTenants,
      averageDailyActiveUsers,
      growthRate: this.calculateMonthlyGrowthRate()
    };
  }

  private calculateTenantHealthScore(tenant: any): number {
    let score = 0;
    
    // Feature usage score (0-40 points)
    if (tenant.features.totalFeatureUsage > 100) score += 40;
    else if (tenant.features.totalFeatureUsage > 50) score += 30;
    else if (tenant.features.totalFeatureUsage > 10) score += 20;
    else score += 10;
    
    // Engagement score (0-30 points)
    const daysSinceLastActivity = tenant.engagement.lastActivityDate ? 
      (Date.now() - tenant.engagement.lastActivityDate.getTime()) / (24 * 60 * 60 * 1000) : 999;
    
    if (daysSinceLastActivity <= 1) score += 30;
    else if (daysSinceLastActivity <= 7) score += 20;
    else if (daysSinceLastActivity <= 30) score += 10;
    
    // Plan score (0-30 points)
    const planScores: Record<string, number> = { 'enterprise': 30, 'pro': 20, 'basic': 10 };
    score += planScores[tenant.plan.toLowerCase()] || 0;
    
    return Math.min(score, 100);
  }

  private assessChurnRisk(tenant: any): 'low' | 'medium' | 'high' {
    const healthScore = this.calculateTenantHealthScore(tenant);
    
    if (healthScore >= 80) return 'low';
    if (healthScore >= 50) return 'medium';
    return 'high';
  }

  private calculateMonthlyGrowthRate(): number {
    // Simplified growth rate calculation
    const activeTenants = Array.from(this.getState().tenants.values())
      .filter(t => t.status === 'active');
    
    const thisMonth = activeTenants.filter(t => {
      const regDate = new Date(t.registrationDate);
      const now = new Date();
      return regDate.getMonth() === now.getMonth() && regDate.getFullYear() === now.getFullYear();
    }).length;
    
    const lastMonth = activeTenants.filter(t => {
      const regDate = new Date(t.registrationDate);
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return regDate.getMonth() === lastMonth.getMonth() && regDate.getFullYear() === lastMonth.getFullYear();
    }).length;
    
    return lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
  }
}
```

### **Use Case 3: Healthcare Patient Management**

```typescript
// patient-care-projection.ts
import { ProjectionBase, EventHandler } from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';

// Business Requirement: Healthcare patient management showing:
// - Patient medical history and records
// - Treatment plans and medication tracking
// - Appointment scheduling and outcomes
// - Care quality metrics and alerts

export class PatientCareProjection extends ProjectionBase<any> {
  constructor() {
    super('PatientCareProjection', 'v1.0');
    this.setState({
      patients: new Map<string, any>(),
      careAlerts: new Map<string, any[]>(),
      qualityMetrics: {
        patientSatisfactionAvg: 0,
        treatmentSuccessRate: 0,
        averageWaitTime: 0,
        missedAppointmentRate: 0
      },
      lastUpdated: new Date()
    });
  }

  @EventHandler('PatientRegistered')
  async onPatientRegistered(event: IDomainEvent): Promise<void> {
    const patientData = event.payload;
    const state = this.getState();

    const patient = {
      patientId: patientData.patientId,
      personalInfo: {
        name: patientData.name,
        dateOfBirth: patientData.dateOfBirth,
        gender: patientData.gender,
        contactInfo: patientData.contactInfo
      },
      medicalHistory: {
        allergies: patientData.allergies || [],
        chronicConditions: patientData.chronicConditions || [],
        medications: [],
        procedures: []
      },
      careTeam: {
        primaryPhysician: null,
        specialists: []
      },
      appointments: {
        upcoming: [],
        completed: [],
        missed: 0,
        totalScheduled: 0
      },
      treatmentPlans: [],
      vitalSigns: [],
      registrationDate: new Date(event.timestamp),
      riskLevel: 'low'
    };

    // Assess initial risk level based on chronic conditions
    patient.riskLevel = this.assessPatientRiskLevel(patient);

    state.patients.set(patientData.patientId, patient);
    state.lastUpdated = new Date();
    this.setState(state);

    console.log(`Patient registered: ${patientData.name} (Risk: ${patient.riskLevel})`);
  }

  @EventHandler('MedicalRecordAdded')
  async onMedicalRecordAdded(event: IDomainEvent): Promise<void> {
    const recordData = event.payload;
    const state = this.getState();
    const patient = state.patients.get(recordData.patientId);

    if (patient) {
      const record = {
        recordId: recordData.recordId,
        type: recordData.recordType,
        diagnosis: recordData.diagnosis,
        treatment: recordData.treatment,
        physician: recordData.physician,
        date: new Date(event.timestamp),
        notes: recordData.notes
      };

      patient.medicalHistory.procedures.push(record);

      // Update risk level based on new diagnosis
      if (recordData.diagnosis && this.isHighRiskCondition(recordData.diagnosis)) {
        patient.riskLevel = 'high';
        
        // Create care alert
        const alert = {
          alertId: `alert-${Date.now()}`,
          patientId: recordData.patientId,
          type: 'high_risk_condition',
          message: `New high-risk condition diagnosed: ${recordData.diagnosis}`,
          severity: 'critical',
          createdAt: new Date(event.timestamp),
          acknowledged: false
        };

        const patientAlerts = state.careAlerts.get(recordData.patientId) || [];
        patientAlerts.push(alert);
        state.careAlerts.set(recordData.patientId, patientAlerts);
      }

      state.patients.set(recordData.patientId, patient);
      state.lastUpdated = new Date();
      this.setState(state);
    }
  }

  @EventHandler('VitalSignsRecorded')
  async onVitalSignsRecorded(event: IDomainEvent): Promise<void> {
    const vitalData = event.payload;
    const state = this.getState();
    const patient = state.patients.get(vitalData.patientId);

    if (patient) {
      const vitalSigns = {
        recordId: vitalData.recordId,
        bloodPressure: vitalData.bloodPressure,
        heartRate: vitalData.heartRate,
        temperature: vitalData.temperature,
        weight: vitalData.weight,
        recordedAt: new Date(event.timestamp),
        recordedBy: vitalData.recordedBy
      };

      patient.vitalSigns.push(vitalSigns);
      
      // Keep only last 50 vital sign records
      patient.vitalSigns = patient.vitalSigns.slice(-50);

      // Check for abnormal readings and create alerts
      const alerts = this.checkVitalSignsForAlerts(vitalData.patientId, vitalSigns);
      if (alerts.length > 0) {
        const patientAlerts = state.careAlerts.get(vitalData.patientId) || [];
        patientAlerts.push(...alerts);
        state.careAlerts.set(vitalData.patientId, patientAlerts);
      }

      state.patients.set(vitalData.patientId, patient);
      state.lastUpdated = new Date();
      this.setState(state);
    }
  }

  @EventHandler('AppointmentCompleted')
  async onAppointmentCompleted(event: IDomainEvent): Promise<void> {
    const appointmentData = event.payload;
    const state = this.getState();
    const patient = state.patients.get(appointmentData.patientId);

    if (patient) {
      const appointment = {
        appointmentId: appointmentData.appointmentId,
        physician: appointmentData.physician,
        type: appointmentData.appointmentType,
        outcome: appointmentData.outcome,
        notes: appointmentData.notes,
        satisfactionScore: appointmentData.satisfactionScore,
        completedAt: new Date(event.timestamp)
      };

      patient.appointments.completed.push(appointment);
      patient.appointments.totalScheduled += 1;

      // Update quality metrics
      this.updateQualityMetrics(state, appointment);

      state.patients.set(appointmentData.patientId, patient);
      state.lastUpdated = new Date();
      this.setState(state);
    }
  }

  // Query methods for healthcare applications
  getPatientRecord(patientId: string): any {
    return this.getState().patients.get(patientId);
  }

  getHighRiskPatients(): any[] {
    return Array.from(this.getState().patients.values())
      .filter(patient => patient.riskLevel === 'high');
  }

  getPatientAlerts(patientId: string): any[] {
    return this.getState().careAlerts.get(patientId) || [];
  }

  getUnacknowledgedAlerts(): any[] {
    const allAlerts: any[] = [];
    for (const alerts of this.getState().careAlerts.values()) {
      allAlerts.push(...alerts.filter(alert => !alert.acknowledged));
    }
    return allAlerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getQualityMetrics(): any {
    return { ...this.getState().qualityMetrics };
  }

  // Private helper methods
  private assessPatientRiskLevel(patient: any): 'low' | 'medium' | 'high' {
    const chronicConditions = patient.medicalHistory.chronicConditions.length;
    const age = this.calculateAge(patient.personalInfo.dateOfBirth);

    if (chronicConditions >= 3 || age >= 75) return 'high';
    if (chronicConditions >= 1 || age >= 65) return 'medium';
    return 'low';
  }

  private isHighRiskCondition(diagnosis: string): boolean {
    const highRiskConditions = [
      'diabetes', 'heart failure', 'copd', 'cancer', 
      'kidney disease', 'stroke', 'heart attack'
    ];
    return highRiskConditions.some(condition => 
      diagnosis.toLowerCase().includes(condition)
    );
  }

  private checkVitalSignsForAlerts(patientId: string, vitals: any): any[] {
    const alerts: any[] = [];

    // Blood pressure alerts
    if (vitals.bloodPressure) {
      const [systolic, diastolic] = vitals.bloodPressure.split('/').map(Number);
      if (systolic > 180 || diastolic > 120) {
        alerts.push({
          alertId: `bp-alert-${Date.now()}`,
          patientId,
          type: 'critical_blood_pressure',
          message: `Critical blood pressure reading: ${vitals.bloodPressure}`,
          severity: 'critical',
          createdAt: new Date(),
          acknowledged: false
        });
      }
    }

    // Heart rate alerts
    if (vitals.heartRate && (vitals.heartRate > 120 || vitals.heartRate < 50)) {
      alerts.push({
        alertId: `hr-alert-${Date.now()}`,
        patientId,
        type: 'abnormal_heart_rate',
        message: `Abnormal heart rate: ${vitals.heartRate} bpm`,
        severity: 'high',
        createdAt: new Date(),
        acknowledged: false
      });
    }

    return alerts;
  }

  private updateQualityMetrics(state: any, appointment: any): void {
    const metrics = state.qualityMetrics;
    
    // Update satisfaction average
    if (appointment.satisfactionScore) {
      const totalPatients = state.patients.size;
      metrics.patientSatisfactionAvg = 
        (metrics.patientSatisfactionAvg * (totalPatients - 1) + appointment.satisfactionScore) / totalPatients;
    }

    // Treatment success rate (simplified)
    if (appointment.outcome === 'successful') {
      const totalAppointments = Array.from(state.patients.values())
        .reduce((sum, patient) => sum + patient.appointments.completed.length, 0);
      metrics.treatmentSuccessRate = (metrics.treatmentSuccessRate * (totalAppointments - 1) + 1) / totalAppointments;
    }
  }

  private calculateAge(dateOfBirth: string): number {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }
}
```

## Business Benefits by Industry

### **E-Commerce**
- **Real-time customer insights**: Instant view of customer behavior and preferences
- **Personalized experiences**: Dynamic recommendations based on purchase history
- **Revenue optimization**: Track metrics that drive conversion and retention
- **Customer service excellence**: Complete context for support interactions

### **SaaS Platforms**
- **Product analytics**: Understanding feature usage and user engagement
- **Churn prediction**: Early identification of at-risk customers
- **Revenue tracking**: Real-time subscription and growth metrics
- **Performance monitoring**: System health and user experience metrics

### **Healthcare**
- **Patient safety**: Real-time alerts for critical conditions and abnormal readings
- **Care coordination**: Complete patient history accessible to entire care team
- **Quality improvement**: Metrics for treatment outcomes and patient satisfaction
- **Compliance reporting**: Automated tracking for regulatory requirements

## Implementation Patterns

### **Dashboard Projections**
```typescript
// Common pattern for dashboard data
interface DashboardProjection {
  summaryMetrics: SummaryData;
  timeSeriesData: TimeSeriesData[];
  topItems: RankedItem[];
  alerts: AlertData[];
  lastUpdated: Date;
}
```

### **Analytics Projections**
```typescript
// Pattern for analytics and reporting
interface AnalyticsProjection {
  dimensions: Map<string, DimensionData>;
  measures: Map<string, MeasureData>;
  filters: FilterConfig[];
  aggregations: AggregationResult[];
}
```

### **Operational Projections**
```typescript
// Pattern for operational monitoring
interface OperationalProjection {
  entities: Map<string, EntityState>;
  workflows: Map<string, WorkflowState>;
  alerts: AlertQueue[];
  metrics: PerformanceMetrics;
}
```

## Common Benefits

1. **Real-time Insights**: Immediate updates as events occur
2. **Optimized Queries**: Purpose-built data structures for specific use cases
3. **Scalable Reads**: Handle high query loads without impacting writes
4. **Flexible Views**: Multiple projections for different stakeholder needs
5. **Historical Tracking**: Complete audit trail of business activities
6. **Alert Generation**: Proactive notifications for critical conditions

## Success Metrics

- **Query Performance**: Sub-second response times for dashboard queries
- **Data Freshness**: Near real-time updates (< 1 minute lag)
- **System Reliability**: 99.9% uptime for projection processing
- **Business Value**: Measurable improvements in decision-making speed
- **User Adoption**: High usage rates for generated dashboards and reports

## Related Examples

- [Simple Event Projection](./example-1.md)
- [Projection with Capabilities](./example-2.md)
- [Projection Engine Setup](./example-3.md)
- [Basic Implementation Guide](./implementation.md)