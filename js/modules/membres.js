// js/modules/membres.js
import { getDb } from '../firebaseService.js';
import { resetModalForms } from '../ui.js';
import { showNotification, applyRandomRotation } from '../utils.js';
import { COLLECTIONS } from '../config.js';

const db = getDb();

// --- VARIABLES SPÉCIFIQUES AU MODULE ---
let membersData = []; // Données des membres chargées

// --- FONCTIONS CRUD ET AFFICHAGE ---

/**
 * Charge les membres depuis Firestore et met à jour l'UI.
 */
export function loadMembersFromFirebase() {
    db.collection(COLLECTIONS.MEMBERS).orderBy('Nom', 'asc').onSnapshot(snapshot => {
        membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateMembersList();
    }, error => {
        console.error("Erreur chargement membres:", error);
        showNotification("Erreur chargement des membres.", true);
    });
}

function updateMembersList() {
    const container = document.getElementById('members-list');
    if (!container) {
        console.error("Conteneur #members-list introuvable pour les membres.");
        return;
    }

    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item)').forEach(item => item.remove());

    const openAddBtn = document.getElementById('open-add-membre');
    if (openAddBtn && addButtonCard) {
        addButtonCard.innerHTML = '';
        addButtonCard.appendChild(openAddBtn);
        openAddBtn.onclick = () => { document.getElementById('modal-membres').style.display = 'block'; };
    } else if (openAddBtn) {
        const card = document.createElement('div');
        card.className = 'grid-item add-item';
        card.appendChild(openAddBtn);
        container.prepend(card);
        openAddBtn.onclick = () => { document.getElementById('modal-membres').style.display = 'block'; };
    }

    if (membersData.length === 0 && (!addButtonCard || container.children.length <= 1)) {
        const msg = document.createElement('p');
        msg.textContent = "Aucun membre à afficher.";
        msg.classList.add('empty-message');
        if (addButtonCard) container.insertBefore(msg, addButtonCard.nextSibling); else container.appendChild(msg);
    } else {
        container.querySelector('.empty-message')?.remove();
        membersData.forEach(member => {
            const item = document.createElement('div');
            const photoURL = member.PhotoURL;

            item.classList.add('grid-item');
            if (photoURL) { // Ajoute le style polaroid si une photo est présente
                item.classList.add('polaroid-style');
            }

            item.innerHTML = `
               ${photoURL ?
                   `<img src="${photoURL}" alt="Photo de ${member.Prenom || ''} ${member.Nom || ''}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display:none; height:100px; background:#f0f0f0; margin:0.5rem; border:1px dashed #ccc; align-items:center; justify-content:center;">
                        <i class="fas fa-user" style="font-size:2rem; color:#ccc;"></i>
                    </div>` :
                   `<div style="height:100px; background:#f0f0f0; margin:0.5rem; border:1px dashed #ccc; display:flex; align-items:center; justify-content:center;">
                       <i class="fas fa-user" style="font-size:2rem; color:#ccc;"></i>
                   </div>`
               }
               <h3>${member.Prenom || ''} ${member.Nom || ''}</h3>
               ${!photoURL ? // Afficher détails seulement si pas de photo (car polaroid prend la place)
                   `<div class="member-details">
                       <p><strong>Rôle:</strong> ${member.Role || 'N/A'}<br>
                          <i>Op: ${member.Operation || 'N/A'}</i><br>
                          <small><i class="fas fa-envelope"></i> ${member.Mail || 'N/A'}</small>
                       </p>
                   </div>` :
                   ''
               }
               <div class="card-actions member-actions">
                 <button class="btn-action edit" data-id="${member.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                 <button class="btn-action delete" data-id="${member.id}" title="Supprimer"><i class="fas fa-user-times"></i></button>
               </div>`;
            if (addButtonCard) container.insertBefore(item, addButtonCard); else container.appendChild(item);
        });

        if (window.uiCurrentActiveSectionId === 'section-membres') {
            applyRandomRotation('#section-membres .grid-item:not(.add-item)');
        }
    }
}

function openEditMemberModal(id) {
    const memberItem = membersData.find(m => m.id === id);
    if (!memberItem) {
        showNotification("Membre introuvable pour modification.", true);
        return;
    }
    const modal = document.getElementById('modal-edit-membre');
    if (!modal) return;

    modal.querySelector('#edit-member-id').value = id;
    modal.querySelector('#edit-member-nom').value = memberItem.Nom || '';
    modal.querySelector('#edit-member-prenom').value = memberItem.Prenom || '';
    modal.querySelector('#edit-member-mail').value = memberItem.Mail || '';
    modal.querySelector('#edit-member-operation').value = memberItem.Operation || '';
    modal.querySelector('#edit-member-role').value = memberItem.Role || '';
    modal.querySelector('#edit-member-photo').value = memberItem.PhotoURL || '';

    const submitButton = modal.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = false;

    modal.style.display = 'block';
}

async function deleteMemberItem(id) {
    if (!confirm("Êtes-vous sûr de vouloir retirer ce membre ?")) return;
    try {
        await db.collection(COLLECTIONS.MEMBERS).doc(id).delete();
        showNotification("Membre retiré avec succès.");
    } catch (err) {
        console.error("Erreur retrait membre:", err);
        showNotification("Erreur lors du retrait du membre.", true);
    }
}

// --- LISTENERS POUR LES FORMULAIRES DU MODULE ---
function handleSubmitAddMember(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('button[type="submit"]');

    const data = {
        Nom: form['member-nom'].value.trim(),
        Prenom: form['member-prenom'].value.trim(),
        Mail: form['member-mail'].value.trim(),
        Operation: form['member-operation'].value.trim(),
        Role: form['member-role'].value.trim(),
        PhotoURL: form['member-photo'].value.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.Nom || !data.Prenom || !data.Mail || !data.Operation || !data.Role) {
        showNotification("Veuillez remplir tous les champs obligatoires (Nom, Prénom, Mail, Opération, Rôle).", true);
        return;
    }

    if (submitButton) submitButton.disabled = true;

    db.collection(COLLECTIONS.MEMBERS).add(data)
        .then(() => {
            showNotification('Membre ajouté avec succès!');
            if (modal) {
                resetModalForms(modal);
                modal.style.display = 'none';
            }
        })
        .catch(err => {
            console.error("Erreur ajout membre:", err);
            showNotification("Erreur lors de l'ajout du membre.", true);
        })
        .finally(() => {
            if (submitButton) submitButton.disabled = false;
        });
}

function handleSubmitEditMember(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('button[type="submit"]');
    const memberId = form['edit-member-id'].value;

    if (!memberId) {
        showNotification("Erreur : Identifiant du membre manquant pour la modification.", true);
        if (submitButton) submitButton.disabled = true;
        return;
    }

    const data = {
        Nom: form['edit-member-nom'].value.trim(),
        Prenom: form['edit-member-prenom'].value.trim(),
        Mail: form['edit-member-mail'].value.trim(),
        Operation: form['edit-member-operation'].value.trim(),
        Role: form['edit-member-role'].value.trim(),
        PhotoURL: form['edit-member-photo'].value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.Nom || !data.Prenom || !data.Mail || !data.Operation || !data.Role) {
        showNotification("Veuillez remplir tous les champs obligatoires (Nom, Prénom, Mail, Opération, Rôle).", true);
        return;
    }

    if (submitButton) submitButton.disabled = true;

    db.collection(COLLECTIONS.MEMBERS).doc(memberId).update(data)
        .then(() => {
            showNotification('Membre modifié avec succès!');
            if (modal) {
                // resetModalForms(modal); // Se fera à la prochaine ouverture
                modal.style.display = 'none';
            }
        })
        .catch(err => {
            console.error(`Erreur modification membre ID: ${memberId}`, err);
            showNotification("Erreur lors de la modification du membre.", true);
        })
        .finally(() => {
            if (submitButton) submitButton.disabled = false;
        });
}

/**
 * Met en place les listeners spécifiques au module Membres.
 */
export function setupMembresListeners() {
    console.log("Attachement des listeners pour le module Membres...");

    const formMembres = document.getElementById('form-membres');
    if (formMembres) {
        formMembres.addEventListener('submit', handleSubmitAddMember);
    } else {
        console.warn("Formulaire #form-membres non trouvé.");
    }

    const formEditMembres = document.getElementById('form-edit-membre');
    if (formEditMembres) {
        formEditMembres.addEventListener('submit', handleSubmitEditMember);
    } else {
        console.warn("Formulaire #form-edit-membre non trouvé.");
    }

    // Délégation d'événements pour les boutons Edit/Delete
    const membersListContainer = document.getElementById('members-list');
    if (membersListContainer) {
        membersListContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.btn-action');
            if (!button) return;

            const id = button.dataset.id;
            if (!id) return;

            if (button.classList.contains('edit')) {
                openEditMemberModal(id);
            } else if (button.classList.contains('delete')) {
                deleteMemberItem(id);
            }
        });
    }
}