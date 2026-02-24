import { Shield } from 'lucide-react';

interface VerifiedBadgeProps {
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const sizes = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
};

export function VerifiedBadge({ size = 'sm', showLabel = false, className = '' }: VerifiedBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} title="Verified Creator">
      <Shield className={`${sizes[size]} text-emerald-400 fill-emerald-400/20`} />
      {showLabel && <span className="text-[10px] text-emerald-400 font-medium">Verified</span>}
    </span>
  );
}
