import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function seedProducts() {
  try {
    const raw = readFileSync(join(__dirname, '../_seed-products.json'), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function blobs() {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore('trotie-maison');
  } catch {
    return null;
  }
}

const mem = globalThis.__tmStore || (globalThis.__tmStore = { catalog: null, imports: null, seenChats: null });

export async function readState() {
  const store = await blobs();
  if (store) {
    const catalog = (await store.get('catalog', { type: 'json' })) || [];
    const imports = (await store.get('imports', { type: 'json' })) || [];
    const seenChats = (await store.get('seenChats', { type: 'json' })) || [];
    return {
      catalog: Array.isArray(catalog) ? catalog : [],
      imports: Array.isArray(imports) ? imports : [],
      seenChats: Array.isArray(seenChats) ? seenChats : []
    };
  }
  return {
    catalog: mem.catalog || [],
    imports: mem.imports || [],
    seenChats: mem.seenChats || []
  };
}

export async function writeState(state) {
  const store = await blobs();
  if (store) {
    await store.setJSON('catalog', state.catalog);
    await store.setJSON('imports', state.imports);
    await store.setJSON('seenChats', state.seenChats || []);
    return;
  }
  mem.catalog = state.catalog;
  mem.imports = state.imports;
  mem.seenChats = state.seenChats || [];
}

export async function recordSeenChat(message) {
  if (!message || !message.chat) return;
  const chat = message.chat;
  const entry = {
    id: chat.id,
    type: chat.type || '',
    title: String(chat.title || chat.username || '').slice(0, 80),
    username: chat.username ? `@${chat.username}` : '',
    messageId: message.message_id || null,
    seenAt: new Date().toISOString()
  };
  const state = await readState();
  const rest = (state.seenChats || []).filter((c) => String(c.id) !== String(entry.id));
  state.seenChats = [entry, ...rest].slice(0, 20);
  await writeState(state);
  return entry;
}

export function publicProduct(p) {
  if (!p || p.published !== true) return null;
  return {
    slug: p.slug,
    name: p.name,
    reference: p.reference || '',
    price_ngn: p.price_ngn,
    status: p.status,
    quantity: p.quantity,
    description: p.description || '',
    specifications: Array.isArray(p.specifications) ? p.specifications : [],
    images: Array.isArray(p.images) ? p.images : [],
    published: true,
    sortOrder: p.sortOrder || 0
  };
}

export function mergedPublished() {
  return Promise.resolve().then(async () => {
    const seed = seedProducts().filter((p) => p.published);
    const { catalog } = await readState();
    const overlay = catalog.filter((p) => p.published);
    const map = new Map();
    for (const p of seed) map.set(p.slug, publicProduct(p));
    for (const p of overlay) {
      const clean = publicProduct(p);
      if (clean) map.set(clean.slug, clean);
    }
    return [...map.values()].filter(Boolean).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  });
}

export async function putMedia(id, buf, mime) {
  const store = await blobs();
  if (!store) throw new Error('Media storage is not available on this deploy. Netlify Blobs is required.');
  await store.set(`media/${id}`, buf, { metadata: { mime } });
}

export async function getMedia(id) {
  const store = await blobs();
  if (!store) return null;
  const blob = await store.getWithMetadata(`media/${id}`, { type: 'arrayBuffer' });
  if (!blob || !blob.data) return null;
  return { buf: Buffer.from(blob.data), mime: (blob.metadata && blob.metadata.mime) || 'image/jpeg' };
}

export { seedProducts };
