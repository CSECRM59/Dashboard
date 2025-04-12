// sw.js - Service Worker Minimaliste pour PWA Installable

const CACHE_NAME = 'atelier-cse-cache-v1'; // Nom de ton cache (change la version si tu modifies les fichiers)
const URLS_TO_CACHE = [
  '.', // La page d'accueil (index.html)
  'index.html',
  'styles.css',
  'script.js',
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

// Événement fetch : Stratégie Cache-First pour les ressources statiques
// (Pour le moment, il répond depuis le cache si trouvé, sinon réseau)
self.addEventListener('fetch', event => {
   // Ne pas intercepter les requêtes non-GET ou vers Firebase (laisser Firebase gérer)
   if (event.request.method !== 'GET' || event.request.url.includes('firestore.googleapis.com')) {
     //console.log('SW: Ignoré (Non-GET ou Firestore)', event.request.url);
     return;
   }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Trouvé dans le cache : on renvoie la réponse cachée
        if (response) {
          //console.log('SW: Réponse depuis le cache:', event.request.url);
          return response;
        }

        // Non trouvé dans le cache : on requête le réseau
        //console.log('SW: Réponse depuis le réseau:', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // Optionnel: Mettre en cache la nouvelle réponse pour la prochaine fois?
            // Attention: Ceci est très basique, ne pas mettre en cache des réponses d'API dynamiques ici sans stratégie.
            /*
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                 return networkResponse; // Ne cache que les ressources valides de notre domaine
             }
             let responseToCache = networkResponse.clone();
             caches.open(CACHE_NAME)
               .then(cache => {
                 cache.put(event.request, responseToCache);
               });
            */
            return networkResponse; // Renvoyer la réponse du réseau
          }
        ).catch(error => {
             console.error("SW: Erreur Fetch (probablement hors ligne et non mis en cache):", error);
             // Optionnel : Renvoyer une page "hors ligne" générique ici si vous en avez une en cache
             // return caches.match('/offline.html');
        });
      })
  );
});