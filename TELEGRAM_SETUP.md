# TROTIE MAISON — Telegram supplier import

The storefront is unchanged. Imports land as **drafts**. Nothing goes public until you press Publish in Atelier.

## Credentials (Netlify → Site configuration → Environment variables)

| Variable | Required | What it is |
|---|---|---|
| `ADMIN_KEY` | yes | Secret you invent. Enter the same value on `/admin`. |
| `TELEGRAM_BOT_TOKEN` | yes | From @BotFather |
| `TELEGRAM_SOURCE_CHAT_ID` | yes | Channel or group id, e.g. `-100123…`. Comma-separate if several. |
| `TELEGRAM_WEBHOOK_SECRET` | recommended | Random string. Telegram sends it as `X-Telegram-Bot-Api-Secret-Token`. |

Do not put these in the ZIP or in frontend files.

## Telegram setup

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN`.
2. Add that bot to the supplier channel/group as **administrator** with permission to read messages.
3. Get the chat id:
   - Add [@userinfobot](https://t.me/userinfobot) or post in the chat then open  
     `https://api.telegram.org/bot<TOKEN>/getUpdates`  
     and read `message.chat.id` / `channel_post.chat.id`.
4. Put that id in `TELEGRAM_SOURCE_CHAT_ID`.
5. Deploy this ZIP.
6. Open `https://YOUR-SITE.netlify.app/admin`
7. House key: `maison`
8. ADMIN_KEY: the same value you set in Netlify
9. Press **Set webhook**. The hook URL is `https://YOUR-SITE.netlify.app/api/telegram-webhook`

If the bot is not an admin, imports fail with:  
“Unable to read supplier channel. Check Telegram permissions.”

## Flow

Supplier post → webhook or **Check for new products** → draft in Atelier → Edit → Publish → `/collection` and `/piece/{slug}`

Existing seed products stay. Telegram products use the same product shape.

## Notes

- `getUpdates` and a webhook cannot run at the same time. After the webhook is set, new posts arrive automatically. Use **Check for new products** only before the webhook is set, or after you delete the webhook.
- Images are stored in Netlify Blobs and served at `/api/media/...`. Blobs must be available on the site.
- Videos are recorded on the draft (`hasVideo`) and not forced onto the storefront.
- Public pages never show supplier names, Telegram ids, or import status.
