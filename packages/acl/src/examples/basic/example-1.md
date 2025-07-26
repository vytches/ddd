# Basic Anti-Corruption Layer Implementation

**Version**: 1.0.0  
**Package**: @vytches/ddd-acl  
**Complexity**: Basic  
**Domain**: Customer Management  
**Patterns**: Anti-Corruption Layer, Data Translation  
**Dependencies**: @vytches/ddd-acl, @vytches/ddd-core

## Description

This example demonstrates a basic Anti-Corruption Layer implementation for
integrating with external customer management systems while protecting your
domain model from external data formats and inconsistencies.

## Business Context

An e-commerce platform needs to integrate with a legacy CRM system that has
different data structures and naming conventions. The ACL protects the domain
model from external system changes and provides a clean translation layer.

## Code Example

```typescript
// customer-management.acl.ts
import { AntiCorruptionLayer, IDataTranslator } from '@vytches/ddd-acl';
import { Result } from '@vytches/ddd-utils';
import { Customer, ExternalCustomerData } from '../types'; // From your application

// Data translator for customer conversion
export class CustomerDataTranslator
  implements IDataTranslator<ExternalCustomerData, Customer>
{
  translate(external: ExternalCustomerData): Result<Customer, Error> {
    try {
      const customer: Customer = {
        id: external.customer_id,
        name: external.full_name,
        email: external.email_address,
        status: this.mapAccountStatus(external.account_status),
        registrationDate: new Date(external.created_timestamp * 1000),
        preferences: {
          currency: external.settings.preferred_currency,
          language: external.settings.locale,
          notifications: external.settings.email_notifications,
          marketingConsent: external.settings.marketing_opt_in,
        },
      };

      return Result.success(customer);
    } catch (error) {
      return Result.failure(new Error(`Translation failed: ${error.message}`));
    }
  }

  private mapAccountStatus(externalStatus: string): Customer['status'] {
    switch (externalStatus.toLowerCase()) {
      case 'active':
      case 'verified':
        return 'active';
      case 'suspended':
      case 'blocked':
        return 'suspended';
      default:
        return 'inactive';
    }
  }
}

// ACL implementation for customer management
export class CustomerManagementACL extends AntiCorruptionLayer<
  ExternalCustomerData,
  Customer
> {
  constructor(private externalCustomerAPI: ExternalCustomerAPI) {
    super(new CustomerDataTranslator());
  }

  async getCustomer(customerId: string): Promise<Result<Customer, Error>> {
    try {
      // Call external system
      const externalData =
        await this.externalCustomerAPI.getCustomer(customerId);

      // Translate through ACL
      return this.translateData(externalData);
    } catch (error) {
      return Result.failure(
        new Error(`Failed to get customer: ${error.message}`)
      );
    }
  }

  async updateCustomer(customer: Customer): Promise<Result<Customer, Error>> {
    try {
      // Convert domain model to external format
      const externalData = this.convertToExternalFormat(customer);

      // Update external system
      const updatedData =
        await this.externalCustomerAPI.updateCustomer(externalData);

      // Translate response back to domain model
      return this.translateData(updatedData);
    } catch (error) {
      return Result.failure(
        new Error(`Failed to update customer: ${error.message}`)
      );
    }
  }

  private convertToExternalFormat(customer: Customer): ExternalCustomerData {
    return {
      customer_id: customer.id,
      full_name: customer.name,
      email_address: customer.email,
      account_status: customer.status,
      created_timestamp: Math.floor(customer.registrationDate.getTime() / 1000),
      settings: {
        preferred_currency: customer.preferences.currency,
        locale: customer.preferences.language,
        email_notifications: customer.preferences.notifications,
        marketing_opt_in: customer.preferences.marketingConsent,
      },
    };
  }
}

// Usage in domain service
export class CustomerService {
  constructor(private customerACL: CustomerManagementACL) {}

  async getCustomerProfile(
    customerId: string
  ): Promise<Result<Customer, Error>> {
    // Clean domain operation using ACL
    return await this.customerACL.getCustomer(customerId);
  }

  async updateCustomerPreferences(
    customerId: string,
    preferences: CustomerPreferences
  ): Promise<Result<Customer, Error>> {
    // Get current customer
    const customerResult = await this.customerACL.getCustomer(customerId);
    if (customerResult.isFailure()) {
      return customerResult;
    }

    const customer = customerResult.value;

    // Update preferences in domain model
    const updatedCustomer: Customer = {
      ...customer,
      preferences: { ...customer.preferences, ...preferences },
    };

    // Save through ACL
    return await this.customerACL.updateCustomer(updatedCustomer);
  }
}

// External API mock (represents third-party system)
interface ExternalCustomerAPI {
  getCustomer(id: string): Promise<ExternalCustomerData>;
  updateCustomer(data: ExternalCustomerData): Promise<ExternalCustomerData>;
}
```

## Key Features

- **Domain Protection**: Shields domain model from external system changes
- **Data Translation**: Converts between external and internal data formats
- **Error Handling**: Robust error management with Result pattern
- **Type Safety**: Full TypeScript support for data transformations

## Common Pitfalls

- **Leaky Abstraction**: Don't expose external data structures to domain
- **Translation Loss**: Ensure no critical data is lost during conversion
- **Performance**: Avoid unnecessary translations for simple pass-through
  operations

## Related Examples

- [Advanced ACL with Caching](/packages/acl/src/examples/intermediate/example-1.md)
- [External Service Integration](/packages/acl/src/examples/advanced/example-1.md)
