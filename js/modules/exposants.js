// js/modules/exposants.js
import { getDb } from '../firebaseService.js';
import { resetModalForms } from '../ui.js';
import { showNotification, applyRandomRotation } from '../utils.js';
import { IMGUR_CLIENT_ID, COLLECTIONS } from '../config.js'; // Import direct

const db = getDb();
let exposantsData = []; // Liste de tous les exposants
let planningData = {};  // Données du planning, clé par date "YYYY-MM-DD"
let currentCalendarDate = new Date(); // Pour la navigation du calendrier des exposants

// Références aux éléments DOM du calendrier (initialisées une fois)
let calendarGridElement, currentMonthYearElement, prevMonthBtn, nextMonthBtn;

// --- Upload Imgur pour Logos Exposants ---
async function uploadExposantLogoToImgur(file, statusElementId, urlInputElementId, submitButtonId) {
    const statusDiv = document.getElementById(statusElementId);
    const urlInput = document.getElementById(urlInputElementId);
    const submitButton = document.getElementById(submitButtonId);

    if (!file) {
        if (statusDiv) statusDiv.textContent = "Aucun fichier.";
        return null;
    }
    if (!IMGUR_CLIENT_ID || IMGUR_CLIENT_ID === "VOTRE_CLIENT_ID_IMGUR") {
         if (statusDiv) statusDiv.textContent = "Erreur: Client ID Imgur non configuré.";
         showNotification("Erreur de configuration Imgur.", true);
         return null;
    }

    if (urlInput) urlInput.value = '';
    if (statusDiv) statusDiv.textContent = 'Téléversement image...';
    if (submitButton) submitButton.disabled = true;

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
            body: formData,
        });
        const dataRes = await response.json(); // Renommé pour éviter conflit avec paramètre
        if (response.ok && dataRes.success) {
            if (statusDiv) statusDiv.textContent = 'Image téléversée !';
            if (urlInput) urlInput.value = dataRes.data.link;
            if (submitButton) submitButton.disabled = false;
            return dataRes.data.link;
        } else {
            if (statusDiv) statusDiv.textContent = `Erreur Imgur: ${dataRes.data?.error || 'Inconnue'}`;
            showNotification(`Erreur Imgur: ${dataRes.data?.error || 'Inconnue'}`, true);
            if (submitButton) submitButton.disabled = false;
            return null;
        }
    } catch (error) {
        if (statusDiv) statusDiv.textContent = 'Erreur réseau upload.';
        showNotification('Erreur réseau upload.', true);
        if (submitButton) submitButton.disabled = false;
        return null;
    }
}

// --- Fonctions CRUD pour les Exposants ---
export function loadExposantsFromFirebase() {
    db.collection(COLLECTIONS.EXPOSANTS).orderBy('Nom', 'asc').onSnapshot(snapshot => {
        exposantsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateExposantsList();
        // Si la section est active et que le calendrier a déjà été rendu une fois (a des enfants),
        // on le re-render pour mettre à jour potentiellement les noms dans les menus déroulants de la modale planning.
        // ou si le nom d'un exposant change et est affiché dans les indicateurs du calendrier.
        if (window.uiCurrentActiveSectionId === 'section-exposants' && calendarGridElement && calendarGridElement.hasChildNodes()) {
            renderExposantCalendar(); // Pour màj indicateurs si noms changent
        }
    }, error => {
        console.error("Erreur chargement exposants:", error);
        showNotification("Erreur chargement des exposants.", true);
    });
}

function updateExposantsList() {
    const container = document.getElementById('exposants-list');
    if (!container) { console.error("Conteneur #exposants-list introuvable."); return; }

    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item), .category-title-h4').forEach(item => item.remove());

    const openAddBtn = document.getElementById('open-add-exposant');
    if (openAddBtn && addButtonCard) {
        addButtonCard.innerHTML = '';
        addButtonCard.appendChild(openAddBtn);
        openAddBtn.onclick = () => {
            const modal = document.getElementById('modal-exposants');
            if (modal) {
                resetModalForms(modal); // Assure que tout le formulaire est reset
                // Les champs spécifiques à l'upload sont gérés par resetModalForms si bien configuré dans ui.js
                modal.querySelector('button[type="submit"]').disabled = false;
                modal.style.display = 'block';
            }
        };
    }

    const sortedExposants = [...exposantsData].sort((a, b) => {
        const catA = (a.Categorie || '').toLowerCase(); const catB = (b.Categorie || '').toLowerCase();
        const nomA = (a.Nom || '').toLowerCase(); const nomB = (b.Nom || '').toLowerCase();
        if (catA < catB) return -1; if (catA > catB) return 1;
        if (nomA < nomB) return -1; if (nomA > nomB) return 1;
        return 0;
    });

    if (addButtonCard) addButtonCard.remove(); // Retirer temporairement

    if (sortedExposants.length === 0) {
        const msg = document.createElement('p');
        msg.textContent = "Aucun exposant à afficher.";
        msg.classList.add('empty-message');
        container.appendChild(msg);
    } else {
        container.querySelector('.empty-message')?.remove();
        let lastCategory = null;
        sortedExposants.forEach(expo => {
            if (expo.Categorie && expo.Categorie !== lastCategory) {
                const categoryTitle = document.createElement('h4');
                categoryTitle.textContent = expo.Categorie;
                categoryTitle.classList.add('category-title-h4');
                categoryTitle.style.cssText = "width:100%; text-align:left; margin-top:2rem; margin-bottom:0.5rem; padding-bottom:0.3rem; border-bottom:1px dotted var(--bordure-crayon); grid-column:1/-1;";
                container.appendChild(categoryTitle);
                lastCategory = expo.Categorie;
            }
            const item = document.createElement('div');
            item.classList.add('grid-item');
            item.innerHTML = `
                ${expo.Logo ? `<img src="${expo.Logo}" alt="Logo ${expo.Nom}" style="height: 60px; width: auto; max-width: 150px; object-fit: contain; margin-bottom: 1rem; border-radius:3px; background: #fff; padding:3px;">` : '<div style="height:60px; margin-bottom:1rem; text-align:center; color: #ccc; display:flex; align-items:center; justify-content:center;"><i>(Pas de logo)</i></div>'}
                <h3>${expo.Nom || 'N/A'}</h3>
                <p><small>Catégorie: ${expo.Categorie || 'N/A'}</small></p>
                ${expo.Stand ? `<p><small>Stand: <strong>${expo.Stand}</strong></small></p>` : ''}
                <p style="font-size: 0.85em;">${(expo.Description || '').substring(0, 120)}...</p>
                ${expo.ContactNom ? `<p style="font-size: 0.8em; margin-top: auto; padding-top: 0.5rem; border-top: 1px dotted #eee;">Contact: ${expo.ContactNom} <br> ${expo.ContactEmail ? `<a href="mailto:${expo.ContactEmail}">${expo.ContactEmail}</a>` : ''} ${expo.ContactTel ? ` / ${expo.ContactTel}` : ''}</p>` : ''}
                <div class="card-actions exposant-actions">
                  <button class="btn-action edit" data-id="${expo.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                  <button class="btn-action delete" data-id="${expo.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
                </div>`;
            container.appendChild(item);
        });
    }
    if (addButtonCard) container.prepend(addButtonCard);

    if (window.uiCurrentActiveSectionId === 'section-exposants') {
        applyRandomRotation('#section-exposants .grid-item:not(.add-item)');
    }
}

function openEditExposantModal(id) {
    const expoItem = exposantsData.find(e => e.id === id);
    if (!expoItem) { showNotification("Exposant non trouvé.", true); return; }
    const modal = document.getElementById('modal-edit-exposant');
    if (!modal) return;

    resetModalForms(modal); // Reset général d'abord

    modal.querySelector('#edit-exposant-id').value = id;
    modal.querySelector('#edit-exposant-nom').value = expoItem.Nom || '';
    modal.querySelector('#edit-exposant-categorie').value = expoItem.Categorie || '';
    modal.querySelector('#edit-exposant-description').value = expoItem.Description || '';
    modal.querySelector('#edit-exposant-stand').value = expoItem.Stand || '';
    modal.querySelector('#edit-exposant-contact-nom').value = expoItem.ContactNom || '';
    modal.querySelector('#edit-exposant-contact-email').value = expoItem.ContactEmail || '';
    modal.querySelector('#edit-exposant-contact-tel').value = expoItem.ContactTel || '';

    const currentLogoUrl = expoItem.Logo || '';
    modal.querySelector('#edit-exposant-original-logo-url').value = currentLogoUrl;
    const logoDisplayDiv = modal.querySelector('#edit-current-exposant-logo-display');
    if (logoDisplayDiv) {
        logoDisplayDiv.innerHTML = currentLogoUrl ? `<p style="font-size:0.9em; margin-bottom:5px;">Logo actuel :</p><img src="${currentLogoUrl}" alt="Logo actuel" style="max-width: 100px; max-height: 70px; border: 1px solid #ccc; display: block; object-fit: contain; background: #f0f0f0; padding: 5px;">` : '<p style="font-size:0.9em; margin-bottom:5px;"><i>Pas de logo actuel.</i></p>';
    }
    // Les champs d'upload sont déjà reset par resetModalForms
    modal.querySelector('button[type="submit"]').disabled = false;
    modal.style.display = 'block';
}

async function deleteExposantItem(id) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet exposant ?\nCela retirera aussi ses éventuelles réservations du planning.")) return;
    try {
        // Supprimer l'exposant
        await db.collection(COLLECTIONS.EXPOSANTS).doc(id).delete();

        // Supprimer les entrées de planning associées
        const planningSnapshot = await db.collection('planning_exposants').where('exposantId', '==', id).get();
        const batch = db.batch();
        planningSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        showNotification("Exposant et son planning supprimés.");
        if (window.uiCurrentActiveSectionId === 'section-exposants') {
            loadPlanningForMonth(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
        }
    } catch (err) {
        console.error("Erreur suppression exposant:", err);
        showNotification("Erreur suppression exposant.", true);
    }
}

function handleSubmitAddExposant(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('#submit-add-exposant');
    const logoUrl = form.querySelector('#exposant-logo-url').value;

    const data = {
        Nom: form['exposant-nom'].value.trim(), Categorie: form['exposant-categorie'].value.trim(),
        Description: form['exposant-description'].value.trim(), Stand: form['exposant-stand'].value.trim() || null,
        ContactNom: form['exposant-contact-nom'].value.trim() || null, ContactEmail: form['exposant-contact-email'].value.trim() || null,
        ContactTel: form['exposant-contact-tel'].value.trim() || null, Logo: logoUrl || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!data.Nom || !data.Categorie || !data.Description) { showNotification("Nom, Catégorie et Description sont requis.", true); return; }
    if(submitButton) submitButton.disabled = true;
    db.collection(COLLECTIONS.EXPOSANTS).add(data)
        .then(() => {
            showNotification('Exposant ajouté !');
            if (modal) { resetModalForms(modal); modal.style.display = 'none'; }
        })
        .catch(err => { showNotification("Erreur ajout exposant.", true); console.error(err); })
        .finally(() => { if(submitButton) submitButton.disabled = false; });
}

function handleSubmitEditExposant(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('#submit-edit-exposant');
    const exposantId = form['edit-exposant-id'].value;
    if (!exposantId) { showNotification("ID Exposant manquant.", true); return; }

    const newLogoUrl = form.querySelector('#edit-exposant-logo-url').value;
    const originalLogoUrl = form.querySelector('#edit-exposant-original-logo-url').value;
    const finalLogoUrl = newLogoUrl || originalLogoUrl || null;
    const data = {
        Nom: form['edit-exposant-nom'].value.trim(), Categorie: form['edit-exposant-categorie'].value.trim(),
        Description: form['edit-exposant-description'].value.trim(), Stand: form['edit-exposant-stand'].value.trim() || null,
        ContactNom: form['edit-exposant-contact-nom'].value.trim() || null, ContactEmail: form['edit-exposant-contact-email'].value.trim() || null,
        ContactTel: form['edit-exposant-contact-tel'].value.trim() || null, Logo: finalLogoUrl,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!data.Nom || !data.Categorie || !data.Description) { showNotification("Nom, Catégorie et Description sont requis.", true); return; }
    if(submitButton) submitButton.disabled = true;
    db.collection(COLLECTIONS.EXPOSANTS).doc(exposantId).update(data)
        .then(() => {
            showNotification('Exposant modifié !');
            if (modal) modal.style.display = 'none';
            if (window.uiCurrentActiveSectionId === 'section-exposants') {
                loadPlanningForMonth(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
            }
        })
        .catch(err => { showNotification("Erreur modif. exposant.", true); console.error(err); })
        .finally(() => { if(submitButton) submitButton.disabled = false; });
}

// --- Fonctions du Calendrier de Planning ---
function setupCalendarDOMElements() {
    calendarGridElement = document.getElementById('exposant-calendar-grid');
    currentMonthYearElement = document.getElementById('current-month-year-exposant');
    prevMonthBtn = document.getElementById('prev-month-exposant');
    nextMonthBtn = document.getElementById('next-month-exposant');

    if(!calendarGridElement || !currentMonthYearElement || !prevMonthBtn || !nextMonthBtn) {
        console.warn("EXPOSANTS: Un ou plusieurs éléments DOM du calendrier sont manquants.");
        return false; // Indiquer un échec
    }
    prevMonthBtn.addEventListener('click', () => changeMonthExposant(-1));
    nextMonthBtn.addEventListener('click', () => changeMonthExposant(1));
    return true; // Indiquer le succès
}

function changeMonthExposant(monthOffset) {
    currentCalendarDate.setDate(1);
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + monthOffset);
    renderExposantCalendar();
    loadPlanningForMonth(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
}

export async function loadPlanningForMonth(year, month) { // EXPORTÉE
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    try {
        const snapshot = await db.collection('planning_exposants')
                                 .where('date_venue', '>=', firstDayOfMonth)
                                 .where('date_venue', '<=', lastDayOfMonth)
                                 .orderBy('date_venue').orderBy('heure_debut').get();
        planningData = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const dateObj = data.date_venue.toDate();
            const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            if (!planningData[dateStr]) planningData[dateStr] = [];
            planningData[dateStr].push({ id: doc.id, ...data });
        });
        // Re-render seulement si le calendrier est supposé être visible
        if (window.uiCurrentActiveSectionId === 'section-exposants' && calendarGridElement && calendarGridElement.hasChildNodes()) {
            renderExposantCalendar();
        }
    } catch (error) { console.error("Erreur chargement planning exposants:", error); }
}

export function renderExposantCalendar() { // EXPORTÉE
    if (!calendarGridElement || !currentMonthYearElement) {
        console.warn("EXPOSANTS: Éléments du calendrier non initialisés pour renderExposantCalendar."); return;
    }
    calendarGridElement.innerHTML = '';
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    currentMonthYearElement.textContent = currentCalendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    daysOfWeek.forEach(day => {
        const hCell = document.createElement('div'); hCell.classList.add('calendar-header'); hCell.textContent = day; calendarGridElement.appendChild(hCell);
    });

    const firstDayOfMonthDate = new Date(year, month, 1);
    let startingDay = firstDayOfMonthDate.getDay(); startingDay = (startingDay === 0) ? 6 : startingDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    for (let i = 0; i < startingDay; i++) { const eCell = document.createElement('div'); eCell.classList.add('calendar-day', 'not-current-month'); calendarGridElement.appendChild(eCell); }

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div'); cell.classList.add('calendar-day');
        const dNum = document.createElement('span'); dNum.classList.add('day-number'); dNum.textContent = day; cell.appendChild(dNum);
        const currDate = new Date(year, month, day);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (currDate.getTime() === today.getTime()) cell.classList.add('today');
        cell.dataset.date = dateStr;
        cell.addEventListener('click', () => openPlanningModalForDate(dateStr));

        if (planningData[dateStr] && planningData[dateStr].length > 0) {
            const maxInd = 2;
            planningData[dateStr].slice(0, maxInd).forEach(p => {
                 const ind = document.createElement('span'); ind.classList.add('exposant-indicator');
                 ind.innerHTML = `<i class="fas fa-store-alt"></i> ${p.nomExposant}`; cell.appendChild(ind);
            });
            if(planningData[dateStr].length > maxInd) {
                const mInd = document.createElement('span'); mInd.classList.add('exposant-indicator');
                mInd.textContent = `et ${planningData[dateStr].length - maxInd} autre(s)...`; cell.appendChild(mInd);
            }
        }
        calendarGridElement.appendChild(cell);
    }
    const totalCells = startingDay + daysInMonth; const remCells = (7-(totalCells%7))%7;
    for (let i=0; i<remCells; i++) { const eCell = document.createElement('div'); eCell.classList.add('calendar-day', 'not-current-month'); calendarGridElement.appendChild(eCell); }
}

function openPlanningModalForDate(dateStr) {
    const modal = document.getElementById('modal-exposant-planning-date');
    if (!modal) return;
    const dateObj = new Date(dateStr + "T00:00:00Z");
    modal.querySelector('#modal-planning-date-title').textContent = `Planning Exposants pour le ${dateObj.toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris'})}`;
    modal.querySelector('#planning-selected-date').value = dateStr;
    displayPlannedExposantsForDate(dateStr);

    const selectExposant = modal.querySelector('#select-exposant-for-planning');
    selectExposant.innerHTML = '<option value="">-- Sélectionner --</option>';
    exposantsData.sort((a,b) => (a.Nom || '').localeCompare(b.Nom || '')).forEach(expo => {
        const opt = document.createElement('option'); opt.value = expo.id; opt.textContent = expo.Nom;
        selectExposant.appendChild(opt); // Pas besoin de dataset.nomExposant ici si on prend textContent
    });
    const form = modal.querySelector('#form-add-exposant-to-date');
    if (form) form.reset();
    modal.style.display = 'block';
}

function displayPlannedExposantsForDate(dateStr) {
    const listContainer = document.getElementById('planned-exposants-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<h5>Déjà Prévu(s) :</h5>';
    if (planningData[dateStr] && planningData[dateStr].length > 0) {
        planningData[dateStr].sort((a,b) => (a.heure_debut || "00:00").localeCompare(b.heure_debut || "00:00")).forEach(item => {
            const div = document.createElement('div'); div.classList.add('planned-item');
            let tInfo = item.heure_debut; if (item.heure_fin) tInfo += ` - ${item.heure_fin}`;
            div.innerHTML = `<span><strong>${item.nomExposant}</strong> (${tInfo})${item.standAssigne ? ' - Stand: '+item.standAssigne : ''}</span>
                             <button class="btn-delete-planning" data-planning-id="${item.id}" title="Retirer"><i class="fas fa-times-circle"></i></button>`;
            listContainer.appendChild(div);
        });
    } else { listContainer.innerHTML += '<p><i>Aucun exposant planifié pour cette date.</i></p>'; }
}

async function handleAddExposantToDate(event) {
    event.preventDefault();
    const form = event.target;
    const selectedDateStr = document.getElementById('planning-selected-date').value;
    const selectEl = form['select-exposant-for-planning'];
    const exposantId = selectEl.value;
    const nomExposant = selectEl.options[selectEl.selectedIndex]?.textContent || "Exposant Inconnu";
    const heureDebut = form['exposant-planning-heure-debut'].value;
    const heureFin = form['exposant-planning-heure-fin'].value || null;
    const standAssigne = form['exposant-planning-stand'].value.trim() || null;

    if (!selectedDateStr || !exposantId || !heureDebut) { showNotification("Veuillez sélectionner un exposant et une heure de début.", true); return; }

    const planningEntry = {
        date_venue: firebase.firestore.Timestamp.fromDate(new Date(selectedDateStr + 'T00:00:00Z')),
        exposantId, nomExposant, heure_debut: heureDebut, heure_fin: heureFin, standAssigne,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        await db.collection('planning_exposants').add(planningEntry);
        showNotification(`${nomExposant} ajouté au planning.`);
        form.reset();
        await loadPlanningForMonth(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
        displayPlannedExposantsForDate(selectedDateStr);
    } catch (error) { console.error("Erreur ajout planning:", error); showNotification("Erreur ajout au planning.", true); }
}

async function handleDeletePlanningItem(planningId, dateStr) {
    if (!confirm("Retirer cet exposant du planning pour cette date ?")) return;
    try {
        await db.collection('planning_exposants').doc(planningId).delete();
        showNotification("Entrée du planning supprimée.");
        await loadPlanningForMonth(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
        displayPlannedExposantsForDate(dateStr);
    } catch (error) { console.error("Erreur suppression planning:", error); showNotification("Erreur suppression entrée planning.", true); }
}

// --- Setup des Listeners du Module ---
export function setupExposantsListeners() {
    console.log("EXPOSANTS: Attachement des listeners...");
    if(!setupCalendarDOMElements()){ // Initialise et vérifie si les éléments sont là
        console.error("EXPOSANTS: Échec de l'initialisation des éléments DOM du calendrier. Certaines fonctionnalités du planning pourraient ne pas marcher.");
    }

    const formExposants = document.getElementById('form-exposants');
    if (formExposants) formExposants.addEventListener('submit', handleSubmitAddExposant);
    const formEditExposants = document.getElementById('form-edit-exposant');
    if (formEditExposants) formEditExposants.addEventListener('submit', handleSubmitEditExposant);

    const logoInputAdd = document.getElementById('exposant-logo-file');
    if (logoInputAdd) {
        logoInputAdd.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) uploadExposantLogoToImgur(file, 'exposant-upload-status', 'exposant-logo-url', 'submit-add-exposant');
        });
    }
    const logoInputEdit = document.getElementById('edit-exposant-logo-file');
    if (logoInputEdit) {
        logoInputEdit.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) uploadExposantLogoToImgur(file, 'edit-exposant-upload-status', 'edit-exposant-logo-url', 'submit-edit-exposant');
        });
    }

    const exposantsListContainer = document.getElementById('exposants-list');
    if (exposantsListContainer) {
        exposantsListContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.btn-action');
            if (!button || !button.dataset.id) return;
            const id = button.dataset.id;
            if (button.classList.contains('edit')) openEditExposantModal(id);
            else if (button.classList.contains('delete')) deleteExposantItem(id);
        });
    }

    const formAddToDate = document.getElementById('form-add-exposant-to-date');
    if (formAddToDate) formAddToDate.addEventListener('submit', handleAddExposantToDate);

    const plannedList = document.getElementById('planned-exposants-list');
    if (plannedList) {
        plannedList.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('.btn-delete-planning');
            if (deleteButton && deleteButton.dataset.planningId) {
                const planningId = deleteButton.dataset.planningId;
                const selectedDateStr = document.getElementById('planning-selected-date').value;
                if(selectedDateStr) handleDeletePlanningItem(planningId, selectedDateStr);
                else console.warn("EXPOSANTS: Impossible de supprimer l'item du planning, date sélectionnée non trouvée.");
            }
        });
    }

    // L'appel initial à renderExposantCalendar et loadPlanningForMonth
    // est maintenant géré par ui.js -> handleMenuItemClick lorsque la section est activée.
}