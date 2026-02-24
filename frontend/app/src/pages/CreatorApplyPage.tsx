import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, CheckCircle2, Clock, XCircle, ChevronDown, ArrowLeft } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CATEGORIES = [
  { value: 'defi', label: 'DeFi' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'nft', label: 'NFT / Collectibles' },
  { value: 'social', label: 'Social' },
  { value: 'utility', label: 'Utility' },
  { value: 'content', label: 'Content / Media' },
  { value: 'music', label: 'Music' },
  { value: 'art', label: 'Art' },
  { value: 'dao', label: 'DAO / Governance' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'other', label: 'Other' },
];

interface ApplicationStatus {
  is_verified: boolean;
  has_pending: boolean;
  application: { id: number; project_name: string; category: string; approved_at: string } | null;
}

interface Application {
  id: number;
  project_name: string;
  category: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export function CreatorApplyPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const sessionToken = localStorage.getItem('cre8_session');

  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    project_name: '',
    category: '',
    description: '',
    website: '',
    product_proof: '',
    twitter: '',
    telegram: '',
    discord: '',
    youtube: '',
    team_info: '',
    token_utility: '',
    roadmap: '',
  });

  useEffect(() => {
    if (!isAuthenticated || !sessionToken) return;

    Promise.all([
      fetch(`${API_URL}/api/creators/status`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      }).then(r => r.json()),
      fetch(`${API_URL}/api/creators/my-applications`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      }).then(r => r.json()),
    ]).then(([statusData, appsData]) => {
      setStatus(statusData);
      setApplications(appsData.applications || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthenticated, sessionToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/creators/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit application');
        return;
      }

      setSuccess(true);
      setStatus(prev => prev ? { ...prev, has_pending: true } : prev);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Shield className="w-16 h-16 mx-auto text-emerald-400 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Become a Verified Creator</h1>
        <p className="text-zinc-400 mb-6">Sign in to apply for creator verification.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  // Already verified
  if (status?.is_verified) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-zinc-400 hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-zinc-900 border border-emerald-500/30 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-400 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">You're a Verified Creator</h1>
          <p className="text-zinc-400 mb-2">Project: <span className="text-white">{status.application?.project_name}</span></p>
          <p className="text-zinc-500 text-sm mb-6">Category: {status.application?.category}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/create')} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors">
              Launch Creator Token
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Has pending application
  if (status?.has_pending || success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-zinc-400 hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-zinc-900 border border-amber-500/30 rounded-xl p-8 text-center">
          <Clock className="w-16 h-16 mx-auto text-amber-400 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Application Under Review</h1>
          <p className="text-zinc-400 mb-6">We're reviewing your creator application. This typically takes 24-48 hours.</p>
        </div>

        {applications.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-zinc-400">Your Applications</h3>
            {applications.map(app => (
              <div key={app.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium">{app.project_name}</span>
                  <StatusBadge status={app.status} />
                </div>
                <p className="text-xs text-zinc-500">{app.category} &middot; Applied {new Date(app.created_at).toLocaleDateString()}</p>
                {app.admin_notes && (
                  <p className="mt-2 text-xs text-zinc-400 bg-zinc-800 rounded p-2">{app.admin_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Application form
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-zinc-400 hover:text-white mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white">Become a Verified Creator</h1>
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Verified creators can launch tokens in <span className="text-emerald-400 font-medium">Forge Mode</span> with whitelist, 
          presale, and vesting features. Your tokens get a verified badge, 
          building trust with your community.
        </p>
      </div>

      {/* Rejected applications */}
      {applications.filter(a => a.status === 'rejected').length > 0 && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400 font-medium">Previous application was rejected</span>
          </div>
          {applications.filter(a => a.status === 'rejected').map(a => (
            a.admin_notes && <p key={a.id} className="text-xs text-zinc-400 mt-1">Reason: {a.admin_notes}</p>
          ))}
          <p className="text-xs text-zinc-500 mt-1">You can reapply below.</p>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Project Name */}
        <FormField label="Project Name" required>
          <input
            type="text"
            value={form.project_name}
            onChange={e => updateField('project_name', e.target.value)}
            placeholder="e.g., CoolApp"
            className="form-input"
            required
            maxLength={100}
          />
        </FormField>

        {/* Category */}
        <FormField label="Category" required>
          <div className="relative">
            <select
              value={form.category}
              onChange={e => updateField('category', e.target.value)}
              className="form-input appearance-none pr-10"
              required
            >
              <option value="">Select a category</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          </div>
        </FormField>

        {/* Description */}
        <FormField label="Project Description" required hint="Min 20 characters. What does your project do?">
          <textarea
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
            placeholder="Describe your project, what it does, and why it matters..."
            className="form-input min-h-[100px] resize-y"
            required
            maxLength={2000}
          />
          <p className="text-[10px] text-zinc-600 mt-1 text-right">{form.description.length}/2000</p>
        </FormField>

        {/* Token Utility */}
        <FormField label="Token Utility" required hint="What will the token be used for?">
          <textarea
            value={form.token_utility}
            onChange={e => updateField('token_utility', e.target.value)}
            placeholder="How will holders use the token? Governance, access, rewards, in-app currency..."
            className="form-input min-h-[80px] resize-y"
            required
            maxLength={1000}
          />
        </FormField>

        {/* Website & Product Proof */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Website">
            <input type="url" value={form.website} onChange={e => updateField('website', e.target.value)} placeholder="https://yourproject.com" className="form-input" />
          </FormField>
          <FormField label="Product Proof" hint="Link to working product, demo, or app store">
            <input type="url" value={form.product_proof} onChange={e => updateField('product_proof', e.target.value)} placeholder="https://app.yourproject.com" className="form-input" />
          </FormField>
        </div>

        {/* Social Links */}
        <div className="border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-500 mb-3">Social Links (at least one recommended)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Twitter / X">
              <input type="text" value={form.twitter} onChange={e => updateField('twitter', e.target.value)} placeholder="@handle or URL" className="form-input" />
            </FormField>
            <FormField label="Telegram">
              <input type="text" value={form.telegram} onChange={e => updateField('telegram', e.target.value)} placeholder="@group or URL" className="form-input" />
            </FormField>
            <FormField label="Discord">
              <input type="url" value={form.discord} onChange={e => updateField('discord', e.target.value)} placeholder="https://discord.gg/..." className="form-input" />
            </FormField>
            <FormField label="YouTube">
              <input type="url" value={form.youtube} onChange={e => updateField('youtube', e.target.value)} placeholder="https://youtube.com/..." className="form-input" />
            </FormField>
          </div>
        </div>

        {/* Team Info */}
        <FormField label="Team Info" hint="Brief description of your team (optional)">
          <textarea
            value={form.team_info}
            onChange={e => updateField('team_info', e.target.value)}
            placeholder="Who's on the team? Background, experience..."
            className="form-input min-h-[60px] resize-y"
            maxLength={1000}
          />
        </FormField>

        {/* Roadmap */}
        <FormField label="Roadmap" hint="Brief plans for the token and project (optional)">
          <textarea
            value={form.roadmap}
            onChange={e => updateField('roadmap', e.target.value)}
            placeholder="Key milestones, upcoming features, timeline..."
            className="form-input min-h-[60px] resize-y"
            maxLength={1000}
          />
        </FormField>

        <div className="border-t border-zinc-800 pt-5">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-lg transition-colors text-sm"
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
          <p className="text-[10px] text-zinc-600 text-center mt-2">
            Applications are typically reviewed within 24-48 hours.
          </p>
        </div>
      </form>

      <style>{`
        .form-input {
          width: 100%;
          background: rgb(24 24 27);
          border: 1px solid rgb(39 39 42);
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          color: white;
          font-size: 0.8125rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus {
          border-color: rgb(52 211 153 / 0.5);
        }
        .form-input::placeholder {
          color: rgb(63 63 70);
        }
        .form-input option {
          background: rgb(24 24 27);
          color: white;
        }
      `}</style>
    </div>
  );
}

function FormField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
        {label} {required && <span className="text-emerald-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  }[status] || 'bg-zinc-800 text-zinc-400 border-zinc-700';

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${styles}`}>
      {status}
    </span>
  );
}
