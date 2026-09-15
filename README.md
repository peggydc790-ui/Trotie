# TROTIE MAISON — Launch Build

Brand-new watches, selected in Nigeria.
MADE FOR THE TOP MEMBER.
WhatsApp: +234 701 183 8440

`content/products.json` is intentionally `[]`. Do not invent watches.

## Commands

```bash
npm install
npm run dev
npm run build
npm run qa:review
npm run qa:prod
```

Netlify publishes `dist` with `npx astro build`. Empty catalog does not fail the Netlify build.

## Adding watches later

1. Put photographs in `public/assets/products/<slug>/01.jpg`
2. Add a published object to `content/products.json`
3. Run `npm run qa:prod` then `npm run build`
