// js/modules/partenaires.js
import { getDb } from '../firebaseService.js';
import { resetModalForms } from '../ui.js';
import { showNotification, applyRandomRotation } from '../utils.js';
import { IMGUR_CLIENT_ID, COLLECTIONS } from '../config.js';

const db = getDb();
let partnersData = [];

// --- Fonction Upload Imgur (déjà fournie, supposée correcte) ---
async function uploadPartnerLogoToImgur(file, statusElementId, urlInputElementId, submitButtonId) {
    // ... (code de la fonction uploadPartnerLogoToImgur)
    const statusDiv = document.getElementById(statusElementId);
    const urlInput = document.getElementById(urlInputElementId);
    const submitButton = document.getElementById(submitButtonId);

    if (!file) {
        if (statusDiv) statusDiv.textContent = "Aucun fichier sélectionné.";
        return null;
    }
    if (!IMGUR_CLIENT_ID || IMGUR_CLIENT_ID === "VOTRE_CLIENT_ID_IMGUR") {
         if (statusDiv) statusDiv.textContent = "Erreur: Client ID Imgur non configuré.";
         showNotification("Erreur de configuration Imgur.", true);
         return null;
    }

    if (urlInput) urlInput.value = '';
    if (statusDiv) statusDiv.textContent = 'Téléversement du logo...';
    if (submitButton) submitButton.disabled = true;

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
            body: formData,
        });
        const data = await response.json();
        if (response.ok && data.success) {
            if (statusDiv) statusDiv.textContent = 'Logo téléversé !';
            if (urlInput) urlInput.value = data.data.link;
            if (submitButton) submitButton.disabled = false;
            return data.data.link;
        } else {
            if (statusDiv) statusDiv.textContent = `Erreur Imgur: ${data.data?.error || 'Inconnue'}`;
            showNotification(`Erreur Imgur: ${data.data?.error || 'Inconnue'}`, true);
            if (submitButton) submitButton.disabled = false;
            return null;
        }
    } catch (error) {
        if (statusDiv) statusDiv.textContent = 'Erreur réseau lors du téléversement.';
        showNotification('Erreur réseau lors du téléversement.', true);
        if (submitButton) submitButton.disabled = false;
        return null;
    }
}

// --- Fonctions CRUD et Affichage ---
export function loadPartnersFromFirebase() {
    db.collection(COLLECTIONS.PARTNERS).orderBy('Nom', 'asc').onSnapshot(snapshot => {
        partnersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updatePartnersList();
    }, error => {
        console.error("Erreur chargement partenaires:", error);
        showNotification("Erreur chargement des partenaires.", true);
    });
}

function updatePartnersList() {
    const container = document.getElementById('partners-list');
    if (!container) {
        console.error("Conteneur #partners-list introuvable.");
        return;
    }

    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item), .category-title-h4').forEach(item => item.remove()); // Supprime aussi les anciens titres de catégorie

    const openAddBtn = document.getElementById('open-add-partenaire');
    if (openAddBtn && addButtonCard) {
        addButtonCard.innerHTML = '';
        addButtonCard.appendChild(openAddBtn);
        openAddBtn.onclick = () => {
            const modal = document.getElementById('modal-partenaires');
            if (modal) {
                const logoFileInput = modal.querySelector('#partner-logo-file');
                const uploadStatus = modal.querySelector('#partner-upload-status');
                const logoUrlInput = modal.querySelector('#partner-logo-url');
                const submitButton = modal.querySelector('button[type="submit"]');

                if (logoFileInput) logoFileInput.value = null;
                if (uploadStatus) uploadStatus.textContent = '';
                if (logoUrlInput) logoUrlInput.value = '';
                if (submitButton) submitButton.disabled = false;
                modal.style.display = 'block';
            }
        };
    } else if (openAddBtn) {
        const card = document.createElement('div');
        card.className = 'grid-item add-item';
        card.appendChild(openAddBtn);
        container.prepend(card);
        openAddBtn.onclick = () => { document.getElementById('modal-partenaires').style.display = 'block'; };
    }

    // Trier les données par Catégorie, puis par Nom
    const sortedPartners = [...partnersData].sort((a, b) => {
        const catA = (a.Categorie || '').toLowerCase();
        const catB = (b.Categorie || '').toLowerCase();
        const nomA = (a.Nom || '').toLowerCase();
        const nomB = (b.Nom || '').toLowerCase();

        if (catA < catB) return -1;
        if (catA > catB) return 1;
        if (nomA < nomB) return -1;
        if (nomA > nomB) return 1;
        return 0;
    });

    if (sortedPartners.length === 0 && (!addButtonCard || container.children.length <= 1)) {
        const msg = document.createElement('p');
        msg.textContent = "Aucun partenaire à afficher.";
        msg.classList.add('empty-message');
        if (addButtonCard) container.insertBefore(msg, addButtonCard.nextSibling); else container.appendChild(msg);
    } else {
        container.querySelector('.empty-message')?.remove();
        let lastCategory = null;

        sortedPartners.forEach(partner => {
            // Ajouter un titre de catégorie si elle change
            if (partner.Categorie && partner.Categorie !== lastCategory) {
                const categoryTitle = document.createElement('h4');
                categoryTitle.textContent = partner.Categorie;
                categoryTitle.classList.add('category-title-h4'); // Ajout d'une classe pour pouvoir le supprimer
                categoryTitle.style.width = '100%';
                categoryTitle.style.textAlign = 'left';
                categoryTitle.style.marginTop = '2rem';
                categoryTitle.style.marginBottom = '0.5rem';
                categoryTitle.style.paddingBottom = '0.3rem';
                categoryTitle.style.borderBottom = '1px dotted var(--bordure-crayon)';
                categoryTitle.style.gridColumn = '1 / -1';
                // Insérer avant la carte d'ajout si elle existe, sinon à la fin
                if (addButtonCard) container.insertBefore(categoryTitle, addButtonCard);
                else container.appendChild(categoryTitle);
                lastCategory = partner.Categorie;
            }

            const item = document.createElement('div');
            item.classList.add('grid-item');
            item.innerHTML = `
                ${partner.Logo ? `<img src="${partner.Logo}" alt="Logo ${partner.Nom || ''}" style="height: 50px; width: auto; object-fit: contain; margin-bottom: 1rem; border-radius:0; border:none; box-shadow:none; background:transparent; padding:0;">` : ''}
                <h3>${partner.Nom || 'Nom inconnu'}</h3>
                <p><small>Catégorie: ${partner.Categorie || 'N/A'}</small></p>
                <p>${(partner.Description || '').substring(0, 100)}...</p>
                <p style="margin-top:auto;">
                    <a href="${partner.Lien || '#'}" target="_blank" rel="noopener noreferrer">
                        Visiter <i class="fas fa-external-link-alt" style="font-size: 0.7em;"></i>
                    </a>
                </p>
                <div class="card-actions partner-actions">
                  <button class="btn-action edit" data-id="${partner.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                  <button class="btn-action delete" data-id="${partner.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
                </div>`;
            // Insérer avant la carte d'ajout si elle existe, sinon à la fin
            if (addButtonCard) container.insertBefore(item, addButtonCard);
            else container.appendChild(item);
        });

        if (window.uiCurrentActiveSectionId === 'section-partenaires') {
            applyRandomRotation('#section-partenaires .grid-item:not(.add-item)');
        }
    }
}

function openEditPartnerModal(id) {
    const partnerItem = partnersData.find(p => p.id === id);
    if (!partnerItem) return;
    const modal = document.getElementById('modal-edit-partenaire');
    if (!modal) return;

    modal.querySelector('#edit-partenaire-id').value = id;
    modal.querySelector('#edit-partenaire-categorie').value = partnerItem.Categorie || '';
    modal.querySelector('#edit-partenaire-nom').value = partnerItem.Nom || '';
    modal.querySelector('#edit-partenaire-description').value = partnerItem.Description || '';
    modal.querySelector('#edit-partenaire-lien').value = partnerItem.Lien || '';

    const currentLogoUrl = partnerItem.Logo || '';
    const logoDisplayDiv = modal.querySelector('#edit-current-partner-logo-display');
    const originalUrlInput = modal.querySelector('#edit-partner-original-logo-url');
    const newUrlInput = modal.querySelector('#edit-partner-logo-url');
    const fileInput = modal.querySelector('#edit-partner-logo-file');
    const statusDiv = modal.querySelector('#edit-partner-upload-status');
    const submitButton = modal.querySelector('button[type="submit"]');

    if (originalUrlInput) originalUrlInput.value = currentLogoUrl;
    if (logoDisplayDiv) {
        if (currentLogoUrl) {
            logoDisplayDiv.innerHTML = `<p style="font-size:0.9em; margin-bottom:5px;">Logo actuel :</p><img src="${currentLogoUrl}" alt="Logo actuel" style="max-width: 100px; max-height: 70px; border: 1px solid #ccc; display: block; object-fit: contain; background: #f0f0f0; padding: 5px;">`;
        } else {
            logoDisplayDiv.innerHTML = '<p style="font-size:0.9em; margin-bottom:5px;"><i>Pas de logo actuel.</i></p>';
        }
    }
    if (newUrlInput) newUrlInput.value = '';
    if (fileInput) fileInput.value = null;
    if (statusDiv) statusDiv.textContent = '';
    if (submitButton) submitButton.disabled = false;

    modal.style.display = 'block';
}

async function deletePartnerItem(id) {
    if (!confirm("Êtes-vous sûr de vouloir effacer ce partenaire ?")) return;
    try {
        await db.collection(COLLECTIONS.PARTNERS).doc(id).delete();
        showNotification("Partenaire effacé avec succès.");
    } catch (err) {
        console.error("Erreur suppression partenaire:", err);
        showNotification("Erreur lors de la suppression du partenaire.", true);
    }
}

function handleSubmitAddPartner(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('button[type="submit"]');
    const logoUrl = form.querySelector('#partner-logo-url').value;

    const data = {
        Categorie: form['partenaire-categorie'].value.trim(),
        Nom: form['partenaire-nom'].value.trim(),
        Description: form['partenaire-description'].value.trim(),
        Lien: form['partenaire-lien'].value.trim(),
        Logo: logoUrl,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.Categorie || !data.Nom || !data.Description || !data.Lien) {
        showNotification("Veuillez remplir tous les champs obligatoires (Catégorie, Nom, Description, Lien).", true);
        return;
    }
    if (submitButton) submitButton.disabled = true;

    db.collection(COLLECTIONS.PARTNERS).add(data)
        .then(() => {
            showNotification('Partenaire ajouté!');
            if (modal) {
                resetModalForms(modal);
                modal.style.display = 'none';
            }
        })
        .catch(err => {
            console.error("Erreur ajout partenaire:", err);
            showNotification("Erreur lors de l'ajout du partenaire.", true);
        })
        .finally(() => { if (submitButton) submitButton.disabled = false; });
}

function handleSubmitEditPartner(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('button[type="submit"]');
    const partnerId = form['edit-partenaire-id'].value;

    if (!partnerId) {
        showNotification("Erreur : Identifiant du partenaire manquant.", true);
        return;
    }

    const newLogoUrl = form.querySelector('#edit-partner-logo-url').value;
    const originalLogoUrl = form.querySelector('#edit-partner-original-logo-url').value;
    const finalLogoUrl = newLogoUrl || originalLogoUrl;

    const data = {
        Categorie: form['edit-partenaire-categorie'].value.trim(),
        Nom: form['edit-partenaire-nom'].value.trim(),
        Description: form['edit-partenaire-description'].value.trim(),
        Lien: form['edit-partenaire-lien'].value.trim(),
        Logo: finalLogoUrl,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.Categorie || !data.Nom || !data.Description || !data.Lien) {
        showNotification("Veuillez remplir Catégorie, Nom, Description et Lien.", true);
        return;
    }
    if (submitButton) submitButton.disabled = true;

    db.collection(COLLECTIONS.PARTNERS).doc(partnerId).update(data)
        .then(() => {
            showNotification('Partenaire modifié!');
            if (modal) modal.style.display = 'none';
        })
        .catch(err => {
            console.error(`Erreur modification partenaire ID: ${partnerId}`, err);
            showNotification("Erreur modification partenaire.", true);
        })
        .finally(() => { if (submitButton) submitButton.disabled = false; });
}

export function setupPartnersListeners() {
    console.log("Attachement des listeners pour le module Partenaires...");

    const formPartenaires = document.getElementById('form-partenaires');
    if (formPartenaires) {
        formPartenaires.addEventListener('submit', handleSubmitAddPartner);
    }
    const formEditPartenaires = document.getElementById('form-edit-partenaire');
    if (formEditPartenaires) {
        formEditPartenaires.addEventListener('submit', handleSubmitEditPartner);
    }

    const partnerLogoInputAdd = document.getElementById('partner-logo-file');
    if (partnerLogoInputAdd) {
        partnerLogoInputAdd.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const submitBtn = formPartenaires.querySelector('button[type="submit"]');
                const submitBtnId = submitBtn.id || 'submit-add-partner-temp-id';
                if(!submitBtn.id) submitBtn.id = submitBtnId;
                uploadPartnerLogoToImgur(file, 'partner-upload-status', 'partner-logo-url', submitBtnId);
            }
        });
    }

    const partnerLogoInputEdit = document.getElementById('edit-partner-logo-file');
    if (partnerLogoInputEdit) {
        partnerLogoInputEdit.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                 const submitBtn = formEditPartenaires.querySelector('button[type="submit"]');
                 const submitBtnId = submitBtn.id || 'submit-edit-partner-temp-id';
                 if(!submitBtn.id) submitBtn.id = submitBtnId;
                uploadPartnerLogoToImgur(file, 'edit-partner-upload-status', 'edit-partner-logo-url', submitBtnId);
            }
        });
    }

    const partnersListContainer = document.getElementById('partners-list');
    if (partnersListContainer) {
        partnersListContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.btn-action');
            if (!button || !button.dataset.id) return;
            const id = button.dataset.id;
            if (button.classList.contains('edit')) openEditPartnerModal(id);
            else if (button.classList.contains('delete')) deletePartnerItem(id);
        });
    }
}