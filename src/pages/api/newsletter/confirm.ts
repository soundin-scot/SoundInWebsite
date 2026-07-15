export const prerender = false;

import { createHash } from 'node:crypto';
import type { APIRoute } from 'astro';
import { getAirtableConfig, getNewsletterResendConfig, IntegrationConfigurationError } from '@/lib/forms/config';
import { upsertNewsletterContact } from '@/lib/forms/resend';
import { SubscriberStore } from '@/lib/forms/subscribers';
import { cleanText, json } from '@/lib/forms/validation';

export const POST: APIRoute = async ({ request }) => {
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'The confirmation request could not be read.' }, 400);
  }

  const token = cleanText(body.token, 100);
  if (!token) return json({ error: 'This confirmation link is invalid or has expired.' }, 400);

  try {
    const airtableConfig = getAirtableConfig(import.meta.env);
    const resendConfig = getNewsletterResendConfig(import.meta.env);
    const subscribers = new SubscriberStore(airtableConfig);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const subscriber = await subscribers.findByTokenHash(tokenHash);
    const expiresAt = subscriber?.fields['Confirmation Expires At'];

    if (!subscriber || !expiresAt || Date.parse(expiresAt) < Date.now()) {
      return json({ error: 'This confirmation link is invalid or has expired.' }, 410);
    }

    if (subscriber.fields.Status === 'Active') return json({ ok: true });

    const contactId = await upsertNewsletterContact(resendConfig, subscriber.fields.Email);
    const confirmedAt = new Date().toISOString();
    await subscribers.update(subscriber.id, {
      Status: 'Active',
      'Consent Confirmed At': confirmedAt,
      'Resend Contact ID': contactId,
      'Last Event At': confirmedAt,
    });

    return json({ ok: true });
  } catch (error) {
    if (error instanceof IntegrationConfigurationError) {
      console.error('Newsletter confirmation is missing server configuration', error.missing);
      return json({ error: 'Subscription confirmation is unavailable right now.' }, 503);
    }
    console.error('Newsletter confirmation failed', error);
    return json({ error: 'We could not confirm your subscription. Please try again.' }, 502);
  }
};
