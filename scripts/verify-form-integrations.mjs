import { createHmac } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';

const appOrigin = 'http://127.0.0.1:4323';
const providerOrigin = 'http://127.0.0.1:4400';
const webhookSecret = `whsec_${Buffer.from('soundin-test-webhook-secret').toString('base64')}`;
const tables = new Map();
const emails = [];
const contacts = new Map();
let recordSequence = 0;
let emailSequence = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function table(name) {
  if (!tables.has(name)) tables.set(name, []);
  return tables.get(name);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

const provider = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', providerOrigin);

  if (url.pathname === '/__state') {
    return json(response, 200, {
      tables: Object.fromEntries(tables),
      emails,
      contacts: Object.fromEntries(contacts),
    });
  }

  if (url.pathname.startsWith('/airtable/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const tableId = decodeURIComponent(parts[2] ?? '');
    const recordId = parts[3] ? decodeURIComponent(parts[3]) : undefined;
    const records = table(tableId);

    if (request.method === 'GET') {
      const formula = url.searchParams.get('filterByFormula') ?? '';
      const match = formula.match(/^\{(.+)}=(.+)$/);
      const filtered = match
        ? records.filter((record) => record.fields[match[1]] === JSON.parse(match[2]))
        : records;
      return json(response, 200, { records: filtered.slice(0, 1) });
    }

    const body = await readJson(request);
    if (request.method === 'POST') {
      const created = body.records.map(({ fields }) => ({
        id: `rec_test_${++recordSequence}`,
        createdTime: new Date().toISOString(),
        fields,
      }));
      records.push(...created);
      return json(response, 200, { records: created });
    }

    if (request.method === 'PATCH' && recordId) {
      const record = records.find((candidate) => candidate.id === recordId);
      if (!record) return json(response, 404, { error: 'not_found' });
      Object.assign(record.fields, body.fields);
      return json(response, 200, record);
    }
  }

  if (url.pathname === '/resend/emails' && request.method === 'POST') {
    const body = await readJson(request);
    const id = `email_test_${++emailSequence}`;
    emails.push({ id, ...body });
    return json(response, 200, { id });
  }

  if (url.pathname === '/resend/contacts' && request.method === 'POST') {
    const body = await readJson(request);
    const contact = { id: `contact_test_${contacts.size + 1}`, ...body };
    contacts.set(body.email, contact);
    return json(response, 200, { object: 'contact', id: contact.id });
  }

  if (url.pathname.startsWith('/resend/contacts/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const email = decodeURIComponent(parts[2] ?? '');
    const contact = contacts.get(email);

    if (request.method === 'GET' && parts.length === 3) {
      return contact ? json(response, 200, contact) : json(response, 404, { message: 'Contact not found' });
    }
    if (request.method === 'PATCH' && parts.length === 3) {
      if (!contact) return json(response, 404, { message: 'Contact not found' });
      Object.assign(contact, await readJson(request));
      return json(response, 200, { object: 'contact', id: contact.id });
    }
    if (request.method === 'POST' && parts[3] === 'segments') {
      if (!contact) return json(response, 404, { message: 'Contact not found' });
      contact.segmentId = decodeURIComponent(parts[4] ?? '');
      return json(response, 200, { id: contact.id });
    }
    if (request.method === 'PATCH' && parts[3] === 'topics') {
      if (!contact) return json(response, 404, { message: 'Contact not found' });
      contact.topics = await readJson(request);
      return json(response, 200, { id: contact.id });
    }
  }

  return json(response, 404, { message: 'Mock route not found' });
});

async function waitForApp() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${appOrigin}/newsletter`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Astro test server did not become ready.');
}

async function post(path, body, headers = {}) {
  return fetch(`${appOrigin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

await new Promise((resolve) => provider.listen(4400, '127.0.0.1', resolve));

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const app = spawn(command, ['exec', 'astro', 'dev', '--host', '127.0.0.1', '--port', '4323'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    AIRTABLE_PERSONAL_ACCESS_TOKEN: 'test_token',
    AIRTABLE_BASE_ID: 'app_test',
    AIRTABLE_ENQUIRIES_TABLE_ID: 'tbl_enquiries',
    AIRTABLE_SUBSCRIBERS_TABLE_ID: 'tbl_subscribers',
    AIRTABLE_API_BASE_URL: `${providerOrigin}/airtable`,
    RESEND_API_KEY: 're_test',
    RESEND_API_BASE_URL: `${providerOrigin}/resend`,
    RESEND_FROM_EMAIL: 'SoundIn <hello@soundin.scot>',
    CONTACT_NOTIFICATION_EMAIL: 'cougar@soundin.scot',
    RESEND_NEWSLETTER_SEGMENT_ID: 'seg_test',
    RESEND_NEWSLETTER_TOPIC_ID: 'topic_test',
    RESEND_WEBHOOK_SECRET: webhookSecret,
    SITE_URL: appOrigin,
  },
});

let appOutput = '';
app.stdout.on('data', (chunk) => { appOutput += chunk.toString(); });
app.stderr.on('data', (chunk) => { appOutput += chunk.toString(); });

try {
  await waitForApp();

  const honeypot = await post('/api/contact', {
    name: 'Bot Person',
    email: 'bot@example.com',
    message: 'This should never be stored.',
    website: 'https://spam.example',
  });
  assert(honeypot.ok, 'Contact honeypot did not return the generic success response.');

  const contact = await post('/api/contact', {
    name: 'Test Person',
    email: 'test@example.com',
    company: 'Example Venue',
    message: 'We would like to understand how SoundIn could help our venue.',
  });
  assert(contact.ok, `Contact flow failed with ${contact.status}.`);

  const newsletter = await post('/api/newsletter', { email: 'reader@example.com' });
  assert(newsletter.ok, `Newsletter request failed with ${newsletter.status}.`);
  const emailCountAfterSignup = emails.length;

  const repeated = await post('/api/newsletter', { email: 'reader@example.com' });
  assert(repeated.ok, 'Repeated newsletter request did not return a generic success.');
  assert(emails.length === emailCountAfterSignup, 'Newsletter cooldown sent a duplicate confirmation email.');

  const confirmationEmail = emails.find((email) => email.tags?.some((tag) => tag.value === 'newsletter_confirmation'));
  const confirmationUrl = confirmationEmail?.html?.match(/href="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
  assert(confirmationUrl, 'Confirmation email did not contain a link.');
  const token = new URL(confirmationUrl).searchParams.get('token');
  assert(token, 'Confirmation link did not contain an opaque token.');

  const confirmationPage = await fetch(confirmationUrl);
  assert(confirmationPage.ok, 'Confirmation review page did not load.');
  const confirmation = await post('/api/newsletter/confirm', { token });
  assert(confirmation.ok, `Confirmation failed with ${confirmation.status}.`);

  const event = JSON.stringify({
    type: 'contact.updated',
    created_at: new Date().toISOString(),
    data: { email: 'reader@example.com', unsubscribed: true },
  });
  const webhookId = 'msg_test_unsubscribe';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signingKey = Buffer.from(webhookSecret.slice('whsec_'.length), 'base64');
  const signature = `v1,${createHmac('sha256', signingKey).update(`${webhookId}.${timestamp}.${event}`).digest('base64')}`;
  const webhook = await post('/api/webhooks/resend', event, {
    'svix-id': webhookId,
    'svix-timestamp': timestamp,
    'svix-signature': signature,
  });
  assert(webhook.ok, `Verified webhook failed with ${webhook.status}.`);

  const enquiryRecords = table('tbl_enquiries');
  const subscriberRecords = table('tbl_subscribers');
  assert(enquiryRecords.length === 1, 'Expected exactly one stored enquiry.');
  assert(enquiryRecords[0].fields['Notification Status'] === 'Sent', 'Contact notification status was not recorded.');
  assert(subscriberRecords.length === 1, 'Expected exactly one subscriber record.');
  assert(subscriberRecords[0].fields.Status === 'Unsubscribed', 'Resend unsubscribe webhook did not update Airtable.');
  assert(contacts.has('reader@example.com'), 'Confirmed subscriber was not created in Resend.');

  console.log('Form integrations verified: capture, notification, double opt-in, cooldown, confirmation and unsubscribe sync.');
} catch (error) {
  console.error(appOutput);
  throw error;
} finally {
  if (process.platform === 'win32' && app.pid) {
    spawnSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    app.kill('SIGTERM');
  }
  provider.closeAllConnections?.();
  await new Promise((resolve) => provider.close(resolve));
}
