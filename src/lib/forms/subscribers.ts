import type { AirtableConfig } from './config';
import { AirtableClient, type AirtableFields, type AirtableRecord } from './airtable';

export type SubscriberStatus =
  | 'Pending'
  | 'Active'
  | 'Confirmation failed'
  | 'Unsubscribed'
  | 'Bounced'
  | 'Complained'
  | 'Suppressed';

export type SubscriberFields = AirtableFields & {
  Email: string;
  Status: SubscriberStatus;
  Source?: string;
  'Consent Requested At'?: string;
  'Consent Confirmed At'?: string;
  'Confirmation Token Hash'?: string;
  'Confirmation Expires At'?: string;
  'Confirmation Email ID'?: string;
  'Resend Contact ID'?: string;
  'Last Event At'?: string;
  'Last Webhook ID'?: string;
};

export class SubscriberStore {
  private readonly airtable: AirtableClient;

  constructor(private readonly config: AirtableConfig) {
    this.airtable = new AirtableClient(config);
  }

  findByEmail(email: string): Promise<AirtableRecord<SubscriberFields> | null> {
    return this.airtable.findFirst<SubscriberFields>(this.config.subscribersTableId, 'Email', email);
  }

  findByTokenHash(hash: string): Promise<AirtableRecord<SubscriberFields> | null> {
    return this.airtable.findFirst<SubscriberFields>(this.config.subscribersTableId, 'Confirmation Token Hash', hash);
  }

  async savePending(
    existing: AirtableRecord<SubscriberFields> | null,
    fields: SubscriberFields,
  ): Promise<AirtableRecord<SubscriberFields>> {
    if (existing) return this.airtable.update<SubscriberFields>(this.config.subscribersTableId, existing.id, fields);
    return this.airtable.create<SubscriberFields>(this.config.subscribersTableId, fields);
  }

  update(recordId: string, fields: Partial<SubscriberFields>): Promise<AirtableRecord<SubscriberFields>> {
    return this.airtable.update<SubscriberFields>(this.config.subscribersTableId, recordId, fields);
  }

  async applyProviderEvent(
    email: string,
    status: SubscriberStatus,
    eventAt: string,
    webhookId: string,
  ): Promise<boolean> {
    const subscriber = await this.findByEmail(email);
    if (!subscriber || subscriber.fields['Last Webhook ID'] === webhookId) return false;

    const currentEventAt = subscriber.fields['Last Event At'];
    if (currentEventAt && Date.parse(currentEventAt) > Date.parse(eventAt)) return false;

    await this.update(subscriber.id, {
      Status: status,
      'Last Event At': eventAt,
      'Last Webhook ID': webhookId,
    });
    return true;
  }
}
