import express from 'express';
import cors from 'cors';
import { config } from './config';
import { pool } from './db';
import { chatRouter } from './routes/chat.routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(cors({
  origin: config.frontendUrl,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10kb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/chat', chatRouter);
app.use(errorHandler);
