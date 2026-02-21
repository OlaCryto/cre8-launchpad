import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Zap, Users, Bell, Check, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// ============ Types ============

type NotificationType = 'launch' | 'presale' | 'graduation' | 'whale' | 'system';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  creatorName?: string;
  timestamp: number;
  read: boolean;
}

// ============ Constants ============

const TYPE_META: Record<NotificationType, { icon: typeof Rocket; color: string; bg: string }> = {
  launch:     { icon: Rocket, color: 'text-cre8-red', bg: 'bg-cre8-red/10' },
  presale:    { icon: Users,  color: 'text-blue-400', bg: 'bg-blue-400/10' },
  graduation: { icon: Zap,    color: 'text-green-400', bg: 'bg-green-400/10' },
  whale:      { icon: Zap,    color: 'text-amber-400', bg: 'bg-amber-400/10' },
  system:     { icon: Bell,   color: 'text-dim',       bg: 'bg-white/[0.04]' },
};

const FILTER_LABELS: { key: 'all' | NotificationType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'launch', label: 'Launches' },
  { key: 'presale', label: 'Presales' },
  { key: 'graduation', label: 'Graduations' },
];

// ============ Helpers ============

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ============ Component ============

export function InboxPage() {
  const { isAuthenticated } = useAuth();
  const [filter, setFilter] = useState<'all' | NotificationType>('all');

  // Placeholder — will be replaced with real data from backend / on-chain events
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'launch',
      title: 'New Token Launched',
      body: 'A new token $EXAMPLE has been launched on the bonding curve.',
      tokenSymbol: 'EXAMPLE',
      tokenAddress: '0x0000000000000000000000000000000000000000',
      creatorName: 'LogiqOS',
      timestamp: Date.now() - 300000,
      read: false,
    },
    {
      id: '2',
      type: 'presale',
      title: 'Presale Starting Soon',
      body: 'The presale for $FORGE is starting in 2 hours. Get whitelisted now.',
      tokenSymbol: 'FORGE',
      tokenAddress: '0x0000000000000000000000000000000000000000',
      timestamp: Date.now() - 7200000,
      read: false,
    },
    {
      id: '3',
      type: 'graduation',
      title: 'Token Graduated!',
      body: '$MOON has reached the graduation threshold and is now live on TraderJoe.',
      tokenSymbol: 'MOON',
      tokenAddress: '0x0000000000000000000000000000000000000000',
      timestamp: Date.now() - 86400000,
      read: true,
    },
    {
      id: '4',
      type: 'system',
      title: 'Welcome to Cre8',
      body: 'Your account is set up. Start creating tokens or browse the feed.',
      timestamp: Date.now() - 172800000,
      read: true,
    },
  ]);

  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const markRead = (id: string) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const removeNotification = (id: string) =>
    setNotifications(prev => prev.filter(n => n.id !== id));

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
            <Bell className="w-7 h-7 text-dim" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Sign in to view your inbox</h2>
          <p className="text-sm text-dim">Get notified about launches, presales, and more.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Inbox</h1>
            {unreadCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cre8-red text-white">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs text-dim hover:text-white transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto no-scrollbar">
          {FILTER_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === key
                  ? 'bg-cre8-red text-white'
                  : 'bg-white/[0.04] text-dim hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Notifications list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6 text-dim" />
            </div>
            <p className="text-sm text-dim">No notifications yet</p>
            <p className="text-xs text-dim/50 mt-1">You'll be notified when creators launch tokens or start presales.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((notif) => {
              const meta = TYPE_META[notif.type];
              const Icon = meta.icon;
              return (
                <div
                  key={notif.id}
                  onClick={() => markRead(notif.id)}
                  className={`group relative flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                    notif.read
                      ? 'border-white/[0.04] bg-transparent hover:bg-white/[0.02]'
                      : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Unread dot */}
                  {!notif.read && (
                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-cre8-red" />
                  )}

                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`w-4.5 h-4.5 ${meta.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm font-semibold truncate ${notif.read ? 'text-white/70' : 'text-white'}`}>
                        {notif.title}
                      </p>
                    </div>
                    <p className={`text-xs leading-relaxed ${notif.read ? 'text-dim/60' : 'text-dim'}`}>
                      {notif.body}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-dim/50">{timeAgo(notif.timestamp)}</span>
                      {notif.tokenSymbol && notif.tokenAddress && (
                        <Link
                          to={`/token/${notif.tokenAddress}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-cre8-red hover:underline font-medium"
                        >
                          View ${notif.tokenSymbol}
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-dim hover:text-red-400 transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
