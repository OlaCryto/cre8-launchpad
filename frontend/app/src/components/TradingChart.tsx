import { useEffect, useRef, useMemo } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
  type UTCTimestamp,
  CandlestickSeries,
  AreaSeries,
} from 'lightweight-charts';
import type { TradeActivity } from '@/hooks/useContracts';

// ============ Types ============

type TimeInterval = '1H' | '4H' | '1D' | '1W' | 'ALL';

interface TradingChartProps {
  trades: TradeActivity[];
  currentPrice: number;
  interval: TimeInterval;
  isLoading?: boolean;
}

// ============ Helpers ============

/** Bucket size in seconds for each interval */
function bucketSize(interval: TimeInterval): number {
  switch (interval) {
    case '1H': return 60;          // 1-min candles
    case '4H': return 300;         // 5-min candles
    case '1D': return 900;         // 15-min candles
    case '1W': return 3600;        // 1-hour candles
    case 'ALL': return 14400;      // 4-hour candles
  }
}

/** How far back to look (seconds) */
function lookback(interval: TimeInterval): number {
  switch (interval) {
    case '1H': return 3600;
    case '4H': return 14400;
    case '1D': return 86400;
    case '1W': return 604800;
    case 'ALL': return Infinity;
  }
}

interface CandleData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Aggregate trades into OHLC candles */
function buildCandles(
  trades: TradeActivity[],
  interval: TimeInterval,
  currentPrice: number,
): CandleData[] {
  if (trades.length === 0) return [];

  const bucket = bucketSize(interval);
  const lb = lookback(interval);
  const now = Math.floor(Date.now() / 1000);
  const cutoff = lb === Infinity ? 0 : now - lb;

  const validTrades = trades.filter((t) => t.newPrice != null && t.newPrice > 0);

  // Filter trades within the lookback window; fall back to all valid trades
  // so the chart always renders something when data exists
  let filtered = validTrades
    .filter((t) => t.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (filtered.length === 0) {
    filtered = validTrades.sort((a, b) => a.timestamp - b.timestamp);
  }

  if (filtered.length === 0) return [];

  const candles = new Map<number, CandleData>();

  for (const trade of filtered) {
    const price = trade.newPrice!;
    const bucketTime = Math.floor(trade.timestamp / bucket) * bucket;
    const existing = candles.get(bucketTime);

    if (existing) {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
    } else {
      candles.set(bucketTime, {
        time: bucketTime as UTCTimestamp,
        open: price,
        high: price,
        low: price,
        close: price,
      });
    }
  }

  // Fill forward — carry the close into the current bucket if needed
  const currentBucket = Math.floor(now / bucket) * bucket;
  if (!candles.has(currentBucket) && candles.size > 0) {
    const lastCandle = Array.from(candles.values()).pop()!;
    candles.set(currentBucket, {
      time: currentBucket as UTCTimestamp,
      open: lastCandle.close,
      high: Math.max(lastCandle.close, currentPrice),
      low: Math.min(lastCandle.close, currentPrice),
      close: currentPrice,
    });
  }

  return Array.from(candles.values()).sort((a, b) => (a.time as number) - (b.time as number));
}

// ============ Component ============

export function TradingChart({ trades, currentPrice, interval, isLoading }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null);

  const candles = useMemo(
    () => buildCandles(trades, interval, currentPrice),
    [trades, interval, currentPrice],
  );

  // Create chart instance
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(232,65,66,0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#E84142',
        },
        horzLine: {
          color: 'rgba(232,65,66,0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#E84142',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    // Use candlestick if we have enough data, otherwise area
    if (candles.length >= 3) {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#E84142',
        borderDownColor: '#E84142',
        borderUpColor: '#22c55e',
        wickDownColor: '#E84142',
        wickUpColor: '#22c55e',
      });
      seriesRef.current = series;
    } else {
      const series = chart.addSeries(AreaSeries, {
        lineColor: '#E84142',
        topColor: 'rgba(232,65,66,0.25)',
        bottomColor: 'rgba(232,65,66,0.01)',
        lineWidth: 2,
      });
      seriesRef.current = series;
    }

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  // Recreate chart when candle count crosses the 3 threshold (area vs candlestick switch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles.length >= 3]);

  // Update data
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    if (candles.length === 0) return;

    if (candles.length >= 3) {
      seriesRef.current.setData(candles);
    } else {
      const lineData = candles.map((c) => ({
        time: c.time,
        value: c.close,
      }));
      seriesRef.current.setData(lineData);
    }

    chartRef.current.timeScale().fitContent();
  }, [candles]);

  return (
    <div className="relative w-full h-full min-h-[300px]">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-cre8-base/50 z-10">
          <div className="w-6 h-6 border-2 border-cre8-red/30 border-t-cre8-red rounded-full animate-spin" />
        </div>
      )}

      {/* No data state */}
      {!isLoading && candles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <p className="text-dim text-sm">No trade data for this interval</p>
            <p className="text-dim/50 text-xs mt-1">Try a wider time range or make a trade</p>
          </div>
        </div>
      )}

      {/* Current price badge */}
      {currentPrice > 0 && !isLoading && (
        <div className="absolute right-3 top-3 bg-cre8-red text-white text-xs font-bold px-2 py-1 rounded z-10 font-mono">
          {currentPrice < 0.0001
            ? currentPrice.toFixed(8).replace(/0+$/, '')
            : currentPrice < 1
              ? currentPrice.toFixed(6).replace(/0+$/, '')
              : currentPrice.toFixed(4)}
        </div>
      )}
    </div>
  );
}
