import { Component, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { LoadingScreen } from './components/LoadingScreen';
import { WelcomeModal } from './components/WelcomeModal';
import { HomePage } from './pages/HomePage';
import { CreateTokenPage } from './pages/CreateTokenPage';
import { TokenDetailPage } from './pages/TokenDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { LegalPage } from './pages/LegalPage';
import { CreatorApplyPage } from './pages/CreatorApplyPage';
import { AdminPage } from './pages/AdminPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { PresalePage } from './pages/PresalePage';
import { VestingPage } from './pages/VestingPage';
import { InboxPage } from './pages/InboxPage';
import { CreatorDashboardPage } from './pages/CreatorDashboardPage';
import { Toaster } from '@/components/ui/sonner';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cre8-base flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-dim text-sm mb-6">An unexpected error occurred. Try refreshing the page.</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-cre8-red hover:bg-cre8-red/90 text-white rounded-lg font-semibold text-sm transition-colors">
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

function MobileGate() {
  return (
    <div className="flex md:hidden min-h-screen bg-cre8-base items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-cre8-red/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-cre8-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-3">Desktop Only</h1>
        <p className="text-dim text-sm leading-relaxed mb-6">
          Cre8 is currently optimized for desktop and laptop screens.
          Please visit on a larger screen for the best experience.
        </p>
        <div className="text-dim/40 text-xs">cre8app.net</div>
      </div>
    </div>
  );
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileGate />
      <div className="hidden md:block min-h-screen bg-cre8-base overflow-x-hidden">
        <Sidebar />
        <main className="ml-[68px]">
          {children}
        </main>
      </div>
    </>
  );
}

function AppRoutes() {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/portfolio" element={<ProfilePage />} />
        <Route path="/create" element={<CreateTokenPage />} />
        <Route path="/token/:ticker" element={<TokenDetailPage />} />
        <Route path="/profile/:address" element={<ProfilePage />} />
        <Route path="/creator/apply" element={<CreatorApplyPage />} />
        <Route path="/creator/dashboard" element={<CreatorDashboardPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/presale/:launchId" element={<PresalePage />} />
        <Route path="/vesting/:launchId" element={<VestingPage />} />
        <Route path="/legal/:page" element={<LegalPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Routes>
    </DashboardLayout>
  );
}

function App() {
  const [showLoading, setShowLoading] = useState(true);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {showLoading && <LoadingScreen onComplete={() => setShowLoading(false)} />}
          {!showLoading && <WelcomeModal />}
          <Router>
            <AppRoutes />
          </Router>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
