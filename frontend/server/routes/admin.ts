import { Router, Request, Response } from 'express';
import {
  getAllApplications, getApplicationById, reviewApplication,
  getPendingApplications, getApplicationCountByStatus,
} from '../database.js';

const router = Router();

const ADMIN_ADDRESSES = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',').map(a => a.trim()).filter(Boolean);

function requireAdmin(req: Request, res: Response, next: () => void) {
  const apiKey = req.headers['x-admin-key'] as string;
  const expected = process.env.ADMIN_API_KEY;

  if (expected && apiKey === expected) {
    next();
    return;
  }

  res.status(403).json({ error: 'Admin access required' });
}

// GET /api/admin/applications — list all applications with pagination
router.get('/applications', requireAdmin, (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  const status = req.query.status as string;

  if (status === 'pending') {
    const apps = getPendingApplications();
    res.json({ applications: apps, total: apps.length });
    return;
  }

  const { applications, total } = getAllApplications(limit, offset);
  res.json({ applications, total, limit, offset });
});

// GET /api/admin/applications/stats — get application counts by status
router.get('/applications/stats', requireAdmin, (_req: Request, res: Response) => {
  res.json({
    pending: getApplicationCountByStatus('pending'),
    approved: getApplicationCountByStatus('approved'),
    rejected: getApplicationCountByStatus('rejected'),
    total: getApplicationCountByStatus('pending') +
           getApplicationCountByStatus('approved') +
           getApplicationCountByStatus('rejected'),
  });
});

// GET /api/admin/applications/:id — get a single application
router.get('/applications/:id', requireAdmin, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Invalid application ID' });
    return;
  }

  const app = getApplicationById(id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  res.json(app);
});

// POST /api/admin/applications/:id/review — approve or reject an application
router.post('/applications/:id/review', requireAdmin, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Invalid application ID' });
    return;
  }

  const app = getApplicationById(id);
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

  const reviewerInfo = 'admin';
  reviewApplication(id, decision, notes || '', reviewerInfo);

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
