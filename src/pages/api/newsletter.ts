export const prerender = false;

import type { APIRoute } from 'astro';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !emailPattern.test(email)) {
    return Response.json({ error: 'Please provide a valid email address.' }, { status: 400 });
  }

  const endpoint = import.meta.env.NEWSLETTER_WEBHOOK_URL;
  if (!endpoint) {
    return Response.json(
      { error: 'Newsletter subscriptions are not available yet. Please check back soon.' },
      { status: 503 },
    );
  }

  try {
    const subscription = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        source: 'soundin.scot/newsletter',
        subscribedAt: new Date().toISOString(),
      }),
    });

    if (!subscription.ok) {
      console.error('Newsletter provider returned an error', subscription.status);
      return Response.json({ error: 'Unable to subscribe right now. Please try again later.' }, { status: 502 });
    }
  } catch (error) {
    console.error('Newsletter provider request failed', error);
    return Response.json({ error: 'Unable to subscribe right now. Please try again later.' }, { status: 502 });
  }

  return Response.json({ ok: true });
};
