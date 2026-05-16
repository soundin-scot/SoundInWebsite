import type { APIContext } from 'astro';

export const prerender = false;

interface ContactBody {
  name: string;
  email: string;
  company?: string;
  message: string;
}

export async function POST({ request }: APIContext): Promise<Response> {
  let body: ContactBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { name, email, company, message } = body;
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return json({ error: 'Missing required fields' }, 400);
  }

  const token = import.meta.env.HUBSPOT_PRIVATE_TOKEN;
  if (!token) {
    return json({ error: 'Server configuration error' }, 500);
  }

  const [firstname, ...rest] = name.trim().split(' ');
  const lastname = rest.join(' ') || undefined;

  const contactId = await upsertContact(token, { email, firstname, lastname, company });
  if (!contactId) {
    return json({ error: 'Failed to create CRM record' }, 500);
  }

  await createNote(token, contactId, message);

  return json({ success: true }, 200);
}

async function upsertContact(
  token: string,
  props: { email: string; firstname: string; lastname?: string; company?: string }
): Promise<string | null> {
  const properties: Record<string, string> = {
    email: props.email,
    firstname: props.firstname,
    lifecyclestage: 'lead',
    hs_lead_status: 'NEW',
  };
  if (props.lastname) properties.lastname = props.lastname;
  if (props.company) properties.company = props.company;

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties }),
  });

  if (res.ok) {
    const data = await res.json();
    return data.id as string;
  }

  if (res.status === 409) {
    // Contact already exists — fetch by email
    const existing = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(props.email)}?idProperty=email`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!existing.ok) return null;
    const data = await existing.json();
    return data.id as string;
  }

  return null;
}

async function createNote(token: string, contactId: string, message: string): Promise<void> {
  await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: {
        hs_note_body: `Website contact form:\n\n${message}`,
        hs_timestamp: String(Date.now()),
      },
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
        },
      ],
    }),
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
