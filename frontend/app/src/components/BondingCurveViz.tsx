import { useMemo } from 'react';

interface BondingCurveVizProps {
  progress: number;
  reserveBalance: number;
  targetReserve: number;
  currentPrice: number;
  isGraduated: boolean;
}

export function BondingCurveViz({
  progress,
  reserveBalance,
  targetReserve,
  currentPrice,
  isGraduated,
}: BondingCurveVizProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  const curvePath = useMemo(() => {
    const points: string[] = [];
    const w = 200;
    const h = 80;
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = t * w;
      const y = h - (t * t * 0.6 + t * 0.4) * h;
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  }, []);

  const fillIndex = Math.floor((clampedProgress / 100) * 50);
  const fillPath = useMemo(() => {
    const points: string[] = [];
    const w = 200;
    const h = 80;
    const steps = 50;
    const end = Math.min(fillIndex, steps);
    points.push(`0,${h}`);
    for (let i = 0; i <= end; i++) {
      const t = i / steps;
      const x = t * w;
      const y = h - (t * t * 0.6 + t * 0.4) * h;
      points.push(`${x},${y}`);
    }
    const lastT = end / steps;
    const lastX = lastT * w;
    points.push(`${lastX},${h}`);
    return points.join(' ');
  }, [fillIndex]);

  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">Bonding Curve</span>
        <span className={`text-sm font-bold tabular-nums ${isGraduated ? 'text-green-400' : 'text-cre8-red'}`}>
          {clampedProgress.toFixed(1)}%
        </span>
      </div>

      <div className="relative bg-cre8-base rounded-lg p-3 overflow-hidden">
        <svg viewBox="0 0 200 80" className="w-full h-auto" preserveAspectRatio="none">
          <defs>
            <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isGraduated ? '#22c55e' : '#E84142'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isGraduated ? '#22c55e' : '#E84142'} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <polyline
            points={curvePath}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.5"
          />

          <polygon
            points={fillPath}
            fill="url(#curve-fill)"
          />

          <polyline
            points={fillPath.split(' ').slice(1, -1).join(' ')}
            fill="none"
            stroke={isGraduated ? '#22c55e' : '#E84142'}
            strokeWidth="2"
            strokeLinecap="round"
          />

          {!isGraduated && clampedProgress > 0 && (
            <circle
              cx={(fillIndex / 50) * 200}
              cy={80 - ((fillIndex / 50) * (fillIndex / 50) * 0.6 + (fillIndex / 50) * 0.4) * 80}
              r="3"
              fill="#E84142"
              stroke="#07070B"
              strokeWidth="1.5"
            />
          )}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="bg-cre8-base rounded-lg px-3 py-2">
          <p className="text-dim">Reserve</p>
          <p className="text-white font-mono font-semibold tabular-nums">{reserveBalance.toFixed(2)} AVAX</p>
        </div>
        <div className="bg-cre8-base rounded-lg px-3 py-2">
          <p className="text-dim">Target</p>
          <p className="text-white font-mono font-semibold tabular-nums">{targetReserve.toLocaleString()} AVAX</p>
        </div>
      </div>

      {isGraduated && (
        <div className="mt-2.5 p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
          <span className="text-green-400 text-xs font-semibold">Graduated to TraderJoe DEX</span>
        </div>
      )}
    </div>
  );
}
