export type ServerEnv = Record<string, string | boolean | undefined>;

export class IntegrationConfigurationError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Missing server configuration: ${missing.join(', ')}`);
    this.name = 'IntegrationConfigurationError';
    this.missing = missing;
  }
}

function read(env: ServerEnv, key: string): string | undefined {
  // Astro's `import.meta.env` is resolved at build time, while Vercel injects
  // Sensitive environment variables into the Node function at runtime.
  // Prefer an explicitly supplied value (useful for tests/local overrides),
  // then fall back to the function runtime environment.
  const value = env[key] ?? (typeof process !== 'undefined' ? process.env[key] : undefined);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requireValues(env: ServerEnv, keys: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  const missing: string[] = [];

  for (const key of keys) {
    const value = read(env, key);
    if (value) values[key] = value;
    else missing.push(key);
  }

  if (missing.length) throw new IntegrationConfigurationError(missing);
  return values;
}

export interface AirtableConfig {
  token: string;
  baseId: string;
  enquiriesTableId: string;
  subscribersTableId: string;
  apiBaseUrl: string;
}

export function getAirtableConfig(env: ServerEnv): AirtableConfig {
  const values = requireValues(env, [
    'AIRTABLE_PERSONAL_ACCESS_TOKEN',
    'AIRTABLE_BASE_ID',
    'AIRTABLE_ENQUIRIES_TABLE_ID',
    'AIRTABLE_SUBSCRIBERS_TABLE_ID',
  ]);

  return {
    token: values.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    baseId: values.AIRTABLE_BASE_ID,
    enquiriesTableId: values.AIRTABLE_ENQUIRIES_TABLE_ID,
    subscribersTableId: values.AIRTABLE_SUBSCRIBERS_TABLE_ID,
    apiBaseUrl: read(env, 'AIRTABLE_API_BASE_URL') ?? 'https://api.airtable.com/v0',
  };
}

export interface ResendConfig {
  apiKey: string;
  apiBaseUrl?: string;
  from: string;
  contactNotificationEmail: string;
  webhookSecret?: string;
}

export interface NewsletterResendConfig extends ResendConfig {
  newsletterSegmentId: string;
  newsletterTopicId: string;
}

export function getResendConfig(env: ServerEnv): ResendConfig {
  const values = requireValues(env, ['RESEND_API_KEY']);

  return {
    apiKey: values.RESEND_API_KEY,
    apiBaseUrl: read(env, 'RESEND_API_BASE_URL'),
    from: read(env, 'RESEND_FROM_EMAIL') ?? 'SoundIn <hello@soundin.scot>',
    contactNotificationEmail: read(env, 'CONTACT_NOTIFICATION_EMAIL') ?? 'cougar@soundin.scot',
    webhookSecret: read(env, 'RESEND_WEBHOOK_SECRET'),
  };
}

export function getNewsletterResendConfig(env: ServerEnv): NewsletterResendConfig {
  const config = getResendConfig(env);
  const values = requireValues(env, ['RESEND_NEWSLETTER_SEGMENT_ID', 'RESEND_NEWSLETTER_TOPIC_ID']);
  return {
    ...config,
    newsletterSegmentId: values.RESEND_NEWSLETTER_SEGMENT_ID,
    newsletterTopicId: values.RESEND_NEWSLETTER_TOPIC_ID,
  };
}

export function getSiteUrl(env: ServerEnv): string {
  return (read(env, 'SITE_URL') ?? 'https://soundin.scot').replace(/\/$/, '');
}
