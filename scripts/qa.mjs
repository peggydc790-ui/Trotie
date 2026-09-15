import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const mode = process.argv.includes('--prod') || process.env.TM_BUILD_MODE === 'production' ? 'prod' : 'review';
const products = JSON.parse(readFileSync(join(root, 'content/products.json'), 'utf8'));
if (!Array.isArray(products)) throw new Error('content/products.json must be an array');

const required = [
  'src/pages/404.astro',
  'src/pages/piece/[slug].astro',
  'src/pages/selection.astro',
  'src/pages/selection-data.json.ts',
  'src/lib/whatsapp.ts',
  'public/assets/tm-emblem-exact.png',
  'public/fonts/source-serif-4-400.woff2',
  'public/fonts/source-sans-3-400.woff2',
  'netlify.toml',
  'package-lock.json'
];
for (const file of required) {
  if (!existsSync(join(root, file))) throw new Error(`Missing required file: ${file}`);
}

const scanFiles = [
  'src/pages/index.astro',
  'src/pages/collection.astro',
  'src/pages/house.astro',
  'src/pages/concierge.astro',
  'src/pages/policy.astro',
  'src/pages/selection.astro',
  'src/pages/404.astro',
  'src/components/Header.astro',
  'src/components/Footer.astro'
];
const banned = [
  'ARRIVING MOMENTARILY',
  'TM / 01',
  'THE WATCH HOUSE',
  'COMING SOON',
  'coming soon',
  'PRIVATE DESK',
  'Swiss-made',
  'Swiss movement',
  'Powered by Netlify',
  'href="/#"',
  "href='#'",
  'href="#"'
];
for (const file of scanFiles) {
  const text = readFileSync(join(root, file), 'utf8');
  for (const needle of banned) {
    if (text.includes(needle)) throw new Error(`${file} contains banned copy: ${needle}`);
  }
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (!pkg.dependencies?.astro) throw new Error('astro must be in dependencies');
if (pkg.dependencies.astro === 'latest') throw new Error('Astro must not use latest');
if (pkg.dependencies['@astrojs/netlify'] || pkg.dependencies['@sanity/client']) {
  throw new Error('Unused adapter/Sanity dependency remains');
}

if (mode === 'review' && products.length !== 0) {
  throw new Error('Review build must keep content/products.json = []');
}
if (mode === 'prod') {
  const published = products.filter((p) => p?.published === true);
  if (published.length < 1) throw new Error('Production QA requires at least one published product');
}

console.log(`QA PASS (${mode}): required files present; storefront checks passed.`);
