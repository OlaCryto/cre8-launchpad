import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IconHome,
  IconPlus,
  IconUser,
  IconWallet,
  IconBriefcase,
  IconKey,
  IconLogout,
  IconAlertTriangle,
  IconCopy,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconX,
  IconSearch,
  IconInbox,
  IconDashboard,
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnChainTokens } from '@/hooks/useContracts';
import { TokenImage } from '@/components/TokenImage';
import { toast } from 'sonner';

// ============ Search Overlay ============

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { tokens } = useOnChainTokens();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query.trim()
    ? tokens.filter((t) => {
        const q = query.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
        );
      }).slice(0, 8)
    : [];

  // Reset selection when results change
  useEffect(() => { setSelectedIdx(0); }, [query]);

  // ESC to close, arrow keys + enter for navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      navigate(`/token/${results[selectedIdx].address}`);
      onClose();
    }
  }, [results, selectedIdx, navigate, onClose]);

  // Global ESC listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const formatPrice = (price: number) => {
    if (price === 0) return '0';
    if (price < 0.0001) return price.toFixed(8).replace(/0+$/, '');
    if (price < 1) return price.toFixed(6).replace(/0+$/, '');
    return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" onClick={onClose} />
      <div className="fixed top-0 left-0 right-0 z-[61] flex justify-center pt-[15vh]">
        <div className="w-full max-w-lg mx-4 animate-slide-up">
          <div className="bg-cre8-surface border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
              <IconSearch size={18} className="text-dim shrink-0" />
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search tokens, addresses..."
                className="flex-1 bg-transparent text-white text-sm placeholder:text-dim/60 focus:outline-none"
              />
              <kbd className="text-[10px] text-dim bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06] cursor-pointer" onClick={onClose}>ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[360px] overflow-y-auto">
              {!query.trim() ? (
                <div className="p-4 text-center">
                  <p className="text-dim text-sm">Type to search tokens...</p>
                  {tokens.length > 0 && (
                    <p className="text-dim/40 text-xs mt-1">{tokens.length} tokens indexed</p>
                  )}
                </div>
              ) : results.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-dim text-sm">No tokens found for "{query}"</p>
                </div>
              ) : (
                <div className="py-1">
                  {results.map((token, i) => (
                    <Link
                      key={token.address}
                      to={`/token/${token.address}`}
                      onClick={onClose}
                      onMouseEnter={() => setSelectedIdx(i)}
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                        i === selectedIdx ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <TokenImage
                        tokenAddress={token.address}
                        symbol={token.symbol}
                        onChainImageURI={token.imageURI}
                        className="w-8 h-8 rounded-lg overflow-hidden bg-white/[0.06] flex items-center justify-center shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{token.name}</span>
                          <span className="text-xs text-cre8-red font-mono">${token.symbol}</span>
                        </div>
                        <p className="text-[10px] text-dim font-mono truncate">{token.address}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-white font-mono">{formatPrice(token.currentPrice)} AVAX</p>
                        {token.isGraduated && (
                          <span className="text-[9px] text-green-400 font-medium">Graduated</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const location = useLocation();
  const { user, isAuthenticated, isLoading, signInWithX, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [pkModal, setPkModal] = useState<'closed' | 'warning' | 'revealed'>('closed');
  const [pkCopied, setPkCopied] = useState(false);
  const [pkVisible, setPkVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const navItems = [
    { path: '/', icon: IconHome, label: 'Home' },
    { path: '/create', icon: IconPlus, label: 'Create' },
    { path: '/portfolio', icon: IconBriefcase, label: 'Portfolio' },
    { path: '/inbox', icon: IconInbox, label: 'Inbox' },
    ...(user?.creatorProfile ? [{ path: '/dashboard', icon: IconDashboard, label: 'Dashboard' }] : []),
  ];

  const handleSignIn = async () => {
    try {
      await signInWithX();
      toast.success('Signed in successfully!');
    } catch {
      toast.error('Failed to sign in. Try again.');
    }
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <>
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-[68px] bg-cre8-base border-r border-white/[0.06] flex flex-col items-center py-5 z-50">
        {/* Logo */}
        <Link to="/" className="mb-8 group">
          <img
            src="/logo-icon.png"
            alt="Cre8"
            className="w-9 h-9 object-contain transition-transform duration-200 group-hover:scale-110"
          />
        </Link>

        {/* Search */}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-dim hover:text-white hover:bg-white/[0.06] transition-colors mb-2"
          title="Search"
        >
          <IconSearch size={20} stroke={1.5} />
        </button>

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
          )}
        </div>
      </aside>

      {/* Search Overlay */}
      {searchOpen && (
        <SearchOverlay onClose={() => setSearchOpen(false)} />
      )}

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
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 ${
                  isActive ? 'text-cre8-red' : 'text-dim'
                }`}
              >
                <Icon size={20} stroke={isActive ? 2 : 1.5} />
                <span className="text-[10px] font-medium">{item.label}</span>
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPkModal('closed')} />
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
                      onClick={() => setPkModal('closed')}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.04] text-dim hover:bg-white/[0.08] hover:text-white text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { setPkModal('revealed'); setPkVisible(false); setPkCopied(false); }}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors border border-red-500/20"
                    >
                      Show Key
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Your Private Key</h3>
                    <button
                      onClick={() => setPkModal('closed')}
                      className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-dim hover:text-white transition-colors"
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                  <div className="relative">
                    <div className="bg-cre8-base border border-white/[0.06] rounded-lg p-3.5 pr-20 font-mono text-sm break-all">
                      {pkVisible ? (
                        <span className="text-white">{user.wallet.privateKey}</span>
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
                          navigator.clipboard.writeText(user.wallet.privateKey);
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
