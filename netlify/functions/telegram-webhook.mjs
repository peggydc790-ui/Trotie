import { importTelegramMessage } from './lib/import-message.mjs';
import { recordSeenChat } from './lib/store.mjs';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  if (secret) {
    const header = req.headers.get('x-telegram-bot-api-secret-token') || '';
    if (header !== secret) return new Response('Unauthorized', { status: 401 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return new Response('TELEGRAM_BOT_TOKEN missing', { status: 500 });
  let body;
  try { body = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const message = body.message || body.channel_post;
  if (!message) return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { 'Content-Type': 'application/json' } });
  try {
    await recordSeenChat(message);
    const result = await importTelegramMessage(message, token);
    return new Response(JSON.stringify({ ok: true, result: result.status }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = { path: '/api/telegram-webhook' };
