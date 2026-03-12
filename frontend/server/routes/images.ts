/**
 * Image upload & serving routes.
 * Stores token images in PostgreSQL (BYTEA) so they persist across Railway deploys.
 *
 * POST /api/images/:tokenAddress  — upload (auth required)
 * GET  /api/images/:tokenAddress  — serve  (public, cached)
 */

import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateTokenAddress, isValidAddress, param } from '../middleware/validation.js';
import { saveTokenImage, getTokenImage } from '../database.js';

const router = Router();

const MAX_BASE64_LENGTH = 7 * 1024 * 1024; // ~5MB decoded
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: { error: 'Too many uploads, please try again later' },
});

// ---- Upload (auth required) ----

router.post('/:tokenAddress', uploadLimiter, validateTokenAddress, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const tokenAddress = param(req, 'tokenAddress');

  const { image } = req.body;
  if (!image || typeof image !== 'string') {
    res.status(400).json({ error: 'Missing image field' });
    return;
  }
  if (image.length > MAX_BASE64_LENGTH) {
    res.status(413).json({ error: 'Image too large (max 5MB)' });
    return;
  }

  // Parse data URI
  const match = image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'Invalid image format. Must be PNG, JPEG, or WebP data URI.' });
    return;
  }

  const mimeType = `image/${match[1] === 'jpg' ? 'jpeg' : match[1]}`;
  const base64Data = match[2];
  const addr = tokenAddress.toLowerCase();

  try {
    const imageBuffer = Buffer.from(base64Data, 'base64');
    await saveTokenImage(addr, mimeType, imageBuffer, req.sessionUser?.wallet_address);
    console.log(`[images] Saved ${addr} (${Math.round(imageBuffer.length / 1024)}KB)`);
    res.json({ ok: true, url: `/api/images/${addr}` });
  } catch (err) {
    console.error('[images] Save failed:', err);
    res.status(500).json({ error: 'Failed to save image' });
  }
});

// ---- Serve (public, cached) ----

router.get('/:tokenAddress', async (req, res) => {
  const tokenAddress = param(req, 'tokenAddress');
  if (!isValidAddress(tokenAddress)) {
    res.status(400).json({ error: 'Invalid token address' });
    return;
  }

  try {
    const row = await getTokenImage(tokenAddress);
    if (!row) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    const safeMime = ALLOWED_MIMES.includes(row.mime_type) ? row.mime_type : 'application/octet-stream';
    res.setHeader('Content-Type', safeMime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(row.image_data);
  } catch (err) {
    console.error('[images] Fetch failed:', err);
    res.status(500).json({ error: 'Failed to retrieve image' });
  }
});

export default router;
