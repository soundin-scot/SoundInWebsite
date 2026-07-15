export const prerender = false;

import type { APIRoute } from 'astro';
import { AirtableClient } from '@/lib/forms/airtable';
import { getAirtableConfig, getResendConfig, IntegrationConfigurationError } from '@/lib/forms/config';
import { sendContactNotification } from '@/lib/forms/resend';
import { cleanText, isEmail, json, normaliseEmail } from '@/lib/forms/validation';

interface ContactBody {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  message?: unknown;
  website?: unknown;
}

export const POST: APIRoute = async ({ request }) => {
  let body: ContactBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'The request could not be read.' }, 400);
  }

  // Honeypot submissions receive a generic success response and are not stored.
  if (cleanText(body.website, 200)) return json({ ok: true });

  const name = cleanText(body.name, 120);
  const email = normaliseEmail(body.email);
  const company = cleanText(body.company, 160);
  const message = cleanText(body.message, 5000);

  if (name.length < 2 || !isEmail(email) || message.length < 10) {
    return json({ error: 'Please provide your name, a valid email address and a short message.' }, 400);
  }

  try {
    const airtableConfig = getAirtableConfig(import.meta.env);
    const resendConfig = getResendConfig(import.meta.env);
    const airtable = new AirtableClient(airtableConfig);
    const submittedAt = new Date().toISOString();
    const enquiry = await airtable.create(airtableConfig.enquiriesTableId, {
      Name: name,
      Email: email,
      Company: company || undefined,
      Message: message,
      Source: 'soundin.scot/contact',
      Status: 'New',
      'Submitted At': submittedAt,
      'Notification Status': 'Pending',
    });

    try {
      const emailId = await sendContactNotification(resendConfig, {
        id: enquiry.id,
        name,
        email,
        company: company || undefined,
        message,
      });
      await airtable.update(airtableConfig.enquiriesTableId, enquiry.id, {
        'Notification Status': 'Sent',
        'Notification Email ID': emailId,
      });
    } catch (error) {
      console.error('Contact notification failed after enquiry capture', error);
      await airtable.update(airtableConfig.enquiriesTableId, enquiry.id, {
        'Notification Status': 'Failed',
      }).catch((updateError) => console.error('Unable to record contact notification failure', updateError));
    }

    return json({ ok: true });
  } catch (error) {
    if (error instanceof IntegrationConfigurationError) {
      console.error('Contact form is missing server configuration', error.missing);
      return json({ error: 'The contact form is unavailable right now. Please email cougar@soundin.scot.' }, 503);
    }
    console.error('Contact form provider failure', error);
    return json({ error: 'We could not save your message. Please email cougar@soundin.scot.' }, 502);
  }
};
