import { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle2, XCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Application {
  id: number;
  user_id: string;
  wallet_address: string;
  project_name: string;
  category: string;
  description: string;
  website: string | null;
  product_proof: string | null;
  twitter: string | null;
  telegram: string | null;
  discord: string | null;
  youtube: string | null;
  team_info: string | null;
  token_utility: string | null;
  roadmap: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export function AdminPage() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('cre8_admin_key') || '');
  const [authenticated, setAuthenticated] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  const headers = { 'x-admin-key': apiKey };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, appsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/applications/stats`, { headers }),
        fetch(`${API_URL}/api/admin/applications?status=${filter}`, { headers }),
      ]);

      if (!statsRes.ok || !appsRes.ok) {
        setAuthenticated(false);
        return;
      }

      setStats(await statsRes.json());
      const appsData = await appsRes.json();
      setApplications(appsData.applications || []);
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [apiKey, filter]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('cre8_admin_key', apiKey);
    fetchData();
  };

  useEffect(() => {
    if (apiKey) fetchData();
  }, [filter]);

  const handleReview = async (id: number, decision: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`${API_URL}/api/admin/applications/${id}/review`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: reviewNotes[id] || '' }),
      });

      if (res.ok) {
        fetchData();
        setExpanded(null);
      }
    } catch { /* ignore */ }
  };

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <Shield className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white text-center mb-4">Admin Dashboard</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Admin API Key"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm mb-3 outline-none focus:border-emerald-500/50"
            />
            <button type="submit" className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-sm">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Creator Applications</h1>
        <button onClick={fetchData} disabled={loading} className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 border border-zinc-700 rounded-lg">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard label="Pending" value={stats.pending} color="text-amber-400" />
          <StatCard label="Approved" value={stats.approved} color="text-emerald-400" />
          <StatCard label="Rejected" value={stats.rejected} color="text-red-400" />
          <StatCard label="Total" value={stats.total} color="text-white" />
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['pending', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              filter === f ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-zinc-700 text-zinc-400 hover:text-white'
            }`}
          >
            {f === 'pending' ? 'Pending Review' : 'All Applications'}
          </button>
        ))}
      </div>

      {/* Applications */}
      {applications.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          {filter === 'pending' ? 'No pending applications' : 'No applications yet'}
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map(app => (
            <div key={app.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpanded(expanded === app.id ? null : app.id)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm truncate">{app.project_name}</span>
                      <StatusBadge status={app.status} />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {app.category} &middot; {app.wallet_address.slice(0, 6)}...{app.wallet_address.slice(-4)} &middot; {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {expanded === app.id ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
              </button>

              {/* Expanded details */}
              {expanded === app.id && (
                <div className="border-t border-zinc-800 p-4 space-y-3">
                  <DetailRow label="Description" value={app.description} />
                  <DetailRow label="Token Utility" value={app.token_utility} />
                  {app.website && <DetailRow label="Website" value={app.website} isLink />}
                  {app.product_proof && <DetailRow label="Product Proof" value={app.product_proof} isLink />}
                  {app.twitter && <DetailRow label="Twitter" value={app.twitter} />}
                  {app.telegram && <DetailRow label="Telegram" value={app.telegram} />}
                  {app.discord && <DetailRow label="Discord" value={app.discord} isLink />}
                  {app.youtube && <DetailRow label="YouTube" value={app.youtube} isLink />}
                  {app.team_info && <DetailRow label="Team" value={app.team_info} />}
                  {app.roadmap && <DetailRow label="Roadmap" value={app.roadmap} />}

                  <div className="text-[10px] text-zinc-600 font-mono">
                    Wallet: {app.wallet_address}
                  </div>

                  {app.status === 'pending' && (
                    <div className="border-t border-zinc-800 pt-3 space-y-2">
                      <textarea
                        value={reviewNotes[app.id] || ''}
                        onChange={e => setReviewNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                        placeholder="Admin notes (visible to applicant)..."
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-xs min-h-[60px] resize-y outline-none focus:border-emerald-500/50"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(app.id, 'approved')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleReview(app.id, 'rejected')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-lg text-xs border border-red-500/20"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-600">
                        After approval, call <code className="text-zinc-400">setVerified(wallet, true)</code> on the CreatorRegistry contract.
                      </p>
                    </div>
                  )}

                  {app.status !== 'pending' && app.admin_notes && (
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-[10px] text-zinc-500 mb-1">Admin Notes</p>
                      <p className="text-xs text-zinc-300">{app.admin_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
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

function DetailRow({ label, value, isLink }: { label: string; value: string | null; isLink?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] text-zinc-500 mb-0.5">{label}</p>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
          {value} <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <p className="text-xs text-zinc-300 whitespace-pre-wrap">{value}</p>
      )}
    </div>
  );
}
