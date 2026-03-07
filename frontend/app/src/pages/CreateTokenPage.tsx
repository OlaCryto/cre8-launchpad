import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Zap,
  Twitter, Globe, MessageCircle, LinkIcon,
  ChevronDown, ChevronUp, ImageIcon, Info, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { FEES, TOKEN_CONSTANTS } from '@/config/wagmi';
import { useCreateTokenAndBuy } from '@/hooks/useTransactions';
import { useAvaxBalance } from '@/hooks/useContracts';
import { uploadTokenImage } from '@/utils/uploadImage';
import { registerTokenCreator } from '@/utils/registerToken';

export function CreateTokenPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, signInWithX, user } = useAuth();
  const { isLoading: txLoading, isPending, execute: createToken } = useCreateTokenAndBuy();
  const avaxBalance = useAvaxBalance(user?.wallet?.address);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [initialBuy, setInitialBuy] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    ticker: '',
    description: '',
    twitter: '',
    telegram: '',
    website: '',
  });

  const update = (fields: Partial<typeof formData>) => setFormData(prev => ({ ...prev, ...fields }));

  const tokensPerAvax = Number(TOKEN_CONSTANTS.CURVE_SUPPLY) / Number(TOKEN_CONSTANTS.GRADUATION_THRESHOLD);
  const estimatedTokens = initialBuy * tokensPerAvax;
  const supplyPercent = Number(TOKEN_CONSTANTS.TOTAL_SUPPLY) > 0
    ? (estimatedTokens / Number(TOKEN_CONSTANTS.TOTAL_SUPPLY)) * 100
    : 0;
  const maxBuy = Math.max(0, Math.floor((avaxBalance - FEES.CREATION - 0.01) * 100) / 100);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleEasySubmit = async () => {
    if (!formData.name.trim()) { toast.error('Coin name is required'); return; }
    if (!formData.ticker.trim()) { toast.error('Ticker is required'); return; }

    try {
      const maxBuyPercent = 20;
      const buyPercent = maxBuy > 0 ? Math.min((initialBuy / maxBuy) * maxBuyPercent, maxBuyPercent) : 0;
      const creatorBuyBps = Math.round(buyPercent * 100);

      const receipt = await createToken({
        name: formData.name,
        symbol: formData.ticker.replace('$', ''),
        description: formData.description,
        imageURI: imagePreview || '',
        twitter: formData.twitter,
        telegram: formData.telegram,
        website: formData.website,
        creatorBuyBps,
        creatorBuyAvax: initialBuy,
      });

      if (receipt.tokenAddress) {
        // Upload image (fire-and-forget)
        if (imagePreview?.startsWith('data:')) {
          uploadTokenImage(receipt.tokenAddress, imagePreview);
        }
        // Register token creator + metadata (fire-and-forget)
        registerTokenCreator(
          receipt.tokenAddress,
          formData.name,
          formData.ticker.replace('$', ''),
          receipt.blockNumber,
          {
            description: formData.description,
            twitter: formData.twitter,
            telegram: formData.telegram,
            website: formData.website,
          },
        );
      }

      toast.success('Token created!', { description: `TX: ${receipt.transactionHash.slice(0, 14)}...` });
      navigate(receipt.tokenAddress ? `/token/${receipt.tokenAddress}` : '/');
    } catch (err: any) {
      toast.error('Token creation failed', { description: err?.shortMessage || err?.message });
    }
  };

  const handleSubmit = handleEasySubmit;

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="text-dim hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Create new coin</h1>
            <p className="text-xs text-dim mt-0.5">Instant launch on the bonding curve</p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
          {/* ── Left: Form ── */}
          <div className="space-y-6">
            {/* Section header */}
            <div>
              <h2 className="text-base font-bold text-white mb-1">Coin details</h2>
              <p className="text-sm text-dim">Choose carefully, these can't be changed once the coin is created</p>
            </div>

            {/* Name + Ticker row */}
            <div className="surface p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4">
                <div>
                  <label className="block text-sm text-dim mb-1.5">Coin name</label>
                  <Input
                    placeholder="Name your coin"
                    value={formData.name}
                    maxLength={32}
                    onChange={(e) => update({ name: e.target.value })}
                    className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg h-11 focus-visible:ring-1 focus-visible:ring-white/20"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dim mb-1.5">Ticker</label>
                  <Input
                    placeholder="e.g. DOGE"
                    value={formData.ticker}
                    maxLength={10}
                    onChange={(e) => update({ ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                    className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg h-11 font-mono focus-visible:ring-1 focus-visible:ring-white/20"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-dim mb-1.5">Description <span className="text-dim/40">(Optional)</span></label>
                <div className="relative">
                  <Textarea
                    placeholder="Write a short description"
                    value={formData.description}
                    maxLength={500}
                    onChange={(e) => update({ description: e.target.value })}
                    className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg min-h-[100px] resize-none focus-visible:ring-1 focus-visible:ring-white/20"
                  />
                  <span className="absolute right-3 bottom-3 text-dim/30 text-xs font-mono tabular-nums">{500 - formData.description.length}</span>
                </div>
              </div>

              {/* Social Links (collapsible) */}
              <div>
                <button type="button" onClick={() => setSocialsOpen(!socialsOpen)}
                  className="flex items-center gap-2 text-sm text-dim hover:text-white transition-colors">
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Add social links</span>
                  <span className="text-dim/40">(Optional)</span>
                  {socialsOpen ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                </button>
                {socialsOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Twitter className="w-4 h-4 text-dim shrink-0" />
                      <Input placeholder="@handle" value={formData.twitter} onChange={(e) => update({ twitter: e.target.value })}
                        className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg h-10 text-sm focus-visible:ring-1 focus-visible:ring-white/20" />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-dim shrink-0" />
                      <Input placeholder="t.me/yourgroup" value={formData.telegram} onChange={(e) => update({ telegram: e.target.value })}
                        className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg h-10 text-sm focus-visible:ring-1 focus-visible:ring-white/20" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-dim shrink-0" />
                      <Input placeholder="https://yourtoken.com" value={formData.website} onChange={(e) => update({ website: e.target.value })}
                        className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg h-10 text-sm focus-visible:ring-1 focus-visible:ring-white/20" />
                    </div>
                  </div>
                )}
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm text-dim mb-1.5">Image <span className="text-dim/40">(Optional)</span></label>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="group w-full h-32 rounded-lg border-2 border-dashed border-white/[0.08] hover:border-cre8-red/40 transition-colors flex flex-col items-center justify-center gap-2 overflow-hidden">
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleImageUpload} className="hidden" />
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImageIcon className="w-6 h-6 text-dim/40 group-hover:text-dim transition-colors" />
                      <span className="text-xs text-dim/40 group-hover:text-dim transition-colors">Click to upload (PNG, JPG, max 5MB)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ── Initial Purchase ── */}
            {isAuthenticated && (
              <div className="surface p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cre8-red" />
                  <h3 className="text-sm font-bold text-white">Initial Purchase</h3>
                  <span className="text-[10px] text-dim/50 ml-1">(Optional)</span>
                  <div className="group relative ml-auto">
                    <Info className="w-3.5 h-3.5 text-dim cursor-help" />
                    <div className="absolute bottom-full right-0 mb-2 w-52 p-2.5 bg-cre8-elevated border border-white/[0.1] rounded-lg text-xs text-dim opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
                      Buy your own token at launch. Goes through the bonding curve like everyone else.
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-dim">Available balance</span>
                  <span className="text-white font-mono font-semibold tabular-nums">{avaxBalance.toFixed(4)} AVAX</span>
                </div>

                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-cre8-red flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">A</span>
                  </div>
                  <Input type="number" min={0} max={maxBuy} step={0.1}
                    value={initialBuy || ''} placeholder="0"
                    onChange={(e) => setInitialBuy(Math.min(parseFloat(e.target.value) || 0, maxBuy))}
                    className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg h-11 pl-10 font-mono focus-visible:ring-1 focus-visible:ring-white/20" />
                </div>

                <input type="range" min={0} max={maxBuy} step={0.01} value={initialBuy}
                  onChange={(e) => setInitialBuy(parseFloat(e.target.value))}
                  className="w-full accent-cre8-red h-1.5 rounded-full appearance-none bg-white/[0.06] cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cre8-red [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-cre8-base [&::-webkit-slider-thumb]:shadow-md" />

                {initialBuy > 0 && (
                  <div className="bg-cre8-base rounded-lg px-3 py-2.5 text-center">
                    <p className="text-sm text-white">
                      You'll receive <span className="text-cre8-red font-bold font-mono">{estimatedTokens > 0 ? estimatedTokens.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}</span> ${formData.ticker || 'TOKEN'}
                    </p>
                    <p className="text-[11px] text-dim mt-0.5">({supplyPercent.toFixed(2)}% of total supply)</p>
                  </div>
                )}
              </div>
            )}

            {/* Info banner */}
            <div className="flex items-start gap-2.5 px-4 py-3 bg-cre8-surface border border-white/[0.04] rounded-xl">
              <AlertCircle className="w-4 h-4 text-dim shrink-0 mt-0.5" />
              <p className="text-xs text-dim leading-relaxed">
                Coin data (social links, image, etc) can only be added now, and can't be changed or edited after creation. Creation fee: <span className="text-white font-mono">{FEES.CREATION} AVAX</span>
              </p>
            </div>

            {/* Submit / Auth */}
            {isAuthenticated ? (
              <Button onClick={handleSubmit} disabled={txLoading || !formData.name.trim() || !formData.ticker.trim()}
                className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-bold rounded-xl py-5 text-base disabled:opacity-40">
                {txLoading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />{isPending ? 'Confirming...' : 'Creating...'}</>
                ) : (initialBuy > 0 ? 'Create and Buy' : 'Create coin')
                }
              </Button>
            ) : (
              <Button onClick={signInWithX} disabled={authLoading}
                className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-bold rounded-xl py-5 text-base">
                {authLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                ) : (
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                )}
                {authLoading ? 'Signing in...' : 'Login to create coin'}
              </Button>
            )}
          </div>

          {/* ── Right: Preview ── */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <h2 className="text-base font-bold text-white mb-3">Preview</h2>
              <div className="surface overflow-hidden">
                <div className="aspect-[4/3] bg-gradient-to-br from-white/[0.02] to-transparent relative overflow-hidden flex items-center justify-center">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <p className="text-dim/30 text-sm text-center px-6">A preview of how the coin will look like</p>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {user ? (
                      <img src={user.xAvatar} alt="" className="w-[18px] h-[18px] rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full bg-dim/20 shrink-0" />
                    )}
                    <span className="text-[11px] text-dim truncate">{user?.xName || 'Creator'}</span>
                    <span className="text-dim/30 text-[10px] ml-auto">just now</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-white text-sm truncate">{formData.name || 'Coin name'}</h3>
                    <span className="text-xs text-cre8-red font-semibold shrink-0">${formData.ticker || 'TICKER'}</span>
                  </div>
                  {formData.description ? (
                    <p className="text-xs text-dim/60 line-clamp-2 mb-2 leading-relaxed">{formData.description}</p>
                  ) : (
                    <p className="text-xs text-dim/20 mb-2">No description</p>
                  )}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-dim">mcap: <span className="text-white font-mono font-semibold">$0</span></span>
                    <span className="text-dim font-mono tabular-nums">0 txns</span>
                  </div>
                </div>
              </div>

              {/* Cost summary */}
              <div className="mt-4 surface p-4 space-y-2">
                <h3 className="text-sm font-semibold text-white mb-2">Cost breakdown</h3>
                <div className="flex justify-between text-xs">
                  <span className="text-dim">Creation fee</span>
                  <span className="text-white font-mono tabular-nums">{FEES.CREATION} AVAX</span>
                </div>
                {initialBuy > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-dim">Initial buy</span>
                    <span className="text-white font-mono tabular-nums">{initialBuy.toFixed(2)} AVAX</span>
                  </div>
                )}
                <div className="border-t border-white/[0.06] pt-2 mt-2 flex justify-between text-sm">
                  <span className="text-dim font-medium">Total</span>
                  <span className="text-white font-mono font-bold tabular-nums">{(FEES.CREATION + initialBuy).toFixed(2)} AVAX</span>
                </div>
              </div>

              {/* Socials preview */}
              {(formData.twitter || formData.telegram || formData.website) && (
                <div className="mt-3 surface p-3 space-y-1.5">
                  <span className="text-[11px] text-dim font-medium">Social links</span>
                  {formData.twitter && (
                    <div className="flex items-center gap-2 text-xs text-dim"><Twitter className="w-3 h-3" /><span className="truncate">{formData.twitter}</span></div>
                  )}
                  {formData.telegram && (
                    <div className="flex items-center gap-2 text-xs text-dim"><MessageCircle className="w-3 h-3" /><span className="truncate">{formData.telegram}</span></div>
                  )}
                  {formData.website && (
                    <div className="flex items-center gap-2 text-xs text-dim"><Globe className="w-3 h-3" /><span className="truncate">{formData.website}</span></div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
