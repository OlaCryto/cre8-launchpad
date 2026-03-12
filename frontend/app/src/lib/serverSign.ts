/**
 * Server-side transaction signing client.
 * All transactions are signed on the server — the private key never reaches the browser.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ServerTxRequest {
  action: string;
  params: Record<string, unknown>;
}

/**
 * Send a transaction request to the server for signing and broadcasting.
 * Returns the transaction hash.
 */
export async function serverSignTransaction(tx: ServerTxRequest): Promise<`0x${string}`> {
  const sessionToken = localStorage.getItem('cre8_session');
  if (!sessionToken) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/api/wallet/send-transaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(tx),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Transaction failed');
  }

  return data.hash as `0x${string}`;
}

/**
 * Export private key (explicit user action only — NOT called on page load).
 */
export async function exportPrivateKey(): Promise<string> {
  const sessionToken = localStorage.getItem('cre8_session');
  if (!sessionToken) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/api/wallet/export-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to export key');
  return data.privateKey;
}
