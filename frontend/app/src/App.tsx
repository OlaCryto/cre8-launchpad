import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { LoadingScreen } from './components/LoadingScreen';
import { HomePage } from './pages/HomePage';
import { PortfolioPage } from './pages/PortfolioPage';
import { CreateTokenPage } from './pages/CreateTokenPage';
import { TokenDetailPage } from './pages/TokenDetailPage';
import { PresalePage } from './pages/PresalePage';
import { ProfilePage } from './pages/ProfilePage';
import { VestingPage } from './pages/VestingPage';
import { InboxPage } from './pages/InboxPage';
import { CreatorDashboardPage } from './pages/CreatorDashboardPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { Toaster } from '@/components/ui/sonner';

const queryClient = new QueryClient();

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-cre8-base">
      {/* Sidebar — hidden on mobile, visible md+ */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      {/* Main content — offset for sidebar */}
      <main className="flex-1 md:ml-[68px] pb-16 md:pb-0">
        {children}
      </main>
      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <Sidebar />
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/create" element={<CreateTokenPage />} />
        <Route path="/token/:ticker" element={<TokenDetailPage />} />
        <Route path="/presale/:launchId" element={<PresalePage />} />
        <Route path="/profile/:address" element={<ProfilePage />} />
        <Route path="/vesting/:launchId" element={<VestingPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/dashboard" element={<CreatorDashboardPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Routes>
    </DashboardLayout>
  );
}

function App() {
  const [showLoading, setShowLoading] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {showLoading && <LoadingScreen onComplete={() => setShowLoading(false)} />}
        <Router>
          <AppRoutes />
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
