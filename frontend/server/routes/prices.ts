import { Router, Request, Response } from 'express';
import { getPriceChanges, getPriceHistory, addPriceSnapshot } from '../database.js';
import { requireApiKey } from '../middleware/auth.js';
import { validateTokenAddress, param } from '../middleware/validation.js';

const router = Router();

router.get('/:tokenAddress', validateTokenAddress, async (req: Request, res: Response) => {
  const tokenAddress = param(req, 'tokenAddress');
  const changes = await getPriceChanges(tokenAddress);
  res.json(changes);
});

router.get('/:tokenAddress/history', validateTokenAddress, async (req: Request, res: Response) => {
  const tokenAddress = param(req, 'tokenAddress');
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const history = await getPriceHistory(tokenAddress, limit);
  res.json(history);
});

router.post('/snapshot', requireApiKey, async (req: Request, res: Response) => {
  const { token_address, price, reserve, market_cap } = req.body;

  if (!token_address || typeof token_address !== 'string' || !/^0x[0-9a-fA-F]{40}$/i.test(token_address)) {
    res.status(400).json({ error: 'Invalid token_address' });
    return;
  }
  if (typeof price !== 'number' || price < 0) {
    res.status(400).json({ error: 'Invalid price' });
    return;
  }

  await addPriceSnapshot(token_address.toLowerCase(), price, reserve || 0, market_cap || 0);
  res.status(201).json({ ok: true });
});

export default router;
