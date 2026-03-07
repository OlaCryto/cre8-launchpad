import { Router, type Request, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { registerTokenCreator, getTokenCreator, getTokensByCreator } from '../database.js';
import { isValidAddress, param } from '../middleware/validation.js';

const router = Router();

// POST /api/tokens/register — called by frontend after successful token creation
router.post('/register', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token_address, token_name, token_symbol, created_block } = req.body;

    if (!token_address || !isValidAddress(token_address)) {
      res.status(400).json({ error: 'Invalid token_address' });
      return;
    }
    if (!token_name || typeof token_name !== 'string') {
      res.status(400).json({ error: 'token_name is required' });
      return;
    }
    if (!token_symbol || typeof token_symbol !== 'string') {
      res.status(400).json({ error: 'token_symbol is required' });
      return;
    }

    await registerTokenCreator({
      token_address,
      creator_address: req.sessionUser!.wallet_address,
      token_name,
      token_symbol,
      created_block: created_block ? Number(created_block) : undefined,
    });

    res.status(201).json({ ok: true });
  } catch (err: any) {
    console.error('Failed to register token creator:', err);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// GET /api/tokens/:tokenAddress/creator — look up who created a token
router.get('/:tokenAddress/creator', async (req: Request, res: Response) => {
  const tokenAddress = param(req, 'tokenAddress');
  if (!isValidAddress(tokenAddress)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  const creator = await getTokenCreator(tokenAddress);
  if (!creator) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(creator);
});

// GET /api/tokens/by-creator/:creatorAddress — list tokens by a creator
router.get('/by-creator/:creatorAddress', async (req: Request, res: Response) => {
  const creatorAddress = param(req, 'creatorAddress');
  if (!isValidAddress(creatorAddress)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  const tokens = await getTokensByCreator(creatorAddress);
  res.json({ tokens });
});

export default router;
