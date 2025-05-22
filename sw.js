
// sw.js - Service Worker Minimaliste pour PWA Installable

const CACHE_NAME = 'atelier-cse-cache-v5'; // Nom de ton cache (change la version si tu modifies les fichiers)
const URLS_TO_CACHE = [
  '.', // La page d'accueil (index.html)
  'index.html',
  'styles.css',
  'js/main.js',
  'img/favicon.ico', // Ajoute le favicon
  // Ajoute ici les icônes importantes listées dans le manifest
  'icon/icon-192x192.png',
  'icon/icon-512x512.png',
   // Ajoute d'autres ressources statiques importantes si nécessaire
   // (Ex: Polices locales, autres images statiques)
   'https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&family=Patrick+Hand&family=Architects+Daughter&family=Roboto:wght@400;500;700&display=swap', // Cache les polices Google si possible (peut être complexe)
   'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css', // FontAwesome CSS
   // NOTE: Le JS de Firebase, Chart.js, Tabulator etc. depuis les CDN NE SERA PAS mis en cache par défaut ici.
   // Le mode hors ligne complet demanderait une stratégie plus avancée.
];

// Événement d'installation : Mise en cache des ressources statiques (App Shell)
self.addEventListener('install', event => {
  console.log('Service Worker: Installation...');
  event.waitUntil( // Attend que le cache soit rempli
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Mise en cache des fichiers de base');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(err => {
        console.error('Service Worker: Échec de la mise en cache lors de l\'installation', err);
      })
      .then(() => {
          console.log('Service Worker: Installation terminée, passage à l\'activation.');
          return self.skipWaiting(); // Force l'activation immédiate (utile pour les mises à jour)
      })
  );
});

// Événement d'activation : Nettoyage des anciens caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activation...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          // Supprime les caches qui ne correspondent pas au CACHE_NAME actuel
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('Service Worker: Suppression de l\'ancien cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
        console.log('Service Worker: Activation terminée, prêt à contrôler les pages.');
        return self.clients.claim(); // Prend le contrôle immédiat des pages ouvertes
    })
  );
});

/* ------------------------------------------------------------------ */
/*  SW – stratégie “stale-while-revalidate” (cache d’abord, réseau après) */
/* ------------------------------------------------------------------ */
self.addEventListener('fetch', event => {
  // on ignore les requêtes non-GET ou vers Firestore / Google Fonts
  if (event.request.method !== 'GET' ||
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('fonts.gstatic.com')) {
    return;               // on laisse passer
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. on regarde si la ressource est déjà en cache
      const cached = await cache.match(event.request);

      // 2. on lance en parallèle la requête réseau
      const network = fetch(event.request).then(resp => {
        // si la réponse est OK, on met à jour le cache pour la prochaine fois
        if (resp && resp.ok) cache.put(event.request, resp.clone());
        return resp;
      }).catch(() => cached); // hors-ligne : on retombe sur le cache

      // 3. on renvoie tout de suite le cache si dispo, sinon on attend le réseau
      return cached || network;
    })
  );
});
