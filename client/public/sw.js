/**
 * UK-GED Service Worker — Université de Kindia
 * Stratégie de sécurité stricte :
 * - AUCUN cache pour les flux d'API métier (/api/*)
 * - AUCUN cache pour les pièces jointes, signatures et documents sensibles (/uploads/*)
 * - Cache uniquement réservé à la coquille applicative statique (UI, CSS, JS, polices)
 */

const CACHE_NAME = 'uk-ged-app-shell-v1';

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/favicon-32x32.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/logo_univ_kindia_officiel.png'
];

// 1. Installation du Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn('[UK-GED SW] Avertissement lors du précache statique :', err);
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// 2. Activation et purge des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[UK-GED SW] Nettoyage ancien cache :', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. Gestion des requêtes réseau
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Uniquement les requêtes GET
  if (request.method !== 'GET') {
    return;
  }

  // RÈGLE DE SÉCURITÉ ABSOLUE 1 :
  // Les requêtes API (/api/*) sont TOUJOURS en direct réseau (Network-Only).
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ 
            error: 'Connexion réseau requise pour accéder aux services UK-GED.' 
          }), 
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // RÈGLE DE SÉCURITÉ ABSOLUE 2 :
  // Les documents administratifs, courriers, bordereaux et signatures (/uploads/*)
  // ne sont JAMAIS stockés dans le cache Service Worker.
  if (url.pathname.startsWith('/uploads')) {
    event.respondWith(fetch(request));
    return;
  }

  // RÈGLE 3 : Requêtes de navigation SPA (HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // RÈGLE 4 : Assets statiques (JS, CSS, Polices Google Fonts, Icônes locales)
  const isStaticAsset = 
    url.origin === self.location.origin && (
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.woff2')
    );

  const isGoogleFont = 
    url.origin.includes('fonts.googleapis.com') || 
    url.origin.includes('fonts.gstatic.com');

  if (isStaticAsset || isGoogleFont) {
    // Stale-While-Revalidate pour les assets statiques
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Comportement par défaut : passage direct au réseau
  event.respondWith(fetch(request));
});
