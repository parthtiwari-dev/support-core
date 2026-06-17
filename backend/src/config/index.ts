import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function shouldUseDatabaseSsl(databaseUrl: string, nodeEnv: string): boolean {
  const explicit = process.env.DATABASE_SSL?.toLowerCase();

  if (explicit && ['true', '1', 'yes', 'require'].includes(explicit)) {
    return true;
  }

  if (explicit && ['false', '0', 'no', 'disable'].includes(explicit)) {
    return false;
  }

  return nodeEnv === 'production' || databaseUrl.includes('sslmode=require');
}

const nodeEnv = process.env.NODE_ENV || 'development';
const databaseUrl = requireEnv('DATABASE_URL');

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl,
  databaseSsl: shouldUseDatabaseSsl(databaseUrl, nodeEnv) ? { rejectUnauthorized: false } : false,
  openaiApiKey: requireEnv('OPENAI_API_KEY'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  nodeEnv,
} as const;
