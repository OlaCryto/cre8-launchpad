import { Router, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { param } from '../middleware/validation.js';
import {
  createPresaleEvent, getPresaleEvents, getPresaleByLaunchId,
  getFollowerAddresses, createBulkNotifications,
} from '../database.js';

const router = Router();

// ============ POST /api/presales ============
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { launch_id, token_name, token_symbol, hard_cap, soft_cap, max_per_wallet, duration_seconds, vault_address } = req.body;

    if (!launch_id || !token_name || !token_symbol || !hard_cap || !max_per_wallet || !duration_seconds) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await createPresaleEvent({
      launch_id,
      creator_address: req.sessionUser!.wallet_address,
      token_name,
      token_symbol,
      hard_cap: parseFloat(hard_cap),
      soft_cap: parseFloat(soft_cap || '0'),
      max_per_wallet: parseFloat(max_per_wallet),
      duration_seconds: parseInt(duration_seconds),
      vault_address,
    });

    res.json({ id: result.id });
  } catch (err: any) {
    console.error('Failed to create presale event:', err);
    res.status(500).json({ error: 'Failed to create presale event' });
  }
});

// ============ GET /api/presales ============
router.get('/', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const events = await getPresaleEvents(status, limit);
    res.json({ presales: events });
  } catch (err: any) {
    console.error('Failed to get presale events:', err);
    res.status(500).json({ error: 'Failed to get presale events' });
  }
});

// ============ GET /api/presales/:launchId ============
router.get('/:launchId', async (req, res) => {
  try {
    const launchId = parseInt(param(req, 'launchId'));
    if (isNaN(launchId)) {
      res.status(400).json({ error: 'Invalid launch ID' });
      return;
    }
    const presale = await getPresaleByLaunchId(launchId);
    if (!presale) {
      res.status(404).json({ error: 'Presale not found' });
      return;
    }
    res.json(presale);
  } catch (err: any) {
    console.error('Failed to get presale:', err);
    res.status(500).json({ error: 'Failed to get presale' });
  }
});

// ============ POST /api/presales/:launchId/announce ============
router.post('/:launchId/announce', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const launchId = parseInt(param(req, 'launchId'));
    if (isNaN(launchId)) {
      res.status(400).json({ error: 'Invalid launch ID' });
      return;
    }

    const presale = await getPresaleByLaunchId(launchId);
    if (!presale) {
      res.status(404).json({ error: 'Presale not found' });
      return;
    }

    // Only the creator can announce
    if (presale.creator_address !== req.sessionUser!.wallet_address.toLowerCase()) {
      res.status(403).json({ error: 'Only the creator can announce this presale' });
      return;
    }

    // Get all follower addresses for this creator
    const followers = await getFollowerAddresses(req.sessionUser!.wallet_address);
    if (followers.length === 0) {
      res.json({ notified: 0 });
      return;
    }

    // Create notifications for all followers
    const notifications = followers.map(addr => ({
      user_address: addr,
      type: 'presale_announced',
      title: `${presale.token_name} Presale is Live!`,
      body: `${req.sessionUser!.twitter_name || req.sessionUser!.twitter_handle} just launched a presale for $${presale.token_symbol}. Hard cap: ${presale.hard_cap} AVAX.`,
      token_symbol: presale.token_symbol,
      creator_name: req.sessionUser!.twitter_name || req.sessionUser!.twitter_handle,
    }));

    await createBulkNotifications(notifications);

    res.json({ notified: followers.length });
  } catch (err: any) {
    console.error('Failed to announce presale:', err);
    res.status(500).json({ error: 'Failed to announce presale' });
  }
});

export default router;
