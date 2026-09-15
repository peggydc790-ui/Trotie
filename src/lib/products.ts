import raw from '../../content/products.json';

export type Status = 'Available' | 'Limited Stock' | 'Sold Out';
export type Product = {
  slug: string;
  name: string;
  reference?: string;
  price_ngn: number;
  status: Status;
  quantity?: number;
  description?: string;
  specifications?: { label: string; value: string }[];
  images: string[];
  published: boolean;
  sortOrder?: number;
};

const statuses: Status[] = ['Available', 'Limited Stock', 'Sold Out'];

export function getPublishedProducts(): Product[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Product[])
    .filter((p) =>
      p?.published === true &&
      typeof p.slug === 'string' && p.slug.trim() &&
      typeof p.name === 'string' && p.name.trim() &&
      typeof p.price_ngn === 'number' && Number.isFinite(p.price_ngn) && p.price_ngn >= 0 &&
      statuses.includes(p.status) &&
      Array.isArray(p.images) && p.images.length > 0 &&
      p.images.every((src) => typeof src === 'string' && src.trim())
    )
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function money(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(value);
}
