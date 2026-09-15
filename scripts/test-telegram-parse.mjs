import { parseSupplierText, telegramKey } from '../netlify/functions/lib/parse.mjs';

const cases = [
  ['POEDAGAR CHAIN\n₦35,000\nAvailable', { name: 'POEDAGAR CHAIN', price_ngn: 35000, status: 'Available', priceNeedsReview: false }],
  ['PATEK PHILIPPE\nPrice: 100000\nLimited Stock', { name: 'PATEK PHILIPPE', price_ngn: 100000, status: 'Limited Stock' }],
  ['New Arrival\nPOEDAGAR Men’s Watch\n35000', { price_ngn: 35000, status: 'Available' }],
  ['Watch only photo caption', { priceNeedsReview: true }],
  ['Sold out\nCASIO\n25000', { status: 'Sold Out', price_ngn: 25000 }],
  ['Stock: 5\nCURREN\n₦35,000', { quantity: 5, price_ngn: 35000 }]
];

let fail = 0;
for (const [text, expect] of cases) {
  const got = parseSupplierText(text);
  for (const [k, v] of Object.entries(expect)) {
    if (got[k] !== v) {
      console.error('FAIL', text.replace(/\n/g, ' | '), k, 'got', got[k], 'want', v);
      fail += 1;
    }
  }
}
if (telegramKey(1, 2) !== '1:2') { console.error('key fail'); fail += 1; }
if (fail) { console.error(fail, 'failures'); process.exit(1); }
console.log('parse tests passed', cases.length);
