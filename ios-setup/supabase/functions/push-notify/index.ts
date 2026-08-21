// Supabase Edge Function: push-notify
// Sends APNs push notifications to the user's iPhone
// Deploy: supabase functions deploy push-notify
//
// Call from cron jobs or triggers:
// POST /functions/v1/push-notify
// { "user_id": "uuid", "title": "...", "body": "...", "data": { "route": "/habits" } }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// APNs auth key — upload to Supabase secrets:
// supabase secrets set APNS_KEY_ID=... APNS_TEAM_ID=... APNS_PRIVATE_KEY=...
const APNS_KEY_ID    = Deno.env.get('APNS_KEY_ID')!;
const APNS_TEAM_ID   = Deno.env.get('APNS_TEAM_ID')!;
const APNS_BUNDLE_ID = 'com.batman.personalos';
const APNS_HOST      = 'https://api.sandbox.push.apple.com'; // switch to api.push.apple.com for prod

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { user_id, title, body, data = {} } = await req.json();
  if (!user_id || !title || !body) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Get device token
  const { data: tokenRow } = await sb
    .from('device_tokens')
    .select('token')
    .eq('user_id', user_id)
    .eq('platform', 'ios')
    .single();

  if (!tokenRow?.token) {
    return new Response(JSON.stringify({ error: 'No device token' }), { status: 404 });
  }

  // Build APNs JWT (ES256)
  const jwt = await buildAPNsJWT(APNS_KEY_ID, APNS_TEAM_ID);

  // Send via APNs HTTP/2
  const payload = {
    aps: {
      alert: { title, body },
      badge: 1,
      sound: 'default',
      'content-available': 1,
    },
    ...data,
  };

  const apnsRes = await fetch(`${APNS_HOST}/3/device/${tokenRow.token}`, {
    method: 'POST',
    headers: {
      'authorization': `bearer ${jwt}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!apnsRes.ok) {
    const err = await apnsRes.text();
    return new Response(JSON.stringify({ error: err }), { status: 502 });
  }

  return new Response(JSON.stringify({ sent: true }), { status: 200 });
});

// ── Build APNs JWT ─────────────────────────────────────────────────────────────
async function buildAPNsJWT(keyId: string, teamId: string): Promise<string> {
  const privateKey = Deno.env.get('APNS_PRIVATE_KEY')!
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .trim();

  const keyData = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const header  = btoa(JSON.stringify({ alg: 'ES256', kid: keyId })).replace(/=/g, '');
  const payload = btoa(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })).replace(/=/g, '');
  const msg     = `${header}.${payload}`;

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(msg)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '');
  return `${msg}.${sigB64}`;
}
