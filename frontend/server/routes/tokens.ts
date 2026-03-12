import { Router, type Request, type Response } from 'express';
import { createPublicClient, http, type Address } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { registerTokenCreator, getTokenCreator, getTokensByCreator } from '../database.js';
import { isValidAddress, param } from '../middleware/validation.js';

const router = Router();

// ============ On-chain creator verification ============

const RPC_URL = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const MANAGER_ADDRESS = (process.env.CRE8_MANAGER_ADDRESS || '0x4e972F92461AE6bc080411723C856996Dbe1591E') as Address;

const verifyClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC_URL) });

const TokenParamsABI = [
  {
    name: 'getTokenByAddress', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenAddr', type: 'address' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'tokenParams', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'tokenAddress', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'graduated', type: 'bool' },
    ],
  },
] as const;

/** Verify that walletAddress is the on-chain creator of tokenAddress */
export async function verifyOnChainCreator(tokenAddress: string, walletAddress: string): Promise<boolean> {
  try {
    const tokenId = await verifyClient.readContract({
      address: MANAGER_ADDRESS,
      abi: TokenParamsABI,
      functionName: 'getTokenByAddress',
      args: [tokenAddress as Address],
    });

    const params = await verifyClient.readContract({
      address: MANAGER_ADDRESS,
      abi: TokenParamsABI,
      functionName: 'tokenParams',
      args: [tokenId],
    }) as any;

    const onChainCreator = (params[1] || params.creator) as string;
    return onChainCreator.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}

// POST /api/tokens/register — called by frontend after successful token creation
router.post('/register', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token_address, token_name, token_symbol, created_block, description, twitter, telegram, website } = req.body;

    if (!token_address || !isValidAddress(token_address)) {
      res.status(400).json({ error: 'Invalid token_address' });
      return;
    }
    if (!token_name || typeof token_name !== 'string') {
      res.status(400).json({ error: 'token_name is required' });
      return;
    }
    if (!token_symbol || typeof token_symbol !== 'string') {
      res.status(400).json({ error: 'token_symbol is required' });
      return;
    }

    // Verify caller is the actual on-chain creator — prevents spoofing
    const isCreator = await verifyOnChainCreator(token_address, req.sessionUser!.wallet_address);
    if (!isCreator) {
      res.status(403).json({ error: 'You are not the on-chain creator of this token' });
      return;
    }

    await registerTokenCreator({
      token_address,
      creator_address: req.sessionUser!.wallet_address,
      token_name,
      token_symbol,
      created_block: created_block ? Number(created_block) : undefined,
      description: typeof description === 'string' ? description.slice(0, 500) : '',
      twitter: typeof twitter === 'string' ? twitter.slice(0, 100) : '',
      telegram: typeof telegram === 'string' ? telegram.slice(0, 100) : '',
      website: typeof website === 'string' ? website.slice(0, 200) : '',
    });

    res.status(201).json({ ok: true });
  } catch (err: any) {
    console.error('Failed to register token creator:', err);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// GET /api/tokens/:tokenAddress/creator — look up who created a token
router.get('/:tokenAddress/creator', async (req: Request, res: Response) => {
  const tokenAddress = param(req, 'tokenAddress');
  if (!isValidAddress(tokenAddress)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  const creator = await getTokenCreator(tokenAddress);
  if (!creator) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(creator);
});

// GET /api/tokens/by-creator/:creatorAddress — list tokens by a creator
router.get('/by-creator/:creatorAddress', async (req: Request, res: Response) => {
  const creatorAddress = param(req, 'creatorAddress');
  if (!isValidAddress(creatorAddress)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  const tokens = await getTokensByCreator(creatorAddress);
  res.json({ tokens });
});

export default router;
