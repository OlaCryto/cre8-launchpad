import { Request, Response, NextFunction } from 'express';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Safely extract a single string param from Express 5 req.params (which may be string | string[]).
 */
export function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : v ?? '';
}

export function isValidAddress(addr: string | string[] | undefined): addr is string {
  return typeof addr === 'string' && ETH_ADDRESS_RE.test(addr);
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
  const addr = param(req, 'tokenAddress');
  if (!isValidAddress(addr)) {
    res.status(400).json({ error: 'Invalid token address format' });
    return;
  }
  next();
}

/**
 * Validates that :id param is a positive integer.
 */
export function validateIntId(req: Request, res: Response, next: NextFunction) {
  const id = parseInt(param(req, 'id'));
  if (isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Invalid ID format' });
    return;
  }
  next();
}
