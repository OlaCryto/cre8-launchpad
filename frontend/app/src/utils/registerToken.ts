const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Register a newly created token in the backend (fire-and-forget).
 * This enables:
 *  - Comment notifications to the token creator
 *  - Exact creation block for trade history (no missed trades)
 *  - Creator lookup by token address
 */
export async function registerTokenCreator(
  tokenAddress: string,
  tokenName: string,
  tokenSymbol: string,
  createdBlock?: bigint | number,
): Promise<boolean> {
  const sessionToken = localStorage.getItem('cre8_session');
  if (!sessionToken) return false;

  try {
    const res = await fetch(`${API_BASE}/api/tokens/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        token_address: tokenAddress.toLowerCase(),
        token_name: tokenName,
        token_symbol: tokenSymbol,
        created_block: createdBlock ? Number(createdBlock) : undefined,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[registerTokenCreator] Failed (non-critical):', err);
    return false;
  }
}
