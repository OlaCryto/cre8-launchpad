import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Rocket, Shield, Check, Globe, MessageCircle, Github, FileText,
  Edit, Save, X, Megaphone, Plus, ExternalLink, Wallet,
  TrendingUp, Award, ChevronRight, Users, ArrowLeft,
  Flame, Lock, Clock, ImageIcon, LinkIcon,
  Twitter, ChevronDown, ChevronUp, AlertCircle, Play,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth, type CreatorProject } from '@/contexts/AuthContext';
import { useAvaxBalance } from '@/hooks/useContracts';
import { useCreatorForgeLaunches, useCreateForgeLaunch, useExecuteLaunch, type ForgeLaunchInfo } from '@/hooks/useForge';
import { FEES } from '@/config/wagmi';
import { parseEther } from 'viem';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PHASE_LABELS = ['Presale', 'Presale Closed', 'Whitelist', 'Public', 'Graduated'] as const;

type DashboardView = 'main' | 'presale' | 'launch' | 'announce' | 'edit';

// ============ Shared: Token Details Fields ============

function TokenDetailsFields({
  formData,
  update,
  imagePreview,
  setImagePreview,
  fileInputRef,
  socialsOpen,
  setSocialsOpen,
}: {
  formData: { name: string; ticker: string; description: string; twitter: string; telegram: string; website: string };
  update: (fields: Partial<typeof formData>) => void;
  imagePreview: string | null;
  setImagePreview: (v: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  socialsOpen: boolean;
  setSocialsOpen: (v: boolean) => void;
}) {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="surface p-5 space-y-5">
      <h3 className="text-sm font-bold text-white">Token Details</h3>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4">
        <div>
          <label className="block text-sm text-dim mb-1.5">Coin name</label>
          <Input placeholder="Name your coin" value={formData.name} maxLength={32} onChange={(e) => update({ name: e.target.value })}
            className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg h-11" />
        </div>
        <div>
          <label className="block text-sm text-dim mb-1.5">Ticker</label>
          <Input placeholder="e.g. DOGE" value={formData.ticker} maxLength={10}
            onChange={(e) => update({ ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
            className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg h-11 font-mono" />
        </div>
      </div>

      <div>
        <label className="block text-sm text-dim mb-1.5">Description <span className="text-dim/40">(Optional)</span></label>
        <div className="relative">
          <Textarea placeholder="Write a short description" value={formData.description} maxLength={500}
            onChange={(e) => update({ description: e.target.value })}
            className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg min-h-[100px] resize-none" />
          <span className="absolute right-3 bottom-3 text-dim/30 text-xs font-mono tabular-nums">{500 - formData.description.length}</span>
        </div>
      </div>

      {/* Social Links */}
      <div>
        <button type="button" onClick={() => setSocialsOpen(!socialsOpen)}
          className="flex items-center gap-2 text-sm text-dim hover:text-white transition-colors">
          <LinkIcon className="w-3.5 h-3.5" /><span>Add social links</span><span className="text-dim/40">(Optional)</span>
          {socialsOpen ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
        </button>
        {socialsOpen && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <Twitter className="w-4 h-4 text-dim shrink-0" />
              <Input placeholder="@handle" value={formData.twitter} onChange={(e) => update({ twitter: e.target.value })}
                className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg h-10 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-dim shrink-0" />
              <Input placeholder="t.me/yourgroup" value={formData.telegram} onChange={(e) => update({ telegram: e.target.value })}
                className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg h-10 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-dim shrink-0" />
              <Input placeholder="https://yourtoken.com" value={formData.website} onChange={(e) => update({ website: e.target.value })}
                className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg h-10 text-sm" />
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
  );
}

// ============ Run Presale Flow ============

function PresaleSetupFlow({ onBack }: { onBack: () => void }) {
  const { isLoading: txLoading, isPending, execute: createForgeLaunch } = useCreateForgeLaunch();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', ticker: '', description: '', twitter: '', telegram: '', website: '',
  });

  // Presale config
  const [presaleHardCap, setPresaleHardCap] = useState('10');
  const [presaleSoftCap, setPresaleSoftCap] = useState('');
  const [presaleMaxPerWallet, setPresaleMaxPerWallet] = useState('5');
  const [presaleDurationHours, setPresaleDurationHours] = useState('24');

  // Optional: whitelist + vesting for after presale
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [whitelistAddresses, setWhitelistAddresses] = useState('');
  const [whitelistDurationMins, setWhitelistDurationMins] = useState('60');
  const [vestingEnabled, setVestingEnabled] = useState(false);
  const [vestingTeamPercent, setVestingTeamPercent] = useState('10');
  const [vestingCliffDays, setVestingCliffDays] = useState('30');
  const [vestingDurationDays, setVestingDurationDays] = useState('180');

  const update = (fields: Partial<typeof formData>) => setFormData(prev => ({ ...prev, ...fields }));

  const handleSubmit = async () => {
    if (!formData.name.trim()) { toast.error('Coin name is required'); return; }
    if (!formData.ticker.trim()) { toast.error('Ticker is required'); return; }
    if (!presaleHardCap || parseFloat(presaleHardCap) <= 0) { toast.error('Hard cap is required'); return; }

    const whitelist = whitelistEnabled
      ? whitelistAddresses.split(/[\n,]+/).map(s => s.trim()).filter(s => /^0x[a-fA-F0-9]{40}$/.test(s))
      : [];
    if (whitelistEnabled && whitelist.length === 0) {
      toast.error('Add at least one valid whitelist address');
      return;
    }

    try {
      const safeImageURI = imagePreview?.startsWith('data:') ? '' : (imagePreview || '');

      const receipt = await createForgeLaunch({
        name: formData.name,
        symbol: formData.ticker.replace('$', ''),
        description: formData.description,
        imageURI: safeImageURI,
        twitter: formData.twitter,
        telegram: formData.telegram,
        website: formData.website,
        presaleEnabled: true,
        whitelistEnabled,
        vestingEnabled,
        presaleMaxPerWallet: parseEther(presaleMaxPerWallet || '0'),
        presaleDuration: BigInt(Math.round(parseFloat(presaleDurationHours || '0') * 3600)),
        presaleHardCap: parseEther(presaleHardCap || '0'),
        presaleSoftCap: parseEther(presaleSoftCap || '0'),
        whitelist,
        whitelistDuration: whitelistEnabled ? BigInt(Math.round(parseFloat(whitelistDurationMins || '0') * 60)) : 0n,
        vestingTeamBps: vestingEnabled ? BigInt(Math.round(parseFloat(vestingTeamPercent || '0') * 100)) : 0n,
        vestingCliff: vestingEnabled ? BigInt(Math.round(parseFloat(vestingCliffDays || '0') * 86400)) : 0n,
        vestingDuration: vestingEnabled ? BigInt(Math.round(parseFloat(vestingDurationDays || '0') * 86400)) : 0n,
      });

      // Record presale event off-chain
      if (receipt) {
        try {
          const session = localStorage.getItem('cre8_session');
          await fetch(`${API_BASE}/api/presales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
            body: JSON.stringify({
              launch_id: 0,
              token_name: formData.name,
              token_symbol: formData.ticker.replace('$', ''),
              hard_cap: presaleHardCap,
              soft_cap: presaleSoftCap || '0',
              max_per_wallet: presaleMaxPerWallet,
              duration_seconds: Math.round(parseFloat(presaleDurationHours || '0') * 3600),
            }),
          });
        } catch { /* non-critical */ }
      }

      toast.success('Presale created! Contributors can now fund your project.');
      onBack();
    } catch (err: any) {
      toast.error('Presale creation failed', { description: err?.shortMessage || err?.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-dim hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">Run Presale</h2>
          <p className="text-xs text-dim">Raise funds before your token launches. Presale AVAX will seed the bonding curve.</p>
        </div>
      </div>

      {/* Token Details (needed for contract registration) */}
      <TokenDetailsFields
        formData={formData} update={update}
        imagePreview={imagePreview} setImagePreview={setImagePreview}
        fileInputRef={fileInputRef} socialsOpen={socialsOpen} setSocialsOpen={setSocialsOpen}
      />

      {/* Presale Configuration */}
      <div className="surface p-5 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Presale Configuration</h3>
            <p className="text-xs text-dim">Set your fundraising parameters</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-dim mb-1 block">Hard Cap (AVAX) <span className="text-cre8-red">*</span></label>
            <Input type="number" value={presaleHardCap} onChange={(e) => setPresaleHardCap(e.target.value)} placeholder="10"
              className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs text-dim mb-1 block">Soft Cap (AVAX) <span className="text-dim/40">(Optional)</span></label>
            <Input type="number" value={presaleSoftCap} onChange={(e) => setPresaleSoftCap(e.target.value)} placeholder="0"
              className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-dim mb-1 block">Max per wallet (AVAX)</label>
            <Input type="number" value={presaleMaxPerWallet} onChange={(e) => setPresaleMaxPerWallet(e.target.value)}
              className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs text-dim mb-1 block">Duration (hours)</label>
            <Input type="number" value={presaleDurationHours} onChange={(e) => setPresaleDurationHours(e.target.value)}
              className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
          </div>
        </div>
        <p className="text-[11px] text-dim">Hard cap auto-closes presale when reached. Soft cap cancels presale (refunds) if not met.</p>
        <p className="text-[11px] text-dim">Duration — Min: 1 hour, Max: 168 hours (7 days)</p>
      </div>

      {/* Post-Launch Options (whitelist + vesting applied after presale) */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white">Post-Launch Options</h3>
        <p className="text-xs text-dim -mt-2">These apply after presale ends and the token launches.</p>

        {/* Whitelist */}
        <div className="surface p-5 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Whitelist Early Access</p>
                <p className="text-xs text-dim">Select wallets get early buy window after launch</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${whitelistEnabled ? 'bg-cre8-red' : 'bg-white/[0.1]'}`}
              onClick={() => setWhitelistEnabled(!whitelistEnabled)}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${whitelistEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </div>
          </label>
          {whitelistEnabled && (
            <div className="pl-11 space-y-3">
              <div>
                <label className="text-xs text-dim mb-1 block">Duration (minutes)</label>
                <Input type="number" value={whitelistDurationMins} onChange={(e) => setWhitelistDurationMins(e.target.value)}
                  className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
                <p className="text-[11px] text-dim mt-1">Min: 5 min, Max: 1440 min (24h)</p>
              </div>
              <div>
                <label className="text-xs text-dim mb-1 block">Whitelisted addresses (one per line)</label>
                <Textarea value={whitelistAddresses} onChange={(e) => setWhitelistAddresses(e.target.value)}
                  placeholder={"0x1234...\n0xabcd..."}
                  className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg min-h-[80px] resize-none text-xs font-mono" />
              </div>
            </div>
          )}
        </div>

        {/* Vesting */}
        <div className="surface p-5 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <Lock className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Team Vesting</p>
                <p className="text-xs text-dim">Lock team tokens with cliff + linear unlock</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${vestingEnabled ? 'bg-cre8-red' : 'bg-white/[0.1]'}`}
              onClick={() => setVestingEnabled(!vestingEnabled)}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${vestingEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </div>
          </label>
          {vestingEnabled && (
            <div className="pl-11 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-dim mb-1 block">Team % (max 20)</label>
                  <Input type="number" min={1} max={20} value={vestingTeamPercent} onChange={(e) => setVestingTeamPercent(e.target.value)}
                    className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-dim mb-1 block">Cliff (days)</label>
                  <Input type="number" value={vestingCliffDays} onChange={(e) => setVestingCliffDays(e.target.value)}
                    className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-dim mb-1 block">Vesting (days)</label>
                  <Input type="number" value={vestingDurationDays} onChange={(e) => setVestingDurationDays(e.target.value)}
                    className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
                </div>
              </div>
              <p className="text-[11px] text-dim">
                {vestingTeamPercent}% of curve supply locked. {vestingCliffDays}d cliff, then linear unlock over {vestingDurationDays}d.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="surface p-3 space-y-1.5">
        <span className="text-[11px] text-dim font-medium">Presale summary</span>
        <div className="flex items-center gap-2 text-xs text-amber-400"><Clock className="w-3 h-3" /><span>Presale: {presaleDurationHours}h, cap {presaleHardCap} AVAX{presaleSoftCap ? `, min ${presaleSoftCap}` : ''}, max {presaleMaxPerWallet}/wallet</span></div>
        {whitelistEnabled && (
          <div className="flex items-center gap-2 text-xs text-blue-400"><Shield className="w-3 h-3" /><span>Whitelist: {whitelistDurationMins}min after launch</span></div>
        )}
        {vestingEnabled && (
          <div className="flex items-center gap-2 text-xs text-purple-400"><Lock className="w-3 h-3" /><span>Vesting: {vestingTeamPercent}%, {vestingCliffDays}d cliff</span></div>
        )}
      </div>

      <div className="flex items-start gap-2.5 px-4 py-3 bg-cre8-surface border border-white/[0.04] rounded-xl">
        <AlertCircle className="w-4 h-4 text-dim shrink-0 mt-0.5" />
        <p className="text-xs text-dim leading-relaxed">
          This starts a presale. After it closes, you'll execute the token launch from your dashboard — presale AVAX automatically seeds the bonding curve. Fee: <span className="text-white font-mono">{FEES.CREATION} AVAX</span>
        </p>
      </div>

      <Button onClick={handleSubmit} disabled={txLoading || !formData.name.trim() || !formData.ticker.trim()}
        className="w-full bg-amber-500 hover:bg-amber-500/90 text-black font-bold rounded-xl py-5 text-base disabled:opacity-40">
        {txLoading ? (
          <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2" />{isPending ? 'Confirming...' : 'Creating Presale...'}</>
        ) : (
          <><DollarSign className="w-4 h-4 mr-2" />Start Presale</>
        )}
      </Button>
    </div>
  );
}

// ============ Direct Launch Flow (no presale) ============

function DirectLaunchFlow({ onBack }: { onBack: () => void }) {
  const { isLoading: txLoading, isPending, execute: createForgeLaunch } = useCreateForgeLaunch();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', ticker: '', description: '', twitter: '', telegram: '', website: '',
  });

  // Optional features (no presale)
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [whitelistAddresses, setWhitelistAddresses] = useState('');
  const [whitelistDurationMins, setWhitelistDurationMins] = useState('60');
  const [vestingEnabled, setVestingEnabled] = useState(false);
  const [vestingTeamPercent, setVestingTeamPercent] = useState('10');
  const [vestingCliffDays, setVestingCliffDays] = useState('30');
  const [vestingDurationDays, setVestingDurationDays] = useState('180');

  const update = (fields: Partial<typeof formData>) => setFormData(prev => ({ ...prev, ...fields }));

  const handleSubmit = async () => {
    if (!formData.name.trim()) { toast.error('Coin name is required'); return; }
    if (!formData.ticker.trim()) { toast.error('Ticker is required'); return; }

    const whitelist = whitelistEnabled
      ? whitelistAddresses.split(/[\n,]+/).map(s => s.trim()).filter(s => /^0x[a-fA-F0-9]{40}$/.test(s))
      : [];
    if (whitelistEnabled && whitelist.length === 0) {
      toast.error('Add at least one valid whitelist address');
      return;
    }

    try {
      const safeImageURI = imagePreview?.startsWith('data:') ? '' : (imagePreview || '');

      await createForgeLaunch({
        name: formData.name,
        symbol: formData.ticker.replace('$', ''),
        description: formData.description,
        imageURI: safeImageURI,
        twitter: formData.twitter,
        telegram: formData.telegram,
        website: formData.website,
        presaleEnabled: false,
        whitelistEnabled,
        vestingEnabled,
        presaleMaxPerWallet: 0n,
        presaleDuration: 0n,
        presaleHardCap: 0n,
        presaleSoftCap: 0n,
        whitelist,
        whitelistDuration: whitelistEnabled ? BigInt(Math.round(parseFloat(whitelistDurationMins || '0') * 60)) : 0n,
        vestingTeamBps: vestingEnabled ? BigInt(Math.round(parseFloat(vestingTeamPercent || '0') * 100)) : 0n,
        vestingCliff: vestingEnabled ? BigInt(Math.round(parseFloat(vestingCliffDays || '0') * 86400)) : 0n,
        vestingDuration: vestingEnabled ? BigInt(Math.round(parseFloat(vestingDurationDays || '0') * 86400)) : 0n,
      });

      toast.success('Token launched!');
      onBack();
    } catch (err: any) {
      toast.error('Launch failed', { description: err?.shortMessage || err?.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-dim hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">Launch Token</h2>
          <p className="text-xs text-dim">Deploy a token directly — no presale. Goes live immediately on the bonding curve.</p>
        </div>
      </div>

      {/* Token Details */}
      <TokenDetailsFields
        formData={formData} update={update}
        imagePreview={imagePreview} setImagePreview={setImagePreview}
        fileInputRef={fileInputRef} socialsOpen={socialsOpen} setSocialsOpen={setSocialsOpen}
      />

      {/* Launch Options */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white">Launch Options</h3>

        {/* Whitelist */}
        <div className="surface p-5 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Whitelist Early Access</p>
                <p className="text-xs text-dim">Select wallets get early buy window</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${whitelistEnabled ? 'bg-cre8-red' : 'bg-white/[0.1]'}`}
              onClick={() => setWhitelistEnabled(!whitelistEnabled)}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${whitelistEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </div>
          </label>
          {whitelistEnabled && (
            <div className="pl-11 space-y-3">
              <div>
                <label className="text-xs text-dim mb-1 block">Duration (minutes)</label>
                <Input type="number" value={whitelistDurationMins} onChange={(e) => setWhitelistDurationMins(e.target.value)}
                  className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
                <p className="text-[11px] text-dim mt-1">Min: 5 min, Max: 1440 min (24h)</p>
              </div>
              <div>
                <label className="text-xs text-dim mb-1 block">Whitelisted addresses (one per line)</label>
                <Textarea value={whitelistAddresses} onChange={(e) => setWhitelistAddresses(e.target.value)}
                  placeholder={"0x1234...\n0xabcd..."}
                  className="bg-cre8-base border-white/[0.06] text-white placeholder:text-dim/40 rounded-lg min-h-[80px] resize-none text-xs font-mono" />
              </div>
            </div>
          )}
        </div>

        {/* Vesting */}
        <div className="surface p-5 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <Lock className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Team Vesting</p>
                <p className="text-xs text-dim">Lock team tokens with cliff + linear unlock</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${vestingEnabled ? 'bg-cre8-red' : 'bg-white/[0.1]'}`}
              onClick={() => setVestingEnabled(!vestingEnabled)}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${vestingEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </div>
          </label>
          {vestingEnabled && (
            <div className="pl-11 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-dim mb-1 block">Team % (max 20)</label>
                  <Input type="number" min={1} max={20} value={vestingTeamPercent} onChange={(e) => setVestingTeamPercent(e.target.value)}
                    className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-dim mb-1 block">Cliff (days)</label>
                  <Input type="number" value={vestingCliffDays} onChange={(e) => setVestingCliffDays(e.target.value)}
                    className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-dim mb-1 block">Vesting (days)</label>
                  <Input type="number" value={vestingDurationDays} onChange={(e) => setVestingDurationDays(e.target.value)}
                    className="bg-cre8-base border-white/[0.06] text-white rounded-lg h-9 text-sm font-mono" />
                </div>
              </div>
              <p className="text-[11px] text-dim">
                {vestingTeamPercent}% of curve supply locked. {vestingCliffDays}d cliff, then linear unlock over {vestingDurationDays}d.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      {(whitelistEnabled || vestingEnabled) && (
        <div className="surface p-3 space-y-1.5">
          <span className="text-[11px] text-dim font-medium">Launch summary</span>
          {whitelistEnabled && (
            <div className="flex items-center gap-2 text-xs text-blue-400"><Shield className="w-3 h-3" /><span>Whitelist: {whitelistDurationMins}min early access</span></div>
          )}
          {vestingEnabled && (
            <div className="flex items-center gap-2 text-xs text-purple-400"><Lock className="w-3 h-3" /><span>Vesting: {vestingTeamPercent}%, {vestingCliffDays}d cliff</span></div>
          )}
        </div>
      )}

      <div className="flex items-start gap-2.5 px-4 py-3 bg-cre8-surface border border-white/[0.04] rounded-xl">
        <AlertCircle className="w-4 h-4 text-dim shrink-0 mt-0.5" />
        <p className="text-xs text-dim leading-relaxed">
          Token launches immediately on the bonding curve. No presale — trading starts right away. Fee: <span className="text-white font-mono">{FEES.CREATION} AVAX</span>
        </p>
      </div>

      <Button onClick={handleSubmit} disabled={txLoading || !formData.name.trim() || !formData.ticker.trim()}
        className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-bold rounded-xl py-5 text-base disabled:opacity-40">
        {txLoading ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />{isPending ? 'Confirming...' : 'Launching...'}</>
        ) : (
          <><Flame className="w-4 h-4 mr-2" />Launch Token</>
        )}
      </Button>
    </div>
  );
}

// ============ Profile Editor ============

function ProfileEditor({
  profile,
  onSave,
  onCancel,
}: {
  profile: CreatorProject;
  onSave: (updated: CreatorProject) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState({ ...profile });
  const update = (fields: Partial<CreatorProject>) => setData(prev => ({ ...prev, ...fields }));

  const authenticityItems = [
    { label: 'Project name', filled: !!data.projectName.trim() },
    { label: 'Description', filled: !!data.description.trim() },
    { label: 'GitHub', filled: !!data.githubRepo.trim() },
    { label: 'Whitepaper', filled: !!data.whitepaper.trim() },
    { label: 'Website', filled: !!data.website.trim() },
    { label: 'Telegram', filled: !!data.telegram.trim() },
  ];
  const score = authenticityItems.filter(i => i.filled).length;

  return (
    <div className="space-y-5">
      {/* Authenticity Score */}
      <div className="surface p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-white">Authenticity Score</span>
          </div>
          <span className={`text-sm font-bold font-mono ${
            score >= 5 ? 'text-green-400' : score >= 3 ? 'text-amber-400' : 'text-dim'
          }`}>{score}/{authenticityItems.length}</span>
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
      </div>

      {/* Edit Form */}
      <div className="surface p-5 space-y-4">
        <div>
          <label className="block text-sm text-dim mb-1.5">Project Name <span className="text-cre8-red">*</span></label>
          <Input value={data.projectName} onChange={(e) => update({ projectName: e.target.value })}
            className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
        </div>
        <div>
          <label className="block text-sm text-dim mb-1.5">Description</label>
          <Textarea value={data.description} onChange={(e) => update({ description: e.target.value })}
            className="bg-cre8-base border-white/[0.06] text-white rounded-lg min-h-[100px]" />
          <p className="text-xs text-dim/50 mt-1">{data.description.length}/1000</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><Github className="w-3.5 h-3.5" />GitHub</label>
            <Input value={data.githubRepo} onChange={(e) => update({ githubRepo: e.target.value })} placeholder="https://github.com/..." className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><FileText className="w-3.5 h-3.5" />Whitepaper</label>
            <Input value={data.whitepaper} onChange={(e) => update({ whitepaper: e.target.value })} placeholder="https://docs..." className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><Globe className="w-3.5 h-3.5" />Website</label>
            <Input value={data.website} onChange={(e) => update({ website: e.target.value })} placeholder="https://..." className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-dim mb-1.5"><MessageCircle className="w-3.5 h-3.5" />Telegram</label>
            <Input value={data.telegram} onChange={(e) => update({ telegram: e.target.value })} placeholder="t.me/..." className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-3">
        <Button onClick={onCancel} variant="outline" className="flex-1 border-white/[0.08] text-white hover:bg-white/[0.04] rounded-xl py-5">
          <X className="w-4 h-4 mr-2" />Cancel
        </Button>
        <Button
          onClick={() => {
            if (!data.projectName.trim()) { toast.error('Project name is required'); return; }
            onSave({ ...data, isVerified: score >= 5 });
          }}
          className="flex-1 bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl py-5"
        >
          <Save className="w-4 h-4 mr-2" />Save Changes
        </Button>
      </div>
    </div>
  );
}

// ============ Presale Announcer ============

function PresaleAnnouncer({ onClose, launches }: { onClose: () => void; launches: ForgeLaunchInfo[] }) {
  const presaleLaunches = launches.filter(l => l.config.presaleEnabled);
  const [selectedLaunchId, setSelectedLaunchId] = useState<number | null>(
    presaleLaunches.length > 0 ? presaleLaunches[0].launchId : null
  );
  const [sending, setSending] = useState(false);

  const announce = async () => {
    if (selectedLaunchId === null) {
      toast.error('Select a launch to announce');
      return;
    }
    setSending(true);
    try {
      const token = localStorage.getItem('cre8_session');
      const res = await fetch(`${API_BASE}/api/presales/${selectedLaunchId}/announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        toast.success('Presale announced!', { description: `${data.notified ?? 0} followers notified.` });
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to announce presale');
      }
    } catch {
      toast.error('Failed to announce presale');
    }
    setSending(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="text-dim hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-cre8-red" />
          <h2 className="text-lg font-semibold text-white">Announce Presale</h2>
        </div>
      </div>

      <p className="text-sm text-dim">Notify all your followers about a presale. Select the Forge launch to announce.</p>

      {presaleLaunches.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-dim">No presale-enabled launches found.</p>
          <p className="text-xs text-dim/50 mt-1">Run a presale first to announce it.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {presaleLaunches.map((l) => (
              <button
                key={l.launchId}
                onClick={() => setSelectedLaunchId(l.launchId)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                  selectedLaunchId === l.launchId
                    ? 'border-cre8-red/40 bg-cre8-red/5'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-cre8-red/10 flex items-center justify-center shrink-0">
                  <Rocket className="w-4 h-4 text-cre8-red" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{l.config.name}</p>
                  <p className="text-xs text-dim">${l.config.symbol} &middot; {PHASE_LABELS[l.phase] ?? 'Unknown'}</p>
                </div>
                {selectedLaunchId === l.launchId && (
                  <Check className="w-4 h-4 text-cre8-red shrink-0" />
                )}
              </button>
            ))}
          </div>

          <Button
            onClick={announce}
            disabled={sending || selectedLaunchId === null}
            className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl py-5 disabled:opacity-50"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            ) : (
              <Megaphone className="w-4 h-4 mr-2" />
            )}
            Announce Presale
          </Button>
        </>
      )}
    </div>
  );
}

// ============ Quick Action Card ============

function ActionCard({
  icon: Icon,
  title,
  description,
  accent,
  onClick,
}: {
  icon: typeof Rocket;
  title: string;
  description: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="surface-interactive p-4 text-left group"
    >
      <div className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-cre8-red transition-colors">{title}</h3>
      <p className="text-xs text-dim leading-relaxed">{description}</p>
      <ChevronRight className="w-4 h-4 text-dim mt-2 group-hover:translate-x-1 transition-transform" />
    </button>
  );
}

// ============ Execute Launch Button ============

function ExecuteLaunchButton({ launchId }: { launchId: number }) {
  const { isLoading, isPending, execute } = useExecuteLaunch();

  const handleExecute = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await execute(launchId);
      toast.success('Token launched! Presale funds are now on the bonding curve.');
      // Reload to reflect new state
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      toast.error('Execute launch failed', { description: err?.shortMessage || err?.message });
    }
  };

  return (
    <Button
      onClick={handleExecute}
      disabled={isLoading}
      size="sm"
      className="bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20 text-xs rounded-lg px-3 h-8"
    >
      {isLoading ? (
        <div className="w-3 h-3 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin mr-1.5" />
      ) : (
        <Play className="w-3 h-3 mr-1.5" />
      )}
      {isPending ? 'Confirming...' : 'Execute Launch'}
    </Button>
  );
}

// ============ Main Dashboard ============

export function CreatorDashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, signInWithX, updateCreatorProfile } = useAuth();
  const avaxBalance = useAvaxBalance(user?.wallet?.address);
  const { launches, isLoading: launchesLoading, error: launchesError } = useCreatorForgeLaunches(user?.wallet?.address);
  const [view, setView] = useState<DashboardView>('main');

  // Check creator verification status
  const [creatorStatus, setCreatorStatus] = useState<{ isVerified: boolean; hasPending: boolean } | null>(null);
  useEffect(() => {
    if (!isAuthenticated) { setCreatorStatus(null); return; }
    const session = localStorage.getItem('cre8_session');
    if (!session) return;
    fetch(`${API_BASE}/api/creators/status`, { headers: { Authorization: `Bearer ${session}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCreatorStatus({ isVerified: data.is_verified, hasPending: data.has_pending }); })
      .catch(() => {});
  }, [isAuthenticated]);

  const profile = user?.creatorProfile;

  // Computed stats from chain data
  const totalLaunched = launches.length;
  const activePresales = launches.filter(l => l.config.presaleEnabled && l.phase <= 1).length;
  const graduated = launches.filter(l => l.phase === 4).length;
  const pendingExecute = launches.filter(l => l.phase === 1).length; // PresaleClosed = ready to execute

  // Authenticity score for display
  const authenticityItems = profile ? [
    { label: 'Project name', filled: !!profile.projectName.trim() },
    { label: 'Description', filled: !!profile.description.trim() },
    { label: 'GitHub', filled: !!profile.githubRepo.trim() },
    { label: 'Whitepaper', filled: !!profile.whitepaper.trim() },
    { label: 'Website', filled: !!profile.website.trim() },
    { label: 'Telegram', filled: !!profile.telegram.trim() },
  ] : [];
  const authenticityScore = authenticityItems.filter(i => i.filled).length;

  // Not signed in
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-cre8-red/10 flex items-center justify-center mx-auto mb-4">
            <Flame className="w-7 h-7 text-cre8-red" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Creator Dashboard</h2>
          <p className="text-sm text-dim mb-6">Sign in to access Forge Mode — launch tokens with presale, whitelist, and vesting features.</p>
          <Button onClick={signInWithX} className="bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl px-8 py-5">
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  // Not verified — show apply CTA
  if (!creatorStatus?.isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Verified Creators Only</h2>
          <p className="text-sm text-dim mb-6 leading-relaxed">
            Forge Mode is available exclusively to verified creators. Apply for verification to unlock presale, whitelist, and vesting features.
          </p>
          {creatorStatus?.hasPending ? (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">Your application is under review</span>
            </div>
          ) : (
            <Button onClick={() => navigate('/creator/apply')} className="bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl px-8 py-5">
              <Shield className="w-4 h-4 mr-2" />
              Apply for Creator Verification
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-2">

        {/* Sub-views */}
        {view === 'presale' ? (
          <PresaleSetupFlow onBack={() => setView('main')} />
        ) : view === 'launch' ? (
          <DirectLaunchFlow onBack={() => setView('main')} />
        ) : view === 'announce' ? (
          <PresaleAnnouncer onClose={() => setView('main')} launches={launches} />
        ) : view === 'edit' && profile ? (
          <ProfileEditor
            profile={profile}
            onSave={(updated) => {
              updateCreatorProfile(updated);
              setView('main');
              toast.success('Profile updated!');
            }}
            onCancel={() => setView('main')}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-bold text-white">{profile?.projectName || 'Creator Dashboard'}</h1>
                  {profile?.isVerified && (
                    <Badge className="bg-green-500/15 text-green-400 text-xs">
                      <Check className="w-3 h-3 mr-1" />Verified
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-dim">Creator Control Center</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-cre8-surface rounded-lg border border-white/[0.06]">
                  <Wallet className="w-4 h-4 text-dim" />
                  <span className="text-sm text-white font-mono">{avaxBalance.toFixed(2)} AVAX</span>
                </div>
                {profile && (
                  <Button
                    onClick={() => setView('edit')}
                    className="bg-cre8-red/10 text-cre8-red hover:bg-cre8-red/20 border border-cre8-red/30 text-sm rounded-lg"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1.5" />Edit Profile
                  </Button>
                )}
              </div>
            </div>

            {/* Profile Summary Card */}
            {profile && (
              <div className="surface p-5 mb-5">
                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-14 h-14 rounded-xl bg-cre8-red/10 flex items-center justify-center shrink-0">
                      <span className="text-xl font-bold text-cre8-red">{profile.projectName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-white truncate">{profile.projectName}</h2>
                      {profile.description && (
                        <p className="text-sm text-dim mt-1 line-clamp-2">{profile.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {profile.website && (
                          <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                            <Globe className="w-3 h-3" />Website<ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {profile.githubRepo && (
                          <a href={profile.githubRepo.startsWith('http') ? profile.githubRepo : `https://${profile.githubRepo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                            <Github className="w-3 h-3" />GitHub<ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {profile.whitepaper && (
                          <a href={profile.whitepaper.startsWith('http') ? profile.whitepaper : `https://${profile.whitepaper}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                            <FileText className="w-3 h-3" />Docs<ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {profile.telegram && (
                          <a href={profile.telegram.startsWith('http') ? profile.telegram : `https://${profile.telegram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                            <MessageCircle className="w-3 h-3" />Telegram<ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Authenticity */}
                  <div className="sm:w-44 shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-xs font-semibold text-dim uppercase tracking-wider">Trust Score</span>
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <span className={`text-3xl font-bold font-mono ${
                        authenticityScore >= 5 ? 'text-green-400' : authenticityScore >= 3 ? 'text-amber-400' : 'text-dim'
                      }`}>{authenticityScore}</span>
                      <span className="text-sm text-dim mb-1">/ {authenticityItems.length}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {authenticityItems.map((item, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${
                          item.filled ? 'bg-green-400' : 'bg-white/[0.06]'
                        }`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-dim/60 mt-2">
                      {authenticityScore >= 5 ? 'Verified creator' :
                       authenticityScore >= 3 ? 'Add more details for verification' :
                       'Complete your profile to build trust'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Execute Banner */}
            {pendingExecute > 0 && (
              <div className="mb-5 p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
                    <Play className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{pendingExecute} presale{pendingExecute > 1 ? 's' : ''} ready to launch</p>
                    <p className="text-xs text-dim">Presale closed — execute the launch to deploy the token and use presale funds.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-white font-mono">{launchesLoading ? '...' : totalLaunched}</p>
                <p className="text-xs text-dim mt-0.5">Tokens Launched</p>
              </div>
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-white font-mono">{launchesLoading ? '...' : activePresales}</p>
                <p className="text-xs text-dim mt-0.5">Active Presales</p>
              </div>
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-green-400 font-mono">{launchesLoading ? '...' : graduated}</p>
                <p className="text-xs text-dim mt-0.5">Graduated</p>
              </div>
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-cre8-red font-mono">0.00</p>
                <p className="text-xs text-dim mt-0.5">AVAX Earned</p>
              </div>
            </div>

            {/* Quick Actions — separated presale vs launch */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <ActionCard
                  icon={DollarSign}
                  title="Run Presale"
                  description="Raise funds before your token launches on the bonding curve."
                  accent="bg-amber-400/10 text-amber-400"
                  onClick={() => setView('presale')}
                />
                <ActionCard
                  icon={Flame}
                  title="Launch Token"
                  description="Deploy a token directly — goes live immediately, no presale."
                  accent="bg-cre8-red/10 text-cre8-red"
                  onClick={() => setView('launch')}
                />
                <ActionCard
                  icon={Megaphone}
                  title="Announce Presale"
                  description="Notify your followers about an active presale."
                  accent="bg-blue-400/10 text-blue-400"
                  onClick={() => setView('announce')}
                />
                <ActionCard
                  icon={Users}
                  title="View Profile"
                  description="See your public creator profile."
                  accent="bg-green-400/10 text-green-400"
                  onClick={() => navigate(`/profile/${user.wallet.address}`)}
                />
              </div>
            </div>

            {/* Creator Earnings */}
            <div className="surface p-5 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <TrendingUp className="w-4 h-4 text-cre8-red" />
                    <h3 className="font-semibold text-white text-sm">Creator Earnings</h3>
                  </div>
                  <p className="text-xs text-dim">You earn {FEES.TRADING_CREATOR * 100}% of all trading volume on your tokens.</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold text-cre8-red">0.00</p>
                  <p className="text-xs text-dim">AVAX claimable</p>
                </div>
              </div>
              <Button
                disabled
                className="mt-4 bg-white/[0.04] text-dim rounded-lg text-sm cursor-not-allowed"
              >
                No Earnings Yet
              </Button>
            </div>

            {/* Launched Tokens */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Your Tokens</h2>
                <button onClick={() => setView('launch')} className="text-xs text-cre8-red hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" />Launch New
                </button>
              </div>
              {launchesError ? (
                <div className="surface p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-sm text-white font-medium mb-1">Failed to load tokens</p>
                  <p className="text-xs text-dim mb-4">Could not connect to the blockchain. Check your network and try again.</p>
                  <Button onClick={() => window.location.reload()} className="bg-white/[0.06] hover:bg-white/[0.1] text-white text-sm rounded-lg px-6">
                    Retry
                  </Button>
                </div>
              ) : launchesLoading ? (
                <div className="surface p-8 text-center">
                  <div className="w-6 h-6 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-dim">Loading your tokens...</p>
                </div>
              ) : launches.length === 0 ? (
                <div className="surface p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                    <Rocket className="w-6 h-6 text-dim" />
                  </div>
                  <p className="text-sm text-white font-medium mb-1">No tokens launched yet</p>
                  <p className="text-xs text-dim mb-4">Run a presale or launch your first token to see it here.</p>
                  <div className="flex justify-center gap-3">
                    <Button onClick={() => setView('presale')} className="bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20 font-medium rounded-lg text-sm px-5">
                      <DollarSign className="w-3.5 h-3.5 mr-1.5" />Run Presale
                    </Button>
                    <Button onClick={() => setView('launch')} className="bg-cre8-red hover:bg-cre8-red/90 text-white font-medium rounded-lg text-sm px-5">
                      <Flame className="w-3.5 h-3.5 mr-1.5" />Launch Token
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {launches.map((l) => {
                    const isPresaleClosed = l.phase === 1;
                    const linkTo = l.token !== '0x0000000000000000000000000000000000000000'
                      ? `/token/${l.token}`
                      : `/presale/${l.launchId}`;

                    return (
                      <div key={l.launchId} className="surface-interactive flex items-center gap-3 p-4">
                        <Link to={linkTo} className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-cre8-red/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-cre8-red">{l.config.symbol.charAt(0)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{l.config.name}</p>
                            <p className="text-xs text-dim">${l.config.symbol}</p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          {isPresaleClosed && (
                            <ExecuteLaunchButton launchId={l.launchId} />
                          )}
                          <Badge className={`text-[10px] ${
                            l.phase === 4 ? 'bg-green-500/15 text-green-400' :
                            l.phase === 3 ? 'bg-blue-400/15 text-blue-400' :
                            l.phase === 1 ? 'bg-orange-400/15 text-orange-400' :
                            l.phase === 0 ? 'bg-amber-400/15 text-amber-400' :
                            'bg-white/[0.06] text-dim'
                          }`}>
                            {PHASE_LABELS[l.phase] ?? 'Unknown'}
                          </Badge>
                          <Link to={linkTo}>
                            <ChevronRight className="w-4 h-4 text-dim" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="mt-6 p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-medium mb-1">Pro Tip</p>
                  <p className="text-xs text-dim leading-relaxed">
                    Run a presale to raise funds before launching — presale AVAX automatically seeds the bonding curve
                    when you execute the launch. Use the Announce button to notify your followers.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
