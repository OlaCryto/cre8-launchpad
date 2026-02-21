import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface TokenImageProps {
  tokenAddress: string;
  symbol: string;
  /** On-chain imageURI — if a valid URL (not data:), used as primary source */
  onChainImageURI?: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
}

/**
 * Displays a token image with cascading fallback:
 *   on-chain URL → backend /api/images/:address → letter avatar
 *
 * Uses <img onError> to advance through sources — no pre-fetching.
 */
export function TokenImage({
  tokenAddress,
  symbol,
  onChainImageURI,
  className = '',
  imgClassName = 'w-full h-full object-cover',
  fallbackClassName = 'text-sm font-bold text-white',
}: TokenImageProps) {
  const backendUrl = `${API_BASE}/api/images/${tokenAddress.toLowerCase()}`;
  const hasOnChainUrl = !!onChainImageURI && !onChainImageURI.startsWith('data:');

  const sources = [
    ...(hasOnChainUrl ? [onChainImageURI!] : []),
    backendUrl,
  ];

  const [sourceIndex, setSourceIndex] = useState(0);

  if (sourceIndex >= sources.length) {
    return (
      <div className={className}>
        <span className={fallbackClassName}>{symbol.charAt(0)}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <img
        src={sources[sourceIndex]}
        alt={symbol}
        className={imgClassName}
        onError={() => setSourceIndex((i) => i + 1)}
        loading="lazy"
      />
    </div>
  );
}
