import { Request, Response, NextFunction } from 'express';
import { findValidSession } from '../database.js';

export interface AuthenticatedRequest extends Request {
  sessionUser?: {
    id: string;
    twitter_id: string;
    twitter_handle: string;
    twitter_name: string;
    twitter_avatar: string;
    wallet_address: string;
  };
}

/**
 * Middleware that requires a valid Bearer session token.
 * Attaches `req.sessionUser` with public user fields (no encryption data).
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing session token' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.length < 10) {
    res.status(401).json({ error: 'Invalid session token format' });
    return;
  }

  const result = findValidSession(token);
  if (!result) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.sessionUser = {
    id: result.user.id,
    twitter_id: result.user.twitter_id,
    twitter_handle: result.user.twitter_handle,
    twitter_name: result.user.twitter_name,
    twitter_avatar: result.user.twitter_avatar,
    wallet_address: result.user.wallet_address,
  };

  next();
}

/**
 * Optional auth — attaches sessionUser if token present, but doesn't block.
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token && token.length >= 10) {
      const result = findValidSession(token);
      if (result) {
        req.sessionUser = {
          id: result.user.id,
          twitter_id: result.user.twitter_id,
          twitter_handle: result.user.twitter_handle,
          twitter_name: result.user.twitter_name,
          twitter_avatar: result.user.twitter_avatar,
          wallet_address: result.user.wallet_address,
        };
      }
    }
  }
  next();
}

/**
 * Requires a valid INDEXER_API_KEY for internal service endpoints.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string;
  const expected = process.env.INDEXER_API_KEY;

  if (!expected) {
    res.status(503).json({ error: 'Service not configured' });
    return;
  }

  if (!key || key !== expected) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
