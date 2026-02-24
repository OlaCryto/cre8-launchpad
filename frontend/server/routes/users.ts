import { Router, type Request, type Response } from 'express';
import { findUsersByWalletAddresses } from '../database.js';
import { isValidAddress } from '../middleware/validation.js';

const router = Router();

/**
 * GET /api/users/by-wallet?addresses=0xabc,0xdef
 * Returns a map of wallet address -> public profile (handle, name, avatar).
 * Public endpoint — no auth required.
 */
router.get('/by-wallet', (req: Request, res: Response) => {
  const raw = req.query.addresses as string | undefined;
  if (!raw) {
    res.json({});
    return;
  }

  const addresses = raw.split(',').map(a => a.trim()).filter(Boolean).slice(0, 50);
  const valid = addresses.filter(isValidAddress);

  if (valid.length === 0) {
    res.json({});
    return;
  }

  const result = findUsersByWalletAddresses(valid);
  res.json(result);
});

export default router;
