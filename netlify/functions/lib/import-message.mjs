import { parseSupplierText, slugify, telegramKey } from './parse.mjs';
import { readState, writeState, putMedia } from './store.mjs';
import { allowedChat, extractMedia, downloadFile } from './telegram.mjs';

function sanitizeText(s) {
  return String(s || '').replace(/[<>]/g, '').slice(0, 4000);
}

export async function importTelegramMessage(message, token) {
  if (!message || !message.chat || !message.message_id) {
    return { status: 'Failed', error: 'Malformed Telegram message' };
  }
  const chatId = message.chat.id;
  if (!allowedChat(chatId)) {
    return { status: 'Skipped', error: 'Unauthorized source channel. Check TELEGRAM_SOURCE_CHAT_ID.' };
  }
  const key = telegramKey(chatId, message.message_id);
  const state = await readState();
  const existing = state.imports.find((i) => i.key === key);
  if (existing) {
    return { status: 'Already imported', import: existing };
  }
  const groupId = message.media_group_id ? `${chatId}:${message.media_group_id}` : null;
  if (groupId) {
    const sibling = state.imports.find((i) => i.telegram && i.telegram.mediaGroupId === message.media_group_id && String(i.telegram.chatId) === String(chatId));
    if (sibling) {
      const product = state.catalog.find((p) => p.slug === sibling.productSlug);
      const media = extractMedia(message);
      if (product && media.photos[0]) {
        try {
          const file = await downloadFile(token, media.photos[0].file_id);
          const id = `${chatId}_${message.message_id}_0.${file.ext}`;
          await putMedia(id, file.buf, file.mime);
          product.images.push(`/api/media/${id}`);
          sibling.imageCount = product.images.length;
          sibling.status = 'Draft Created';
          await writeState(state);
        } catch (e) {
          sibling.error = e.message;
          await writeState(state);
        }
      }
      return { status: 'Already imported', import: sibling };
    }
  }

  const media = extractMedia(message);
  const parsed = parseSupplierText(media.text);
  const images = [];
  const errors = [];
  for (let i = 0; i < media.photos.length; i += 1) {
    try {
      const file = await downloadFile(token, media.photos[i].file_id);
      const id = `${chatId}_${message.message_id}_${i}.${file.ext}`;
      await putMedia(id, file.buf, file.mime);
      images.push(`/api/media/${id}`);
    } catch (e) {
      errors.push(e.message);
    }
  }

  let importStatus = 'Draft Created';
  if (!parsed.name) importStatus = 'Needs Review';
  if (parsed.priceNeedsReview) importStatus = 'Needs Review';
  if (!images.length) importStatus = 'Needs Review';

  const slugBase = slugify(parsed.name || `telegram-${message.message_id}`);
  let slug = slugBase;
  const used = new Set([...state.catalog.map((p) => p.slug)]);
  let n = 2;
  while (used.has(slug)) { slug = `${slugBase}-${n}`; n += 1; }

  const product = {
    slug,
    name: parsed.name || `Untitled ${message.message_id}`,
    reference: '',
    price_ngn: parsed.price_ngn == null ? 0 : parsed.price_ngn,
    status: parsed.status,
    quantity: parsed.quantity,
    description: parsed.description || '',
    specifications: [],
    images,
    published: false,
    sortOrder: Date.now(),
    _priceNeedsReview: parsed.priceNeedsReview,
    _statusNeedsReview: parsed.statusNeedsReview,
    _telegram: {
      chatId,
      messageId: message.message_id,
      date: message.date,
      text: sanitizeText(media.text),
      videoFileId: media.video ? media.video.file_id : null,
      mediaGroupId: media.mediaGroupId
    }
  };

  const record = {
    key,
    status: importStatus,
    createdAt: new Date().toISOString(),
    telegram: product._telegram,
    productSlug: slug,
    notes: [...parsed.notes, ...errors],
    imageCount: images.length,
    error: errors[0] || ''
  };

  state.catalog.push(product);
  state.imports.unshift(record);
  await writeState(state);
  return { status: importStatus, import: record, product };
}
