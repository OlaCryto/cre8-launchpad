import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { addComment, getComments, getReplies, toggleLike, getComment, isLikedByUser } from '../database.js';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateTokenAddress, validateIntId, sanitizeText } from '../middleware/validation.js';

const router = Router();

const commentWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Commenting too fast, please slow down' },
});

// GET /api/comments/:tokenAddress — list comments for a token
router.get('/:tokenAddress', validateTokenAddress, optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const { tokenAddress } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  const { comments, total } = getComments(tokenAddress, limit, offset);
  const userAddr = req.sessionUser?.wallet_address;

  const enriched = comments.map((c: any) => ({
    ...c,
    liked: userAddr ? isLikedByUser(c.id, userAddr) : false,
    replies: getReplies(c.id).map((r: any) => ({
      ...r,
      liked: userAddr ? isLikedByUser(r.id, userAddr) : false,
    })),
  }));

  res.json({ comments: enriched, total, limit, offset });
});

// POST /api/comments — create a comment
router.post('/', commentWriteLimiter, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.sessionUser!;
  const { token_address, content, parent_id } = req.body;

  if (!token_address || typeof token_address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(token_address)) {
    res.status(400).json({ error: 'Invalid token_address' });
    return;
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'Content is required' });
    return;
  }

  const sanitized = sanitizeText(content);
  if (sanitized.length > 500) {
    res.status(400).json({ error: 'Comment too long (max 500 chars)' });
    return;
  }

  if (parent_id !== undefined && parent_id !== null) {
    const pid = parseInt(parent_id);
    if (isNaN(pid) || pid < 1) {
      res.status(400).json({ error: 'Invalid parent_id' });
      return;
    }
    const parent = getComment(pid);
    if (!parent) {
      res.status(404).json({ error: 'Parent comment not found' });
      return;
    }
  }

  const result = addComment({
    token_address,
    author_address: user.wallet_address,
    author_name: user.twitter_name,
    author_avatar: user.twitter_avatar,
    content: sanitized,
    parent_id: parent_id ? parseInt(parent_id) : undefined,
  });

  res.status(201).json({
    id: result.id,
    token_address,
    author_address: user.wallet_address,
    author_name: user.twitter_name,
    author_avatar: user.twitter_avatar,
    content: sanitized,
    parent_id: parent_id || null,
    likes: 0,
    liked: false,
    created_at: new Date().toISOString(),
  });
});

// POST /api/comments/:id/like — toggle like on a comment
router.post('/:id/like', validateIntId, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.sessionUser!;
  const commentId = parseInt(req.params.id);

  const comment = getComment(commentId);
  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  const liked = toggleLike(commentId, user.wallet_address);
  res.json({ liked });
});

export default router;
