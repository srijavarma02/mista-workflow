import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { errorHandler, notFound } from './middleware/errorHandler';
import routes from './routes';
import { pool } from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security ─────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX || '200'),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ── Body Parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ── Root (API info) ───────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'Stores & Inventory API',
    status: 'running',
    frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
    endpoints: {
      health: '/health',
      api: '/api',
      login: '/api/auth/login',
    },
    message: 'Open the frontend URL in your browser to use the application.',
  });
});

// ── Health Check ──────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 & Error Handlers ──────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Stores & Inventory API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api`);
  console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`);
});

export default app;
