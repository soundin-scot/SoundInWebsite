export const prerender = false;

import type { APIRoute } from 'astro';
import { getAirtableConfig, getResendConfig, IntegrationConfigurationError } from '@/lib/forms/config';
import { verifyResendWebhook } from '@/lib/forms/resend';
import { SubscriberStore, type SubscriberStatus } from '@/lib/forms/subscribers';
import { json } from '@/lib/forms/validation';

function requiredHeader(request: Request, name: string): string {
  return request.headers.get(name) ?? '';
}

export const POST: APIRoute = async ({ request }) => {
  const payload = await request.text();
  const headers = {
    id: requiredHeader(request, 'svix-id'),
    timestamp: requiredHeader(request, 'svix-timestamp'),
    signature: requiredHeader(request, 'svix-signature'),
  };

  if (!headers.id || !headers.timestamp || !headers.signature) return json({ error: 'Invalid webhook signature.' }, 400);

  try {
    const airtableConfig = getAirtableConfig(import.meta.env);
    const resendConfig = getResendConfig(import.meta.env);
    const event = verifyResendWebhook(resendConfig, payload, headers);
    const subscribers = new SubscriberStore(airtableConfig);
    let email: string | undefined;
    let status: SubscriberStatus | undefined;

    if (event.type === 'contact.updated' && event.data.unsubscribed) {
      email = event.data.email;
      status = 'Unsubscribed';
    } else if (event.type === 'contact.deleted') {
      email = event.data.email;
      status = 'Unsubscribed';
    } else if (event.type === 'email.bounced') {
      email = event.data.to?.[0];
      status = 'Bounced';
    } else if (event.type === 'email.complained') {
      email = event.data.to?.[0];
      status = 'Complained';
    } else if (event.type === 'email.suppressed') {
      email = event.data.to?.[0];
      status = 'Suppressed';
    }

    if (email && status) await subscribers.applyProviderEvent(email.toLowerCase(), status, event.created_at, headers.id);
    return json({ received: true });
  } catch (error) {
    if (error instanceof IntegrationConfigurationError) {
      console.error('Resend webhook is missing server configuration', error.missing);
      return json({ error: 'Webhook is not configured.' }, 503);
    }
    console.error('Invalid or failed Resend webhook', error);
    return json({ error: 'Invalid webhook.' }, 400);
  }
};
