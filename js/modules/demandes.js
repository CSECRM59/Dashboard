// js/modules/demandes.js
import { getDb, updateDocumentStatus as fbUpdateStatus } from '../firebaseService.js'; // fbUpdateStatus pour éviter conflit
import { showNotification } from '../utils.js';
import { COLLECTIONS } from '../config.js';

const db = getDb();

// --- VARIABLES SPÉCIFIQUES AU MODULE ---
let demandesData = []; // Données des demandes chargées

// --- FONCTIONS D'AFFICHAGE ET DE MISE À JOUR DE STATUT ---

/**
 * Charge les demandes depuis Firestore et met à jour l'UI.
 */
export function loadDemandesFromFirebase() {
    db.collection(COLLECTIONS.CONTACT).orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        demandesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDemandesList();
    }, error => {
        console.error("Erreur chargement demandes:", error);
        showNotification("Erreur chargement des demandes de contact.", true);
    });
}

function updateDemandesList() {
    const container = document.getElementById('demandes-list');
    if (!container) {
        console.error("Conteneur #demandes-list introuvable.");
        return;
    }
    container.innerHTML = ''; // Vider, pas de bouton "add" ici par défaut

    if (demandesData.length === 0) {
        const msg = document.createElement('p');
        msg.textContent = "Aucune demande de contact en attente ou à afficher.";
        msg.classList.add('empty-message');
        container.appendChild(msg);
    } else {
        demandesData.forEach(demande => {
            const item = document.createElement('div');
            item.classList.add('grid-item'); // Utilise le style de carte existant

            const currentStatus = demande.status || "en cours"; // Default à "en cours"
            let timestamp = '?';
            if (demande.timestamp && typeof demande.timestamp.toDate === 'function') {
                try {
                    timestamp = demande.timestamp.toDate().toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'short', year: 'numeric', /*hour: '2-digit', minute: '2-digit'*/
                    });
                } catch (e) { console.warn("Date de demande invalide:", demande.timestamp); }
            } else if (demande.timestamp) { // Si c'est déjà une chaîne ou un nombre (moins probable avec serverTimestamp)
                timestamp = new Date(demande.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
            }


            // Gestion du champ 'demande' qui peut être un array ou une string
            let demandesListText = '?';
            if (Array.isArray(demande.demande)) {
                demandesListText = demande.demande.join(", ") || 'Non spécifié';
            } else if (typeof demande.demande === 'string') {
                demandesListText = demande.demande || 'Non spécifié';
            }

            item.innerHTML = `
                <h3>${demande.name || 'Inconnu'} <small>(${demande.operation || 'Opération N/A'})</small></h3>
                <p><small><i class="fas fa-envelope"></i> ${demande.email || 'Email N/A'}</small></p>
                <p><strong>Produits/Services demandés:</strong><br>${demandesListText}</p>
                ${demande.message ? `<p style="font-style: italic; background-color: #f9f9f9; padding: 8px; border-radius: 3px;">"${demande.message}"</p>` : ''}
                <div style="margin-top: auto; padding-top: 0.5rem; border-top: 1px dotted var(--bordure-crayon); display: flex; justify-content: space-between; align-items: center;">
                    <p><small>Reçu le: ${timestamp}</small></p>
                    <div class="form-group" style="margin:0;">
                        <label for="status-demande-${demande.id}" style="font-size: 0.8rem; margin-right: 4px;">Statut:</label>
                        <select class="contact-status" data-id="${demande.id}" id="status-demande-${demande.id}" style="padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px; font-size:0.8rem;">
                            <option value="en cours" ${currentStatus === 'en cours' ? 'selected' : ''}>En cours</option>
                            <option value="traité" ${currentStatus === 'traité' ? 'selected' : ''}>Traité</option>
                            <!-- Ajout d'un statut 'annulé' ou 'rejeté' pourrait être utile -->
                            <option value="annulé" ${currentStatus === 'annulé' ? 'selected' : ''}>Annulé</option>
                        </select>
                    </div>
                </div>`;
            container.appendChild(item);
        });
        // Pas de applyRandomRotation ici par défaut, mais peut être ajouté si désiré
    }
}

async function updateDemandeStatus(demandeId, newStatus) {
    try {
        await fbUpdateStatus(COLLECTIONS.CONTACT, demandeId, newStatus);
        showNotification(`Statut de la demande mis à jour : ${newStatus}`);
        // La liste se mettra à jour via onSnapshot
    } catch (error) {
        console.error(`Erreur MàJ statut demande ${demandeId}:`, error);
        showNotification("Erreur lors de la mise à jour du statut de la demande.", true);
        // Revenir à l'ancien statut dans le select si l'update échoue ? (plus complexe)
        const selectElement = document.getElementById(`status-demande-${demandeId}`);
        if (selectElement) {
            const originalStatus = demandesData.find(d => d.id === demandeId)?.status || 'en cours';
            selectElement.value = originalStatus;
        }
    }
}

/**
 * Met en place les listeners spécifiques au module Demandes.
 * Principalement pour la mise à jour du statut via les selects.
 */
export function setupDemandesListeners() {
    console.log("Attachement des listeners pour le module Demandes...");

    const demandesListContainer = document.getElementById('demandes-list');
    if (demandesListContainer) {
        demandesListContainer.addEventListener('change', (event) => {
            const select = event.target.closest('select.contact-status');
            if (select && select.dataset.id) {
                event.stopPropagation(); // Évite la propagation si d'autres listeners sont sur le conteneur
                const newStatus = select.value;
                const demandeId = select.dataset.id;
                updateDemandeStatus(demandeId, newStatus);
            }
        });
    } else {
        console.warn("Conteneur #demandes-list non trouvé pour attacher le listener de statut.");
    }
}