import { readState, writeState, seedProducts, recordSeenChat } from './lib/store.mjs';
import { importTelegramMessage } from './lib/import-message.mjs';
import { tg } from './lib/telegram.mjs';

function cors() {
  return { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
}

function authed(req) {
  const key = process.env.ADMIN_KEY || '';
  if (!key) return { ok: false, error: 'ADMIN_KEY is not set in Netlify environment variables.' };
  const sent = req.headers.get('x-admin-key') || '';
  return sent === key ? { ok: true } : { ok: false, error: 'Unauthorized admin request.' };
}

const publicSafe = (p) => ({
  slug: p.slug,
  name: p.name,
  reference: p.reference || '',
  price_ngn: p.price_ngn,
  status: p.status,
  quantity: p.quantity,
  description: p.description || '',
  images: p.images || [],
  published: !!p.published,
  _priceNeedsReview: !!p._priceNeedsReview,
  _statusNeedsReview: !!p._statusNeedsReview,
  hasVideo: !!(p._telegram && p._telegram.videoFileId),
  supplierText: p._telegram ? p._telegram.text : ''
});

export default async (req) => {
  const gate = authed(req);
  if (!gate.ok) return new Response(JSON.stringify({ error: gate.error }), { status: 401, headers: cors() });

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'list';
  const token = process.env.TELEGRAM_BOT_TOKEN || '';

  try {
    if (action === 'list' && req.method === 'GET') {
      const state = await readState();
      return new Response(JSON.stringify({
        catalog: state.catalog.map(publicSafe),
        imports: state.imports,
        seenChats: state.seenChats || [],
        seedCount: seedProducts().length,
        telegramConfigured: Boolean(token),
        sourceChat: process.env.TELEGRAM_SOURCE_CHAT_ID || ''
      }), { headers: cors() });
    }

    if (action === 'check' && req.method === 'POST') {
      if (!token) return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN is not set.' }), { status: 400, headers: cors() });
      const updates = await tg(token, 'getUpdates', { timeout: 0, allowed_updates: ['message', 'channel_post'] });
      const results = [];
      for (const u of updates) {
        const message = u.message || u.channel_post;
        if (!message) continue;
        await recordSeenChat(message);
        results.push(await importTelegramMessage(message, token));
      }
      if (updates.length) {
        const last = updates[updates.length - 1].update_id;
        try { await tg(token, 'getUpdates', { offset: last + 1, timeout: 0 }); } catch {}
      }
      return new Response(JSON.stringify({
        pulled: updates.length,
        results: results.map((r) => ({ status: r.status, error: r.error || r.import?.error, slug: r.product?.slug || r.import?.productSlug }))
      }), { headers: cors() });
    }

    if (action === 'webhook' && req.method === 'POST') {
      if (!token) return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN is not set in Netlify environment variables.' }), { status: 400, headers: cors() });
      const reqUrl = new URL(req.url);
      const site = (process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL || `${reqUrl.protocol}//${reqUrl.host}`).replace(/\/$/, '');
      const hook = `${site}/api/telegram-webhook`;
      const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
      try {
        await tg(token, 'setWebhook', {
          url: hook,
          secret_token: secret || undefined,
          allowed_updates: ['message', 'channel_post']
        });
        const info = await tg(token, 'getWebhookInfo');
        return new Response(JSON.stringify({
          ok: true,
          webhook: hook,
          pending_update_count: info.pending_update_count,
          last_error_message: info.last_error_message || '',
          last_error_date: info.last_error_date || null
        }), { headers: cors() });
      } catch (e) {
        return new Response(JSON.stringify({
          error: e.message || 'Telegram rejected setWebhook',
          webhook: hook
        }), { status: 400, headers: cors() });
      }
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const state = await readState();

    if (action === 'save' && req.method === 'POST') {
      const slug = String(body.slug || '');
      const product = state.catalog.find((p) => p.slug === slug);
      if (!product) return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404, headers: cors() });
      if (typeof body.name === 'string' && body.name.trim()) product.name = body.name.trim();
      if (Number.isFinite(Number(body.price_ngn))) {
        product.price_ngn = Number(body.price_ngn);
        product._priceNeedsReview = false;
      }
      if (['Available', 'Limited Stock', 'Sold Out'].includes(body.status)) {
        product.status = body.status;
        product._statusNeedsReview = false;
      }
      if (typeof body.description === 'string') product.description = body.description.slice(0, 500);
      if (typeof body.reference === 'string') product.reference = body.reference.slice(0, 40);
      if (body.quantity === '' || body.quantity == null) delete product.quantity;
      else if (Number.isFinite(Number(body.quantity))) product.quantity = Number(body.quantity);
      if (Array.isArray(body.images)) product.images = body.images.filter((s) => typeof s === 'string' && s.startsWith('/'));
      await writeState(state);
      return new Response(JSON.stringify({ ok: true, product: publicSafe(product) }), { headers: cors() });
    }

    if (action === 'publish' && req.method === 'POST') {
      const product = state.catalog.find((p) => p.slug === body.slug);
      if (!product) return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404, headers: cors() });
      if (!product.name || product.name.startsWith('Untitled')) {
        return new Response(JSON.stringify({ error: 'Name required before publish' }), { status: 400, headers: cors() });
      }
      if (!product.price_ngn || product._priceNeedsReview) {
        return new Response(JSON.stringify({ error: 'Set a verified price before publish' }), { status: 400, headers: cors() });
      }
      if (!product.images.length) {
        return new Response(JSON.stringify({ error: 'At least one image is required' }), { status: 400, headers: cors() });
      }
      product.published = true;
      const rec = state.imports.find((i) => i.productSlug === product.slug);
      if (rec) rec.status = 'Published';
      await writeState(state);
      return new Response(JSON.stringify({ ok: true, product: publicSafe(product) }), { headers: cors() });
    }

    if (action === 'unpublish' && req.method === 'POST') {
      const product = state.catalog.find((p) => p.slug === body.slug);
      if (!product) return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404, headers: cors() });
      product.published = false;
      await writeState(state);
      return new Response(JSON.stringify({ ok: true }), { headers: cors() });
    }

    if (action === 'skip' && req.method === 'POST') {
      const rec = state.imports.find((i) => i.key === body.key || i.productSlug === body.slug);
      if (rec) rec.status = 'Skipped';
      const product = state.catalog.find((p) => p.slug === (rec && rec.productSlug) || body.slug);
      if (product) product.published = false;
      await writeState(state);
      return new Response(JSON.stringify({ ok: true }), { headers: cors() });
    }

    if (action === 'manual' && req.method === 'POST') {
      const slug = String(body.slug || '').trim();
      if (!slug || !body.name || !Number(body.price_ngn)) {
        return new Response(JSON.stringify({ error: 'Name, slug and price are required' }), { status: 400, headers: cors() });
      }
      if (state.catalog.some((p) => p.slug === slug)) {
        return new Response(JSON.stringify({ error: 'Slug already exists' }), { status: 400, headers: cors() });
      }
      const product = {
        slug,
        name: String(body.name).trim(),
        reference: String(body.reference || ''),
        price_ngn: Number(body.price_ngn),
        status: ['Available', 'Limited Stock', 'Sold Out'].includes(body.status) ? body.status : 'Available',
        description: String(body.description || ''),
        images: String(body.image || '').trim() ? [String(body.image).trim()] : [],
        published: false,
        sortOrder: Date.now()
      };
      state.catalog.push(product);
      await writeState(state);
      return new Response(JSON.stringify({ ok: true, product: publicSafe(product) }), { headers: cors() });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: cors() });
  } catch (e) {
    const msg = e.message || 'Server error';
    const friendly = /chat not found|forbidden|unauthorized/i.test(msg)
      ? 'Unable to read supplier channel. Check Telegram permissions.'
      : /unauthorized/i.test(msg)
        ? 'Invalid Telegram credentials.'
        : msg;
    return new Response(JSON.stringify({ error: friendly }), { status: 500, headers: cors() });
  }
};

export const config = { path: '/api/admin' };
