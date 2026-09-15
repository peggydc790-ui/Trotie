import { getMedia } from './lib/store.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || url.pathname.split('/').pop();
  if (!id || id.includes('..') || id.includes('/')) {
    return new Response('Not found', { status: 404 });
  }
  const media = await getMedia(id);
  if (!media) return new Response('Not found', { status: 404 });
  return new Response(media.buf, {
    headers: {
      'Content-Type': media.mime,
      'Cache-Control': 'public, max-age=86400'
    }
  });
};

export const config = { path: '/api/media/:id' };
