// js/modules/PWA.js

/**
 * Enregistre le Service Worker.
 * Cette fonction doit être appelée une fois que l'application principale est chargée
 * pour ne pas impacter les performances initiales. Typiquement après l'événement 'load' de window.
 */
export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        // Vérifier si un SW ne contrôle pas déjà la page.
        // Utile pour éviter des ré-enregistrements inutiles à chaque initialisation de l'app,
        // bien que `register()` soit assez intelligent pour ne pas le faire si le script SW n'a pas changé.
        // Cependant, la condition !navigator.serviceWorker.controller est plus pour la première initialisation.
        // Si l'app est déjà contrôlée, on peut supposer qu'il est là.
        // Pour les mises à jour, le navigateur gère le cycle de vie du SW.

        // L'enregistrement est généralement fait une fois au chargement de la page (via window.load).
        // Si cette fonction `registerServiceWorker` est appelée depuis `initializeAppFeatures`
        // (qui est après authentification), l'événement 'load' de la fenêtre est probablement déjà passé.
        // Donc, un appel direct à navigator.serviceWorker.register est souvent suffisant ici.

        console.log("PWA Module: Tentative d'enregistrement du Service Worker...");
        navigator.serviceWorker.register('/sw.js') // Assure-toi que le chemin est correct depuis la racine
            .then(registration => {
                console.log('PWA Module: Service Worker enregistré avec succès ! Scope:', registration.scope);

                // Optionnel : Gérer les mises à jour du Service Worker
                // registration.onupdatefound = () => {
                //   const installingWorker = registration.installing;
                //   if (installingWorker == null) {
                //     return;
                //   }
                //   installingWorker.onstatechange = () => {
                //     if (installingWorker.state === 'installed') {
                //       if (navigator.serviceWorker.controller) {
                //         // Nouveau contenu disponible, SW mis à jour.
                //         // Afficher un message à l'utilisateur pour rafraîchir.
                //         console.log('PWA Module: Nouveau contenu disponible, veuillez rafraîchir.');
                //         // Exemple: showUpdateNotification(); // Fonction à créer pour informer l'utilisateur
                //       } else {
                //         // Contenu mis en cache pour utilisation hors ligne.
                //         console.log('PWA Module: Contenu mis en cache pour utilisation hors ligne.');
                //       }
                //     }
                //   };
                // };
            })
            .catch(error => {
                console.error('PWA Module: Échec de l\'enregistrement du Service Worker:', error);
            });
    } else {
        console.warn("PWA Module: Service Worker non supporté par ce navigateur.");
    }
}

// Pas de listeners spécifiques à attacher depuis ce module.
// Pas de données à charger non plus.
// C'est une fonction utilitaire appelée au bon moment.