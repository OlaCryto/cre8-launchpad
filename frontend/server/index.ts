import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import imageRoutes from './routes/images.js';
import userRoutes from './routes/users.js';
import commentRoutes from './routes/comments.js';
import priceRoutes from './routes/prices.js';
import favoriteRoutes from './routes/favorites.js';
import creatorRoutes from './routes/creators.js';
import adminRoutes from './routes/admin.js';
import { startPriceIndexer } from './services/priceIndexer.js';

const app = express();
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
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Cre8 server running on http://localhost:${PORT}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`Database: SQLite (WAL mode)`);
  startPriceIndexer();
});
