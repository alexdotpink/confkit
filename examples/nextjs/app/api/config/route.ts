import config from '../../../conf/config';

export const runtime = 'nodejs';

export async function GET() {
  const redacted = await config.toJSON({ redact: true });
  return new Response(JSON.stringify({ redacted }, null, 2), {
    headers: { 'content-type': 'application/json' },
  });
}

