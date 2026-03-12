import { Router, type Response } from 'express';
import { createPublicClient, http, type Address } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { param, isValidAddress } from '../middleware/validation.js';
import {
  createPresaleEvent, getPresaleEvents, getPresaleByLaunchId,
  getFollowerAddresses, createBulkNotifications,
} from '../database.js';

// ============ On-chain creator verification ============

const RPC_URL = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const MANAGER_ADDRESS = (process.env.CRE8_MANAGER_ADDRESS || '0x4e972F92461AE6bc080411723C856996Dbe1591E') as Address;

const verifyClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC_URL) });

const TokenParamsABI = [{
  name: 'tokenParams', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'tokenId', type: 'uint256' }],
  outputs: [
    { name: 'tokenAddress', type: 'address' },
    { name: 'creator', type: 'address' },
    { name: 'createdAt', type: 'uint256' },
    { name: 'graduated', type: 'bool' },
  ],
}] as const;

async function verifyOnChainCreatorByTokenId(tokenId: number, walletAddress: string): Promise<boolean> {
  try {
    const params = await verifyClient.readContract({
      address: MANAGER_ADDRESS,
      abi: TokenParamsABI,
      functionName: 'tokenParams',
      args: [BigInt(tokenId)],
    }) as any;
    const onChainCreator = (params[1] || params.creator) as string;
    return onChainCreator.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}

const router = Router();

// ============ POST /api/presales ============
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { launch_id, token_name, token_symbol, hard_cap, soft_cap, max_per_wallet, duration_seconds, vault_address } = req.body;

    if (!launch_id || !token_name || !token_symbol || !hard_cap || !max_per_wallet || !duration_seconds) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const parsedLaunchId = Number(launch_id);
    const parsedHardCap = Number(hard_cap);
    const parsedSoftCap = Number(soft_cap || 0);
    const parsedMaxPerWallet = Number(max_per_wallet);
    const parsedDuration = Number(duration_seconds);

    if (!Number.isFinite(parsedLaunchId) || parsedLaunchId < 0 ||
        !Number.isFinite(parsedHardCap) || parsedHardCap <= 0 ||
        !Number.isFinite(parsedSoftCap) || parsedSoftCap < 0 ||
        !Number.isFinite(parsedMaxPerWallet) || parsedMaxPerWallet <= 0 ||
        !Number.isInteger(parsedDuration) || parsedDuration <= 0) {
      res.status(400).json({ error: 'Invalid numeric field values' });
      return;
    }
    if (typeof token_name !== 'string' || token_name.length > 100 ||
        typeof token_symbol !== 'string' || token_symbol.length > 20) {
      res.status(400).json({ error: 'Invalid token name or symbol' });
      return;
    }

    if (vault_address && !isValidAddress(vault_address)) {
      res.status(400).json({ error: 'Invalid vault address' });
      return;
    }

    // Verify caller is the actual on-chain creator of this launch — prevents spoofing
    const isCreator = await verifyOnChainCreatorByTokenId(parsedLaunchId, req.sessionUser!.wallet_address);
    if (!isCreator) {
      res.status(403).json({ error: 'You are not the on-chain creator of this token' });
      return;
    }

    const result = await createPresaleEvent({
      launch_id: parsedLaunchId,
      creator_address: req.sessionUser!.wallet_address,
      token_name,
      token_symbol,
      hard_cap: parsedHardCap,
      soft_cap: parsedSoftCap,
      max_per_wallet: parsedMaxPerWallet,
      duration_seconds: parsedDuration,
      vault_address,
    });

    res.json({ id: result.id });
  } catch (err: any) {
    console.error('Failed to create presale event:', err);
    res.status(500).json({ error: 'Failed to create presale event' });
  }
});

// ============ GET /api/presales ============
router.get('/', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 20, 50));
    const events = await getPresaleEvents(status, limit);
    res.json({ presales: events });
  } catch (err: any) {
    console.error('Failed to get presale events:', err);
    res.status(500).json({ error: 'Failed to get presale events' });
  }
});

// ============ GET /api/presales/:launchId ============
router.get('/:launchId', async (req, res) => {
  try {
    const launchId = parseInt(param(req, 'launchId'));
    if (isNaN(launchId)) {
      res.status(400).json({ error: 'Invalid launch ID' });
      return;
    }
    const presale = await getPresaleByLaunchId(launchId);
    if (!presale) {
      res.status(404).json({ error: 'Presale not found' });
      return;
    }
    res.json(presale);
  } catch (err: any) {
    console.error('Failed to get presale:', err);
    res.status(500).json({ error: 'Failed to get presale' });
  }
});

// ============ POST /api/presales/:launchId/announce ============
router.post('/:launchId/announce', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const launchId = parseInt(param(req, 'launchId'));
    if (isNaN(launchId)) {
      res.status(400).json({ error: 'Invalid launch ID' });
      return;
    }

    const presale = await getPresaleByLaunchId(launchId);
    if (!presale) {
      res.status(404).json({ error: 'Presale not found' });
      return;
    }

    // Only the creator can announce
    if (presale.creator_address !== req.sessionUser!.wallet_address.toLowerCase()) {
      res.status(403).json({ error: 'Only the creator can announce this presale' });
      return;
    }

    // Get all follower addresses for this creator
    const followers = await getFollowerAddresses(req.sessionUser!.wallet_address);
    if (followers.length === 0) {
      res.json({ notified: 0 });
      return;
    }

    // Create notifications for all followers
    const notifications = followers.map(addr => ({
      user_address: addr,
      type: 'presale_announced',
      title: `${presale.token_name} Presale is Live!`,
      body: `${req.sessionUser!.twitter_name || req.sessionUser!.twitter_handle} just launched a presale for $${presale.token_symbol}. Hard cap: ${presale.hard_cap} AVAX.`,
      token_symbol: presale.token_symbol,
      creator_name: req.sessionUser!.twitter_name || req.sessionUser!.twitter_handle,
    }));

    await createBulkNotifications(notifications);

    res.json({ notified: followers.length });
  } catch (err: any) {
    console.error('Failed to announce presale:', err);
    res.status(500).json({ error: 'Failed to announce presale' });
  }
});

export default router;
