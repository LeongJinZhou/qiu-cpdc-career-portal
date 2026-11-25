# Test host image (Render, docs/RELEASE.md "Render test copy"): Apache + PHP 8.3 serve the built web app and the API.
# Secrets never enter the image: Render passes them as environment variables and a secret file at run time.

# 1. Build the web app (web/dist).
FROM node:24-bookworm-slim AS web
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY shared ./shared
COPY web ./web
RUN npx vite build --config web/vite.config.ts

# 2. PHP packages (api/vendor). The composer image has unzip and git, which the PHP + Apache image lacks.
FROM composer:2.8 AS vendor
WORKDIR /src/api
COPY api/composer.json api/composer.lock ./
# gd is built into the run-time image below; the composer image only lacks it.
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --optimize-autoloader --no-scripts \
    --ignore-platform-req=ext-gd

# 3. Run time: PHP + Apache.
FROM php:8.3-apache-bookworm
# gd and zip: PDF (mpdf) and Excel (openspout) exports.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libfreetype6-dev libjpeg62-turbo-dev libpng-dev libzip-dev \
    && rm -rf /var/lib/apt/lists/* \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" gd zip pdo_mysql \
    && a2enmod headers remoteip \
    && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && printf 'expose_php = Off\nupload_max_filesize = 16M\npost_max_size = 17M\n' > "$PHP_INI_DIR/conf.d/zz-app.ini"

WORKDIR /app
COPY --from=vendor /src/api/vendor ./api/vendor
COPY api/composer.json ./api/
COPY api/bin ./api/bin
COPY api/migrations ./api/migrations
COPY api/public ./api/public
COPY api/resources ./api/resources
COPY api/src ./api/src
COPY shared ./shared
COPY --from=web /src/web/dist ./web/dist

COPY deploy/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/start.sh /usr/local/bin/sld-start
RUN printf 'Listen ${PORT}\n' > /etc/apache2/ports.conf \
    && chmod 0755 /usr/local/bin/sld-start \
    && mkdir -p /app/storage && chown www-data:www-data /app/storage

# Render sets PORT; 10000 is its default for Docker services.
ENV PORT=10000 STORAGE_DIR=/app/storage
EXPOSE 10000
CMD ["sld-start"]
