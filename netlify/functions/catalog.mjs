import { mergedPublished } from './lib/store.mjs';

export default async () => {
  const products = await mergedPublished();
  return new Response(JSON.stringify(products), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
};

export const config = { path: '/api/catalog' };
