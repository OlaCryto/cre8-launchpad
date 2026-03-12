import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// ============ Types ============

export interface PlatformUser {
  id: string;
  xHandle: string;
  xName: string;
  xAvatar: string;
  wallet: {
    address: string;
    /** Real private key (0x-prefixed) — used for signing transactions */
    privateKey: string;
  };
  creatorProfile?: CreatorProject;
  createdAt: string;
}

export interface CreatorProject {
  projectName: string;
  description: string;
  githubRepo: string;
  whitepaper: string;
  website: string;
  telegram: string;
  tokenImage: string;
  isVerified: boolean;
  createdAt: string;
}

interface AuthState {
  user: PlatformUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<void>;
  /** @deprecated Use signInWithGoogle */
  signInWithX: () => Promise<void>;
  signOut: () => void;
  updateCreatorProfile: (profile: CreatorProject) => void;
  showPrivateKey: () => string | null;
  /** Called by AuthCallbackPage after OAuth redirects back */
  handleAuthCallback: (sessionToken: string) => Promise<void>;
  /** Dev-only: bypass OAuth for local testing */
  devLogin: () => Promise<void>;
}

// ============ API helper ============

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function apiCall(path: string, options?: RequestInit) {
  const sessionToken = localStorage.getItem('cre8_session');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ============ Context ============

const AuthContext = createContext<AuthContextType | null>(null);

// ============ Provider ============

const STORAGE_KEY = 'cre8_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Load user from localStorage on mount + validate session & re-fetch key
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const session = localStorage.getItem('cre8_session');

    if (stored && session) {
      try {
        const parsed = JSON.parse(stored) as PlatformUser;
        // Show user immediately (without private key) while we re-fetch
        const userWithoutKey: PlatformUser = {
          ...parsed,
          wallet: { ...parsed.wallet, privateKey: '' },
        };
        setState({ user: userWithoutKey, isAuthenticated: true, isLoading: false });

        // Validate session + re-fetch private key from server (never stored locally)
        Promise.all([
          apiCall('/api/auth/session'),
          apiCall('/api/auth/wallet-key', { method: 'POST' }),
        ]).then(([, keyData]) => {
          setState(s => s.user ? {
            ...s,
            user: { ...s.user, wallet: { ...s.user.wallet, privateKey: keyData.privateKey } },
          } : s);
        }).catch(() => {
          // Session expired — force re-login
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem('cre8_session');
          setState({ user: null, isAuthenticated: false, isLoading: false });
        });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setState(s => ({ ...s, isLoading: false }));
      }
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  // Persist user to localStorage — NEVER store private key
  const persistUser = (user: PlatformUser) => {
    const safe = { ...user, wallet: { address: user.wallet.address, privateKey: '' } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  };

  /** Redirect to Google OAuth */
  const signInWithGoogle = async () => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const { url } = await apiCall('/api/auth/google');
      window.location.href = url;
    } catch (err) {
      console.error('Failed to start Google sign-in:', err);
      setState(s => ({ ...s, isLoading: false }));
    }
  };

  /** @deprecated Use signInWithGoogle */
  const signInWithX = signInWithGoogle;

  /** Called by AuthCallbackPage after X redirects back */
  const handleAuthCallback = async (sessionToken: string) => {
    setState(s => ({ ...s, isLoading: true }));

    try {
      // Store session
      localStorage.setItem('cre8_session', sessionToken);

      // Fetch user data
      const { user: userData } = await apiCall('/api/auth/session');

      // Fetch wallet private key for signing
      const { privateKey } = await apiCall('/api/auth/wallet-key', { method: 'POST' });

      const user: PlatformUser = {
        id: userData.id,
        xHandle: userData.xHandle,
        xName: userData.xName,
        xAvatar: userData.xAvatar,
        wallet: {
          address: userData.walletAddress,
          privateKey,
        },
        createdAt: new Date().toISOString(),
      };

      persistUser(user);
      setState({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      console.error('Auth callback failed:', err);
      localStorage.removeItem('cre8_session');
      setState({ user: null, isAuthenticated: false, isLoading: false });
      throw err;
    }
  };

  const signOut = () => {
    const session = localStorage.getItem('cre8_session');
    if (session) {
      // Best-effort server logout
      apiCall('/api/auth/logout', { method: 'POST' }).catch(() => {});
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('cre8_session');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  };

  const updateCreatorProfile = (profile: CreatorProject) => {
    if (!state.user) return;
    const updated = { ...state.user, creatorProfile: profile };
    persistUser(updated);
    setState(s => ({ ...s, user: updated }));
  };

  const showPrivateKey = (): string | null => {
    return state.user?.wallet.privateKey ?? null;
  };

  /** Dev-only login — bypasses X OAuth */
  const devLogin = async () => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const res = await fetch(`${API_BASE}/api/auth/dev-login`, { method: 'POST' });
      if (!res.ok) throw new Error('Dev login not available');
      const { session } = await res.json();
      await handleAuthCallback(session);
    } catch (err) {
      console.error('Dev login failed:', err);
      setState(s => ({ ...s, isLoading: false }));
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      signInWithGoogle,
      signInWithX,
      signOut,
      updateCreatorProfile,
      showPrivateKey,
      handleAuthCallback,
      devLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============ Hook ============

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
