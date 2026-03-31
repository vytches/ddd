import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ACL_ADAPTER_METADATA } from '../src/constants';
import { ACLAdapterFor } from '../src/decorators/acl-adapter.decorator';
import type { ACLAdapterMetadata } from '../src/decorators/acl-adapter.decorator';

describe('@ACLAdapterFor', () => {
  it('sets contextName, description, and version on class metadata', () => {
    @ACLAdapterFor('payments', { description: 'Stripe integration', version: '2.0.0' })
    class PaymentAdapter {}

    const meta: ACLAdapterMetadata = Reflect.getMetadata(ACL_ADAPTER_METADATA, PaymentAdapter);

    expect(meta.contextName).toBe('payments');
    expect(meta.description).toBe('Stripe integration');
    expect(meta.version).toBe('2.0.0');
  });

  it('defaults version to 1.0.0 when options are omitted', () => {
    @ACLAdapterFor('inventory')
    class InventoryAdapter {}

    const meta: ACLAdapterMetadata = Reflect.getMetadata(ACL_ADAPTER_METADATA, InventoryAdapter);

    expect(meta.contextName).toBe('inventory');
    expect(meta.version).toBe('1.0.0');
    expect(meta.description).toBeUndefined();
  });

  it('metadata is retrievable via Reflect.getMetadata with ACL_ADAPTER_METADATA key', () => {
    @ACLAdapterFor('shipping')
    class ShippingAdapter {}

    const meta = Reflect.getMetadata(ACL_ADAPTER_METADATA, ShippingAdapter);

    expect(meta).toBeDefined();
    expect(meta).toMatchObject({ contextName: 'shipping' });
  });

  it('decorators on different classes do not interfere with each other', () => {
    @ACLAdapterFor('orders', { description: 'Order context' })
    class OrderAdapter {}

    @ACLAdapterFor('notifications', { description: 'Notification context', version: '3.0.0' })
    class NotificationAdapter {}

    const orderMeta: ACLAdapterMetadata = Reflect.getMetadata(ACL_ADAPTER_METADATA, OrderAdapter);
    const notifMeta: ACLAdapterMetadata = Reflect.getMetadata(
      ACL_ADAPTER_METADATA,
      NotificationAdapter
    );

    expect(orderMeta.contextName).toBe('orders');
    expect(orderMeta.description).toBe('Order context');
    expect(notifMeta.contextName).toBe('notifications');
    expect(notifMeta.version).toBe('3.0.0');
  });
});
