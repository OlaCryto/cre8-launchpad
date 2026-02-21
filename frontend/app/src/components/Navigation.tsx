import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { User, Menu, X, LogOut, Key, Wallet, AlertTriangle, Copy, Check, Eye, EyeOff, Search, Rocket, Compass, Briefcase, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function Navigation() {
  const location = useLocation();
  const { user, isAuthenticated, isLoading, signInWithX, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [pkModal, setPkModal] = useState<'closed' | 'warning' | 'revealed'>('closed');
  const [pkCopied, setPkCopied] = useState(false);
  const [pkVisible, setPkVisible] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const navItems = [
    { path: '/', label: 'Home', icon: Rocket },
    { path: '/explore', label: 'Explore', icon: Compass },
    { path: '/create', label: 'Create', icon: Plus },
    { path: '/portfolio', label: 'Portfolio', icon: Briefcase },
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
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <img
                src="/logo-icon.png"
                alt="Cre8"
                className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105"
              />
              <span className="text-lg font-bold tracking-tight text-white hidden sm:block">
                Cre8
              </span>
            </Link>

            {/* Center Nav Links — Desktop */}
            <div className="hidden md:flex items-center gap-1 mx-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'text-dim hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-cre8-red rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* Search — expandable */}
              <div className={`hidden lg:flex items-center transition-all duration-200 ${searchFocused ? 'w-72' : 'w-56'}`}>
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
                  <input
                    type="text"
                    placeholder="Search tokens..."
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-dim/60 focus:outline-none focus:border-white/[0.12] transition-colors"
                  />
                </div>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
              >
                {isMenuOpen ? <X className="w-4 h-4 text-white" /> : <Menu className="w-4 h-4 text-white" />}
              </button>

              {/* Auth — Desktop */}
              <div className="hidden md:block">
                {isAuthenticated && user ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
                    >
                      <img src={user.xAvatar} alt={user.xName} className="w-6 h-6 rounded-full object-cover" />
                      <span className="text-white text-sm font-medium max-w-[100px] truncate">{user.xHandle}</span>
                    </button>

                    {showUserMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                        <div className="absolute right-0 top-full mt-1.5 w-60 bg-cre8-surface border border-white/[0.06] rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                          <div className="px-3 py-2.5 border-b border-white/[0.06]">
                            <p className="text-white font-medium text-sm">{user.xName}</p>
                            <p className="text-xs text-dim">{user.xHandle}</p>
                          </div>
                          <div className="px-3 py-2.5 border-b border-white/[0.06]">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Wallet className="w-3 h-3 text-dim" />
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
                              <User className="w-4 h-4" />
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
                              <Key className="w-4 h-4" />
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
                              <LogOut className="w-4 h-4" />
                              <span className="text-sm">Sign Out</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={handleSignIn}
                    disabled={isLoading}
                    className="bg-cre8-red hover:bg-cre8-red/90 text-white rounded-lg font-medium text-sm px-4 h-8"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Connect'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown */}
        <div
          className={`md:hidden absolute top-full left-0 right-0 transition-all duration-200 ease-out ${
            isMenuOpen
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          <div className="mx-3 mt-1.5 bg-cre8-surface/95 backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden shadow-2xl">
            <div className="p-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white/[0.06] text-white'
                        : 'text-dim hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cre8-red" />}
                  </Link>
                );
              })}
            </div>
            <div className="px-3 py-2.5 border-t border-white/[0.06]">
              {isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <img src={user.xAvatar} alt={user.xName} className="w-8 h-8 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{user.xHandle}</p>
                    <p className="text-xs text-dim font-mono">{truncateAddress(user.wallet.address)}</p>
                  </div>
                  <button
                    onClick={() => { signOut(); setIsMenuOpen(false); }}
                    className="text-dim hover:text-red-400 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Button
                  onClick={() => { handleSignIn(); setIsMenuOpen(false); }}
                  disabled={isLoading}
                  className="w-full bg-cre8-red hover:bg-cre8-red/90 text-white rounded-lg font-medium text-sm h-9"
                >
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-black/40 -z-10" onClick={() => setIsMenuOpen(false)} />
        )}
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
                      <AlertTriangle className="w-6 h-6 text-amber-400" />
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
                      <X className="w-3.5 h-3.5" />
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
                        {pkVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(user.wallet.privateKey);
                          setPkCopied(true);
                          setTimeout(() => setPkCopied(false), 2000);
                        }}
                        className="w-7 h-7 rounded-md bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-dim hover:text-white transition-colors"
                      >
                        {pkCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-amber-400/70 mt-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
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
