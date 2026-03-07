/**
 * Google OAuth 2.0 service
 * (File kept as twitter.ts to minimize import changes across the codebase)
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// In-memory store for OAuth state → nonce mapping
const pendingAuth = new Map<string, { nonce: string; createdAt: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingAuth) {
    if (now - data.createdAt > 10 * 60 * 1000) pendingAuth.delete(state);
  }
}, 5 * 60 * 1000);

/** Generate the Google OAuth 2.0 authorization URL */
export async function generateAuthLink() {
  const { randomBytes } = await import('crypto');
  const state = randomBytes(24).toString('base64url');
  const nonce = randomBytes(16).toString('base64url');

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  const url = `${GOOGLE_AUTH_URL}?${params}`;
  pendingAuth.set(state, { nonce, createdAt: Date.now() });
  return { url, state };
}

/** Exchange the authorization code for an access token */
async function exchangeCodeForToken(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { access_token: string; id_token?: string };
  return data.access_token;
}

/** Fetch Google user profile */
async function fetchUserProfile(accessToken: string) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user profile (${res.status})`);
  }

  const data = await res.json() as {
    id: string;
    email: string;
    name: string;
    picture: string;
  };

  return {
    id: data.id,
    handle: data.email,
    name: data.name,
    avatar: data.picture ?? '',
  };
}

/** Handle the OAuth callback — exchange code for user data */
export async function handleCallback(code: string, state: string) {
  const pending = pendingAuth.get(state);
  if (!pending) throw new Error('Invalid or expired OAuth state');

  pendingAuth.delete(state);

  const accessToken = await exchangeCodeForToken(code);
  return fetchUserProfile(accessToken);
}
