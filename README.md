# Projects Hub

A single-user Next.js dashboard that hosts multiple internal tools, dashboards,
and data utilities behind one branded shell. Designed to be self-hosted on
Vercel + Firebase, with a single allow-listed sign-in email.

**Stack:** Next.js 15 (App Router) · Tailwind v4 · Headless UI · Framer Motion
· Firebase (Auth + Firestore + Storage) · deployed on Vercel.

## Built-in tabs

| Tab           | Route       | Description |
|---------------|-------------|-------------|
| Maps Contacts | `/contacts` | Business contacts scraped from Google Maps by the companion Chromium extension (`../gmaps-scraper/`), upserted into Firestore, filterable + exportable. |
| Account       | `/account`  | Display name, email verification, phone link/verify, avatar. |

To add a new tab:

1. Create `src/app/<your-tab>/page.tsx`.
2. Add an entry to `NAV` in `src/components/AppLayout.tsx`
   (Heroicon outline + solid, label, route).

---

## ⚠️ Security model — read first

This app is built for **a single owner**. There is intentionally **no public
sign-up**.

- Sign-in is restricted to one email address via `NEXT_PUBLIC_ALLOWED_EMAIL`.
- The user account itself must be created manually in
  **Firebase Console → Authentication → Users → Add user**.
- Firestore rules (below) enforce: `contacts/*` is read-only from the web,
  writes only via the server (Admin SDK behind an API key); `users/{uid}` is
  scoped to its owner.
- All writes from the browser extension go through `/api/contacts/upload`,
  which requires a shared secret in the `x-api-key` header.
- **Secrets never live in the repo.** Anything sensitive belongs in
  `.env.local` (gitignored) or in Vercel project env vars. See
  [SECURITY.md](../SECURITY.md).

> **If you see `FirebaseError: [code=permission-denied]` in the browser
> console**, your Firestore or Storage rules haven't been published yet.
> Paste the rules in §1 below into the Firebase Console and click **Publish**.
> The app will continue to work in degraded mode (UI works, profile won't
> persist) until you do.

---

## Setup

### 1. Firebase

1. Create a project at https://console.firebase.google.com.
2. **Build → Firestore Database** → create in production mode.
3. **Build → Storage** → click *Get started* (used for avatars).
4. **Project settings → General → Your apps** → add a Web app → copy the
   config into the `NEXT_PUBLIC_FIREBASE_*` env vars below.
5. **Project settings → Service accounts → Generate new private key** →
   download JSON. This JSON belongs **only** in your local `.env.local` and
   in Vercel as `FIREBASE_SERVICE_ACCOUNT`. Never commit it.

#### Firestore rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public web is read-only. Writes come from either the Admin SDK
    // (server-side upload endpoint) OR an authenticated user — the latter
    // lets the browser extension push contacts directly using the user's
    // ID token (no API key round-trip). Since email/password sign-up is
    // disabled in your Firebase Auth config, only accounts you create can
    // ever satisfy `request.auth != null`.
    match /contacts/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    // Each signed-in user can only read/write their own profile doc.
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

#### Storage rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Avatars: anyone can read (so <img> works), only the owner can write
    // their own `{uid}.svg` file. Capped at 1 MB and must be an image type.
    match /avatars/{file} {
      allow read: if true;
      allow write: if request.auth != null
                   && file == request.auth.uid + ".svg"
                   && request.resource.size < 1 * 1024 * 1024
                   && request.resource.contentType.matches("image/.*");
    }
  }
}
```

#### Enable sign-in methods

**Authentication → Sign-in method** → enable:

- **Email/Password** — then in **Users**, click *Add user* and create your
  own account with the email you'll set in `NEXT_PUBLIC_ALLOWED_EMAIL`.
- **Phone** — required to link a phone number on the Account page.

### 2. Env vars

```bash
cp .env.local.example .env.local
# fill in every value (.env.local is gitignored)
```

| Var                              | Where it's used  | Sensitive? |
|----------------------------------|------------------|------------|
| `NEXT_PUBLIC_ALLOWED_EMAIL`      | Client + UI gate | No (but ties UI to you) |
| `NEXT_PUBLIC_SITE_NAME`          | Branding         | No |
| `NEXT_PUBLIC_OWNER_NAME`         | Metadata         | No |
| `NEXT_PUBLIC_SITE_URL`           | Metadata base    | No |
| `NEXT_PUBLIC_FIREBASE_*`         | Web SDK          | Public by design — protected by Firebase rules |
| `FIREBASE_SERVICE_ACCOUNT`       | Admin SDK (server only) | **YES — full project access** |
| `UPLOAD_API_KEY`                 | `/api/contacts/upload` auth | **YES** |

> **`FIREBASE_SERVICE_ACCOUNT`** is the full service-account JSON, on a
> single line, with `\n` left escaped inside `private_key`. Quick way:
>
> ```bash
> node -e "console.log(JSON.stringify(require('./serviceAccount.json')))"
> ```

### 3. Run locally

```bash
npm install
npm run dev
# open http://localhost:3000 → redirects to /login
```

### 4. Deploy to Vercel

1. Push the repo to GitHub.
2. Import into Vercel.
3. **Project Settings → Environment Variables** — copy every var from your
   `.env.local`. (Vercel encrypts these at rest; they are never exposed to
   the client unless prefixed `NEXT_PUBLIC_`.)
4. **Settings → Domains** → add your custom domain.

---

## Companion extension

See [`../gmaps-scraper/README.md`](../gmaps-scraper/README.md). After
deploying, configure the extension popup with:

- **Endpoint URL:** `https://<your-domain>/api/contacts/upload`
- **API key:** the value of `UPLOAD_API_KEY` from your env

The endpoint accepts:

```http
POST /api/contacts/upload
Content-Type: application/json
x-api-key: <UPLOAD_API_KEY>

{
  "query": "dentists in oakland",
  "contacts": [{ "place_url": "https://maps.google.com/...", "name": "…", … }]
}
```

Each contact is upserted with document id `sha1(place_url)`, so re-scraping
merges instead of duplicating.

---

## License

MIT — see [LICENSE](../LICENSE).
