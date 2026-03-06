import { Router, type Request, type Response } from 'express';
import { findUsersByWalletAddresses } from '../database.js';
import { isValidAddress } from '../middleware/validation.js';

const router = Router();

router.get('/by-wallet', async (req: Request, res: Response) => {
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

  const result = await findUsersByWalletAddresses(valid);
  res.json(result);
});

export default router;
