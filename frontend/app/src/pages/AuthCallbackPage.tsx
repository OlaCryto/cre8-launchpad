import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleAuthCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;

    const session = searchParams.get('session');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(errorParam === 'auth_failed'
        ? 'Authentication failed. Please try again.'
        : 'Something went wrong. Please try again.');
      return;
    }

    if (!session) {
      setError('Missing session token.');
      return;
    }

    calledRef.current = true;
    handleAuthCallback(session)
      .then(() => navigate('/', { replace: true }))
      .catch(() => setError('Failed to complete sign-in. Please try again.'));
  }, [searchParams, handleAuthCallback, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {error ? (
        <div className="text-center space-y-4">
          <div className="text-red-400 text-lg">{error}</div>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="text-violet-400 hover:text-violet-300 underline"
          >
            Go back to home
          </button>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin mx-auto" />
          <div className="text-zinc-400">Completing sign-in...</div>
        </div>
      )}
    </div>
  );
}
