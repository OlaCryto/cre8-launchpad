import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import {
  IconHome,
  IconPlus,
  IconUser,
  IconWallet,
  IconBriefcase,
  IconInbox,
  IconLayoutDashboard,
  IconKey,
  IconLogout,
  IconAlertTriangle,
  IconCopy,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconX,
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function Sidebar() {
  const location = useLocation();
  const { user, isAuthenticated, isLoading, signInWithX, signOut, devLogin } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [pkModal, setPkModal] = useState<'closed' | 'warning' | 'revealed'>('closed');
  const [pkCopied, setPkCopied] = useState(false);
  const [pkVisible, setPkVisible] = useState(false);
  const [exportedKey, setExportedKey] = useState<string>('');
  const [pkExporting, setPkExporting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll for unread notification count
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchUnread = async () => {
      try {
        const token = localStorage.getItem('cre8_session');
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/notifications?limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unread ?? 0);
        }
      } catch { /* ignore */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const navItems = [
    { path: '/', icon: IconHome, label: 'Home' },
    { path: '/create', icon: IconPlus, label: 'Create' },
    { path: '/portfolio', icon: IconBriefcase, label: 'Portfolio' },
    ...(isAuthenticated ? [
      { path: '/inbox', icon: IconInbox, label: 'Inbox', badge: unreadCount },
      { path: '/creator/dashboard', icon: IconLayoutDashboard, label: 'Forge' },
    ] : []),
  ];

  const handleSignIn = async () => {
    try {
      await signInWithX();
      toast.success('Signed in successfully!');
    } catch {
      toast.error('Failed to sign in. Try again.');
    }
  };

  const handleDevLogin = async () => {
    try {
      await devLogin();
      toast.success('Dev login successful!');
    } catch {
      toast.error('Dev login failed.');
    }
  };

  const isDev = import.meta.env.DEV;

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <>
      {/* Sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-[68px] bg-cre8-base border-r border-white/[0.06] flex-col items-center py-5 z-50">
        {/* Logo */}
        <Link to="/" className="mb-8 group">
          <img
            src="/logo-icon.png"
            alt="Cre8"
            className="w-9 h-9 object-contain transition-transform duration-200 group-hover:scale-110"
          />
        </Link>

        {/* Nav Items */}
        <nav className="flex-1 flex flex-col items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-cre8-red/15 text-cre8-red'
                    : 'text-dim hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Icon size={20} stroke={isActive ? 2 : 1.5} />
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-cre8-red rounded-r-full" />
                )}
                {'badge' in item && (item as any).badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-cre8-red text-white text-[9px] font-bold flex items-center justify-center">
                    {(item as any).badge > 99 ? '99+' : (item as any).badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom — Profile */}
        <div className="mt-auto flex flex-col items-center gap-2">
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-10 h-10 rounded-xl overflow-hidden border-2 border-transparent hover:border-white/[0.12] transition-colors"
                title={user.xHandle}
              >
                <img src={user.xAvatar} alt={user.xName} className="w-full h-full object-cover rounded-lg" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute bottom-0 left-full ml-2 w-56 bg-cre8-surface border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                    <div className="px-3 py-2.5 border-b border-white/[0.06]">
                      <p className="text-white font-medium text-sm">{user.xName}</p>
                      <p className="text-xs text-dim">{user.xHandle}</p>
                    </div>
                    <div className="px-3 py-2.5 border-b border-white/[0.06]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <IconWallet size={12} className="text-dim" />
                        <span className="text-xs text-dim">Wallet</span>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(user.wallet.address);
                          toast.success('Address copied!');
                        }}
                        className="text-sm text-white font-mono hover:text-cre8-red transition-colors"
                      >
                        {truncateAddress(user.wallet.address)}
                      </button>
                    </div>
                    <div className="p-1.5">
                      <Link
                        to={`/profile/${user.wallet.address}`}
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-dim hover:text-white hover:bg-white/[0.04] transition-colors"
                      >
                        <IconUser size={16} />
                        <span className="text-sm">Profile</span>
                      </Link>
                      <button
                        onClick={() => {
                          setPkModal('warning');
                          setPkCopied(false);
                          setPkVisible(false);
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-dim hover:text-white hover:bg-white/[0.04] transition-colors"
                      >
                        <IconKey size={16} />
                        <span className="text-sm">Export Private Key</span>
                      </button>
                      <button
                        onClick={() => {
                          signOut();
                          setShowUserMenu(false);
                          toast.success('Signed out');
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <IconLogout size={16} />
                        <span className="text-sm">Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={handleSignIn}
                disabled={isLoading}
                title="Sign In"
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-cre8-red/15 text-cre8-red hover:bg-cre8-red/25 transition-colors"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin" />
                ) : (
                  <IconUser size={20} stroke={1.5} />
                )}
              </button>
              {isDev && (
                <button
                  onClick={handleDevLogin}
                  disabled={isLoading}
                  title="Dev Login (bypass X)"
                  className="w-10 h-7 rounded-lg flex items-center justify-center bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors text-[9px] font-bold"
                >
                  DEV
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-nav border-t border-white/[0.06] border-b-0">
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 ${
                  isActive ? 'text-cre8-red' : 'text-dim'
                }`}
              >
                <Icon size={20} stroke={isActive ? 2 : 1.5} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {'badge' in item && (item as any).badge > 0 && (
                  <span className="absolute top-0 right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-cre8-red text-white text-[8px] font-bold flex items-center justify-center">
                    {(item as any).badge > 99 ? '99+' : (item as any).badge}
                  </span>
                )}
              </Link>
            );
          })}
          {isAuthenticated && user ? (
            <Link
              to={`/profile/${user.wallet.address}`}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 ${
                location.pathname.startsWith('/profile') ? 'text-cre8-red' : 'text-dim'
              }`}
            >
              <img src={user.xAvatar} alt="" className="w-5 h-5 rounded-full object-cover" />
              <span className="text-[10px] font-medium">Profile</span>
            </Link>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-dim"
            >
              <IconUser size={20} stroke={1.5} />
              <span className="text-[10px] font-medium">Sign In</span>
            </button>
          )}
        </div>
      </nav>

      {/* Private Key Modal */}
      {pkModal !== 'closed' && user && createPortal(
        <div className="fixed inset-0 z-[9999]">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setPkModal('closed'); setExportedKey(''); }} />
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-cre8-surface border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              {pkModal === 'warning' ? (
                <>
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                      <IconAlertTriangle size={24} className="text-amber-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-3">Export Private Key</h3>
                    <div className="space-y-2.5 text-sm text-dim text-left">
                      <p className="flex items-start gap-2">
                        <span className="text-red-400 font-mono text-xs mt-0.5">1.</span>
                        <span><strong className="text-white">Never share</strong> your private key with anyone.</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="text-red-400 font-mono text-xs mt-0.5">2.</span>
                        <span><strong className="text-white">Store it securely</strong> offline. Not in screenshots or messages.</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="text-red-400 font-mono text-xs mt-0.5">3.</span>
                        <span><strong className="text-white">Cre8 will never</strong> ask for your private key.</span>
                      </p>
                    </div>
                  </div>
                  <div className="px-6 pb-6 flex gap-3">
                    <button
                      onClick={() => { setPkModal('closed'); setExportedKey(''); }}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.04] text-dim hover:bg-white/[0.08] hover:text-white text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setPkExporting(true);
                        try {
                          const { exportPrivateKey } = await import('@/lib/serverSign');
                          const key = await exportPrivateKey();
                          setExportedKey(key);
                          setPkModal('revealed');
                          setPkVisible(false);
                          setPkCopied(false);
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to export key');
                        } finally {
                          setPkExporting(false);
                        }
                      }}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors border border-red-500/20"
                    >
                      {pkExporting ? 'Loading...' : 'Show Key'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Your Private Key</h3>
                    <button
                      onClick={() => { setPkModal('closed'); setExportedKey(''); }}
                      className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-dim hover:text-white transition-colors"
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                  <div className="relative">
                    <div className="bg-cre8-base border border-white/[0.06] rounded-lg p-3.5 pr-20 font-mono text-sm break-all">
                      {pkVisible ? (
                        <span className="text-white">{exportedKey}</span>
                      ) : (
                        <span className="text-dim">{'•'.repeat(66)}</span>
                      )}
                    </div>
                    <div className="absolute top-2.5 right-2.5 flex gap-1">
                      <button
                        onClick={() => setPkVisible(!pkVisible)}
                        className="w-7 h-7 rounded-md bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-dim hover:text-white transition-colors"
                      >
                        {pkVisible ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(exportedKey);
                          setPkCopied(true);
                          setTimeout(() => setPkCopied(false), 2000);
                        }}
                        className="w-7 h-7 rounded-md bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-dim hover:text-white transition-colors"
                      >
                        {pkCopied ? <IconCheck size={14} className="text-green-400" /> : <IconCopy size={14} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-amber-400/70 mt-3 flex items-center gap-1.5">
                    <IconAlertTriangle size={12} className="shrink-0" />
                    Never share this key. Anyone with it can access your funds.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
