export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const token = import.meta.env.HUBSPOT_PRIVATE_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { name?: string; email?: string; company?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { name, email, company, message } = body;

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: 'Name, email, and message are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hsHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Upsert contact
  const contactRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: hsHeaders,
    body: JSON.stringify({
      properties: {
        firstname: name.split(' ')[0],
        lastname: name.split(' ').slice(1).join(' ') || '',
        email,
        company: company || '',
        lifecyclestage: 'lead',
      },
    }),
  });

  let contactId: string;

  if (contactRes.status === 409) {
    // Contact already exists — extract existing ID from error
    const err = await contactRes.json();
    const match = (err?.message as string | undefined)?.match(/existing ID: (\d+)/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Failed to upsert contact' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    contactId = match[1];
  } else if (!contactRes.ok) {
    return new Response(JSON.stringify({ error: 'Failed to create contact' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  } else {
    const contact = await contactRes.json();
    contactId = contact.id;
  }

  // Create note and associate with contact
  const noteRes = await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
    method: 'POST',
    headers: hsHeaders,
    body: JSON.stringify({
      properties: {
        hs_note_body: `Message from soundin.scot contact form:\n\n${message}`,
        hs_timestamp: Date.now().toString(),
      },
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
        },
      ],
    }),
  });

  if (!noteRes.ok) {
    // Note creation failure is non-fatal — contact was captured
    console.error('Failed to create HubSpot note', await noteRes.text());
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
