import { Router, Response } from 'express';
import { addFavorite, removeFavorite, getFavorites } from '../database.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateTokenAddress, param } from '../middleware/validation.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const favs = await getFavorites(req.sessionUser!.wallet_address);
  res.json({ favorites: favs });
});

router.post('/:tokenAddress', validateTokenAddress, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await addFavorite(req.sessionUser!.wallet_address, param(req, 'tokenAddress').toLowerCase());
  res.status(201).json({ ok: true });
});

router.delete('/:tokenAddress', validateTokenAddress, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await removeFavorite(req.sessionUser!.wallet_address, param(req, 'tokenAddress').toLowerCase());
  res.json({ ok: true });
});

export default router;
