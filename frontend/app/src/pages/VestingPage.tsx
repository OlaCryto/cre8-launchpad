import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Vesting page — vesting contracts were removed in v3.
 * This page is kept as a placeholder for the route.
 */
export function VestingPage() {
  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="text-dim hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Vesting</h1>
        </div>
        <div className="surface p-8 text-center">
          <p className="text-dim">
            Token vesting contracts have been removed in v3.
          </p>
          <Link to="/" className="inline-block mt-4 text-cre8-red hover:underline text-sm">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
