import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createApplication, getApplicationsByUser, getApplicationById,
  hasPendingApplication, isVerifiedCreator, getApprovedApplicationByWallet,
} from '../database.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { sanitizeText, isValidAddress } from '../middleware/validation.js';

const router = Router();

const VALID_CATEGORIES = [
  'defi', 'gaming', 'nft', 'social', 'utility', 'content',
  'music', 'art', 'dao', 'infrastructure', 'other',
];

const applyLimiter = rateLimit({
  windowMs: 60_000 * 60,
  max: 3,
  message: { error: 'Too many applications, please try again later' },
});

router.post('/apply', applyLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.sessionUser!;

  if (await hasPendingApplication(user.id)) {
    res.status(409).json({ error: 'You already have a pending application' });
    return;
  }

  if (await isVerifiedCreator(user.wallet_address)) {
    res.status(409).json({ error: 'You are already a verified creator' });
    return;
  }

  const {
    project_name, category, description, website, product_proof,
    twitter, telegram, discord, youtube, team_info, token_utility, roadmap,
  } = req.body;

  if (!project_name || typeof project_name !== 'string' || project_name.trim().length < 2) {
    res.status(400).json({ error: 'Project name is required (min 2 characters)' });
    return;
  }
  if (project_name.length > 100) {
    res.status(400).json({ error: 'Project name too long (max 100 characters)' });
    return;
  }

  if (!category || !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }

  if (!description || typeof description !== 'string' || description.trim().length < 20) {
    res.status(400).json({ error: 'Description is required (min 20 characters)' });
    return;
  }
  if (description.length > 2000) {
    res.status(400).json({ error: 'Description too long (max 2000 characters)' });
    return;
  }

  if (!token_utility || typeof token_utility !== 'string' || token_utility.trim().length < 10) {
    res.status(400).json({ error: 'Token utility description is required (min 10 characters)' });
    return;
  }

  const result = await createApplication({
    user_id: user.id,
    wallet_address: user.wallet_address.toLowerCase(),
    project_name: sanitizeText(project_name.trim()),
    category,
    description: sanitizeText(description.trim()),
    website: website?.trim() || undefined,
    product_proof: product_proof?.trim() || undefined,
    twitter: twitter?.trim() || undefined,
    telegram: telegram?.trim() || undefined,
    discord: discord?.trim() || undefined,
    youtube: youtube?.trim() || undefined,
    team_info: team_info ? sanitizeText(team_info.trim()) : undefined,
    token_utility: sanitizeText(token_utility.trim()),
    roadmap: roadmap ? sanitizeText(roadmap.trim()) : undefined,
  });

  res.status(201).json({ id: result.id, status: 'pending' });
});

router.get('/my-applications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const apps = await getApplicationsByUser(req.sessionUser!.id);
  res.json({ applications: apps });
});

router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.sessionUser!;
  const verified = await isVerifiedCreator(user.wallet_address);
  const pending = await hasPendingApplication(user.id);
  const application = verified ? await getApprovedApplicationByWallet(user.wallet_address) : null;

  res.json({
    is_verified: verified,
    has_pending: pending,
    application: application ? {
      id: application.id,
      project_name: application.project_name,
      category: application.category,
      approved_at: application.reviewed_at,
    } : null,
  });
});

router.get('/check/:address', async (req, res) => {
  const addr = req.params.address;
  if (!isValidAddress(addr)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  const verified = await isVerifiedCreator(addr);
  const app = verified ? await getApprovedApplicationByWallet(addr) : null;
  res.json({
    is_verified: verified,
    project_name: app?.project_name || null,
    category: app?.category || null,
  });
});

router.get('/categories', (_req, res) => {
  res.json({ categories: VALID_CATEGORIES });
});

export default router;
