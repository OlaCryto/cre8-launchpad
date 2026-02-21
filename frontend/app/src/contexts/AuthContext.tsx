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
  signInWithX: () => Promise<void>;
  signOut: () => void;
  updateCreatorProfile: (profile: CreatorProject) => void;
  showPrivateKey: () => string | null;
  /** Called by AuthCallbackPage after X redirects back */
  handleAuthCallback: (sessionToken: string) => Promise<void>;
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

  // Load user from localStorage on mount + validate session
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const session = localStorage.getItem('cre8_session');

    if (stored && session) {
      try {
        const user = JSON.parse(stored) as PlatformUser;
        setState({ user, isAuthenticated: true, isLoading: false });

        // Validate session in background
        apiCall('/api/auth/session').catch(() => {
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

  // Persist user to localStorage
  const persistUser = (user: PlatformUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  };

  /** Redirect to X OAuth */
  const signInWithX = async () => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const { url } = await apiCall('/api/auth/twitter');
      // Redirect to X — user will come back via /auth/callback
      window.location.href = url;
    } catch (err) {
      console.error('Failed to start X sign-in:', err);
      setState(s => ({ ...s, isLoading: false }));
    }
  };

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

  return (
    <AuthContext.Provider value={{
      ...state,
      signInWithX,
      signOut,
      updateCreatorProfile,
      showPrivateKey,
      handleAuthCallback,
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
