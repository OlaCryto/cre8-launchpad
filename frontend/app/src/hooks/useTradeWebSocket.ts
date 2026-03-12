import { useEffect, useRef, useCallback, useState } from 'react';

export interface WsTrade {
  type: 'buy' | 'sell';
  trader: string;
  tokenId: string;
  avaxAmount: number;
  tokenAmount: number;
  newPrice: number;
  timestamp: number;
  txHash: string;
  blockNumber: string;
}

interface WsTradeMessage {
  type: 'trade';
  trade: WsTrade;
}

interface WsConnectedMessage {
  type: 'connected';
  manager: string;
}

type WsMessage = WsTradeMessage | WsConnectedMessage;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws/trades';

const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 30000;

export function useTradeWebSocket(onTrade: (trade: WsTrade) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const onTradeRef = useRef(onTrade);
  const [connected, setConnected] = useState(false);

  onTradeRef.current = onTrade;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        setConnected(true);
        console.log('[WS] Connected to trade feed');
      };

      ws.onmessage = (event) => {
        try {
          const data: WsMessage = JSON.parse(event.data);
          if (data.type === 'trade') {
            onTradeRef.current(data.trade);
          }
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Exponential backoff reconnect
        const delay = Math.min(
          RECONNECT_BASE * Math.pow(2, reconnectAttempt.current),
          RECONNECT_MAX,
        );
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket constructor can throw if URL is invalid
      const delay = Math.min(
        RECONNECT_BASE * Math.pow(2, reconnectAttempt.current),
        RECONNECT_MAX,
      );
      reconnectAttempt.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { connected };
}
