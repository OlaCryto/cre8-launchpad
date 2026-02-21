import { useState, useRef } from 'react';
import { ArrowUp, Clock, RefreshCw, Settings, X } from 'lucide-react';

interface TokenChartProps {
  currentMCap: number;
  athMCap: number;
  todayChange: number;
  timeAgo: string;
}

// Generate realistic price data that trends down like in the screenshot
const generatePriceData = () => {
  const data = [];
  const startPrice = 20000;
  const endPrice = 3200;
  const points = 50;
  
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    // Exponential decay with some noise
    const basePrice = startPrice * Math.pow(endPrice / startPrice, progress);
    const noise = (Math.random() - 0.5) * 3000;
    const spike = i === 15 ? 4000 : 0; // Add a spike like in the screenshot
    data.push(Math.max(basePrice + noise + spike, endPrice));
  }
  return data;
};

const timeIntervals = ['Tick', '1m', '5m', '15m', 'All'];

export function TokenChart({ currentMCap, athMCap, todayChange, timeAgo }: TokenChartProps) {
  const [activeInterval, setActiveInterval] = useState('All');
  const [showStreakBanner, setShowStreakBanner] = useState(true);
  const [priceData] = useState(generatePriceData());
  const chartRef = useRef<SVGSVGElement>(null);

  const minPrice = Math.min(...priceData);
  const maxPrice = Math.max(...priceData);
  const priceRange = maxPrice - minPrice;
  
  // Calculate ATH progress percentage
  const athProgress = (currentMCap / athMCap) * 100;

  // Format numbers
  const formatCurrency = (val: number) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  };

  // Generate SVG path for the chart line
  const generatePath = () => {
    const width = 800;
    const height = 400;
    const padding = { top: 20, bottom: 40, left: 60, right: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    return priceData.map((price, i) => {
      const x = padding.left + (i / (priceData.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  // Generate area path for gradient fill
  const generateAreaPath = () => {
    const width = 800;
    const height = 400;
    const padding = { top: 20, bottom: 40, left: 60, right: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const linePath = priceData.map((price, i) => {
      const x = padding.left + (i / (priceData.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return `${linePath} L ${padding.left + chartWidth} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;
  };

  // Y-axis labels
  const yAxisLabels = [20000, 15000, 10000, 5000];
  
  // X-axis time labels
  const xAxisLabels = ['20:08', '20:19', '20:30'];

  return (
    <div className="bg-[#0D0D12] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Streak Banner */}
      {showStreakBanner && (
        <div className="relative bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 px-4 py-3">
          <button 
            onClick={() => setShowStreakBanner(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-black/60 hover:text-black"
          >
            <X className="w-5 h-5" />
          </button>
          <p className="text-center text-black font-semibold text-sm">
            Make a trade to kick off your streak! 🔥
          </p>
        </div>
      )}

      {/* Stats Header */}
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          {/* Left - Market Cap */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold text-white">
                {formatCurrency(currentMCap)}
              </span>
              <span className="text-lg text-[#8B8B9E]">MC</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1 text-green-400">
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                  <ArrowUp className="w-3 h-3 text-black" />
                </div>
                <span className="font-medium">{todayChange}%</span>
                <span className="text-[#8B8B9E]">Today</span>
              </div>
              <div className="flex items-center gap-1 text-[#8B8B9E]">
                <Clock className="w-3 h-3" />
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>

          {/* Right - ATH */}
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xl sm:text-2xl font-bold text-white">
                {formatCurrency(athMCap)}
              </span>
              <span className="text-sm text-[#8B8B9E]">ATH</span>
              <RefreshCw className="w-4 h-4 text-[#8B8B9E]" />
            </div>
            {/* ATH Progress Bar */}
            <div className="w-32 sm:w-40 h-2 bg-white/10 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                style={{ width: `${athProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-64 sm:h-80 -mx-4 sm:-mx-6">
          <svg 
            ref={chartRef}
            viewBox="0 0 800 400" 
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Glow filter for the line */}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              
              {/* Gradient for area fill */}
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Y-axis grid lines and labels */}
            {yAxisLabels.map((label, i) => {
              const y = 60 + (i / (yAxisLabels.length - 1)) * 280;
              return (
                <g key={label}>
                  <line 
                    x1="60" y1={y} x2="780" y2={y} 
                    stroke="rgba(255,255,255,0.05)" 
                    strokeWidth="1" 
                  />
                  <text 
                    x="780" y={y - 5} 
                    fill="#8B8B9E" 
                    fontSize="12" 
                    textAnchor="end"
                  >
                    {formatCurrency(label)}
                  </text>
                </g>
              );
            })}

            {/* X-axis labels */}
            {xAxisLabels.map((label, i) => {
              const x = 60 + (i / (xAxisLabels.length - 1)) * 720;
              return (
                <text 
                  key={label}
                  x={x} y="385" 
                  fill="#8B8B9E" 
                  fontSize="12" 
                  textAnchor="middle"
                >
                  {label}
                </text>
              );
            })}

            {/* Area fill */}
            <path
              d={generateAreaPath()}
              fill="url(#areaGradient)"
            />

            {/* Chart line with glow */}
            <path
              d={generatePath()}
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              filter="url(#glow)"
            />

            {/* Current price indicator dot */}
            <circle
              cx={60 + 720}
              cy={60 + 280 - ((priceData[priceData.length - 1] - minPrice) / priceRange) * 280}
              r="6"
              fill="#22c55e"
              stroke="#0D0D12"
              strokeWidth="2"
            />

            {/* Current price label */}
            <g>
              <rect
                x={60 + 720 + 10}
                y={60 + 280 - ((priceData[priceData.length - 1] - minPrice) / priceRange) * 280 - 12}
                width="70"
                height="24"
                rx="4"
                fill="#22c55e"
              />
              <text
                x={60 + 720 + 45}
                y={60 + 280 - ((priceData[priceData.length - 1] - minPrice) / priceRange) * 280 + 4}
                fill="black"
                fontSize="12"
                fontWeight="600"
                textAnchor="middle"
              >
                ${currentMCap.toLocaleString()}
              </text>
            </g>

            {/* Dotted line from current price to bottom */}
            <line
              x1={60 + 720}
              y1={60 + 280 - ((priceData[priceData.length - 1] - minPrice) / priceRange) * 280 + 6}
              x2={60 + 720}
              y2="360"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          </svg>
        </div>

        {/* Time Interval Tabs */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
          <div className="flex gap-1">
            {timeIntervals.map((interval) => (
              <button
                key={interval}
                onClick={() => setActiveInterval(interval)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeInterval === interval
                    ? 'bg-white/20 text-white'
                    : 'text-[#8B8B9E] hover:text-white hover:bg-white/5'
                }`}
              >
                {interval}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#8B8B9E]" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2zm4 8h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
            </button>
            <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              <Settings className="w-5 h-5 text-[#8B8B9E]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
