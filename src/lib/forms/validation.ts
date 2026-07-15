const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function normaliseEmail(value: unknown): string {
  return cleanText(value, 254).toLowerCase();
}

export function isEmail(value: string): boolean {
  return emailPattern.test(value);
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
