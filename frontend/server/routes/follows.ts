import { Router, Response } from 'express';
import { toggleFollow, isFollowing, getFollowerCount, createNotification } from '../database.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { isValidAddress, param } from '../middleware/validation.js';

const router = Router();

// Toggle follow/unfollow a creator
router.post('/:creatorAddress', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const creatorAddress = param(req, 'creatorAddress');
  if (!isValidAddress(creatorAddress)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  if (req.sessionUser!.wallet_address.toLowerCase() === creatorAddress.toLowerCase()) {
    res.status(400).json({ error: 'You cannot follow yourself' });
    return;
  }
  const followed = await toggleFollow(req.sessionUser!.wallet_address, creatorAddress);

  // Notify creator when someone follows them
  if (followed) {
    createNotification({
      user_address: creatorAddress,
      type: 'follow',
      title: 'New Follower',
      body: `${req.sessionUser!.twitter_name || req.sessionUser!.twitter_handle} started following you`,
    }).catch(() => {});
  }

  res.json({ followed });
});

// Get follower count (public) — MUST be before generic /:creatorAddress
router.get('/:creatorAddress/count', async (req, res) => {
  const creatorAddress = param(req, 'creatorAddress');
  if (!isValidAddress(creatorAddress)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  const count = await getFollowerCount(creatorAddress);
  res.json({ count });
});

// Check if current user follows a creator
router.get('/:creatorAddress', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const creatorAddress = param(req, 'creatorAddress');
  if (!isValidAddress(creatorAddress)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  const following = await isFollowing(req.sessionUser!.wallet_address, creatorAddress);
  const count = await getFollowerCount(creatorAddress);
  res.json({ following, count });
});

export default router;
