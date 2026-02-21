import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  findUserByTwitterId, findUserById, createUser, updateUserProfile,
  findValidSession, createSession, deleteSession,
} from '../db.js';
import { generateWallet, decryptPrivateKey } from '../services/wallet.js';
import { generateAuthLink, handleCallback } from '../services/twitter.js';

const router = Router();

// ============ GET /api/auth/twitter ============
router.get('/twitter', async (_req: Request, res: Response) => {
  try {
    const { url } = await generateAuthLink();
    res.json({ url });
  } catch (err: any) {
    console.error('Failed to generate auth link:', err);
    res.status(500).json({ error: 'Failed to start authentication' });
  }
});

// ============ GET /api/auth/callback ============
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!code || !state) {
    res.redirect(`${frontendUrl}/auth/callback?error=missing_params`);
    return;
  }

  try {
    const xUser = await handleCallback(code as string, state as string);

    let userId: string;
    const existingUser = findUserByTwitterId(xUser.id);

    if (existingUser) {
      userId = existingUser.id;
      updateUserProfile(userId, xUser.handle, xUser.name, xUser.avatar);
    } else {
      const wallet = generateWallet();
      userId = uuidv4();

      createUser({
        id: userId,
        twitter_id: xUser.id,
        twitter_handle: xUser.handle,
        twitter_name: xUser.name,
        twitter_avatar: xUser.avatar,
        wallet_address: wallet.address,
        encrypted_private_key: wallet.encryptedKey,
        encryption_iv: wallet.iv,
        encryption_tag: wallet.tag,
        created_at: new Date().toISOString(),
      });
    }

    // Create session (7-day expiry)
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    createSession({
      token: sessionToken,
      user_id: userId,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

    res.redirect(`${frontendUrl}/auth/callback?session=${sessionToken}`);
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    res.redirect(`${frontendUrl}/auth/callback?error=auth_failed`);
  }
});

// ============ GET /api/auth/session ============
router.get('/session', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing session token' });
    return;
  }

  const result = findValidSession(authHeader.slice(7));
  if (!result) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  res.json({
    user: {
      id: result.user.id,
      xHandle: result.user.twitter_handle,
      xName: result.user.twitter_name,
      xAvatar: result.user.twitter_avatar,
      walletAddress: result.user.wallet_address,
    },
  });
});

// ============ POST /api/auth/wallet-key ============
router.post('/wallet-key', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing session token' });
    return;
  }

  const result = findValidSession(authHeader.slice(7));
  if (!result) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  try {
    const privateKey = decryptPrivateKey(
      result.user.encrypted_private_key,
      result.user.encryption_iv,
      result.user.encryption_tag,
    );
    res.json({ privateKey });
  } catch (err: any) {
    console.error('Failed to decrypt wallet key:', err);
    res.status(500).json({ error: 'Failed to retrieve wallet key' });
  }
});

// ============ POST /api/auth/logout ============
router.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    deleteSession(authHeader.slice(7));
  }
  res.json({ ok: true });
});

export default router;
