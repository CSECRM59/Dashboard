// js/modules/infosUtiles.js
import { getDb } from '../firebaseService.js';
import { resetModalForms } from '../ui.js';
import { showNotification, applyRandomRotation } from '../utils.js';
import { COLLECTIONS } from '../config.js';

const db = getDb();
let infosUtilesData = [];
const INFO_UTILE_COLLECTION = COLLECTIONS.INFOS_UTILES || 'infos_utiles';

export function loadInfosUtilesFromFirebase() {
    db.collection(INFO_UTILE_COLLECTION).orderBy('title', 'asc').onSnapshot(snapshot => {
        infosUtilesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateInfosUtilesList();
    }, error => {
        console.error("Erreur chargement Infos Utiles:", error);
        showNotification("Erreur chargement des informations utiles.", true);
    });
}

function updateInfosUtilesList() {
    const container = document.getElementById('infos-utiles-list');
    if (!container) { console.error("INFOS UTILES: Conteneur #infos-utiles-list introuvable."); return; }

    const addButtonCard = container.querySelector('.add-item'); // Devrait exister statiquement dans la section
    container.querySelectorAll('.grid-item:not(.add-item), .category-title-h4').forEach(item => item.remove());

    const openAddBtn = document.getElementById('open-add-info-utile'); // Le bouton lui-même

    // Logique pour attacher le listener au bouton DANS la carte add-item
    if (addButtonCard) { // Si la carte "add-item" existe
        if (openAddBtn) { // Si le bouton existe
            // Vider la carte add-item et y remettre le bouton (pour s'assurer qu'il est bien là et propre)
            addButtonCard.innerHTML = '';
            addButtonCard.appendChild(openAddBtn);
            openAddBtn.onclick = () => {
                console.log("INFOS UTILES: Clic sur 'Nouvelle Info'"); // Log de clic
                const modal = document.getElementById('modal-info-utile');
                if (modal) {
                    resetModalForms(modal);
                    const submitBtn = modal.querySelector('button[type="submit"]');
                    if (submitBtn) submitBtn.disabled = false;
                    modal.style.display = 'block';
                } else {
                    console.error("INFOS UTILES: Modale #modal-info-utile non trouvée !");
                }
            };
        } else {
            console.warn("INFOS UTILES: Bouton #open-add-info-utile non trouvé.");
        }
        // S'assurer que addButtonCard est bien le premier enfant s'il a été retiré puis ré-ajouté.
        // Si la structure HTML garantit qu'il est déjà là et qu'on ne le retire pas, pas besoin de prepend.
        // Mais si on vide puis ré-ajoute, il faut le positionner.
         if (container.firstChild !== addButtonCard) {
             container.prepend(addButtonCard);
         }

    } else {
        console.warn("INFOS UTILES: Carte .add-item non trouvée dans #infos-utiles-list.");
        // Si la carte add-item n'existe pas, mais que le bouton existe, on pourrait la créer dynamiquement ici (moins idéal)
    }


    const sortedInfos = [...infosUtilesData].sort((a, b) => { /* ... tri ... */ });
    
    // Si addButtonCard a été retiré pour le tri, le remettre
    // if (addButtonCard && !container.contains(addButtonCard)) {
    //     container.prepend(addButtonCard);
    // }

    if (sortedInfos.length === 0) {
        if (container.children.length <= (addButtonCard ? 1 : 0) && !container.querySelector('.empty-message')) {
            const msg = document.createElement('p');
            msg.textContent = "Aucune information utile pour le moment.";
            msg.classList.add('empty-message');
            if (addButtonCard && addButtonCard.parentNode === container) container.insertBefore(msg, addButtonCard.nextSibling);
            else container.appendChild(msg);
        }
    } else {
        container.querySelector('.empty-message')?.remove();
        sortedInfos.forEach(info => {
            const item = document.createElement('div');
            item.classList.add('grid-item');
            let dateString = '';
            if (info.date) {
                try {
                    const dateObj = new Date(info.date + (info.time ? `T${info.time}` : 'T00:00:00Z'));
                    dateString = `Événement: ${dateObj.toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'})}`;
                    if (info.time) dateString += ` à ${info.time.substring(0,5)}`;
                } catch(e) { dateString = "Date invalide"; }
            }
            item.innerHTML = `
                <h3>${info.title || 'Sans titre'}</h3>
                ${info.categorie ? `<p><small><em>Cat.: ${info.categorie}</em></small></p>` : ''}
                <p style="white-space: pre-wrap;">${info.description || ''}</p>
                ${info.link ? `<p><a href="${info.link.startsWith('http')?info.link:'http://'+info.link}" target="_blank" rel="noopener noreferrer">Lien <i class="fas fa-external-link-alt fa-xs"></i></a></p>` : ''}
                ${dateString ? `<p><small><i class="fas fa-calendar-alt fa-xs"></i> ${dateString}</small></p>` : ''}
                <div class="card-actions info-utile-actions">
                  <button class="btn-action edit" data-id="${info.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                  <button class="btn-action delete" data-id="${info.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
                </div>`;
            // Insérer avant la carte d'ajout si elle a été remise, sinon à la fin
            if (addButtonCard && addButtonCard.parentNode === container) {
                 container.insertBefore(item, addButtonCard);
            } else {
                 container.appendChild(item);
            }
        });
    }

    if (window.uiCurrentActiveSectionId === 'section-infosUtiles') {
        applyRandomRotation('#infos-utiles-list .grid-item:not(.add-item)');
    }
}

function openEditInfoUtileModal(id) {
    const infoItem = infosUtilesData.find(i => i.id === id);
    if (!infoItem) { showNotification("Information introuvable.", true); return; }
    const modal = document.getElementById('modal-edit-info-utile');
    if (!modal) return;
    resetModalForms(modal);
    modal.querySelector('#edit-info-id').value = id;
    modal.querySelector('#edit-info-title').value = infoItem.title || '';
    modal.querySelector('#edit-info-description').value = infoItem.description || '';
    modal.querySelector('#edit-info-categorie').value = infoItem.categorie || '';
    modal.querySelector('#edit-info-link').value = infoItem.link || '';
    modal.querySelector('#edit-info-date').value = infoItem.date || '';
    modal.querySelector('#edit-info-time').value = infoItem.time || '';
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = false;
    modal.style.display = 'block';
}

async function deleteInfoUtileItem(id) {
    if (!confirm("Supprimer cette information ?")) return;
    try {
        await db.collection(INFO_UTILE_COLLECTION).doc(id).delete();
        showNotification("Information supprimée.");
    } catch (err) { console.error("Erreur suppression Info:", err); showNotification("Erreur suppression.", true); }
}

function handleSubmitAddInfoUtile(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('#submit-add-info-utile');
    const data = {
        title: form['info-title'].value.trim(), description: form['info-description'].value.trim(),
        categorie: form['info-categorie'].value.trim() || null, link: form['info-link'].value.trim() || null,
        date: form['info-date'].value || null, time: form['info-time'].value || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!data.title || !data.description) { showNotification("Titre et description requis.", true); return; }
    if(submitButton) submitButton.disabled = true;
    db.collection(INFO_UTILE_COLLECTION).add(data)
        .then(() => {
            showNotification('Info ajoutée !');
            if (modal) { resetModalForms(modal); modal.style.display = 'none'; }
        })
        .catch(err => { showNotification("Erreur ajout info.", true); console.error(err); })
        .finally(() => { if(submitButton) submitButton.disabled = false; });
}

function handleSubmitEditInfoUtile(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('#submit-edit-info-utile');
    const infoId = form['edit-info-id'].value;
    if (!infoId) { showNotification("ID Info manquant.", true); return; }
    const data = {
        title: form['edit-info-title'].value.trim(), description: form['edit-info-description'].value.trim(),
        categorie: form['edit-info-categorie'].value.trim() || null, link: form['edit-info-link'].value.trim() || null,
        date: form['edit-info-date'].value || null, time: form['edit-info-time'].value || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!data.title || !data.description) { showNotification("Titre et description requis.", true); return; }
    if(submitButton) submitButton.disabled = true;
    db.collection(INFO_UTILE_COLLECTION).doc(infoId).update(data)
        .then(() => {
            showNotification('Info modifiée !');
            if (modal) modal.style.display = 'none';
        })
        .catch(err => { showNotification("Erreur modif info.", true); console.error(err); })
        .finally(() => { if(submitButton) submitButton.disabled = false; });
}

export function setupInfosUtilesListeners() {
    console.log("INFOS UTILES: Attachement des listeners...");
    const formInfoUtile = document.getElementById('form-info-utile');
    if (formInfoUtile) formInfoUtile.addEventListener('submit', handleSubmitAddInfoUtile);
    else console.warn("INFOS UTILES: Form #form-info-utile non trouvé.");

    const formEditInfoUtile = document.getElementById('form-edit-info-utile');
    if (formEditInfoUtile) formEditInfoUtile.addEventListener('submit', handleSubmitEditInfoUtile);
    else console.warn("INFOS UTILES: Form #form-edit-info-utile non trouvé.");

    const listContainer = document.getElementById('infos-utiles-list');
    if (listContainer) {
        listContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.btn-action');
            if (!button || !button.dataset.id) return;
            const id = button.dataset.id;
            if (button.classList.contains('edit')) openEditInfoUtileModal(id);
            else if (button.classList.contains('delete')) deleteInfoUtileItem(id);
        });
    } else { console.warn("INFOS UTILES: Conteneur #infos-utiles-list non trouvé pour délégation."); }
}