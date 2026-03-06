import { Router, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { getNotifications, markNotificationsRead, deleteNotification } from '../database.js';
import { param } from '../middleware/validation.js';

const router = Router();

// ============ GET /api/notifications ============
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await getNotifications(req.sessionUser!.wallet_address, limit, offset);
    res.json(result);
  } catch (err: any) {
    console.error('Failed to get notifications:', err);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// ============ POST /api/notifications/read ============
router.post('/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body as { ids?: number[] };
    await markNotificationsRead(req.sessionUser!.wallet_address, ids);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Failed to mark notifications read:', err);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// ============ DELETE /api/notifications/:id ============
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(param(req, 'id'));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid notification ID' });
      return;
    }
    await deleteNotification(req.sessionUser!.wallet_address, id);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Failed to delete notification:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
