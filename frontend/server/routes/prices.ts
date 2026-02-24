import { Router, Request, Response } from 'express';
import { getPriceChanges, getPriceHistory, addPriceSnapshot } from '../database.js';
import { requireApiKey } from '../middleware/auth.js';
import { validateTokenAddress } from '../middleware/validation.js';

const router = Router();

// GET /api/prices/:tokenAddress — get price changes (5m, 1h, 6h, 24h)
router.get('/:tokenAddress', validateTokenAddress, (req: Request, res: Response) => {
  const { tokenAddress } = req.params;
  const changes = getPriceChanges(tokenAddress);
  res.json(changes);
});

// GET /api/prices/:tokenAddress/history — get price history
router.get('/:tokenAddress/history', validateTokenAddress, (req: Request, res: Response) => {
  const { tokenAddress } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const history = getPriceHistory(tokenAddress, limit);
  res.json(history);
});

// POST /api/prices/snapshot — record a price snapshot (internal only, requires API key)
router.post('/snapshot', requireApiKey, (req: Request, res: Response) => {
  const { token_address, price, reserve, market_cap } = req.body;

  if (!token_address || typeof token_address !== 'string' || !/^0x[0-9a-fA-F]{40}$/i.test(token_address)) {
    res.status(400).json({ error: 'Invalid token_address' });
    return;
  }
  if (typeof price !== 'number' || price < 0) {
    res.status(400).json({ error: 'Invalid price' });
    return;
  }

  addPriceSnapshot(token_address.toLowerCase(), price, reserve || 0, market_cap || 0);
  res.status(201).json({ ok: true });
});

export default router;
