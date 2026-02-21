import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Rocket, Shield, Check, Globe, MessageCircle, Github, FileText,
  Edit, Save, X, Megaphone, Plus, ExternalLink, Wallet,
  TrendingUp, Award, ChevronRight, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAuth, type CreatorProject } from '@/contexts/AuthContext';
import { useAvaxBalance } from '@/hooks/useContracts';
import { FEES } from '@/config/wagmi';

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
          <Input
            value={data.projectName}
            onChange={(e) => update({ projectName: e.target.value })}
            className="bg-cre8-base border-white/[0.06] text-white rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-dim mb-1.5">Description</label>
          <Textarea
            value={data.description}
            onChange={(e) => update({ description: e.target.value })}
            className="bg-cre8-base border-white/[0.06] text-white rounded-lg min-h-[100px]"
          />
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

function PresaleAnnouncer({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    tokenName: '',
    ticker: '',
    target: '50',
    maxPerWallet: '5',
    duration: '48',
    description: '',
    whitelistOnly: false,
  });

  const update = (fields: Partial<typeof form>) => setForm(prev => ({ ...prev, ...fields }));

  return (
    <div className="surface p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-cre8-red" />
          <h2 className="text-base font-semibold text-white">Announce Presale</h2>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-dim hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-sm text-dim">Let your community know you're launching a presale. This will notify all followers.</p>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dim mb-1.5">Token Name</label>
            <Input value={form.tokenName} onChange={(e) => update({ tokenName: e.target.value })} placeholder="e.g. MoonToken" className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
          <div>
            <label className="block text-sm text-dim mb-1.5">Ticker</label>
            <Input value={form.ticker} onChange={(e) => update({ ticker: e.target.value })} placeholder="$MOON" className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-dim mb-1.5">Announcement Message</label>
          <Textarea
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Tell your community what the presale is about..."
            className="bg-cre8-base border-white/[0.06] text-white rounded-lg min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-dim mb-1.5">Target (AVAX)</label>
            <Input type="number" value={form.target} onChange={(e) => update({ target: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
          <div>
            <label className="block text-sm text-dim mb-1.5">Max/Wallet</label>
            <Input type="number" value={form.maxPerWallet} onChange={(e) => update({ maxPerWallet: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white rounded-lg" />
          </div>
          <div>
            <label className="block text-sm text-dim mb-1.5">Duration</label>
            <div className="relative">
              <Input type="number" value={form.duration} onChange={(e) => update({ duration: e.target.value })} className="bg-cre8-base border-white/[0.06] text-white rounded-lg pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dim text-xs">hrs</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-cre8-base rounded-lg border border-white/[0.04]">
          <div>
            <p className="text-sm text-white font-medium">Whitelist Only</p>
            <p className="text-xs text-dim">Restrict presale to whitelisted addresses</p>
          </div>
          <Switch checked={form.whitelistOnly} onCheckedChange={(v) => update({ whitelistOnly: v })} />
        </div>
      </div>

      <Button
        onClick={() => {
          if (!form.tokenName.trim() || !form.ticker.trim()) {
            toast.error('Token name and ticker are required');
            return;
          }
          toast.success('Presale announced!', { description: `${form.ticker} presale will be visible to your followers.` });
          onClose();
        }}
        className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl py-5"
      >
        <Megaphone className="w-4 h-4 mr-2" />Announce Presale
      </Button>
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

// ============ Main Dashboard ============

export function CreatorDashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateCreatorProfile } = useAuth();
  const avaxBalance = useAvaxBalance(user?.wallet?.address);
  const [editing, setEditing] = useState(false);
  const [showPresale, setShowPresale] = useState(false);

  const profile = user?.creatorProfile;

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

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-dim" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Sign in to access your dashboard</h2>
          <p className="text-sm text-dim">Create a Forge profile to unlock the creator control center.</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-cre8-red/10 flex items-center justify-center mx-auto mb-4">
            <Rocket className="w-7 h-7 text-cre8-red" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No Creator Profile Yet</h2>
          <p className="text-sm text-dim mb-6">Create your Forge profile first to access the dashboard.</p>
          <Button onClick={() => navigate('/create')} className="bg-cre8-red hover:bg-cre8-red/90 text-white font-semibold rounded-xl px-8 py-5">
            <Plus className="w-4 h-4 mr-2" />Create Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-2">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-white">{profile.projectName}</h1>
              {profile.isVerified && (
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
            <Button
              onClick={() => setEditing(true)}
              className="bg-cre8-red/10 text-cre8-red hover:bg-cre8-red/20 border border-cre8-red/30 text-sm rounded-lg"
            >
              <Edit className="w-3.5 h-3.5 mr-1.5" />Edit Profile
            </Button>
          </div>
        </div>

        {/* Editing mode */}
        {editing ? (
          <ProfileEditor
            profile={profile}
            onSave={(updated) => {
              updateCreatorProfile(updated);
              setEditing(false);
              toast.success('Profile updated!');
            }}
            onCancel={() => setEditing(false)}
          />
        ) : showPresale ? (
          <PresaleAnnouncer onClose={() => setShowPresale(false)} />
        ) : (
          <>
            {/* Profile Summary Card */}
            <div className="surface p-5 mb-5">
              <div className="flex flex-col sm:flex-row gap-5">
                {/* Avatar + info */}
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
                          <Globe className="w-3 h-3" />Website
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {profile.githubRepo && (
                        <a href={profile.githubRepo.startsWith('http') ? profile.githubRepo : `https://${profile.githubRepo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                          <Github className="w-3 h-3" />GitHub
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {profile.whitepaper && (
                        <a href={profile.whitepaper.startsWith('http') ? profile.whitepaper : `https://${profile.whitepaper}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                          <FileText className="w-3 h-3" />Docs
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {profile.telegram && (
                        <a href={profile.telegram.startsWith('http') ? profile.telegram : `https://${profile.telegram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                          <MessageCircle className="w-3 h-3" />Telegram
                          <ExternalLink className="w-2.5 h-2.5" />
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

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-white font-mono">0</p>
                <p className="text-xs text-dim mt-0.5">Tokens Launched</p>
              </div>
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-white font-mono">0</p>
                <p className="text-xs text-dim mt-0.5">Active Presales</p>
              </div>
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-green-400 font-mono">0</p>
                <p className="text-xs text-dim mt-0.5">Graduated</p>
              </div>
              <div className="surface p-4 text-center">
                <p className="text-2xl font-bold text-cre8-red font-mono">0.00</p>
                <p className="text-xs text-dim mt-0.5">AVAX Earned</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ActionCard
                  icon={Rocket}
                  title="Launch Token"
                  description="Deploy a new token on the bonding curve with full Forge features."
                  accent="bg-cre8-red/10 text-cre8-red"
                  onClick={() => navigate('/create')}
                />
                <ActionCard
                  icon={Megaphone}
                  title="Announce Presale"
                  description="Notify your community about an upcoming presale event."
                  accent="bg-blue-400/10 text-blue-400"
                  onClick={() => setShowPresale(true)}
                />
                <ActionCard
                  icon={Users}
                  title="View Profile"
                  description="See how your public profile looks to the community."
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

            {/* Launched Tokens (empty state) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Your Tokens</h2>
                <Link to="/create" className="text-xs text-cre8-red hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" />Launch New
                </Link>
              </div>
              <div className="surface p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                  <Rocket className="w-6 h-6 text-dim" />
                </div>
                <p className="text-sm text-white font-medium mb-1">No tokens launched yet</p>
                <p className="text-xs text-dim mb-4">Launch your first token to see it here.</p>
                <Button onClick={() => navigate('/create')} className="bg-cre8-red hover:bg-cre8-red/90 text-white font-medium rounded-lg text-sm px-6">
                  <Rocket className="w-3.5 h-3.5 mr-1.5" />Launch Your First Token
                </Button>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-6 p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-medium mb-1">Pro Tip</p>
                  <p className="text-xs text-dim leading-relaxed">
                    Complete all profile fields to earn a verified badge. Verified creators get higher visibility
                    in the feed and build more trust with buyers. Projects with a GitHub repo and whitepaper
                    see 3x more participation.
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
