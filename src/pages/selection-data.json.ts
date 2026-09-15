import type { APIRoute } from 'astro';
import { getPublishedProducts } from '../lib/products';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      getPublishedProducts().map((p) => ({
        slug: p.slug,
        name: p.name,
        reference: p.reference || '',
        price_ngn: p.price_ngn,
        status: p.status,
        published: p.published
      }))
    ),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    }
  );
