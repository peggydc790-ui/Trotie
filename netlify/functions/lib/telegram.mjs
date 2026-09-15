const API = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

export async function tg(token, method, body) {
  const res = await fetch(API(token, method), {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const desc = data.description || res.statusText || 'Telegram request failed';
    const err = new Error(desc);
    err.code = data.error_code;
    throw err;
  }
  return data.result;
}

export function allowedChat(chatId) {
  const raw = process.env.TELEGRAM_SOURCE_CHAT_ID || '';
  const allow = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (!allow.length) return false;
  return allow.includes(String(chatId));
}

export function extractMedia(message) {
  const photos = [];
  if (Array.isArray(message.photo) && message.photo.length) {
    photos.push(message.photo[message.photo.length - 1]);
  }
  if (message.document && String(message.document.mime_type || '').startsWith('image/')) {
    photos.push({ file_id: message.document.file_id, file_name: message.document.file_name });
  }
  const grouped = [];
  return {
    photos,
    video: message.video ? { file_id: message.video.file_id, mime: message.video.mime_type } : null,
    mediaGroupId: message.media_group_id || null,
    caption: message.caption || '',
    text: message.text || message.caption || ''
  };
}

export async function downloadFile(token, fileId) {
  const file = await tg(token, 'getFile', { file_id: fileId });
  if (!file.file_path) throw new Error('Telegram file path missing');
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed image download from Telegram');
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (file.file_path.split('.').pop() || 'jpg').toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw new Error('Unsupported image');
  }
  if (buf.length > 8_000_000) throw new Error('Image too large');
  return { buf, mime, ext };
}
