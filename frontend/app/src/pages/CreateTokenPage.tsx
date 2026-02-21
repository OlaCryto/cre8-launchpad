import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Zap, Rocket, Upload, Globe, MessageCircle,
  Twitter, Shield, Clock, Percent, Wallet, Check, Github, FileText,
  Lock, ChevronDown, ChevronUp, ImageIcon, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { FEES, TOKEN_CONSTANTS } from '@/config/wagmi';
import { useCreateTokenAndBuy, useCreateProfile } from '@/hooks/useTransactions';
import { useAvaxBalance } from '@/hooks/useContracts';
import { uploadTokenImage } from '@/utils/uploadImage';

// ============ Step indicator ============

function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((label, i) => {
        const step = i + 1;
        const isComplete = step < current;
        const isCurrent = step === current;
        return (
          <div key={step} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                isComplete ? 'bg-green-500 text-white' :
                isCurrent ? 'bg-cre8-red text-white' :
                'bg-white/[0.06] text-dim'
              }`}>
                {isComplete ? <Check className="w-4 h-4" /> : step}
              </div>
              <span className={`text-sm truncate hidden sm:block ${
                isCurrent ? 'text-white font-medium' : 'text-dim'
              }`}>{label}</span>
            </div>
            {step < total && (
              <div className={`h-px flex-1 ${isComplete ? 'bg-green-500' : 'bg-white/[0.06]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============ Auth gate ============

function AuthGate({ onSignIn, isLoading }: { onSignIn: () => void; isLoading: boolean }) {
  return (
    <div className="surface p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-cre8-red/10 flex items-center justify-center mx-auto mb-4">
        <Rocket className="w-7 h-7 text-cre8-red" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Sign in to Create</h2>
      <p className="text-dim mb-6 max-w-md mx-auto text-sm">
        You need to sign in with X to create tokens on Cre8. We'll generate a secure Avalanche wallet for you.
      </p>
      <Button
        onClick={onSignIn}
        disabled={isLoading}
        className="bg-black hover:bg-black/80 text-white font-semibold rounded-xl px-8 py-5 border border-white/20"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
        ) : (
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        )}
        {isLoading ? 'Signing in...' : 'Sign in with X'}
      </Button>
    </div>
  );
}

// ============ Trenches Input with char counter ============

function TrenchesInput({
  label, required, placeholder, value, maxLen, onChange,
}: {
  label: string; required?: boolean; placeholder: string;
  value: string; maxLen: number; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-white/80 uppercase tracking-wider mb-2">
        {label}{required && ' *'}
      </label>
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={value}
          maxLength={maxLen}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent border border-white/[0.1] text-white placeholder:text-dim/40 rounded-xl h-12 pr-12 focus:border-cre8-red/60"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dim/40 text-sm font-mono tabular-nums">
          {maxLen - value.length}
        </span>
      </div>
    </div>
  );
}

// ============ Trenches Mode (2-step wizard) ============

function TrenchesForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isLoading: txLoading, isPending, execute: createToken } = useCreateTokenAndBuy();
  const avaxBalance = useAvaxBalance(user?.wallet?.address);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [initialBuy, setInitialBuy] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    ticker: '',
    handle: user?.xHandle?.replace('@', '') || '',
    description: '',
    twitter: '',
    telegram: '',
    website: '',
  });

  const update = (fields: Partial<typeof formData>) => setFormData(prev => ({ ...prev, ...fields }));

  // Estimate tokens from AVAX amount (constant price: curveSupply / gradThreshold)
  const tokensPerAvax = Number(TOKEN_CONSTANTS.CURVE_SUPPLY) / Number(TOKEN_CONSTANTS.GRADUATION_THRESHOLD);
  const estimatedTokens = initialBuy * tokensPerAvax;
  const supplyPercent = Number(TOKEN_CONSTANTS.TOTAL_SUPPLY) > 0
    ? (estimatedTokens / Number(TOKEN_CONSTANTS.TOTAL_SUPPLY)) * 100
    : 0;

  // Max the user can spend (balance minus creation fee, floored to 0)
  const maxBuy = Math.max(0, Math.floor((avaxBalance - FEES.CREATION - 0.01) * 100) / 100);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const validateStep1 = (): boolean => {
    if (!formData.ticker.trim()) { toast.error('Ticker is required'); return false; }
    if (!formData.name.trim()) { toast.error('Token name is required'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    try {
      const receipt = await createToken({
        name: formData.name,
        symbol: formData.ticker.replace('$', ''),
        description: formData.description,
        imageURI: imagePreview && !imagePreview.startsWith('data:') ? imagePreview : '',
        twitter: formData.twitter,
        telegram: formData.telegram,
        website: formData.website,
        buyAmountAvax: initialBuy,
        minTokensOut: 0n,
      });

      if (receipt.tokenAddress && imagePreview?.startsWith('data:')) {
        uploadTokenImage(receipt.tokenAddress, imagePreview);
      }

      toast.success('Token created on Fuji!', {
        description: `TX: ${receipt.transactionHash.slice(0, 14)}...`,
      });

      navigate(receipt.tokenAddress ? `/token/${receipt.tokenAddress}` : '/');
    } catch (err: any) {
      toast.error('Token creation failed', { description: err?.shortMessage || err?.message });
    }
  };

  return (
    <div className="space-y-8">
      {/* Step header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            {step === 1 ? 'Basic information' : 'Finalize & Launch'}
          </h2>
          <p className="text-sm text-dim mt-1">
            {step === 1
              ? 'Provide some information for the token you wish to create!'
              : 'Set your initial purchase and launch your token.'}
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-cre8-red text-white whitespace-nowrap">
          Step {step}/2 (Trenches)
        </span>
      </div>

      {/* ============ Step 1: Basic Info ============ */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Token image — circular */}
          <div>
            <label className="block text-xs font-bold text-white/80 uppercase tracking-wider mb-3">Token Image</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative w-[72px] h-[72px] rounded-full border-2 border-white/[0.12] hover:border-cre8-red/50 transition-colors flex items-center justify-center overflow-hidden"
            >
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleImageUpload} className="hidden" />
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-7 h-7 text-dim group-hover:text-white/60 transition-colors" />
              )}
            </button>
          </div>

          {/* Ticker */}
          <TrenchesInput
            label="Ticker"
            required
            placeholder="$TOKEN"
            value={formData.ticker}
            maxLen={10}
            onChange={(v) => update({ ticker: v })}
          />

          {/* Name */}
          <TrenchesInput
            label="Name"
            required
            placeholder="token name"
            value={formData.name}
            maxLen={22}
            onChange={(v) => update({ name: v })}
          />

          {/* Handle */}
          <div>
            <TrenchesInput
              label="Handle"
              required
              placeholder="profile_page_handle"
              value={formData.handle}
              maxLen={22}
              onChange={(v) => update({ handle: v.replace(/[^a-zA-Z0-9_]/g, '') })}
            />
            <p className="text-xs text-dim/50 mt-2">* Handles are granted upon reaching $200.0K market cap</p>
          </div>

          {/* Continue */}
          <Button
            onClick={() => { if (validateStep1()) setStep(2); }}
            className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl py-5 text-base mt-2"
          >
            Continue
          </Button>
        </div>
      )}

      {/* ============ Step 2: Description + Socials dropdown + Initial Purchase ============ */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-white/80 uppercase tracking-wider mb-2">Description</label>
            <div className="relative">
              <Textarea
                placeholder="What's your token about?"
                value={formData.description}
                maxLength={500}
                onChange={(e) => update({ description: e.target.value })}
                className="bg-transparent border border-white/[0.1] text-white placeholder:text-dim/40 rounded-xl min-h-[100px] focus:border-cre8-red/60 resize-none"
              />
              <span className="absolute right-3 bottom-3 text-dim/40 text-xs font-mono tabular-nums">
                {500 - formData.description.length}
              </span>
            </div>
          </div>

          {/* Collapsible Socials */}
          <div className="border border-white/[0.06] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setSocialsOpen(!socialsOpen)}
              className="flex items-center justify-between w-full px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Social Links (Optional)</span>
              {socialsOpen ? <ChevronUp className="w-4 h-4 text-dim" /> : <ChevronDown className="w-4 h-4 text-dim" />}
            </button>
            {socialsOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04]">
                <div className="pt-4">
                  <label className="flex items-center gap-2 text-xs text-dim mb-1.5"><Twitter className="w-3.5 h-3.5" />X (Twitter)</label>
                  <Input
                    placeholder="@handle"
                    value={formData.twitter}
                    onChange={(e) => update({ twitter: e.target.value })}
                    className="bg-transparent border border-white/[0.1] text-white placeholder:text-dim/40 rounded-xl h-11 focus:border-cre8-red/60"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs text-dim mb-1.5"><MessageCircle className="w-3.5 h-3.5" />Telegram</label>
                  <Input
                    placeholder="t.me/yourgroup"
                    value={formData.telegram}
                    onChange={(e) => update({ telegram: e.target.value })}
                    className="bg-transparent border border-white/[0.1] text-white placeholder:text-dim/40 rounded-xl h-11 focus:border-cre8-red/60"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs text-dim mb-1.5"><Globe className="w-3.5 h-3.5" />Website</label>
                  <Input
                    placeholder="https://yourtoken.com"
                    value={formData.website}
                    onChange={(e) => update({ website: e.target.value })}
                    className="bg-transparent border border-white/[0.1] text-white placeholder:text-dim/40 rounded-xl h-11 focus:border-cre8-red/60"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Initial Purchase ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cre8-red" />
              <h3 className="text-sm font-bold text-white">Initial Purchase</h3>
              <div className="group relative">
                <Info className="w-3.5 h-3.5 text-dim cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-cre8-surface border border-white/[0.1] rounded-lg text-xs text-dim opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
                  Optionally buy your own token at launch. This is separate from the creation fee.
                </div>
              </div>
            </div>

            <p className="text-xs text-dim">
              AVAILABLE BALANCE: <span className="text-white font-bold">{avaxBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} AVAX</span>
            </p>

            {/* Amount input */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-cre8-red flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">A</span>
              </div>
              <Input
                type="number"
                min={0}
                max={maxBuy}
                step={0.1}
                value={initialBuy || ''}
                placeholder="0"
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  setInitialBuy(Math.min(v, maxBuy));
                }}
                className="bg-transparent border border-white/[0.1] text-white placeholder:text-dim/40 rounded-xl h-12 pl-10 focus:border-cre8-red/60 font-mono"
              />
            </div>

            {/* Slider */}
            <div>
              <input
                type="range"
                min={0}
                max={maxBuy}
                step={0.01}
                value={initialBuy}
                onChange={(e) => setInitialBuy(parseFloat(e.target.value))}
                className="w-full accent-cre8-red h-1.5 rounded-full appearance-none bg-white/[0.08] cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cre8-red [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-cre8-red [&::-webkit-slider-thumb]:shadow-md"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-dim font-mono">0</span>
                <span className="text-xs text-dim font-mono">{maxBuy.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* You are buying summary */}
            <div className="bg-cre8-surface/60 border border-white/[0.06] rounded-xl px-4 py-3 text-center">
              <p className="text-sm text-white">
                You are buying <span className="text-cre8-red font-bold font-mono">{estimatedTokens > 0 ? estimatedTokens.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}</span> ${formData.ticker || 'TOKEN'}
              </p>
              <p className="text-xs text-dim mt-0.5">
                ({supplyPercent.toFixed(2)}% of max supply)
              </p>
            </div>
          </div>

          {/* Create button */}
          <Button
            onClick={handleSubmit}
            disabled={txLoading}
            className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-bold rounded-xl py-5 text-base"
          >
            {txLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                {isPending ? 'Confirming...' : 'Creating...'}
              </>
            ) : initialBuy > 0 ? (
              'Create and Buy Token Now'
            ) : (
              'Create Token Now'
            )}
          </Button>

          <p className="text-center text-xs text-dim">
            By clicking "Create" you are agreeing to Cre8 Launch{' '}
            <span className="text-white underline cursor-pointer">Terms & Conditions</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ============ Forge Mode (multi-step wizard) ============

interface ForgeFormData {
  projectName: string;
  projectDescription: string;
  githubRepo: string;
  whitepaper: string;
  projectWebsite: string;
  projectTelegram: string;
  tokenName: string;
  tokenTicker: string;
  tokenDescription: string;
  tokenImagePreview: string | null;
  tokenImageFile: File | null;
  cooldown: string;
  maxTx: string;
  maxWallet: string;
  presaleEnabled: boolean;
  presaleTarget: string;
  presaleMaxPerWallet: string;
  presaleDuration: string;
  whitelistEnabled: boolean;
  whitelistAddresses: string;
  usePresaleFunds: string;
}

const defaultForgeData: ForgeFormData = {
  projectName: '',
  projectDescription: '',
  githubRepo: '',
  whitepaper: '',
  projectWebsite: '',
  projectTelegram: '',
  tokenName: '',
  tokenTicker: '',
  tokenDescription: '',
  tokenImagePreview: null,
  tokenImageFile: null,
  cooldown: '30',
  maxTx: '20',
  maxWallet: '50',
  presaleEnabled: true,
  presaleTarget: '50',
  presaleMaxPerWallet: '5',
  presaleDuration: '48',
  whitelistEnabled: false,
  whitelistAddresses: '',
  usePresaleFunds: '100',
};

function ForgeWizard() {
  const navigate = useNavigate();
  const { user, updateCreatorProfile } = useAuth();
  const { isLoading: createTxLoading, isPending: createTxPending, execute: createToken } = useCreateTokenAndBuy();
  const { execute: createProfile } = useCreateProfile();
  const [profileCreating, setProfileCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ForgeFormData>(() => {
    if (user?.creatorProfile) {
      return {
        ...defaultForgeData,
        projectName: user.creatorProfile.projectName,
        projectDescription: user.creatorProfile.description,
        githubRepo: user.creatorProfile.githubRepo,
        whitepaper: user.creatorProfile.whitepaper,
        projectWebsite: user.creatorProfile.website,
        projectTelegram: user.creatorProfile.telegram,
      };
    }
    return defaultForgeData;
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSteps = 4;
  const stepLabels = ['Project', 'Token', 'Presale', 'Review'];

  const update = (fields: Partial<ForgeFormData>) => {
    setFormData(prev => ({ ...prev, ...fields }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => update({ tokenImagePreview: reader.result as string, tokenImageFile: file });
      reader.readAsDataURL(file);
    }
  };

  // Live authenticity score based on filled optional fields
  const authenticityItems = [
    { label: 'Project name', filled: !!formData.projectName.trim() },
    { label: 'Description', filled: !!formData.projectDescription.trim() },
    { label: 'GitHub repo', filled: !!formData.githubRepo.trim() },
    { label: 'Whitepaper', filled: !!formData.whitepaper.trim() },
    { label: 'Website', filled: !!formData.projectWebsite.trim() },
    { label: 'Telegram', filled: !!formData.projectTelegram.trim() },
  ];
  const authenticityScore = authenticityItems.filter(i => i.filled).length;
  const authenticityMax = authenticityItems.length;

  const validateStep = (): boolean => {
    switch (step) {
      case 1:
        if (!formData.projectName.trim()) { toast.error('Project name is required'); return false; }
        return true;
      case 2:
        if (!formData.tokenName.trim()) { toast.error('Token name is required'); return false; }
        if (!formData.tokenTicker.trim()) { toast.error('Ticker symbol is required'); return false; }
        return true;
      case 3:
        if (formData.presaleEnabled) {
          if (!formData.presaleTarget || parseFloat(formData.presaleTarget) <= 0) { toast.error('Presale target must be greater than 0'); return false; }
          if (!formData.presaleMaxPerWallet || parseFloat(formData.presaleMaxPerWallet) <= 0) { toast.error('Max per wallet must be greater than 0'); return false; }
          if (!formData.presaleDuration || parseFloat(formData.presaleDuration) <= 0) { toast.error('Presale duration must be greater than 0'); return false; }
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = async () => {
    if (!validateStep()) return;

    if (step === 1) {
      updateCreatorProfile({
        projectName: formData.projectName,
        description: formData.projectDescription,
        githubRepo: formData.githubRepo,
        whitepaper: formData.whitepaper,
        website: formData.projectWebsite,
        telegram: formData.projectTelegram,
        tokenImage: '',
        isVerified: authenticityScore >= 5,
        createdAt: new Date().toISOString(),
      });

      try {
        setProfileCreating(true);
        const handle = formData.projectName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().slice(0, 20);
        await createProfile({
          handle,
          displayName: formData.projectName,
          avatarURI: '',
          bio: formData.projectDescription.slice(0, 200),
        });
        toast.success('Creator profile registered on-chain!');
      } catch (err: any) {
        if (!err?.message?.includes('AlreadyInitialized')) {
          console.warn('Profile creation skipped:', err?.shortMessage || err?.message);
        }
      } finally {
        setProfileCreating(false);
      }

      // Redirect to creator dashboard (control center)
      navigate('/dashboard');
      return;
    }

    setStep(s => Math.min(s + 1, totalSteps));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    try {
      const receipt = await createToken({
        name: formData.tokenName,
        symbol: formData.tokenTicker.replace('$', ''),
        description: formData.tokenDescription,
        imageURI: formData.tokenImagePreview && !formData.tokenImagePreview.startsWith('data:') ? formData.tokenImagePreview : '',
        twitter: '',
        telegram: formData.projectTelegram,
        website: formData.projectWebsite,
        buyAmountAvax: 0,
        minTokensOut: 0n,
      });

      // Upload image to backend (fire-and-forget)
      if (receipt.tokenAddress && formData.tokenImagePreview?.startsWith('data:')) {
        uploadTokenImage(receipt.tokenAddress, formData.tokenImagePreview);
      }

      toast.success('Token created on Fuji!', {
        description: `TX: ${receipt.transactionHash.slice(0, 14)}...`,
      });

      if (receipt.tokenAddress) {
        navigate(`/token/${receipt.tokenAddress}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      toast.error('Token creation failed', { description: err?.shortMessage || err?.message });
    }
  };

  return (
    <div>
      <StepIndicator current={step} total={totalSteps} labels={stepLabels} />

      {/* Step 1: Project Profile */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Authenticity Score */}
          <div className="surface p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-white">Authenticity Score</span>
              </div>
              <span className={`text-sm font-bold font-mono ${
                authenticityScore >= 5 ? 'text-green-400' :
                authenticityScore >= 3 ? 'text-amber-400' : 'text-dim'
              }`}>{authenticityScore}/{authenticityMax}</span>
            </div>
            <div className="flex gap-1 mb-2.5">
              {authenticityItems.map((item, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                  item.filled ? 'bg-green-400' : 'bg-white/[0.06]'
                }`} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {authenticityItems.map((item, i) => (
                <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  item.filled ? 'bg-green-400/10 text-green-400' : 'bg-white/[0.04] text-dim/50'
                }`}>
                  {item.filled && <Check className="w-2.5 h-2.5" />}
                  {item.label}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-dim/60 mt-2">
              {authenticityScore >= 5 ? 'Eligible for verified badge after review.' :
               authenticityScore >= 3 ? 'Good start! Add more details to earn a verified badge.' :
               'Fill in more fields to boost your credibility with the community.'}
            </p>
          </div>

          <div className="surface p-5">
            <div className="flex items-center gap-2 mb-1">
              <Rocket className="w-4 h-4 text-cre8-red" />
              <h2 className="text-base font-semibold text-white">Project Profile</h2>
            </div>
            <p className="text-sm text-dim mb-5">Tell the community about your project. Only the name is required — everything else helps build trust.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dim mb-1.5">
                  Project Name <span className="text-cre8-red">*</span>
                </label>
                <Input
                  placeholder="e.g. Avalanche DeFi Protocol"
                  value={formData.projectName}
                  onChange={(e) => update({ projectName: e.target.value })}
                  className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm text-dim mb-1.5">Project Description</label>
                <Textarea
                  placeholder="Describe your project..."
                  value={formData.projectDescription}
                  onChange={(e) => update({ projectDescription: e.target.value })}
                  className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg min-h-[120px]"
                />
                <p className="text-xs text-dim/50 mt-1">{formData.projectDescription.length}/1000</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><Github className="w-4 h-4" />GitHub Repository</label>
                <Input placeholder="https://github.com/your-project" value={formData.githubRepo} onChange={(e) => update({ githubRepo: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg" />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><FileText className="w-4 h-4" />Whitepaper / Docs</label>
                <Input placeholder="https://docs.yourproject.com" value={formData.whitepaper} onChange={(e) => update({ whitepaper: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><Globe className="w-4 h-4" />Website</label>
                  <Input placeholder="https://yourproject.com" value={formData.projectWebsite} onChange={(e) => update({ projectWebsite: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg" />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><MessageCircle className="w-4 h-4" />Telegram</label>
                  <Input placeholder="t.me/yourgroup" value={formData.projectTelegram} onChange={(e) => update({ projectTelegram: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Token Details */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="surface p-5">
            <h2 className="text-base font-semibold text-white mb-4">Token Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dim mb-1.5">Token Name <span className="text-cre8-red">*</span></label>
                  <Input placeholder="e.g. MoonToken" value={formData.tokenName} onChange={(e) => update({ tokenName: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm text-dim mb-1.5">Ticker Symbol <span className="text-cre8-red">*</span></label>
                  <Input placeholder="e.g. $MOON" value={formData.tokenTicker} onChange={(e) => update({ tokenTicker: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-dim mb-1.5">Token Description</label>
                <Textarea placeholder="Brief description..." value={formData.tokenDescription} onChange={(e) => update({ tokenDescription: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg min-h-[80px]" />
              </div>

              <div>
                <label className="block text-sm text-dim mb-1.5">Token Image</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative border-2 border-dashed border-white/[0.08] rounded-xl p-6 text-center cursor-pointer hover:border-cre8-red/40 transition-colors"
                >
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleImageUpload} className="hidden" />
                  {formData.tokenImagePreview ? (
                    <img src={formData.tokenImagePreview} alt="Preview" className="w-20 h-20 mx-auto rounded-xl object-cover" />
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-dim mx-auto mb-2" />
                      <p className="text-sm text-dim">Click to upload</p>
                      <p className="text-xs text-dim/50 mt-1">PNG, JPG up to 5MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Anti-Bot */}
          <div className="surface p-5">
            <button type="button" onClick={() => setAdvancedOpen(!advancedOpen)} className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cre8-red" />
                <h2 className="text-base font-semibold text-white">Anti-Bot Protection</h2>
              </div>
              {advancedOpen ? <ChevronUp className="w-4 h-4 text-dim" /> : <ChevronDown className="w-4 h-4 text-dim" />}
            </button>

            {advancedOpen && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div>
                  <label className="flex items-center gap-1 text-sm text-dim mb-1.5"><Clock className="w-3 h-3" />Cooldown</label>
                  <div className="relative">
                    <Input type="number" value={formData.cooldown} onChange={(e) => update({ cooldown: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white rounded-lg pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dim text-sm">s</span>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-sm text-dim mb-1.5"><Percent className="w-3 h-3" />Max Tx</label>
                  <div className="relative">
                    <Input type="number" value={formData.maxTx} onChange={(e) => update({ maxTx: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white rounded-lg pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dim text-sm">%</span>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-sm text-dim mb-1.5"><Wallet className="w-3 h-3" />Max Wallet</label>
                  <div className="relative">
                    <Input type="number" value={formData.maxWallet} onChange={(e) => update({ maxWallet: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white rounded-lg pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dim text-sm">%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Presale Config */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-white">Presale Configuration</h2>
                <p className="text-sm text-dim mt-0.5">Run a presale to raise initial funds.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-dim">{formData.presaleEnabled ? 'On' : 'Off'}</span>
                <Switch checked={formData.presaleEnabled} onCheckedChange={(checked) => update({ presaleEnabled: checked })} />
              </div>
            </div>

            {formData.presaleEnabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-dim mb-1.5">Raise Target (AVAX) <span className="text-cre8-red">*</span></label>
                    <div className="relative">
                      <Input type="number" placeholder="50" value={formData.presaleTarget} onChange={(e) => update({ presaleTarget: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg pr-16" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dim text-sm">AVAX</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-dim mb-1.5">Max Per Wallet (AVAX) <span className="text-cre8-red">*</span></label>
                    <div className="relative">
                      <Input type="number" placeholder="5" value={formData.presaleMaxPerWallet} onChange={(e) => update({ presaleMaxPerWallet: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg pr-16" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dim text-sm">AVAX</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-dim mb-1.5">Presale Duration <span className="text-cre8-red">*</span></label>
                  <div className="grid grid-cols-4 gap-2">
                    {['24', '48', '72', '168'].map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => update({ presaleDuration: hours })}
                        className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.presaleDuration === hours
                            ? 'bg-cre8-red text-white'
                            : 'bg-cre8-base text-dim hover:text-white border border-white/[0.06]'
                        }`}
                      >
                        {parseInt(hours) < 168 ? `${hours}h` : '7 days'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-dim mb-1.5">Funds for Liquidity</label>
                  <div className="flex items-center gap-4">
                    <input type="range" min="50" max="100" step="5" value={formData.usePresaleFunds} onChange={(e) => update({ usePresaleFunds: e.target.value })} className="flex-1 accent-cre8-red" />
                    <span className="text-white font-mono text-sm w-12 text-right tabular-nums">{formData.usePresaleFunds}%</span>
                  </div>
                  <p className="text-xs text-dim/50 mt-1">Percentage of raised AVAX used for bonding curve liquidity.</p>
                </div>
              </div>
            )}
          </div>

          {/* Whitelist */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-cre8-red" />
                <h2 className="text-base font-semibold text-white">Whitelist</h2>
                <Badge className="bg-dim/20 text-dim text-xs">Optional</Badge>
              </div>
              <Switch checked={formData.whitelistEnabled} onCheckedChange={(checked) => update({ whitelistEnabled: checked })} />
            </div>
            <p className="text-sm text-dim mb-4">Restrict presale to specific wallets.</p>

            {formData.whitelistEnabled && (
              <div>
                <Textarea
                  placeholder={"Enter wallet addresses, one per line\n0x1234...5678\n0xabcd...efgh"}
                  value={formData.whitelistAddresses}
                  onChange={(e) => update({ whitelistAddresses: e.target.value })}
                  className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/50 rounded-lg min-h-[100px] font-mono text-sm"
                />
                <p className="text-xs text-dim/50 mt-1">
                  {formData.whitelistAddresses.split('\n').filter(a => a.trim()).length} addresses
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">Project</h2>
              <button type="button" onClick={() => setStep(1)} className="text-sm text-cre8-red hover:underline">Edit</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-dim">Name</span><span className="text-white font-medium">{formData.projectName}</span></div>
              <div><span className="text-dim">Description</span><p className="text-white mt-0.5 line-clamp-2">{formData.projectDescription}</p></div>
              {formData.githubRepo && <div className="flex justify-between"><span className="text-dim">GitHub</span><span className="text-cre8-red truncate max-w-[200px]">{formData.githubRepo}</span></div>}
            </div>
          </div>

          <div className="surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">Token</h2>
              <button type="button" onClick={() => setStep(2)} className="text-sm text-cre8-red hover:underline">Edit</button>
            </div>
            <div className="flex items-center gap-4 mb-3">
              {formData.tokenImagePreview && <img src={formData.tokenImagePreview} alt="" className="w-12 h-12 rounded-xl object-cover" />}
              <div>
                <p className="text-white font-semibold">{formData.tokenName}</p>
                <p className="text-cre8-red font-mono text-sm">${formData.tokenTicker}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-cre8-base rounded-lg p-2.5 text-center">
                <p className="text-xs text-dim">Cooldown</p>
                <p className="text-white font-mono text-sm">{formData.cooldown}s</p>
              </div>
              <div className="bg-cre8-base rounded-lg p-2.5 text-center">
                <p className="text-xs text-dim">Max Tx</p>
                <p className="text-white font-mono text-sm">{formData.maxTx}%</p>
              </div>
              <div className="bg-cre8-base rounded-lg p-2.5 text-center">
                <p className="text-xs text-dim">Max Wallet</p>
                <p className="text-white font-mono text-sm">{formData.maxWallet}%</p>
              </div>
            </div>
          </div>

          <div className="surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">Presale</h2>
              <button type="button" onClick={() => setStep(3)} className="text-sm text-cre8-red hover:underline">Edit</button>
            </div>
            {formData.presaleEnabled ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-dim">Target</span><span className="text-white font-mono">{formData.presaleTarget} AVAX</span></div>
                <div className="flex justify-between"><span className="text-dim">Max per wallet</span><span className="text-white font-mono">{formData.presaleMaxPerWallet} AVAX</span></div>
                <div className="flex justify-between"><span className="text-dim">Duration</span><span className="text-white font-mono">{formData.presaleDuration}h</span></div>
                <div className="flex justify-between"><span className="text-dim">Funds to liquidity</span><span className="text-white font-mono">{formData.usePresaleFunds}%</span></div>
                <div className="flex justify-between"><span className="text-dim">Whitelist</span><span className="text-white">{formData.whitelistEnabled ? `${formData.whitelistAddresses.split('\n').filter(a => a.trim()).length} addresses` : 'Open to all'}</span></div>
              </div>
            ) : (
              <p className="text-dim text-sm">No presale — direct bonding curve launch.</p>
            )}
          </div>

          <div className="bg-cre8-surface/50 border border-white/[0.04] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-dim">Creation Fee</span>
              <span className="text-white font-mono">{FEES.CREATION} AVAX</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dim">Trading Fee</span>
              <span className="text-white font-mono">{FEES.TRADING * 100}% (0.2% to you)</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3 mt-8">
        {step > 1 && (
          <Button type="button" onClick={prevStep} variant="outline" className="flex-1 border-white/[0.08] text-white hover:bg-white/[0.04] rounded-xl py-5">
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>
        )}
        {step < totalSteps ? (
          <Button type="button" onClick={nextStep} disabled={profileCreating} className="flex-1 bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl py-5">
            {profileCreating ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Registering...</>
            ) : (
              <>Continue<ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={createTxLoading} className="flex-1 bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl py-5">
            {createTxLoading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />{createTxPending ? 'Confirming...' : 'Submitting...'}</>
            ) : (
              <><Rocket className="w-4 h-4 mr-2" />{formData.presaleEnabled ? 'Create & Start Presale' : 'Launch Token'}</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============ Main Page ============

// ============ Mode Selection Popup ============

function ModeSelection({ onSelect }: { onSelect: (mode: 'trenches' | 'forge') => void }) {
  const [selected, setSelected] = useState<'trenches' | 'forge'>('trenches');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-cre8-base border border-white/[0.08] rounded-2xl p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/" className="text-dim hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-lg font-bold text-white">Create your Token</h2>
        </div>

        {/* Two compact cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelected('trenches')}
            className={`flex items-center justify-between gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
              selected === 'trenches'
                ? 'border-cre8-red bg-cre8-red/[0.06]'
                : 'border-white/[0.08] bg-cre8-surface/50 hover:border-white/[0.15]'
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Trenches</p>
              <p className="text-sm font-semibold text-white leading-tight">Launch</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selected === 'trenches' ? 'bg-cre8-red/20' : 'bg-white/[0.06]'
            }`}>
              <Zap className={`w-5 h-5 ${selected === 'trenches' ? 'text-cre8-red' : 'text-dim'}`} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelected('forge')}
            className={`flex items-center justify-between gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
              selected === 'forge'
                ? 'border-cre8-red bg-cre8-red/[0.06]'
                : 'border-white/[0.08] bg-cre8-surface/50 hover:border-white/[0.15]'
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Forge</p>
              <p className="text-sm font-semibold text-white leading-tight">Launch</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selected === 'forge' ? 'bg-cre8-red/20' : 'bg-white/[0.06]'
            }`}>
              <Rocket className={`w-5 h-5 ${selected === 'forge' ? 'text-cre8-red' : 'text-dim'}`} />
            </div>
          </button>
        </div>

        {/* Hint text */}
        <div className="text-center">
          <p className="text-sm text-dim">Looking for more options?</p>
          <p className="text-xs text-dim/70">Whitelist users to get full control.</p>
        </div>

        {/* Continue button */}
        <Button
          onClick={() => onSelect(selected)}
          className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl py-5 text-base"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// ============ Main Page ============

export function CreateTokenPage() {
  const { isAuthenticated, isLoading, signInWithX } = useAuth();
  const [mode, setMode] = useState<'trenches' | 'forge' | null>(null);

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Show header + form only after mode is selected */}
        {mode && (
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setMode(null)} className="text-dim hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-white">
              {mode === 'trenches' ? 'Trenches Launch' : 'Forge Launch'}
            </h1>
          </div>
        )}

        {!isAuthenticated ? (
          <AuthGate onSignIn={signInWithX} isLoading={isLoading} />
        ) : mode === null ? (
          <ModeSelection onSelect={setMode} />
        ) : mode === 'trenches' ? (
          <TrenchesForm />
        ) : (
          <ForgeWizard />
        )}
      </div>
    </div>
  );
}
