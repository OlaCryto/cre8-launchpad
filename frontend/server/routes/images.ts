/**
 * Image upload & serving routes.
 * Stores token images on disk keyed by token address.
 *
 * POST /api/images/:tokenAddress  — upload (auth required)
 * GET  /api/images/:tokenAddress  — serve  (public)
 */

import { Router, type Request, type Response } from 'express';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { findValidSession } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const router = Router();

const MAX_BASE64_LENGTH = 7 * 1024 * 1024; // ~5MB decoded

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ---- Upload (auth required) ----

router.post('/:tokenAddress', (req: Request, res: Response) => {
  // Auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing session token' });
    return;
  }
  const session = findValidSession(authHeader.slice(7));
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  // Validate address
  const { tokenAddress } = req.params;
  if (!isValidAddress(tokenAddress)) {
    res.status(400).json({ error: 'Invalid token address' });
    return;
  }

  // Validate body
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

  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const base64Data = match[2];
  const addr = tokenAddress.toLowerCase();

  // Remove any existing image for this address (could be different extension)
  for (const ext of ['png', 'jpg', 'webp']) {
    const existing = join(UPLOADS_DIR, `${addr}.${ext}`);
    if (existsSync(existing)) {
      try { unlinkSync(existing); } catch { /* ignore */ }
    }
  }

  // Write file
  const fileName = `${addr}.${extension}`;
  const filePath = join(UPLOADS_DIR, fileName);

  try {
    writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    console.log(`[images] Saved ${fileName} (${Math.round(base64Data.length * 0.75 / 1024)}KB)`);
    res.json({ ok: true, url: `/api/images/${addr}` });
  } catch (err) {
    console.error('[images] Write failed:', err);
    res.status(500).json({ error: 'Failed to save image' });
  }
});

// ---- Serve (public) ----

router.get('/:tokenAddress', (req: Request, res: Response) => {
  const { tokenAddress } = req.params;
  if (!isValidAddress(tokenAddress)) {
    res.status(400).json({ error: 'Invalid token address' });
    return;
  }

  const addr = tokenAddress.toLowerCase();

  for (const ext of ['png', 'jpg', 'webp']) {
    const filePath = join(UPLOADS_DIR, `${addr}.${ext}`);
    if (existsSync(filePath)) {
      const contentType =
        ext === 'png' ? 'image/png' :
        ext === 'webp' ? 'image/webp' :
        'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.sendFile(filePath);
      return;
    }
  }

  res.status(404).json({ error: 'Image not found' });
});

export default router;
