// js/utils.js

/**
 * Applique une rotation aléatoire aux éléments correspondants au sélecteur.
 * @param {string} selector Sélecteur CSS.
 */
export function applyRandomRotation(selector) {
    const activeSection = document.querySelector('.content.active');
    const container = activeSection || document; // Limite la recherche à la section active si possible
    container.querySelectorAll(selector).forEach(item => {
        const randomRotation = Math.random() * 6 - 3; // -3 à +3 deg
        item.style.transform = `rotate(${randomRotation}deg)`;
    });
}

/**
 * Affiche une notification globale.
 * (Ceci est une version simplifiée, vous pourriez la rendre plus sophistiquée)
 * @param {string} message Message à afficher.
 * @param {boolean} isError True si c'est un message d'erreur.
 */
export function showGlobalNotification(message, isError = false) {
    console.log(`Notification: ${message} (Erreur: ${isError})`);
    // Tenter d'utiliser la div de message de la section badges si elle est active, sinon alert.
    // Idéalement, créer un conteneur de notification global.
    const badgeMessageDiv = document.getElementById('badge-message');
    const currentActiveSectionId = document.querySelector('.content.active')?.id;

    if (badgeMessageDiv && currentActiveSectionId === 'section-badges') {
        badgeMessageDiv.textContent = message;
        badgeMessageDiv.style.color = isError ? 'var(--danger-couleur)' : '#2e7d32';
        badgeMessageDiv.style.borderColor = isError ? 'var(--danger-couleur)' : '#a5d6a7';
        badgeMessageDiv.style.backgroundColor = isError ? '#ffebee' : '#e8f5e9';
        badgeMessageDiv.style.display = 'block';
    } else {
        alert(message); // Fallback
    }
}

// Renommer showNotification en showGlobalNotification pour éviter les conflits
// si des modules ont leur propre showNotification locale.
export { showGlobalNotification as showNotification };