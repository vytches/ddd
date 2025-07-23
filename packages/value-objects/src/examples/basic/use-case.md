# Value Objects - Basic Use Cases

**Version**: 2025-01-21 **Package**: @vytches-ddd/value-objects  
**Complexity**: Basic **Focus**: Real-world applications and business scenarios

## Overview

This document outlines common real-world use cases where basic value objects
provide immediate business value. These scenarios demonstrate how value objects
solve practical problems in everyday applications.

## E-Commerce Platform

### **Scenario**: Online Shopping Cart Management

```typescript
import { Money, Email, Address } from '@vytches-ddd/value-objects';

// ✅ Product pricing with currency safety
class Product {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly price: Money
  ) {}

  applyDiscount(percentage: number): Product {
    const discountAmount = this.price.multiply(percentage / 100);
    const newPrice = this.price.subtract(discountAmount);

    return new Product(this.id, this.name, newPrice);
  }
}

// ✅ Shopping cart calculations
class ShoppingCart {
  private items: Map<string, { product: Product; quantity: number }> =
    new Map();

  addItem(product: Product, quantity: number): void {
    const existingItem = this.items.get(product.id);
    const newQuantity = existingItem
      ? existingItem.quantity + quantity
      : quantity;

    this.items.set(product.id, { product, quantity: newQuantity });
  }

  getSubtotal(): Money {
    let total = Money.create(0, 'USD');

    for (const { product, quantity } of this.items.values()) {
      const lineTotal = product.price.multiply(quantity);
      total = total.add(lineTotal);
    }

    return total;
  }

  calculateTax(rate: number): Money {
    return this.getSubtotal().multiply(rate);
  }

  getTotal(taxRate: number): Money {
    const subtotal = this.getSubtotal();
    const tax = this.calculateTax(taxRate);
    return subtotal.add(tax);
  }
}

// ✅ Customer with validated contact information
class Customer {
  constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly shippingAddress: Address,
    public readonly billingAddress?: Address
  ) {}

  getBillingAddress(): Address {
    return this.billingAddress || this.shippingAddress;
  }

  canShipTo(country: string): boolean {
    return this.shippingAddress.country === country;
  }

  isInternationalCustomer(): boolean {
    return this.shippingAddress.isInternationalAddress();
  }
}

// Usage example
const laptop = new Product(
  'laptop-001',
  'Gaming Laptop',
  Money.create(1299.99, 'USD')
);
const mouse = new Product(
  'mouse-001',
  'Wireless Mouse',
  Money.create(79.99, 'USD')
);

const cart = new ShoppingCart();
cart.addItem(laptop, 1);
cart.addItem(mouse, 2);

const customer = new Customer(
  'cust-001',
  Email.create('john.doe@example.com'),
  Address.create('123 Main St', 'Springfield', 'IL', '62701', 'US')
);

console.log(`Subtotal: ${cart.getSubtotal()}`); // $1,459.97
console.log(`Total: ${cart.getTotal(0.08)}`); // $1,576.77
console.log(`Customer: ${customer.email}`); // john.doe@example.com
```

### **Business Impact**:

- **Currency Safety**: Prevents mixing different currencies in calculations
- **Precision Accuracy**: Avoids floating-point arithmetic errors
- **Data Integrity**: Ensures valid email addresses and addresses
- **Business Logic**: Clean separation of pricing and customer logic

---

## SaaS User Management

### **Scenario**: Multi-tenant user registration and billing

```typescript
import { Email, Money } from '@vytches-ddd/value-objects';

// ✅ Subscription pricing with different currencies
class SubscriptionPlan {
  constructor(
    public readonly name: string,
    public readonly monthlyPrice: Money,
    public readonly maxUsers: number
  ) {}

  calculateAnnualPrice(discountPercentage: number = 10): Money {
    const monthlyTotal = this.monthlyPrice.multiply(12);
    const discountAmount = monthlyTotal.multiply(discountPercentage / 100);
    return monthlyTotal.subtract(discountAmount);
  }

  getPricePerUser(): Money {
    return this.monthlyPrice.divide(this.maxUsers);
  }
}

// ✅ User account with verified email requirement
class UserAccount {
  constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly createdAt: Date,
    public readonly isActive: boolean = true
  ) {}

  static create(emailAddress: string): UserAccount {
    const email = Email.create(emailAddress);
    return new UserAccount(generateId(), email, new Date(), true);
  }

  requiresEmailVerification(): boolean {
    return !this.email.isVerified;
  }

  verifyEmail(): UserAccount {
    const verifiedEmail = this.email.markAsVerified();
    return new UserAccount(
      this.id,
      verifiedEmail,
      this.createdAt,
      this.isActive
    );
  }

  deactivate(): UserAccount {
    return new UserAccount(this.id, this.email, this.createdAt, false);
  }
}

// ✅ Tenant organization
class Organization {
  private users: UserAccount[] = [];

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly plan: SubscriptionPlan,
    public readonly adminEmail: Email
  ) {}

  addUser(emailAddress: string): {
    success: boolean;
    user?: UserAccount;
    error?: string;
  } {
    if (this.users.length >= this.plan.maxUsers) {
      return {
        success: false,
        error: `Cannot exceed plan limit of ${this.plan.maxUsers} users`,
      };
    }

    try {
      const user = UserAccount.create(emailAddress);
      this.users.push(user);
      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  calculateMonthlyBill(): Money {
    const activeUsers = this.users.filter(u => u.isActive).length;
    const usedSlots = Math.max(activeUsers, 1); // Minimum billing

    return this.plan.getPricePerUser().multiply(usedSlots);
  }

  getUnverifiedUsers(): UserAccount[] {
    return this.users.filter(u => u.requiresEmailVerification());
  }
}

// Usage example
const starterPlan = new SubscriptionPlan(
  'Starter',
  Money.create(29.99, 'USD'),
  5
);
const proPlan = new SubscriptionPlan(
  'Professional',
  Money.create(99.99, 'USD'),
  25
);

const org = new Organization(
  'org-001',
  'Acme Corp',
  starterPlan,
  Email.createVerified('admin@acmecorp.com')
);

// Add team members
const results = [
  'john@acmecorp.com',
  'jane@acmecorp.com',
  'invalid-email', // This will fail
].map(email => org.addUser(email));

results.forEach((result, index) => {
  if (result.success) {
    console.log(`✓ Added user: ${result.user!.email}`);
  } else {
    console.log(`✗ Failed to add user: ${result.error}`);
  }
});

console.log(`Monthly bill: ${org.calculateMonthlyBill()}`);
console.log(`Annual savings: ${starterPlan.calculateAnnualPrice()}`);

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}
```

### **Business Impact**:

- **Email Validation**: Prevents invalid email addresses in user accounts
- **Billing Accuracy**: Precise subscription calculations without rounding
  errors
- **Multi-Currency Support**: Handle global customers with proper currency
  handling
- **Data Consistency**: Immutable user accounts ensure audit trails

---

## Financial Trading Platform

### **Scenario**: Portfolio management and risk calculations

```typescript
import { Money } from '@vytches-ddd/value-objects';

// ✅ Trading position with profit/loss calculations
class TradingPosition {
  constructor(
    public readonly symbol: string,
    public readonly quantity: number,
    public readonly entryPrice: Money,
    public readonly currentPrice: Money
  ) {
    if (!entryPrice.currency !== currentPrice.currency) {
      throw new Error('Entry and current price must be in same currency');
    }
  }

  updatePrice(newPrice: Money): TradingPosition {
    return new TradingPosition(
      this.symbol,
      this.quantity,
      this.entryPrice,
      newPrice
    );
  }

  getUnrealizedPnL(): Money {
    const priceDiff = this.currentPrice.subtract(this.entryPrice);
    return priceDiff.multiply(this.quantity);
  }

  getMarketValue(): Money {
    return this.currentPrice.multiply(Math.abs(this.quantity));
  }

  isLong(): boolean {
    return this.quantity > 0;
  }

  isShort(): boolean {
    return this.quantity < 0;
  }

  isProfitable(): boolean {
    const pnl = this.getUnrealizedPnL();
    return pnl.isPositive();
  }
}

// ✅ Portfolio management
class Portfolio {
  private positions: Map<string, TradingPosition> = new Map();

  constructor(
    public readonly accountId: string,
    public readonly baseCurrency: string
  ) {}

  addPosition(position: TradingPosition): void {
    this.positions.set(position.symbol, position);
  }

  updatePositionPrice(symbol: string, newPrice: Money): boolean {
    const position = this.positions.get(symbol);
    if (!position) return false;

    const updatedPosition = position.updatePrice(newPrice);
    this.positions.set(symbol, updatedPosition);
    return true;
  }

  getTotalMarketValue(): Money {
    let total = Money.create(0, this.baseCurrency);

    for (const position of this.positions.values()) {
      // Note: In real implementation, would need currency conversion
      if (position.currentPrice.currency === this.baseCurrency) {
        total = total.add(position.getMarketValue());
      }
    }

    return total;
  }

  getTotalPnL(): Money {
    let totalPnL = Money.create(0, this.baseCurrency);

    for (const position of this.positions.values()) {
      if (position.currentPrice.currency === this.baseCurrency) {
        totalPnL = totalPnL.add(position.getUnrealizedPnL());
      }
    }

    return totalPnL;
  }

  getRiskMetrics(): {
    totalExposure: Money;
    profitablePositions: number;
    losingPositions: number;
    largestGain: Money;
    largestLoss: Money;
  } {
    let profitableCount = 0;
    let losingCount = 0;
    let largestGain = Money.create(0, this.baseCurrency);
    let largestLoss = Money.create(0, this.baseCurrency);

    for (const position of this.positions.values()) {
      const pnl = position.getUnrealizedPnL();

      if (pnl.isPositive()) {
        profitableCount++;
        if (pnl.isGreaterThan(largestGain)) {
          largestGain = pnl;
        }
      } else if (pnl.isNegative()) {
        losingCount++;
        if (pnl.abs().isGreaterThan(largestLoss.abs())) {
          largestLoss = pnl;
        }
      }
    }

    return {
      totalExposure: this.getTotalMarketValue(),
      profitablePositions: profitableCount,
      losingPositions: losingCount,
      largestGain,
      largestLoss,
    };
  }
}

// Usage example
const portfolio = new Portfolio('account-001', 'USD');

// Add positions
const applePosition = new TradingPosition(
  'AAPL',
  100,
  Money.create(150.0, 'USD'),
  Money.create(155.5, 'USD')
);

const googlePosition = new TradingPosition(
  'GOOGL',
  50,
  Money.create(2800.0, 'USD'),
  Money.create(2750.0, 'USD')
);

portfolio.addPosition(applePosition);
portfolio.addPosition(googlePosition);

// Update prices
portfolio.updatePositionPrice('AAPL', Money.create(158.0, 'USD'));

console.log(`Total Portfolio Value: ${portfolio.getTotalMarketValue()}`);
console.log(`Total P&L: ${portfolio.getTotalPnL()}`);

const metrics = portfolio.getRiskMetrics();
console.log(`Profitable Positions: ${metrics.profitablePositions}`);
console.log(`Losing Positions: ${metrics.losingPositions}`);
console.log(`Largest Gain: ${metrics.largestGain}`);
console.log(`Largest Loss: ${metrics.largestLoss}`);
```

### **Business Impact**:

- **Precision Trading**: Exact profit/loss calculations without rounding errors
- **Risk Management**: Accurate portfolio value and exposure calculations
- **Currency Consistency**: Prevents mixing different currency positions
- **Audit Trail**: Immutable position records for compliance

---

## Restaurant Delivery Service

### **Scenario**: Order management and delivery optimization

```typescript
import { Money, Address } from '@vytches-ddd/value-objects';

// ✅ Menu item pricing
class MenuItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly basePrice: Money,
    public readonly category: string
  ) {}

  applyModifier(modifierPrice: Money): MenuItem {
    const newPrice = this.basePrice.add(modifierPrice);
    return new MenuItem(this.id, this.name, newPrice, this.category);
  }
}

// ✅ Restaurant with location and delivery range
class Restaurant {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly location: Address,
    public readonly deliveryRadiusKm: number,
    public readonly minimumOrder: Money
  ) {}

  canDeliverTo(deliveryAddress: Address): boolean {
    const distance = this.location.distanceTo(deliveryAddress);
    return distance !== null && distance <= this.deliveryRadiusKm;
  }

  calculateDeliveryFee(deliveryAddress: Address, orderTotal: Money): Money {
    const distance = this.location.distanceTo(deliveryAddress);
    if (distance === null || distance > this.deliveryRadiusKm) {
      throw new Error('Location outside delivery range');
    }

    // Free delivery for orders over minimum threshold
    const freeDeliveryThreshold = this.minimumOrder.multiply(2);
    if (orderTotal.isGreaterThan(freeDeliveryThreshold)) {
      return Money.create(0, orderTotal.currency);
    }

    // Base delivery fee + distance charge
    const baseFee = Money.create(2.99, orderTotal.currency);
    const distanceFee = Money.create(0.5, orderTotal.currency).multiply(
      Math.ceil(distance)
    );

    return baseFee.add(distanceFee);
  }
}

// ✅ Order with delivery calculations
class DeliveryOrder {
  private items: { item: MenuItem; quantity: number }[] = [];

  constructor(
    public readonly id: string,
    public readonly restaurant: Restaurant,
    public readonly deliveryAddress: Address,
    public readonly customerId: string
  ) {
    if (!restaurant.canDeliverTo(deliveryAddress)) {
      throw new Error('Restaurant cannot deliver to this address');
    }
  }

  addItem(item: MenuItem, quantity: number): void {
    this.items.push({ item, quantity });
  }

  getSubtotal(): Money {
    let total = Money.create(0, 'USD');

    for (const { item, quantity } of this.items) {
      const lineTotal = item.basePrice.multiply(quantity);
      total = total.add(lineTotal);
    }

    return total;
  }

  getDeliveryFee(): Money {
    const subtotal = this.getSubtotal();
    return this.restaurant.calculateDeliveryFee(this.deliveryAddress, subtotal);
  }

  getTax(rate: number): Money {
    return this.getSubtotal().multiply(rate);
  }

  getTotal(taxRate: number): Money {
    const subtotal = this.getSubtotal();
    const deliveryFee = this.getDeliveryFee();
    const tax = this.getTax(taxRate);

    return subtotal.add(deliveryFee).add(tax);
  }

  meetsMinimumOrder(): boolean {
    return (
      this.getSubtotal().isGreaterThan(this.restaurant.minimumOrder) ||
      this.getSubtotal().isEqualTo(this.restaurant.minimumOrder)
    );
  }
}

// ✅ Delivery fleet management
class DeliveryFleet {
  private orders: DeliveryOrder[] = [];

  addOrder(order: DeliveryOrder): boolean {
    if (!order.meetsMinimumOrder()) {
      return false;
    }

    this.orders.push(order);
    return true;
  }

  getOrdersByRegion(): Map<string, DeliveryOrder[]> {
    const regions = new Map<string, DeliveryOrder[]>();

    this.orders.forEach(order => {
      const region = `${order.deliveryAddress.city}, ${order.deliveryAddress.state}`;
      if (!regions.has(region)) {
        regions.set(region, []);
      }
      regions.get(region)!.push(order);
    });

    return regions;
  }

  getTotalRevenue(taxRate: number): Money {
    let total = Money.create(0, 'USD');

    this.orders.forEach(order => {
      total = total.add(order.getTotal(taxRate));
    });

    return total;
  }
}

// Usage example
const restaurant = new Restaurant(
  'rest-001',
  'Italian Bistro',
  Address.createWithCoordinates(
    '100 Restaurant Row',
    'Chicago',
    'IL',
    '60601',
    'US',
    41.8781,
    -87.6298
  ),
  10, // 10km delivery radius
  Money.create(15.0, 'USD') // $15 minimum order
);

const pizza = new MenuItem(
  'pizza-001',
  'Margherita Pizza',
  Money.create(18.99, 'USD'),
  'Main'
);
const salad = new MenuItem(
  'salad-001',
  'Caesar Salad',
  Money.create(12.99, 'USD'),
  'Sides'
);

const customerAddress = Address.createWithCoordinates(
  '456 Customer St',
  'Chicago',
  'IL',
  '60610',
  'US',
  41.8841,
  -87.619 // About 3km away
);

const order = new DeliveryOrder(
  'order-001',
  restaurant,
  customerAddress,
  'customer-001'
);
order.addItem(pizza, 2);
order.addItem(salad, 1);

console.log(`Can deliver: ${restaurant.canDeliverTo(customerAddress)}`);
console.log(`Subtotal: ${order.getSubtotal()}`); // $50.97
console.log(`Delivery fee: ${order.getDeliveryFee()}`); // $4.49 (base + distance)
console.log(`Total: ${order.getTotal(0.08)}`); // ~$59.36 with tax
console.log(`Meets minimum: ${order.meetsMinimumOrder()}`); // true

const fleet = new DeliveryFleet();
fleet.addOrder(order);

console.log(`Fleet revenue: ${fleet.getTotalRevenue(0.08)}`);
```

### **Business Impact**:

- **Delivery Optimization**: Accurate distance calculations for delivery fees
- **Order Validation**: Ensures minimum order requirements are met
- **Geographic Awareness**: Location-based service availability
- **Revenue Tracking**: Precise financial calculations across orders

---

## Summary

These basic use cases demonstrate how value objects provide immediate practical
benefits:

1. **Data Integrity**: Invalid data is caught early with comprehensive
   validation
2. **Business Logic**: Domain rules are encoded directly in the objects
3. **Calculation Accuracy**: Precise monetary and numeric calculations
4. **Type Safety**: Prevents common errors like currency mixing
5. **Immutability**: Ensures data consistency and enables audit trails
6. **Reusability**: Common value objects work across different business contexts

The examples show progressive complexity while maintaining the core value object
principles of immutability, validation, and business rule encapsulation.
