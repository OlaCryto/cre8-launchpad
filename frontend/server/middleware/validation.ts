import { Request, Response, NextFunction } from 'express';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isValidAddress(addr: string): boolean {
  return ETH_ADDRESS_RE.test(addr);
}

/**
 * Strips HTML tags and dangerous characters from a string.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Validates that :tokenAddress param is a valid Ethereum address.
 */
export function validateTokenAddress(req: Request, res: Response, next: NextFunction) {
  const addr = req.params.tokenAddress;
  if (!addr || !isValidAddress(addr)) {
    res.status(400).json({ error: 'Invalid token address format' });
    return;
  }
  next();
}

/**
 * Validates that :id param is a positive integer.
 */
export function validateIntId(req: Request, res: Response, next: NextFunction) {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Invalid ID format' });
    return;
  }
  next();
}
