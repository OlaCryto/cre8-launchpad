import { TwitterApi } from 'twitter-api-v2';

/** Create a new Twitter API client from env credentials */
function getClient() {
  return new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET!,
  });
}

// In-memory store for OAuth state → codeVerifier mapping
// In production, use Redis or DB with TTL
const pendingAuth = new Map<string, { codeVerifier: string; createdAt: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingAuth) {
    if (now - data.createdAt > 10 * 60 * 1000) pendingAuth.delete(state);
  }
}, 5 * 60 * 1000);

/** Generate the Twitter OAuth 2.0 authorization URL */
export async function generateAuthLink() {
  const client = getClient();
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    process.env.TWITTER_CALLBACK_URL!,
    { scope: ['tweet.read', 'users.read'] },
  );

  pendingAuth.set(state, { codeVerifier, createdAt: Date.now() });
  return { url, state };
}

/** Exchange the authorization code for an access token */
async function exchangeCodeForToken(code: string, codeVerifier: string) {
  const clientId = process.env.TWITTER_CLIENT_ID!;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!;

  // OAuth 2.0 spec: URL-encode credentials before base64-encoding for Basic auth
  const basicAuth = Buffer.from(
    `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`
  ).toString('base64');

  const res = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: process.env.TWITTER_CALLBACK_URL!,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

/** Exchange the authorization code for user data */
export async function handleCallback(code: string, state: string) {
  const pending = pendingAuth.get(state);
  if (!pending) throw new Error('Invalid or expired OAuth state');

  pendingAuth.delete(state);

  const accessToken = await exchangeCodeForToken(code, pending.codeVerifier);

  const userClient = new TwitterApi(accessToken);
  const { data: twitterUser } = await userClient.v2.me({
    'user.fields': ['profile_image_url', 'name', 'username'],
  });

  return {
    id: twitterUser.id,
    handle: `@${twitterUser.username}`,
    name: twitterUser.name,
    avatar: twitterUser.profile_image_url ?? '',
  };
}
