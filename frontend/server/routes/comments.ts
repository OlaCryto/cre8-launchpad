import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { addComment, getComments, getReplies, toggleLike, getComment, isLikedByUser, getTokenCreator, createNotification } from '../database.js';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateTokenAddress, validateIntId, sanitizeText, param } from '../middleware/validation.js';

const router = Router();

const commentWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Commenting too fast, please slow down' },
});

router.get('/:tokenAddress', validateTokenAddress, optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const tokenAddress = param(req, 'tokenAddress');
  const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 20, 100));
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  const { comments, total } = await getComments(tokenAddress, limit, offset);
  const userAddr = req.sessionUser?.wallet_address;

  const enriched = await Promise.all(comments.map(async (c: any) => {
    const replies = await getReplies(c.id);
    const enrichedReplies = await Promise.all(replies.map(async (r: any) => ({
      ...r,
      liked: userAddr ? await isLikedByUser(r.id, userAddr) : false,
    })));
    return {
      ...c,
      liked: userAddr ? await isLikedByUser(c.id, userAddr) : false,
      replies: enrichedReplies,
    };
  }));

  res.json({ comments: enriched, total, limit, offset });
});

router.post('/', commentWriteLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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
    const parent = await getComment(pid);
    if (!parent) {
      res.status(404).json({ error: 'Parent comment not found' });
      return;
    }
  }

  const result = await addComment({
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

  // Fire-and-forget notifications — never blocks or fails the response
  (async () => {
    try {
      const tokenCreator = await getTokenCreator(token_address);
      const commenterAddr = user.wallet_address.toLowerCase();
      const commenterName = user.twitter_name || user.twitter_handle;

      if (!parent_id) {
        // Top-level comment → notify token creator
        if (tokenCreator && tokenCreator.creator_address !== commenterAddr) {
          await createNotification({
            user_address: tokenCreator.creator_address,
            type: 'comment',
            title: 'New Comment',
            body: `${commenterName} commented on ${tokenCreator.token_symbol}`,
            token_address,
            token_symbol: tokenCreator.token_symbol,
            creator_name: commenterName,
          });
        }
      } else {
        // Reply → notify parent comment author + token creator
        const parentComment = await getComment(parseInt(parent_id));
        if (parentComment && parentComment.author_address.toLowerCase() !== commenterAddr) {
          await createNotification({
            user_address: parentComment.author_address,
            type: 'reply',
            title: 'New Reply',
            body: `${commenterName} replied to your comment`,
            token_address,
            token_symbol: tokenCreator?.token_symbol || '',
            creator_name: commenterName,
          });
        }
        // Also notify token creator if they're a different person
        if (
          tokenCreator &&
          tokenCreator.creator_address !== commenterAddr &&
          tokenCreator.creator_address !== parentComment?.author_address?.toLowerCase()
        ) {
          await createNotification({
            user_address: tokenCreator.creator_address,
            type: 'comment',
            title: 'New Comment',
            body: `${commenterName} commented on ${tokenCreator.token_symbol}`,
            token_address,
            token_symbol: tokenCreator.token_symbol,
            creator_name: commenterName,
          });
        }
      }
    } catch (err) {
      console.warn('[Comments] Notification creation failed:', err);
    }
  })();
});

router.post('/:id/like', validateIntId, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.sessionUser!;
  const commentId = parseInt(param(req, 'id'));

  const comment = await getComment(commentId);
  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  const liked = await toggleLike(commentId, user.wallet_address);
  res.json({ liked });
});

export default router;
