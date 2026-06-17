import { pool } from '../db';
import { Conversation, Message } from '../types';

export const chatRepository = {
  async createConversation(): Promise<string> {
    const result = await pool.query<Conversation>(
      'INSERT INTO conversations DEFAULT VALUES RETURNING id'
    );
    return result.rows[0].id;
  },

  async findConversation(id: string): Promise<Conversation | null> {
    const result = await pool.query<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  },

  async saveMessage(
    conversationId: string,
    sender: 'user' | 'ai',
    text: string
  ): Promise<Message> {
    const result = await pool.query<Message>(
      `INSERT INTO messages (conversation_id, sender, text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [conversationId, sender, text]
    );
    return result.rows[0];
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const result = await pool.query<Message>(
      `SELECT * FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );
    return result.rows;
  },

  async touchConversation(id: string): Promise<void> {
    await pool.query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
      [id]
    );
  },
};
