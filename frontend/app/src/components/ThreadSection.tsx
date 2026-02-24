import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Send, ImageIcon, Heart, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Comment {
  id: number;
  token_address: string;
  author_address: string;
  author_name: string | null;
  author_avatar: string | null;
  content: string;
  parent_id: number | null;
  likes: number;
  liked: boolean;
  created_at: string;
  replies?: Comment[];
}

function addressToColor(address: string): [string, string] {
  const hash = address.toLowerCase().replace('0x', '');
  const hue1 = parseInt(hash.slice(0, 6), 16) % 360;
  const hue2 = (hue1 + 40 + (parseInt(hash.slice(6, 12), 16) % 80)) % 360;
  return [`hsl(${hue1}, 65%, 55%)`, `hsl(${hue2}, 65%, 45%)`];
}

function Avatar({ address, avatar, size = 32 }: { address: string; avatar?: string | null; size?: number }) {
  if (avatar) {
    return <img src={avatar} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  const [c1, c2] = addressToColor(address);
  return (
    <div className="rounded-full shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
  );
}

function formatTime(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

interface ThreadSectionProps {
  tokenAddress: string;
  tokenSymbol: string;
}

export function ThreadSection({ tokenAddress, tokenSymbol }: ThreadSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [input, setInput] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [offset, setOffset] = useState(0);

  const sessionToken = (() => {
    try { return localStorage.getItem('cre8_session'); } catch { return null; }
  })();

  const fetchComments = useCallback(async (reset = false) => {
    try {
      const o = reset ? 0 : offset;
      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${API_URL}/api/comments/${tokenAddress}?limit=20&offset=${o}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      if (reset) {
        setComments(data.comments);
        setOffset(20);
      } else {
        setComments(prev => [...prev, ...data.comments]);
        setOffset(o + 20);
      }
      setTotal(data.total);
    } catch {
      // API might not be running — fall back to empty
    } finally {
      setLoading(false);
    }
  }, [tokenAddress, offset, sessionToken]);

  useEffect(() => {
    setLoading(true);
    setComments([]);
    setOffset(0);
    fetchComments(true);
  }, [tokenAddress]);

  const handleSend = async () => {
    if (!input.trim() || !user || !sessionToken || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`${API_URL}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ token_address: tokenAddress, content: input.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      const comment = await res.json();
      setComments(prev => [comment, ...prev]);
      setTotal(t => t + 1);
      setInput('');
    } catch { /* ignore */ }
    finally { setPosting(false); }
  };

  const handleLike = async (commentId: number) => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      if (!res.ok) return;
      const { liked } = await res.json();
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, liked, likes: liked ? c.likes + 1 : c.likes - 1 } : c
      ));
    } catch { /* ignore */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const sorted = sortBy === 'oldest' ? [...comments].reverse() : comments;
  const hasMore = comments.length < total;

  return (
    <div>
      {/* Compose */}
      <div className="p-4 border-b border-white/[0.06]">
        {isAuthenticated && user ? (
          <div className="flex items-start gap-3">
            <Avatar address={user.wallet.address} avatar={user.xAvatar} size={32} />
            <div className="flex-1">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Add a comment..." rows={1} maxLength={500}
                className="w-full bg-cre8-base border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-dim/40 resize-none focus:outline-none focus:border-white/[0.12] transition-colors" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-dim">{input.length}/500</span>
                <button onClick={handleSend} disabled={!input.trim() || posting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cre8-red/10 hover:bg-cre8-red/20 text-cre8-red text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  {posting ? <div className="w-3 h-3 border border-cre8-red/30 border-t-cre8-red rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
                  Post
                </button>
              </div>
            </div>
            <div className="relative shrink-0">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-cre8-base border border-white/[0.06] rounded-lg px-3 py-1.5 pr-7 text-xs text-dim cursor-pointer focus:outline-none hover:text-white transition-colors">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-dim pointer-events-none" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/[0.06] shrink-0" />
            <div className="flex-1 bg-cre8-base border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-dim/40">
              Sign in to comment
            </div>
            <div className="relative shrink-0">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-cre8-base border border-white/[0.06] rounded-lg px-3 py-1.5 pr-7 text-xs text-dim cursor-pointer focus:outline-none hover:text-white transition-colors">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-dim pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-5 h-5 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-dim">Loading comments...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 text-dim/30" />
            <p className="text-dim text-sm">No comments yet</p>
            <p className="text-dim/60 text-xs mt-1">Be the first to comment on ${tokenSymbol}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {sorted.map((msg) => (
              <div key={msg.id} className="px-4 py-3 hover:bg-white/[0.015] transition-colors">
                <div className="flex items-start gap-3">
                  <Avatar address={msg.author_address} avatar={msg.author_avatar} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white text-xs font-medium truncate">
                        {msg.author_name || `${msg.author_address.slice(0, 8)}...${msg.author_address.slice(-4)}`}
                      </span>
                      <span className="text-dim/40 text-[10px]">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-sm text-white/80 whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    <div className="flex items-center gap-4 mt-1.5">
                      <button onClick={() => handleLike(msg.id)}
                        className={`flex items-center gap-1 text-[11px] transition-colors ${msg.liked ? 'text-cre8-red' : 'text-dim hover:text-white'}`}>
                        <Heart className={`w-3 h-3 ${msg.liked ? 'fill-cre8-red' : ''}`} />
                        <span>{msg.likes}</span>
                      </button>
                    </div>
                    {/* Replies */}
                    {msg.replies && msg.replies.length > 0 && (
                      <div className="mt-2 pl-3 border-l border-white/[0.06] space-y-2">
                        {msg.replies.map(reply => (
                          <div key={reply.id} className="flex items-start gap-2">
                            <Avatar address={reply.author_address} avatar={reply.author_avatar} size={20} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white text-[11px] font-medium">{reply.author_name || `${reply.author_address.slice(0, 6)}...`}</span>
                                <span className="text-dim/40 text-[9px]">{formatTime(reply.created_at)}</span>
                              </div>
                              <p className="text-xs text-white/70">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <button onClick={() => fetchComments(false)}
            className="w-full py-3 text-center text-xs text-dim hover:text-white transition-colors border-t border-white/[0.04] flex items-center justify-center gap-1.5">
            <ChevronDown className="w-3 h-3" />
            Older activity
          </button>
        )}
      </div>
    </div>
  );
}
