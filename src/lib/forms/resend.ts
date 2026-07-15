import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NewsletterResendConfig, ResendConfig } from './config';
import { ProviderRequestError } from './airtable';

interface ResendWebhookData {
  email?: string;
  unsubscribed?: boolean;
  to?: string[];
}

export interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: ResendWebhookData;
}

function baseUrl(config: ResendConfig): string {
  return (config.apiBaseUrl ?? 'https://api.resend.com').replace(/\/$/, '');
}

async function resendRequest<T>(
  config: ResendConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${baseUrl(config)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => ({})) as { message?: string } & T;
  if (!response.ok) {
    throw new ProviderRequestError('Resend', 'Resend request failed.', response.status);
  }
  return payload;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

export async function sendContactNotification(
  config: ResendConfig,
  enquiry: { id: string; name: string; email: string; company?: string; message: string },
): Promise<string> {
  const companyLine = enquiry.company ? `<p><strong>Company</strong><br>${escapeHtml(enquiry.company)}</p>` : '';
  const result = await resendRequest<{ id: string }>(config, '/emails', {
    method: 'POST',
    headers: { 'Idempotency-Key': `contact-enquiry/${enquiry.id}` },
    body: JSON.stringify({
      from: config.from,
      to: config.contactNotificationEmail,
      reply_to: enquiry.email,
      subject: `New SoundIn enquiry from ${enquiry.name}`,
      html: `<h1>New website enquiry</h1><p><strong>Name</strong><br>${escapeHtml(enquiry.name)}</p><p><strong>Email</strong><br>${escapeHtml(enquiry.email)}</p>${companyLine}<p><strong>Message</strong></p><p>${escapeHtml(enquiry.message).replace(/\n/g, '<br>')}</p>`,
      text: `New website enquiry\n\nName: ${enquiry.name}\nEmail: ${enquiry.email}\n${enquiry.company ? `Company: ${enquiry.company}\n` : ''}\n${enquiry.message}`,
      tags: [{ name: 'category', value: 'contact_enquiry' }],
    }),
  });
  return result.id;
}

export async function sendNewsletterConfirmation(
  config: ResendConfig,
  input: { email: string; confirmationUrl: string; tokenHash: string },
): Promise<string> {
  const result = await resendRequest<{ id: string }>(config, '/emails', {
    method: 'POST',
    headers: { 'Idempotency-Key': `newsletter-confirmation/${input.tokenHash.slice(0, 32)}` },
    body: JSON.stringify({
      from: config.from,
      to: input.email,
      subject: 'Confirm your SoundIn Notes subscription',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;color:#111"><p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase">SoundIn / Notes</p><h1 style="font-size:32px;line-height:1.1">One more step.</h1><p>Confirm that you want to receive occasional notes from SoundIn.</p><p style="margin:32px 0"><a href="${escapeHtml(input.confirmationUrl)}" style="display:inline-block;background:#111;color:#fff;padding:14px 18px;text-decoration:none">Review and confirm</a></p><p style="font-size:13px;color:#666">This link expires in 24 hours. If you did not request this, you can ignore this email.</p></div>`,
      text: `Confirm your SoundIn Notes subscription:\n\n${input.confirmationUrl}\n\nThis link expires in 24 hours. If you did not request this, ignore this email.`,
      tags: [{ name: 'category', value: 'newsletter_confirmation' }],
    }),
  });
  return result.id;
}

export async function upsertNewsletterContact(config: NewsletterResendConfig, email: string): Promise<string> {
  let existing: { id: string } | null = null;
  try {
    existing = await resendRequest<{ id: string }>(config, `/contacts/${encodeURIComponent(email)}`);
  } catch (error) {
    if (!(error instanceof ProviderRequestError) || error.status !== 404) throw error;
  }

  if (!existing) {
    const created = await resendRequest<{ id: string }>(config, '/contacts', {
      method: 'POST',
      body: JSON.stringify({
        email,
        unsubscribed: false,
        segments: [{ id: config.newsletterSegmentId }],
        topics: [{ id: config.newsletterTopicId, subscription: 'opt_in' }],
      }),
    });
    return created.id;
  }

  const updated = await resendRequest<{ id: string }>(config, `/contacts/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: JSON.stringify({ unsubscribed: false }),
  });

  try {
    await resendRequest(config, `/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(config.newsletterSegmentId)}`, {
      method: 'POST',
    });
  } catch (error) {
    if (!(error instanceof ProviderRequestError) || error.status !== 409) throw error;
  }

  await resendRequest(config, `/contacts/${encodeURIComponent(email)}/topics`, {
    method: 'PATCH',
    body: JSON.stringify([{ id: config.newsletterTopicId, subscription: 'opt_in' }]),
  });
  return updated.id;
}

function verifySignature(signature: string, expected: Buffer): boolean {
  const encoded = signature.startsWith('v1,') ? signature.slice(3) : '';
  if (!encoded) return false;
  const actual = Buffer.from(encoded, 'base64');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyResendWebhook(
  config: ResendConfig,
  payload: string,
  headers: { id: string; timestamp: string; signature: string },
): ResendWebhookEvent {
  if (!config.webhookSecret) throw new Error('RESEND_WEBHOOK_SECRET is not configured.');

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 5 * 60) {
    throw new Error('Webhook timestamp is outside the allowed window.');
  }

  const encodedSecret = config.webhookSecret.startsWith('whsec_')
    ? config.webhookSecret.slice('whsec_'.length)
    : config.webhookSecret;
  const key = Buffer.from(encodedSecret, 'base64');
  if (!key.length) throw new Error('Webhook signing secret is invalid.');

  const expected = createHmac('sha256', key)
    .update(`${headers.id}.${headers.timestamp}.${payload}`)
    .digest();
  const valid = headers.signature.split(' ').some((signature) => verifySignature(signature, expected));
  if (!valid) throw new Error('Webhook signature is invalid.');

  const event = JSON.parse(payload) as Partial<ResendWebhookEvent>;
  if (!event.type || !event.created_at || !event.data || typeof event.data !== 'object') {
    throw new Error('Webhook payload is invalid.');
  }
  return event as ResendWebhookEvent;
}
