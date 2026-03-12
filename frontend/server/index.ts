import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initDatabase } from './database.js';
import authRoutes from './routes/auth.js';
import imageRoutes from './routes/images.js';
import userRoutes from './routes/users.js';
import commentRoutes from './routes/comments.js';
import priceRoutes from './routes/prices.js';
import favoriteRoutes from './routes/favorites.js';
import creatorRoutes from './routes/creators.js';
import adminRoutes from './routes/admin.js';
import followRoutes from './routes/follows.js';
import notificationRoutes from './routes/notifications.js';
import presaleRoutes from './routes/presales.js';
import tokenRoutes from './routes/tokens.js';
import { startPriceIndexer } from './services/priceIndexer.js';
import { startTradeWatcher } from './services/tradeWatcher.js';

const app = express();
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS
const allowedOrigins = FRONTEND_URL.split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Global rate limiter — 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(globalLimiter);

// Stricter rate limits for auth and write endpoints
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Too many auth attempts, please try again later' },
});

const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: 'Too many requests, please slow down' },
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/favorites', writeLimiter, favoriteRoutes);
app.use('/api/creators', creatorRoutes);
const adminLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: { error: 'Too many admin requests' },
});
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/follows', writeLimiter, followRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/presales', presaleRoutes);
app.use('/api/tokens', tokenRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

function validateEnv() {
  const required = ['DATABASE_URL', 'ENCRYPTION_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (!process.env.ADMIN_API_KEY) {
    console.warn('[WARN] ADMIN_API_KEY not set — admin routes will be inaccessible');
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[WARN] Google OAuth credentials not set — auth will fail');
  }
}

async function start() {
  validateEnv();
  await initDatabase();
  const server = app.listen(PORT, () => {
    console.log(`Cre8 server running on http://localhost:${PORT}`);
    console.log(`Frontend URL: ${FRONTEND_URL}`);
    console.log(`Database: PostgreSQL`);
    startPriceIndexer();
    startTradeWatcher(server);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
