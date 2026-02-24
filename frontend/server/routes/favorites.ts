import { Router, Response } from 'express';
import { addFavorite, removeFavorite, getFavorites } from '../database.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateTokenAddress } from '../middleware/validation.js';

const router = Router();

// GET /api/favorites — get user's favorite tokens
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const favs = getFavorites(req.sessionUser!.wallet_address);
  res.json({ favorites: favs });
});

// POST /api/favorites/:tokenAddress — add to favorites
router.post('/:tokenAddress', validateTokenAddress, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  addFavorite(req.sessionUser!.wallet_address, req.params.tokenAddress.toLowerCase());
  res.status(201).json({ ok: true });
});

// DELETE /api/favorites/:tokenAddress — remove from favorites
router.delete('/:tokenAddress', validateTokenAddress, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  removeFavorite(req.sessionUser!.wallet_address, req.params.tokenAddress.toLowerCase());
  res.json({ ok: true });
});

export default router;
