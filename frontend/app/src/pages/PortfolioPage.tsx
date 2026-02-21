import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, Copy, X, Check,
  DollarSign, QrCode, Send, Share2,
  GraduationCap, Plus, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useAvaxBalance, useOnChainTokens } from '@/hooks/useContracts';
import { CHAINS, ACTIVE_NETWORK } from '@/config/wagmi';
import { ERC20ABI } from '@/config/abis';
import { publicClient } from '@/config/client';
import { toast } from 'sonner';
import { formatUnits } from 'viem';
import { formatPrice } from '@/utils/format';

interface TokenHolding {
  address: string;
  name: string;
  symbol: string;
  balance: number;
  currentPrice: number;
}

export function PortfolioPage() {
  const { user, isAuthenticated, signInWithX, isLoading } = useAuth();
  const [showTutorial, setShowTutorial] = useState(true);
  const [bio, setBio] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  const balance = useAvaxBalance(user?.wallet?.address);
  const explorer = CHAINS[ACTIVE_NETWORK].explorer;
  const { tokens: allTokens } = useOnChainTokens();
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);

  useEffect(() => {
    if (!user?.wallet?.address || allTokens.length === 0) {
      setHoldings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setHoldingsLoading(true);
      const results: TokenHolding[] = [];
      for (const token of allTokens) {
        try {
          const raw = await publicClient.readContract({
            address: token.address as any,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [user.wallet.address as any],
          });
          const bal = Number(formatUnits(raw as bigint, 18));
          if (bal > 0) {
            results.push({
              address: token.address,
              name: token.name,
              symbol: token.symbol,
              balance: bal,
              currentPrice: token.currentPrice,
            });
          }
        } catch { /* skip */ }
      }
      if (!cancelled) {
        setHoldings(results);
        setHoldingsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.wallet?.address, allTokens]);

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const copyAddress = () => {
    if (user?.wallet?.address) {
      navigator.clipboard.writeText(user.wallet.address);
      setAddressCopied(true);
      toast.success('Wallet address copied!');
      setTimeout(() => setAddressCopied(false), 2000);
    }
  };

  // Not signed in
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-cre8-red/10 flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-8 h-8 text-cre8-red" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Sign in to Cre8</h1>
          <p className="text-dim mb-8 text-sm">
            Connect with X to access your portfolio, trade tokens, and launch projects.
          </p>
          <Button
            onClick={signInWithX}
            disabled={isLoading}
            className="w-full bg-white text-black hover:bg-white/90 rounded-xl font-medium py-5"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Sign in with X
              </span>
            )}
          </Button>
          <Link to="/" className="block mt-4 text-sm text-dim hover:text-white">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-4">
            <div className="w-18 h-18 rounded-full bg-gradient-to-br from-cre8-red to-orange-500 p-0.5">
              <div className="w-full h-full rounded-full bg-cre8-surface flex items-center justify-center overflow-hidden">
                <img src={user.xAvatar} alt={user.xName} className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          <h2 className="text-lg font-bold text-white mb-0.5">{user.xName}</h2>
          <p className="text-sm text-dim mb-1">{user.xHandle}</p>

          <div className="flex items-center justify-center gap-2">
            <span className="text-white font-mono text-sm">{truncateAddress(user.wallet.address)}</span>
            <button onClick={copyAddress} className="text-dim hover:text-white">
              {addressCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a href={`${explorer}/address/${user.wallet.address}`} target="_blank" rel="noopener noreferrer" className="text-dim hover:text-white">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Balance */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-1 tabular-nums">{Number(balance.toFixed(4))} AVAX</h1>
          <p className="text-dim text-sm">Avalanche Fuji Testnet</p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-8">
          {[
            { icon: DollarSign, label: 'Deposit', color: 'bg-cre8-red', onClick: () => setShowReceiveModal(true) },
            { icon: QrCode, label: 'Receive', color: 'bg-white/[0.06]', onClick: () => setShowReceiveModal(true) },
            { icon: Send, label: 'Send', color: 'bg-white/[0.06]', onClick: () => toast.info('Send is not available on testnet.') },
            { icon: Share2, label: 'Share', color: 'bg-white/[0.06]', onClick: () => { navigator.clipboard.writeText(`${window.location.origin}/profile/${user.wallet.address}`); toast.success('Profile link copied!'); } },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.label} onClick={action.onClick} className="flex flex-col items-center gap-1.5">
                <div className={`w-12 h-12 rounded-xl ${action.color} flex items-center justify-center hover:opacity-80 transition-opacity`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs text-dim">{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Receive Modal */}
        {showReceiveModal && (
          <div className="surface p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Deposit AVAX</h3>
              <button onClick={() => setShowReceiveModal(false)} className="text-dim hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-dim mb-3">
              Send AVAX to your wallet on <span className="text-cre8-red">Avalanche Fuji C-Chain</span> testnet.
            </p>
            <div className="flex items-center gap-2 p-3 bg-cre8-base rounded-lg mb-3">
              <code className="font-mono text-sm text-white flex-1 break-all">{user.wallet.address}</code>
              <button onClick={copyAddress} className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors shrink-0">
                {addressCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-dim" />}
              </button>
            </div>
            <div className="flex gap-2">
              <a href="https://faucet.avax.network/" target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white rounded-lg py-4">
                  Get Test AVAX <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </a>
              <a href={`${explorer}/address/${user.wallet.address}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="bg-white/[0.04] border-white/[0.08] text-white hover:bg-white/[0.06] rounded-lg py-4 px-4">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* Tutorial */}
        {showTutorial && (
          <div className="relative surface p-4 mb-5">
            <button onClick={() => setShowTutorial(false)} className="absolute top-3 right-3 text-dim hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-cre8-red/10 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-cre8-red" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm mb-0.5">New to Cre8?</h3>
                <p className="text-sm text-dim">Learn how Cre8 works in 2 mins</p>
              </div>
            </div>
            <div className="flex gap-1 mt-3">
              <div className="h-1 flex-1 rounded-full bg-cre8-red" />
              <div className="h-1 flex-1 rounded-full bg-white/[0.06]" />
              <div className="h-1 flex-1 rounded-full bg-white/[0.06]" />
            </div>
          </div>
        )}

        {/* Creator Rewards */}
        <div className="mb-5">
          <div className="bg-gradient-to-r from-cre8-red/15 to-orange-500/15 border border-cre8-red/20 rounded-xl p-4">
            <h4 className="font-semibold text-white text-sm mb-1">Create a coin and earn</h4>
            <p className="text-sm text-dim mb-3">
              Launch a coin in seconds and start earning rewards.
            </p>
            <Link to="/create">
              <Button size="sm" className="bg-cre8-red hover:bg-cre8-red/90 text-white rounded-lg text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />Create a coin
              </Button>
            </Link>
          </div>
        </div>

        {/* Bio */}
        <div className="mb-5">
          {isEditingBio ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Enter your bio..."
                className="flex-1 px-3 py-2 bg-cre8-surface border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-cre8-red/40"
              />
              <Button size="sm" onClick={() => setIsEditingBio(false)} className="bg-cre8-red hover:bg-cre8-red/90 text-sm">Save</Button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingBio(true)}
              className="w-full text-left px-3 py-2 surface text-dim text-sm hover:border-white/[0.1] transition-colors"
            >
              {bio || 'Tap to update your bio...'}
            </button>
          )}
        </div>

        {/* Token Tabs */}
        <Tabs defaultValue="holdings" className="w-full">
          <TabsList className="w-full grid grid-cols-4 bg-cre8-surface border border-white/[0.06] rounded-lg p-1 mb-4">
            <TabsTrigger value="holdings" className="text-xs data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-dim rounded-md">Holdings</TabsTrigger>
            <TabsTrigger value="created" className="text-xs data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-dim rounded-md">Created</TabsTrigger>
            <TabsTrigger value="vesting" className="text-xs data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-dim rounded-md">Vesting</TabsTrigger>
            <TabsTrigger value="presales" className="text-xs data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-dim rounded-md">Presales</TabsTrigger>
          </TabsList>

          <TabsContent value="holdings" className="space-y-2">
            {holdingsLoading && (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-dim">Loading holdings...</p>
              </div>
            )}
            {!holdingsLoading && holdings.length === 0 && (
              <div className="text-center py-8 text-dim">
                <p className="text-sm">No token holdings yet</p>
                <Link to="/">
                  <Button className="mt-4 bg-cre8-red hover:bg-cre8-red/90 text-sm">Explore tokens</Button>
                </Link>
              </div>
            )}
            {!holdingsLoading && holdings.map((holding) => (
              <Link key={holding.address} to={`/token/${holding.address}`} className="flex items-center gap-3 p-3 surface-interactive">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cre8-red/15 to-violet-500/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">{holding.symbol.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm truncate">{holding.name}</span>
                    <span className="font-mono text-white text-sm tabular-nums">
                      {holding.balance < 1000
                        ? holding.balance.toFixed(2)
                        : holding.balance < 1e6
                          ? `${(holding.balance / 1e3).toFixed(1)}K`
                          : `${(holding.balance / 1e6).toFixed(2)}M`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dim">${holding.symbol}</span>
                    <span className="text-dim font-mono tabular-nums">{formatPrice(holding.currentPrice)} AVAX</span>
                  </div>
                </div>
              </Link>
            ))}
          </TabsContent>

          <TabsContent value="created">
            <div className="text-center py-8 text-dim">
              <p className="text-sm">No tokens created yet</p>
              <Link to="/create">
                <Button className="mt-4 bg-cre8-red hover:bg-cre8-red/90 text-sm">Create your first token</Button>
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="vesting">
            <div className="text-center py-8 text-dim">
              <p className="text-sm">No vesting tokens</p>
            </div>
          </TabsContent>

          <TabsContent value="presales">
            <div className="text-center py-8 text-dim">
              <p className="text-sm">No presale participations</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
