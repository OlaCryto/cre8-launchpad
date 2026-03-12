/**
 * Server-side transaction signing routes.
 * Private keys NEVER leave the server.
 *
 * POST /api/wallet/send-transaction  — sign & broadcast (auth required)
 * POST /api/wallet/export-key        — explicit key export (auth required, user-initiated only)
 */

import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { findValidSessionWithKeys } from '../database.js';
import { decryptPrivateKey } from '../services/wallet.js';
import { signAndSend, type TxAction } from '../services/txSigner.js';

const router = Router();

const ALLOWED_ACTIONS = new Set([
  'createToken', 'createTokenForge', 'buy', 'sell',
  'updateWhitelist', 'updateBlacklist', 'sendAvax', 'sendToken',
]);

// Stricter rate limit for transactions (20/min — more than enough for trading)
const txLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { error: 'Too many transactions, please slow down' },
});

// Very strict limit for key export (3/hour)
const exportLimiter = rateLimit({
  windowMs: 3600_000,
  max: 3,
  message: { error: 'Too many export requests' },
});

// ============ POST /api/wallet/send-transaction ============
router.post('/send-transaction', txLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, params } = req.body;

    if (!action || !ALLOWED_ACTIONS.has(action)) {
      res.status(400).json({ error: `Invalid action: ${action}` });
      return;
    }
    if (!params || typeof params !== 'object') {
      res.status(400).json({ error: 'Missing params' });
      return;
    }

    // Get user's encrypted key from session
    const sessionToken = req.headers.authorization?.slice(7);
    if (!sessionToken) {
      res.status(401).json({ error: 'Missing session' });
      return;
    }

    const result = await findValidSessionWithKeys(sessionToken);
    if (!result) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    // Decrypt key on the server — it never leaves this process
    const privateKey = decryptPrivateKey(
      result.user.encrypted_private_key,
      result.user.encryption_iv,
      result.user.encryption_tag,
    );

    const tx: TxAction = { action, params } as TxAction;
    const hash = await signAndSend(privateKey, tx);

    console.log(`[Wallet] ${action} tx signed for ${result.user.wallet_address}: ${hash}`);
    res.json({ hash });
  } catch (err: any) {
    const msg = err?.shortMessage || err?.message || 'Transaction failed';
    console.error('[Wallet] Transaction failed:', msg);
    res.status(400).json({ error: msg });
  }
});

// ============ POST /api/wallet/export-key ============
// Explicit user action — only called when user clicks "Show Private Key"
router.post('/export-key', exportLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionToken = req.headers.authorization?.slice(7);
    if (!sessionToken) {
      res.status(401).json({ error: 'Missing session' });
      return;
    }

    const result = await findValidSessionWithKeys(sessionToken);
    if (!result) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const privateKey = decryptPrivateKey(
      result.user.encrypted_private_key,
      result.user.encryption_iv,
      result.user.encryption_tag,
    );

    console.log(`[Wallet] Key exported for ${result.user.wallet_address}`);
    res.json({ privateKey });
  } catch (err: any) {
    console.error('[Wallet] Export key failed:', err);
    res.status(500).json({ error: 'Failed to export key' });
  }
});

export default router;
