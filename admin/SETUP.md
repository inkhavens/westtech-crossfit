# Site Builder sign-in setup (one time, about 10 minutes)

The Site Builder lives at **https://inkhavens.github.io/westtech-crossfit/admin/**.
GitHub Pages can't keep secrets, so a tiny free Cloudflare Worker finishes the GitHub sign-in.

## 1. GitHub OAuth App
GitHub → Settings → Developer settings → OAuth Apps → your app.

| Field | Value |
|---|---|
| Homepage URL | `https://inkhavens.github.io/westtech-crossfit/` |
| Redirect URI | `https://westtech-admin-auth.YOUR-SUBDOMAIN.workers.dev/callback` |

Keep the **Client ID** handy and generate a **Client secret** (shown once). Never put the secret in this repo.

## 2. Cloudflare Worker
1. dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it `westtech-admin-auth` → **Deploy**.
3. **Edit code**, delete what's there, paste everything from `admin/worker/worker.js`, then **Deploy**.
4. Worker → **Settings → Variables and Secrets** → add:
   - `GITHUB_CLIENT_ID` (Text): your Client ID
   - `GITHUB_CLIENT_SECRET` (**Secret**): your Client secret
   - `ALLOWED_RETURN` (Text): `https://inkhavens.github.io/westtech-crossfit/admin/`
5. Copy the Worker's address, e.g. `https://westtech-admin-auth.YOUR-SUBDOMAIN.workers.dev`.
6. Make sure the GitHub OAuth App's Redirect URI is that address + `/callback`.

## 3. Connect the builder
Put the Worker address in `admin/admin-config.js` as `AUTH_URL` (no slash at the end), or ask Claude to do it.

## Who can sign in
Anyone with **write access** to the `inkhavens/westtech-crossfit` repo (repo → Settings → Collaborators). Everyone else sees a locked screen.
