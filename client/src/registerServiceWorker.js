/**
 * Enregistrement du Service Worker PWA pour UK-GED
 */

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[UK-GED PWA] Service Worker actif, scope :', registration.scope);

          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) return;
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[UK-GED PWA] Nouvelle version disponible.');
                } else {
                  console.log('[UK-GED PWA] Contenu pré-chargé pour utilisation PWA.');
                }
              }
            };
          };
        })
        .catch((error) => {
          console.warn('[UK-GED PWA] Échec enregistrement Service Worker :', error);
        });
    });
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
