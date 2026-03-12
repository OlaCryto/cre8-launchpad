import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  findUserByTwitterId, findUserById, createUser, updateUserProfile,
  findValidSession, createSession, deleteSession,
  isVerifiedCreator, createApplication, reviewApplication,
} from '../database.js';
import { generateWallet } from '../services/wallet.js';
import { generateAuthLink, handleCallback } from '../services/twitter.js';

const router = Router();

// ============ GET /api/auth/google ============
router.get('/google', async (_req: Request, res: Response) => {
  try {
    const { url } = await generateAuthLink();
    res.json({ url });
  } catch (err: any) {
    console.error('Failed to generate auth link:', err);
    res.status(500).json({ error: 'Failed to start authentication' });
  }
});

// Keep /twitter as alias for backwards compatibility
router.get('/twitter', async (_req: Request, res: Response) => {
  try {
    const { url } = await generateAuthLink();
    res.json({ url });
  } catch (err: any) {
    console.error('Failed to generate auth link:', err);
    res.status(500).json({ error: 'Failed to start authentication' });
  }
});

// ============ GET /api/auth/callback & /api/auth/google/callback ============
const handleOAuthCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

  if (!code || !state) {
    res.redirect(`${frontendUrl}/auth/callback?error=missing_params`);
    return;
  }

  try {
    const xUser = await handleCallback(code as string, state as string);

    let userId: string;
    const existingUser = await findUserByTwitterId(xUser.id);

    if (existingUser) {
      userId = existingUser.id;
      await updateUserProfile(userId, xUser.handle, xUser.name, xUser.avatar);
    } else {
      const wallet = generateWallet();
      userId = uuidv4();

      await createUser({
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

    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await createSession({
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
};

router.get('/callback', handleOAuthCallback);
router.get('/google/callback', handleOAuthCallback);

// ============ GET /api/auth/session ============
router.get('/session', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing session token' });
    return;
  }

  const result = await findValidSession(authHeader.slice(7));
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

// ============ POST /api/auth/dev-login (local testing only) ============
router.post('/dev-login', async (_req: Request, res: Response) => {
  if (process.env.ENABLE_DEV_LOGIN !== 'true') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    const DEV_TWITTER_ID = 'dev_test_000';
    let user = await findUserByTwitterId(DEV_TWITTER_ID);

    if (!user) {
      const wallet = generateWallet();
      const userId = uuidv4();

      await createUser({
        id: userId,
        twitter_id: DEV_TWITTER_ID,
        twitter_handle: 'dev_tester',
        twitter_name: 'Dev Tester',
        twitter_avatar: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png',
        wallet_address: wallet.address,
        encrypted_private_key: wallet.encryptedKey,
        encryption_iv: wallet.iv,
        encryption_tag: wallet.tag,
        created_at: new Date().toISOString(),
      });

      user = await findUserByTwitterId(DEV_TWITTER_ID);
    }

    // Auto-verify as creator if not already
    if (!(await isVerifiedCreator(user.wallet_address))) {
      const app = await createApplication({
        user_id: user.id,
        wallet_address: user.wallet_address.toLowerCase(),
        project_name: 'Dev Test Project',
        category: 'utility',
        description: 'Auto-approved dev test creator account',
        token_utility: 'Development testing',
      });
      await reviewApplication(app.id, 'approved', 'Auto-approved dev account', 'system');
      console.log(`[DevLogin] Auto-verified creator for ${user.wallet_address}`);
    }

    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    await createSession({
      token: sessionToken,
      user_id: user.id,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

    console.log(`[DevLogin] Session created for wallet ${user.wallet_address}`);

    res.json({
      session: sessionToken,
      user: {
        id: user.id,
        xHandle: user.twitter_handle,
        xName: user.twitter_name,
        xAvatar: user.twitter_avatar,
        walletAddress: user.wallet_address,
      },
    });
  } catch (err: any) {
    console.error('Dev login error:', err);
    res.status(500).json({ error: 'Dev login failed' });
  }
});

// ============ POST /api/auth/logout ============
router.post('/logout', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    await deleteSession(authHeader.slice(7));
  }
  res.json({ ok: true });
});

export default router;
