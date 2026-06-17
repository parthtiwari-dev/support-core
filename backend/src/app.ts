import express from 'express';
import cors from 'cors';
import { config } from './config';
import { chatRouter } from './routes/chat.routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(cors({
  origin: config.frontendUrl,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/chat', chatRouter);
app.use(errorHandler);
