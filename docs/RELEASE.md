# RELEASE: how to put the portal online

Two places: **Render** (test copy, from GitHub, automatic) and **Exabytes** (production, cPanel upload).
Secrets are typed into Render or the server's `.env` only. Never into GitHub, never into chat.

## 1. Sign-in providers (once)

### Google (students and staff)
Google Cloud Console, the OAuth client of type "Web application" (the founder's existing QIU client can be reused):
- Authorised redirect URIs: `https://<host>/api/auth/google/callback` for every host (Render and Exabytes).
- OAuth consent screen: Internal (QIU Workspace) is best. Scopes: openid, email, profile,
  `.../auth/user.organization.read`, `.../auth/directory.readonly` (same as sld-orientation).
- People API must be enabled in that project.

### LinkedIn (link, and alumni sign-in)
LinkedIn Developer portal, your app:
- Products: **Sign In with LinkedIn using OpenID Connect** (no other product needed).
- Auth, Authorized redirect URLs: `https://<host>/api/auth/linkedin/callback` for every host.
- The old portal's `/api/onboarding/oauth/linkedin/callback` URL is no longer used.

### GitHub (optional)
GitHub, Settings, Developer settings, OAuth Apps: callback `https://<host>/api/auth/github/callback`.

## 2. Database (MySQL 8)
- Render has no MySQL. Use an external MySQL with TLS, e.g. the Aiven free plan (as sld-orientation): create a
  database `qiu_cpdc` and a user; download the CA certificate.
- Exabytes: cPanel, MySQL Databases: create database and user, give the user ALL on that database.
- Tables are created by `php api/bin/migrate.php` (Render runs it at every start).

## 3. Render test copy
1. Render, New, Blueprint, pick the GitHub repo `qiu-cpdc-portal`, branch `main` (uses `render.yaml`).
2. Fill every value marked "sync: false":
   - `APP_URL` = `https://<service>.onrender.com`
   - `SUPERADMIN_EMAIL` = `ai@qiu.edu.my`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - Secret Files: `db-ca.pem` = the database CA certificate.
3. Deploy. Check `https://<service>.onrender.com/api/health` says `{"status":"ok"}`.
4. Sign in with `ai@qiu.edu.my`: you are super admin.

## 4. Exabytes (cPanel shared hosting, production)
Needs PHP 8.3 (cPanel, Select PHP Version: 8.3 with `pdo_mysql`, `mbstring`, `openssl`, `json`, `fileinfo`).
1. On a laptop: `npm ci && npm run build` and `composer install --no-dev --optimize-autoloader` in `api/`.
2. Upload (File Manager or SFTP) to `/home/<user>/cpdc/` (NOT inside public_html):
   `api/` (with `vendor/`), `shared/`, `web/dist/`, `.env`, and an empty `storage/` (mode 700).
3. Point the domain's document root at `/home/<user>/cpdc/api/public` if cPanel allows it. If it does not:
   copy `web/dist/*` into `public_html/`, and put `deploy/exabytes/.htaccess` and `deploy/exabytes/index.php`
   into `public_html/` (they send `/api/*` to the app above public_html).
4. `.env` (above public_html, chmod 600): copy `.env.example`, set `APP_ENV=production`, `APP_URL=https://<domain>`,
   `STORAGE_DIR=/home/<user>/cpdc/storage`, the database, Google, LinkedIn values and the production bases
   (`https://accounts.google.com`, `https://people.googleapis.com`, `https://www.linkedin.com`,
   `https://api.linkedin.com`). Leave `DB_SSL_CA` empty for a database on the same server.
5. cPanel Terminal (or a one-off cron): `php /home/<user>/cpdc/api/bin/migrate.php`.
6. Force HTTPS (cPanel, Domains, Force HTTPS Redirect). The session cookie only works over HTTPS.

## 5. After each release
- `/api/health` answers ok; sign in once with Google and once with LinkedIn (an alumni account).
- Never run `api/bin/seed.php` on Render or Exabytes: it deletes users (it refuses when APP_ENV=production).
