export interface Token {
  id: string;
  name: string;
  ticker: string;
  image: string;
  creator: string;
  creatorAvatar?: string;
  mcap: number;
  mcapFormatted: string;
  volume24h: string;
  holders: string;
  createdAt: string;
  timeAgo: string;
  mode: 'trenches' | 'forge';
  isNew: boolean;
  priceHistory: number[];
  isPositive: boolean;
  description?: string;
  address?: string;
  socials?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  antiBot?: {
    cooldown: number;
    maxTx: string;
    maxWallet: string;
    launchProtection: boolean;
  };
  graduationProgress?: number;
  status?: string;
  athMCap?: number;
  todayChange?: number;
}

export interface User {
  address: string;
  handle: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  created: number;
  balance: {
    usd: string;
    avax: string;
  };
}

export interface Trade {
  id: string;
  type: 'buy' | 'sell';
  amount: string;
  token: string;
  price: string;
  time: string;
  trader: string;
}

export interface ChatMessage {
  id: string;
  user: string;
  avatar: string;
  message: string;
  time: string;
}
