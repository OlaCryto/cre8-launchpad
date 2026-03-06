import { Router, Request, Response } from 'express';
import {
  getAllApplications, getApplicationById, reviewApplication,
  getPendingApplications, getApplicationCountByStatus,
} from '../database.js';
import { param } from '../middleware/validation.js';

const router = Router();

function requireAdmin(req: Request, res: Response, next: () => void) {
  const apiKey = req.headers['x-admin-key'] as string;
  const expected = process.env.ADMIN_API_KEY;

  if (expected && apiKey === expected) {
    next();
    return;
  }

  res.status(403).json({ error: 'Admin access required' });
}

router.get('/applications', requireAdmin, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  const status = req.query.status as string;

  if (status === 'pending') {
    const apps = await getPendingApplications();
    res.json({ applications: apps, total: apps.length });
    return;
  }

  const { applications, total } = await getAllApplications(limit, offset);
  res.json({ applications, total, limit, offset });
});

router.get('/applications/stats', requireAdmin, async (_req: Request, res: Response) => {
  const [pending, approved, rejected] = await Promise.all([
    getApplicationCountByStatus('pending'),
    getApplicationCountByStatus('approved'),
    getApplicationCountByStatus('rejected'),
  ]);
  res.json({ pending, approved, rejected, total: pending + approved + rejected });
});

router.get('/applications/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(param(req, 'id'));
  if (isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Invalid application ID' });
    return;
  }

  const app = await getApplicationById(id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  res.json(app);
});

router.post('/applications/:id/review', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(param(req, 'id'));
  if (isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Invalid application ID' });
    return;
  }

  const app = await getApplicationById(id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  if (app.status !== 'pending') {
    res.status(409).json({ error: `Application already ${app.status}` });
    return;
  }

  const { decision, notes } = req.body;
  if (!decision || !['approved', 'rejected'].includes(decision)) {
    res.status(400).json({ error: 'Decision must be "approved" or "rejected"' });
    return;
  }

  await reviewApplication(id, decision, notes || '', 'admin');

  res.json({
    id,
    status: decision,
    notes: notes || '',
    wallet_address: app.wallet_address,
    message: decision === 'approved'
      ? 'Application approved. Call setVerified() on CreatorRegistry contract for this wallet.'
      : 'Application rejected.',
  });
});

export default router;
