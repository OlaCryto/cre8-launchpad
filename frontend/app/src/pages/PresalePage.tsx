import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Presale page — presale vault contracts were removed in v3.
 * Forge Mode now uses whitelist-only (no separate presale).
 * This page is kept as a placeholder for the route.
 */
export function PresalePage() {
  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="text-dim hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Presale</h1>
        </div>
        <div className="surface p-8 text-center">
          <p className="text-dim">
            Presale vaults have been replaced by Forge Mode whitelist in v3.
            Use the token creation flow with Forge Mode to set up whitelist phases.
          </p>
          <Link to="/create" className="inline-block mt-4 text-cre8-red hover:underline text-sm">
            Create a token with Forge Mode
          </Link>
        </div>
      </div>
    </div>
  );
}
