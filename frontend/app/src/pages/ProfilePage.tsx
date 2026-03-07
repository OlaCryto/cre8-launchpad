import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Copy, Check, ExternalLink, X,
  Plus, Wallet, ChevronDown, Send, ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useAvaxBalance, useOnChainTokens } from '@/hooks/useContracts';
import { useSendAVAX, useSendToken } from '@/hooks/useTransactions';
import { CHAINS, ACTIVE_NETWORK } from '@/config/wagmi';
import { ERC20ABI } from '@/config/abis';
import { publicClient } from '@/config/client';
import { toast } from 'sonner';
import { formatUnits, parseUnits } from 'viem';
import { formatPrice } from '@/utils/format';

interface TokenHolding {
  address: string;
  name: string;
  symbol: string;
  balance: number;
  currentPrice: number;
}

function addressToColor(address: string): [string, string] {
  const hash = address.toLowerCase().replace('0x', '');
  const hue1 = parseInt(hash.slice(0, 6), 16) % 360;
  const hue2 = (hue1 + 40 + (parseInt(hash.slice(6, 12), 16) % 80)) % 360;
  return [`hsl(${hue1}, 65%, 55%)`, `hsl(${hue2}, 65%, 45%)`];
}

function AddressAvatar({ address, size = 40 }: { address: string; size?: number }) {
  const [c1, c2] = addressToColor(address);
  return (
    <div className="rounded-full shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
  );
}

function isValidAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function ProfilePage() {
  const { address: routeAddress } = useParams();
  const { user, isAuthenticated, signInWithX, isLoading } = useAuth();

  const profileAddress = routeAddress || user?.wallet?.address;
  const isOwnProfile = user ? profileAddress === user.wallet.address : false;

  const balance = useAvaxBalance(profileAddress);
  const explorer = CHAINS[ACTIVE_NETWORK].explorer;
  const { tokens: allTokens } = useOnChainTokens();

  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showSend, setShowSend] = useState(false);

  // Send state
  const [sendMode, setSendMode] = useState<'avax' | 'token'>('avax');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('');

  const { isLoading: sendingAvax, isPending: pendingAvax, execute: executeSendAVAX } = useSendAVAX();
  const { isLoading: sendingToken, isPending: pendingToken, execute: executeSendToken } = useSendToken();
  const isSending = sendingAvax || sendingToken;

  useEffect(() => {
    if (!profileAddress || allTokens.length === 0) { setHoldings([]); return; }
    let cancelled = false;
    (async () => {
      setHoldingsLoading(true);
      const balanceResults = await Promise.allSettled(
        allTokens.map(async (token) => {
          const raw = await publicClient.readContract({
            address: token.address as any,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [profileAddress as any],
          });
          return { token, balance: Number(formatUnits(raw as bigint, 18)) };
        })
      );
      if (cancelled) return;
      const results: TokenHolding[] = balanceResults
        .filter((r): r is PromiseFulfilledResult<{ token: typeof allTokens[0]; balance: number }> =>
          r.status === 'fulfilled' && r.value.balance > 0)
        .map(r => ({
          address: r.value.token.address,
          name: r.value.token.name,
          symbol: r.value.token.symbol,
          balance: r.value.balance,
          currentPrice: r.value.token.currentPrice,
        }));
      setHoldings(results);
      setHoldingsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profileAddress, allTokens]);

  const createdTokens = allTokens.filter(t => t.creator?.toLowerCase() === profileAddress?.toLowerCase());

  const truncAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const copyAddress = () => {
    if (profileAddress) {
      navigator.clipboard.writeText(profileAddress);
      setAddressCopied(true);
      toast.success('Address copied!');
      setTimeout(() => setAddressCopied(false), 2000);
    }
  };

  const handleSend = async () => {
    if (!sendTo.trim() || !isValidAddress(sendTo.trim())) {
      toast.error('Enter a valid wallet address');
      return;
    }
    const amount = parseFloat(sendAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    try {
      if (sendMode === 'avax') {
        if (amount > balance - 0.001) {
          toast.error('Insufficient AVAX (need gas)');
          return;
        }
        await executeSendAVAX({ to: sendTo.trim(), amount });
        toast.success(`Sent ${amount} AVAX`, { description: `To ${truncAddr(sendTo.trim())}` });
      } else {
        if (!selectedToken) {
          toast.error('Select a token to send');
          return;
        }
        const holding = holdings.find(h => h.address === selectedToken);
        if (!holding || amount > holding.balance) {
          toast.error('Insufficient token balance');
          return;
        }
        const amountWei = parseUnits(amount.toString(), 18);
        await executeSendToken({ tokenAddress: selectedToken, to: sendTo.trim(), amount: amountWei });
        toast.success(`Sent ${amount} ${holding.symbol}`, { description: `To ${truncAddr(sendTo.trim())}` });
      }
      setSendTo('');
      setSendAmount('');
      setShowSend(false);
    } catch (err: any) {
      toast.error('Transfer failed', { description: err?.shortMessage || err?.message });
    }
  };

  // Not signed in & no route address
  if (!routeAddress && (!isAuthenticated || !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-cre8-red/10 flex items-center justify-center mx-auto mb-5">
            <Wallet className="w-7 h-7 text-cre8-red" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Sign in to Cre8</h1>
          <p className="text-dim mb-6 text-sm">Sign in to view your portfolio and trade tokens.</p>
          <Button onClick={signInWithX} disabled={isLoading}
            className="w-full bg-white text-black hover:bg-white/90 rounded-xl font-medium py-5">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />Signing in...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Sign in with Google
              </span>
            )}
          </Button>
          <Link to="/" className="block mt-4 text-sm text-dim hover:text-white">Back to Home</Link>
        </div>
      </div>
    );
  }

  if (!profileAddress) return null;

  const displayName = isOwnProfile && user ? user.xName : truncAddr(profileAddress);
  const displayHandle = isOwnProfile && user ? user.xHandle : '';
  const displayAvatar = isOwnProfile && user ? user.xAvatar : '';
  const totalValue = holdings.reduce((sum, h) => sum + (h.balance * h.currentPrice), 0);

  return (
    <div className="min-h-screen">
      <div className="max-w-[680px] mx-auto px-4 py-5">

        {/* ── Header row ── */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 bg-cre8-surface">
            {displayAvatar ? (
              <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <AddressAvatar address={profileAddress} size={44} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">{displayName}</h1>
            {displayHandle && <p className="text-xs text-dim">{displayHandle}</p>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={copyAddress}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs text-dim hover:text-white font-mono transition-colors">
              {addressCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {truncAddr(profileAddress)}
            </button>
            <a href={`${explorer}/address/${profileAddress}`} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-dim hover:text-white transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {isOwnProfile && (
            <div className="surface px-3 py-2">
              <p className="font-mono text-sm font-bold text-white tabular-nums">{balance.toFixed(4)}</p>
              <p className="text-[10px] text-dim">AVAX</p>
            </div>
          )}
          <div className="surface px-3 py-2">
            <p className="font-mono text-sm font-bold text-white tabular-nums">{createdTokens.length}</p>
            <p className="text-[10px] text-dim">Created</p>
          </div>
          <div className="surface px-3 py-2">
            <p className="font-mono text-sm font-bold text-white tabular-nums">{holdings.length}</p>
            <p className="text-[10px] text-dim">Holding</p>
          </div>
          <div className="surface px-3 py-2">
            <p className="font-mono text-sm font-bold text-cre8-red tabular-nums">{totalValue > 0 ? totalValue.toFixed(2) : '0'}</p>
            <p className="text-[10px] text-dim">Value</p>
          </div>
        </div>

        {/* ── Own-profile actions ── */}
        {isOwnProfile && (
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => { setShowDeposit(!showDeposit); if (!showDeposit) setShowSend(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cre8-red/10 border border-cre8-red/20 text-cre8-red text-xs font-semibold hover:bg-cre8-red/20 transition-colors">
              <Wallet className="w-3.5 h-3.5" />Deposit
              <ChevronDown className={`w-3 h-3 transition-transform ${showDeposit ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={() => { setShowSend(!showSend); if (!showSend) setShowDeposit(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-dim text-xs font-semibold hover:text-white hover:bg-white/[0.06] transition-colors">
              <Send className="w-3.5 h-3.5" />Send
              <ChevronDown className={`w-3 h-3 transition-transform ${showSend ? 'rotate-180' : ''}`} />
            </button>
            <Link to="/create"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-dim text-xs font-semibold hover:text-white hover:bg-white/[0.06] transition-colors">
              <Plus className="w-3.5 h-3.5" />Create coin
            </Link>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/profile/${profileAddress}`); toast.success('Profile link copied!'); }}
              className="ml-auto px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-dim text-xs hover:text-white transition-colors">
              Share
            </button>
          </div>
        )}

        {/* Deposit panel (collapsible) */}
        {isOwnProfile && showDeposit && (
          <div className="surface p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white text-sm">Deposit AVAX</h3>
              <button onClick={() => setShowDeposit(false)} className="text-dim hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
            <p className="text-xs text-dim mb-2">Send AVAX on <span className="text-cre8-red">Avalanche Fuji C-Chain</span></p>
            <div className="flex items-center gap-2 p-2.5 bg-cre8-base rounded-lg mb-2">
              <code className="font-mono text-xs text-white flex-1 break-all">{profileAddress}</code>
              <button onClick={copyAddress} className="p-1 rounded hover:bg-white/[0.06] transition-colors shrink-0">
                {addressCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-dim" />}
              </button>
            </div>
            <a href="https://faucet.avax.network/" target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-cre8-red hover:bg-cre8-red/90 text-white rounded-lg text-xs w-full">
                Get Test AVAX <ExternalLink className="w-3 h-3 ml-1.5" />
              </Button>
            </a>
          </div>
        )}

        {/* Send panel (collapsible) */}
        {isOwnProfile && showSend && (
          <div className="surface p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm">Send</h3>
              <button onClick={() => setShowSend(false)} className="text-dim hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>

            {/* AVAX / Token toggle */}
            <div className="flex gap-1 p-0.5 bg-cre8-base rounded-lg mb-3">
              <button onClick={() => setSendMode('avax')}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${sendMode === 'avax' ? 'bg-white/[0.08] text-white' : 'text-dim hover:text-white'}`}>
                AVAX
              </button>
              <button onClick={() => setSendMode('token')}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${sendMode === 'token' ? 'bg-white/[0.08] text-white' : 'text-dim hover:text-white'}`}>
                Token
              </button>
            </div>

            {/* Token selector (only in token mode) */}
            {sendMode === 'token' && (
              <div className="mb-3">
                <label className="text-[11px] text-dim font-medium mb-1 block">Select token</label>
                {holdings.length === 0 ? (
                  <p className="text-xs text-dim py-2">No tokens to send</p>
                ) : (
                  <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)}
                    className="w-full bg-cre8-base border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-cre8-red/40">
                    <option value="">Choose a token...</option>
                    {holdings.map(h => (
                      <option key={h.address} value={h.address}>
                        {h.symbol} — {h.balance < 1000 ? h.balance.toFixed(2) : h.balance < 1e6 ? `${(h.balance / 1e3).toFixed(1)}K` : `${(h.balance / 1e6).toFixed(2)}M`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Recipient address */}
            <div className="mb-3">
              <label className="text-[11px] text-dim font-medium mb-1 block">Recipient address</label>
              <Input value={sendTo} onChange={(e) => setSendTo(e.target.value)}
                placeholder="0x..." className="bg-cre8-base border-white/[0.06] text-white font-mono text-xs" />
            </div>

            {/* Amount */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-dim font-medium">Amount</label>
                <button onClick={() => {
                  if (sendMode === 'avax') {
                    setSendAmount(Math.max(0, balance - 0.01).toFixed(4));
                  } else {
                    const h = holdings.find(t => t.address === selectedToken);
                    if (h) setSendAmount(h.balance.toString());
                  }
                }} className="text-[10px] text-cre8-red hover:text-cre8-red/80 font-semibold">
                  MAX
                </button>
              </div>
              <div className="relative">
                <Input value={sendAmount} onChange={(e) => setSendAmount(e.target.value)}
                  type="number" step="any" min="0" placeholder="0.0"
                  className="bg-cre8-base border-white/[0.06] text-white font-mono text-sm pr-16" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dim font-semibold">
                  {sendMode === 'avax' ? 'AVAX' : (holdings.find(h => h.address === selectedToken)?.symbol || 'TOKEN')}
                </span>
              </div>
              {sendMode === 'avax' && (
                <p className="text-[10px] text-dim mt-1">Available: {balance.toFixed(4)} AVAX</p>
              )}
              {sendMode === 'token' && selectedToken && (
                <p className="text-[10px] text-dim mt-1">
                  Available: {holdings.find(h => h.address === selectedToken)?.balance.toFixed(2) || '0'} {holdings.find(h => h.address === selectedToken)?.symbol}
                </p>
              )}
            </div>

            {/* Send button */}
            <Button onClick={handleSend} disabled={isSending || !sendTo || !sendAmount}
              className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white rounded-lg text-xs font-semibold">
              {isSending ? (
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  {pendingAvax || pendingToken ? 'Confirming...' : 'Sending...'}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Send {sendMode === 'avax' ? 'AVAX' : 'Token'}
                </span>
              )}
            </Button>
          </div>
        )}

        {/* ── Tabs ── */}
        <Tabs defaultValue="holdings" className="w-full">
          <div className="border-b border-white/[0.06] mb-3">
            <TabsList className="bg-transparent gap-4 p-0 h-auto">
              <TabsTrigger value="holdings"
                className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-cre8-red text-dim rounded-none px-0 pb-2 pt-0 text-sm font-semibold bg-transparent">
                Coins held
              </TabsTrigger>
              <TabsTrigger value="created"
                className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-cre8-red text-dim rounded-none px-0 pb-2 pt-0 text-sm font-semibold bg-transparent">
                Coins created
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="holdings" className="m-0 space-y-1">
            {holdingsLoading && (
              <div className="text-center py-10">
                <div className="w-5 h-5 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-dim">Loading holdings...</p>
              </div>
            )}
            {!holdingsLoading && holdings.length === 0 && (
              <div className="text-center py-10 text-dim">
                <p className="text-sm mb-3">{isOwnProfile ? 'No token holdings yet' : 'No tokens held'}</p>
                {isOwnProfile && (
                  <Link to="/"><Button size="sm" className="bg-cre8-red hover:bg-cre8-red/90 text-xs">Explore tokens</Button></Link>
                )}
              </div>
            )}
            {!holdingsLoading && holdings.length > 0 && (
              <>
                <div className="grid grid-cols-[1fr_0.7fr_0.7fr] gap-2 px-3 py-1.5 text-[10px] text-dim font-medium uppercase tracking-wider">
                  <span>Token</span>
                  <span className="text-right">Balance</span>
                  <span className="text-right">Value</span>
                </div>
                {holdings.map((h) => (
                  <Link key={h.address} to={`/token/${h.address}`}
                    className="grid grid-cols-[1fr_0.7fr_0.7fr] gap-2 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors items-center">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cre8-red/15 to-violet-500/15 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-white">{h.symbol.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate">{h.name}</p>
                        <p className="text-[11px] text-dim">${h.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white font-mono tabular-nums">
                        {h.balance < 1000 ? h.balance.toFixed(2) : h.balance < 1e6 ? `${(h.balance / 1e3).toFixed(1)}K` : `${(h.balance / 1e6).toFixed(2)}M`}
                      </p>
                      <p className="text-[11px] text-dim font-mono tabular-nums">{formatPrice(h.currentPrice)}</p>
                    </div>
                    <p className="text-sm text-white font-mono tabular-nums text-right">
                      {(h.balance * h.currentPrice).toFixed(4)}
                      <span className="text-dim text-[10px] ml-0.5">AVAX</span>
                    </p>
                  </Link>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="created" className="m-0 space-y-1">
            {createdTokens.length === 0 ? (
              <div className="text-center py-10 text-dim">
                <p className="text-sm mb-3">{isOwnProfile ? 'No tokens created yet' : 'No tokens created'}</p>
                {isOwnProfile && (
                  <Link to="/create"><Button size="sm" className="bg-cre8-red hover:bg-cre8-red/90 text-xs">Create your first token</Button></Link>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_0.7fr_0.7fr] gap-2 px-3 py-1.5 text-[10px] text-dim font-medium uppercase tracking-wider">
                  <span>Token</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Status</span>
                </div>
                {createdTokens.map((token) => (
                  <Link key={token.address} to={`/token/${token.address}`}
                    className="grid grid-cols-[1fr_0.7fr_0.7fr] gap-2 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors items-center">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cre8-red/15 to-violet-500/15 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-white">{token.symbol.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate">{token.name}</p>
                        <p className="text-[11px] text-dim">${token.symbol}</p>
                      </div>
                    </div>
                    <p className="text-sm text-white font-mono tabular-nums text-right">{formatPrice(token.currentPrice)}</p>
                    <div className="text-right">
                      {token.isGraduated ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">Graduated</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-dim font-medium">Trading</span>
                      )}
                    </div>
                  </Link>
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
