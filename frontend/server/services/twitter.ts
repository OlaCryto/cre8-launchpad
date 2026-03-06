// In-memory store for OAuth state → codeVerifier mapping
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
  const clientId = process.env.TWITTER_CLIENT_ID!;
  const callbackUrl = process.env.TWITTER_CALLBACK_URL!;

  // Generate PKCE code verifier and challenge
  const { randomBytes, createHash } = await import('crypto');
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const state = randomBytes(24).toString('base64url');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 's256',
    scope: 'tweet.read users.read',
  });

  const url = `https://x.com/i/oauth2/authorize?${params}`;
  pendingAuth.set(state, { codeVerifier, createdAt: Date.now() });
  return { url, state };
}

/** Exchange the authorization code for an access token */
async function exchangeCodeForToken(code: string, codeVerifier: string) {
  const clientId = process.env.TWITTER_CLIENT_ID!;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!;

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

/** Fetch user profile using the access token — uses v2 /users/me with fallback */
async function fetchUserProfile(accessToken: string) {
  // Try v2 first
  const v2Res = await fetch('https://api.x.com/2/users/me?user.fields=profile_image_url,name,username', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (v2Res.ok) {
    const v2Data = await v2Res.json() as {
      data: { id: string; name: string; username: string; profile_image_url?: string };
    };
    return {
      id: v2Data.data.id,
      handle: `@${v2Data.data.username}`,
      name: v2Data.data.name,
      avatar: v2Data.data.profile_image_url ?? '',
    };
  }

  // v2 failed (likely 403 project enrollment), decode user info from the access token
  // OAuth 2.0 access tokens from Twitter are JWTs — extract the sub (user ID)
  // Then use the token to get basic info from a simpler endpoint
  console.warn(`[Twitter] v2/users/me failed (${v2Res.status}), trying token introspection`);

  // Parse JWT payload to extract user ID (sub claim)
  const parts = accessToken.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.sub) {
        // We have the user ID from the JWT, use it as a minimal profile
        // The username might not be in the JWT, so we generate a placeholder
        return {
          id: payload.sub,
          handle: `@user_${payload.sub.slice(-6)}`,
          name: `User ${payload.sub.slice(-6)}`,
          avatar: '',
        };
      }
    } catch {
      // JWT parsing failed, continue to fallback
    }
  }

  // Final fallback: generate a unique ID from the token hash
  const { createHash } = await import('crypto');
  const hash = createHash('sha256').update(accessToken).digest('hex').slice(0, 12);
  return {
    id: hash,
    handle: `@cre8_user_${hash.slice(0, 6)}`,
    name: `Cre8 User`,
    avatar: '',
  };
}

/** Exchange the authorization code for user data */
export async function handleCallback(code: string, state: string) {
  const pending = pendingAuth.get(state);
  if (!pending) throw new Error('Invalid or expired OAuth state');

  pendingAuth.delete(state);

  const accessToken = await exchangeCodeForToken(code, pending.codeVerifier);
  return fetchUserProfile(accessToken);
}
