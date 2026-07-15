import type { AirtableConfig } from './config';

export type AirtableFields = Record<string, string | number | boolean | null | undefined>;

export interface AirtableRecord<T extends AirtableFields = AirtableFields> {
  id: string;
  createdTime: string;
  fields: T;
}

export class ProviderRequestError extends Error {
  readonly provider: 'Airtable' | 'Resend';
  readonly status?: number;

  constructor(provider: 'Airtable' | 'Resend', message: string, status?: number) {
    super(message);
    this.name = 'ProviderRequestError';
    this.provider = provider;
    this.status = status;
  }
}

function compactFields(fields: AirtableFields): Record<string, string | number | boolean | null> {
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined));
}

function formulaValue(value: string): string {
  return JSON.stringify(value);
}

export class AirtableClient {
  constructor(private readonly config: AirtableConfig) {}

  private tableUrl(tableId: string): string {
    const base = this.config.apiBaseUrl.replace(/\/$/, '');
    return `${base}/${encodeURIComponent(this.config.baseId)}/${encodeURIComponent(tableId)}`;
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    if (!response.ok) {
      console.error('Airtable request failed', response.status, response.headers.get('x-airtable-request-id'));
      throw new ProviderRequestError('Airtable', 'Airtable request failed.', response.status);
    }

    return response.json() as Promise<T>;
  }

  async create<T extends AirtableFields>(tableId: string, fields: T): Promise<AirtableRecord<T>> {
    const result = await this.request<{ records: AirtableRecord<T>[] }>(this.tableUrl(tableId), {
      method: 'POST',
      body: JSON.stringify({ records: [{ fields: compactFields(fields) }], typecast: true }),
    });
    return result.records[0];
  }

  async update<T extends AirtableFields>(tableId: string, recordId: string, fields: Partial<T>): Promise<AirtableRecord<T>> {
    return this.request<AirtableRecord<T>>(`${this.tableUrl(tableId)}/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: compactFields(fields), typecast: true }),
    });
  }

  async findFirst<T extends AirtableFields>(tableId: string, field: string, value: string): Promise<AirtableRecord<T> | null> {
    const query = new URLSearchParams({
      maxRecords: '1',
      filterByFormula: `{${field}}=${formulaValue(value)}`,
    });
    const result = await this.request<{ records: AirtableRecord<T>[] }>(`${this.tableUrl(tableId)}?${query}`);
    return result.records[0] ?? null;
  }
}
