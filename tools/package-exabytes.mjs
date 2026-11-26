// Builds the Exabytes (cPanel) upload in dist/exabytes, laid out like the hosting account's home folder:
//   cpdc/         the app, above public_html (api with vendor, shared, migrations, an empty storage)
//   public_html/  the built web app plus deploy/exabytes/.htaccess and index.php, which hand /api/* to cpdc/
// The Render image is built from this same folder, so Render runs exactly what is uploaded to Exabytes.
// Needs web/dist (npm run build) and api/vendor (composer install --no-dev) first.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.argv[2] ?? 'dist/exabytes');
const from = (path) => join(root, path);

for (const needed of ['web/dist/index.html', 'api/vendor/autoload.php']) {
  if (!existsSync(from(needed))) {
    console.error(`Missing ${needed}: run "npm run build" and "composer install --no-dev" in api/ first.`);
    process.exit(1);
  }
}

rmSync(out, { recursive: true, force: true });
const app = join(out, 'cpdc');
for (const path of ['api/bin', 'api/migrations', 'api/public', 'api/src', 'api/vendor', 'api/composer.json', 'shared', '.env.example']) {
  cpSync(from(path), join(app, path), { recursive: true });
}
mkdirSync(join(app, 'storage'), { recursive: true });

const site = join(out, 'public_html');
cpSync(from('web/dist'), site, { recursive: true });
cpSync(from('deploy/exabytes/.htaccess'), join(site, '.htaccess'));
cpSync(from('deploy/exabytes/index.php'), join(site, 'index.php'));

console.log(`Exabytes upload ready in ${out}: cpdc/ goes in your home folder, public_html/ into public_html.`);
