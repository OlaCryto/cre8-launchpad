import type { TokenHolder } from '@/hooks/useContracts';

interface HolderChartProps {
  holders: TokenHolder[];
  isLoading: boolean;
}

function addressToColor(address: string): string {
  const hash = address.toLowerCase().replace('0x', '');
  const hue = parseInt(hash.slice(0, 6), 16) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

export function HolderChart({ holders, isLoading }: HolderChartProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="w-6 h-6 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin mx-auto mb-3" />
        <p className="text-dim text-sm">Loading holders...</p>
      </div>
    );
  }

  if (holders.length === 0) {
    return (
      <div className="p-8 text-center text-dim">
        <p>No holders yet</p>
      </div>
    );
  }

  const topHolders = holders.slice(0, 10);
  const othersPercent = Math.max(0, 100 - topHolders.reduce((sum, h) => sum + h.percentage, 0));

  const segments: { color: string; percent: number; label: string; address: string }[] = topHolders.map((h) => ({
    color: addressToColor(h.address),
    percent: h.percentage,
    label: h.holderName || `${h.address.slice(0, 6)}...${h.address.slice(-4)}`,
    address: h.address,
  }));

  if (othersPercent > 0.1) {
    segments.push({
      color: 'rgba(255,255,255,0.08)',
      percent: othersPercent,
      label: 'Others',
      address: '',
    });
  }

  let cumulativeAngle = -90;

  const arcs = segments.map((seg) => {
    const angle = (seg.percent / 100) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const r = 45;
    const cx = 50;
    const cy = 50;
    const innerR = 30;

    const x1o = cx + r * Math.cos(startRad);
    const y1o = cy + r * Math.sin(startRad);
    const x2o = cx + r * Math.cos(endRad);
    const y2o = cy + r * Math.sin(endRad);
    const x1i = cx + innerR * Math.cos(endRad);
    const y1i = cy + innerR * Math.sin(endRad);
    const x2i = cx + innerR * Math.cos(startRad);
    const y2i = cy + innerR * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    const d = [
      `M ${x1o} ${y1o}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2o} ${y2o}`,
      `L ${x1i} ${y1i}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i}`,
      'Z',
    ].join(' ');

    return { ...seg, d };
  });

  return (
    <div className="p-4">
      <div className="flex items-start gap-5">
        {/* Donut */}
        <div className="w-[120px] h-[120px] shrink-0 relative">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {arcs.map((arc, i) => (
              <path
                key={i}
                d={arc.d}
                fill={arc.color}
                className="transition-opacity hover:opacity-80"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-white font-bold text-lg tabular-nums">{holders.length}</p>
              <p className="text-dim text-[9px]">holders</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar">
          {segments.slice(0, 8).map((seg, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-dim truncate flex-1 font-mono">{seg.label}</span>
              <span className="text-white font-mono tabular-nums shrink-0">{seg.percent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
