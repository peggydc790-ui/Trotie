const STATUS_AVAILABLE = /\b(available|in stock|new arrival|new arrivals|ready)\b/i;
const STATUS_LIMITED = /\b(limited stock|limited|few left|selling fast)\b/i;
const STATUS_SOLD = /\b(sold out|unavailable|out of stock|\bsold\b)\b/i;
const QTY = /\b(?:stock|qty|quantity)\s*[:#-]?\s*(\d{1,4})\b/i;
const PRICE = /(?:ngn|naira|price)?\s*[₦N]?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,8})(?:\s*(?:ngn|naira))?/i;

export function slugify(name) {
  const s = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return s || `piece-${Date.now().toString(36)}`;
}

export function parseSupplierText(text) {
  const raw = String(text || '').replace(/\u00a0/g, ' ').trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const notes = [];
  let price_ngn = null;
  let priceNeedsReview = true;
  const priceLine = lines.find((l) => PRICE.test(l) && !/ref|model|mm\b/i.test(l));
  if (priceLine) {
    const m = priceLine.match(PRICE);
    if (m) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n >= 1000 && n <= 20000000) {
        price_ngn = n;
        priceNeedsReview = false;
      }
    }
  }

  let status = 'Available';
  let statusNeedsReview = true;
  const blob = raw;
  if (STATUS_SOLD.test(blob)) { status = 'Sold Out'; statusNeedsReview = false; }
  else if (STATUS_LIMITED.test(blob)) { status = 'Limited Stock'; statusNeedsReview = false; }
  else if (STATUS_AVAILABLE.test(blob)) { status = 'Available'; statusNeedsReview = false; }

  let quantity;
  const q = raw.match(QTY);
  if (q) quantity = Number(q[1]);

  const skip = /^(price|available|sold|limited|stock|qty|quantity|ngn|naira|new arrival)[:\s]/i;
  const nameLine = lines.find((l) => {
    if (skip.test(l)) return false;
    if (PRICE.test(l) && l.length < 24) return false;
    if (/^\d+$/.test(l)) return false;
    return l.length >= 3;
  });
  const name = nameLine ? nameLine.replace(/[✨⭐️]/g, '').trim() : '';

  const description = lines
    .filter((l) => l !== nameLine && !PRICE.test(l) && !STATUS_SOLD.test(l) && !STATUS_LIMITED.test(l) && !STATUS_AVAILABLE.test(l) && !QTY.test(l))
    .join(' ')
    .slice(0, 280);

  if (!name) notes.push('NAME NEEDS REVIEW');
  if (priceNeedsReview) notes.push('PRICE NEEDS REVIEW');
  if (statusNeedsReview) notes.push('STATUS NEEDS REVIEW');

  return {
    name,
    price_ngn,
    priceNeedsReview,
    status,
    statusNeedsReview,
    quantity: Number.isFinite(quantity) ? quantity : undefined,
    description,
    notes
  };
}

export function telegramKey(chatId, messageId) {
  return `${chatId}:${messageId}`;
}
