export const WHATSAPP_PHONE = '2347011838440';
const MAX = 900;

const clean = (v: string) =>
  String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);

const naira = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

function encode(lines: string[]) {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(lines.join('\n').slice(0, MAX))}`;
}

export function genericWhatsAppUrl() {
  return encode(['Hello TROTIE MAISON, I would like to enquire about your watches.']);
}

export function buildWhatsAppUrl(input: {
  mode: 'reserve' | 'enquire';
  name: string;
  reference?: string;
  price?: number;
}) {
  const lines = [
    input.mode === 'reserve'
      ? 'Hello TROTIE MAISON, I would like to reserve this piece.'
      : 'Hello TROTIE MAISON, I would like to enquire about this piece.',
    clean(input.name)
  ];
  if (input.reference) lines.push(clean(input.reference));
  if (typeof input.price === 'number') lines.push(naira(input.price));
  return encode(lines);
}

export function buildSelectionWhatsApp(
  items: { name: string; reference?: string; price_ngn: number; status: string }[]
) {
  const lines = ['Hello TROTIE MAISON, I would like to checkout my selection.'];
  for (const item of items) {
    const bits = [clean(item.name)];
    if (item.reference) bits.push(clean(item.reference));
    bits.push(naira(item.price_ngn));
    bits.push(clean(item.status));
    lines.push(`• ${bits.join(' · ')}`);
  }
  lines.push('Delivery across Nigeria. Fee confirmed on WhatsApp.');
  return encode(lines);
}
