export const prerender = false;

import { createHash, randomBytes } from 'node:crypto';
import type { APIRoute } from 'astro';
import { getAirtableConfig, getNewsletterResendConfig, getSiteUrl, IntegrationConfigurationError } from '@/lib/forms/config';
import { sendNewsletterConfirmation } from '@/lib/forms/resend';
import { SubscriberStore, type SubscriberFields } from '@/lib/forms/subscribers';
import { cleanText, isEmail, json, normaliseEmail } from '@/lib/forms/validation';

const confirmationLifetimeMs = 24 * 60 * 60 * 1000;
const confirmationCooldownMs = 15 * 60 * 1000;

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  if (cleanText(body.website, 200)) return json({ ok: true, confirmationRequired: true });

  const email = normaliseEmail(body.email);
  if (!email || !isEmail(email)) return json({ error: 'Please provide a valid email address.' }, 400);

  try {
    const airtableConfig = getAirtableConfig(import.meta.env);
    const resendConfig = getNewsletterResendConfig(import.meta.env);
    const subscribers = new SubscriberStore(airtableConfig);
    const existing = await subscribers.findByEmail(email);

    // Keep the response generic so the endpoint never reveals membership.
    if (existing?.fields.Status === 'Active') return json({ ok: true, confirmationRequired: true });

    const lastRequestedAt = existing?.fields['Consent Requested At'];
    if (
      existing?.fields.Status === 'Pending' &&
      lastRequestedAt &&
      Date.now() - Date.parse(lastRequestedAt) < confirmationCooldownMs
    ) {
      return json({ ok: true, confirmationRequired: true });
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const requestedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + confirmationLifetimeMs).toISOString();
    const pendingFields: SubscriberFields = {
      Email: email,
      Status: 'Pending',
      Source: 'soundin.scot/newsletter',
      'Consent Requested At': requestedAt,
      'Confirmation Token Hash': tokenHash,
      'Confirmation Expires At': expiresAt,
    };
    const record = await subscribers.savePending(existing, pendingFields);
    const confirmationUrl = `${getSiteUrl(import.meta.env)}/newsletter/confirm?token=${encodeURIComponent(token)}`;

    try {
      const emailId = await sendNewsletterConfirmation(resendConfig, { email, confirmationUrl, tokenHash });
      await subscribers.update(record.id, { 'Confirmation Email ID': emailId });
    } catch (error) {
      await subscribers.update(record.id, { Status: 'Confirmation failed' }).catch((updateError) => {
        console.error('Unable to record newsletter confirmation failure', updateError);
      });
      throw error;
    }

    return json({ ok: true, confirmationRequired: true });
  } catch (error) {
    if (error instanceof IntegrationConfigurationError) {
      console.error('Newsletter is missing server configuration', error.missing);
      return json({ error: 'Newsletter subscriptions are not available yet. Please check back soon.' }, 503);
    }
    console.error('Newsletter subscription failed', error);
    return json({ error: 'Unable to start your subscription right now. Please try again later.' }, 502);
  }
};
