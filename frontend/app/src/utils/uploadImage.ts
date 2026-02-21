const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Upload a base64 data URI image to the backend, mapped to a token address.
 * Best-effort — never throws. Token creation is the critical path.
 */
export async function uploadTokenImage(
  tokenAddress: string,
  base64DataURI: string,
): Promise<boolean> {
  const sessionToken = localStorage.getItem('cre8_session');
  if (!sessionToken) {
    console.warn('[uploadTokenImage] No session token, skipping');
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/api/images/${tokenAddress.toLowerCase()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ image: base64DataURI }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[uploadTokenImage] Failed:', err);
      return false;
    }

    console.log('[uploadTokenImage] Uploaded for', tokenAddress);
    return true;
  } catch (err) {
    console.warn('[uploadTokenImage] Network error:', err);
    return false;
  }
}
