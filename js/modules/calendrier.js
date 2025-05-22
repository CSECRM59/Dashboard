// js/modules/calendrier.js
import { getDb } from '../firebaseService.js';
import { resetModalForms } from '../ui.js';
import { showNotification, applyRandomRotation } from '../utils.js';
import { COLLECTIONS } from '../config.js';

const db = getDb();

// --- VARIABLES SPÉCIFIQUES AU MODULE ---
let calendarData = []; // Données des événements du calendrier

// --- FONCTIONS CRUD ET AFFICHAGE ---

/**
 * Charge les événements du calendrier depuis Firestore et met à jour l'UI.
 */
export function loadCalendarFromFirebase() {
    // Trier par date de début ascendante
    db.collection(COLLECTIONS.CALENDAR).orderBy('date', 'asc').onSnapshot(snapshot => {
        calendarData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateCalendarList();
    }, error => {
        console.error("Erreur chargement calendrier:", error);
        showNotification("Erreur chargement des événements du calendrier.", true);
    });
}

function updateCalendarList() {
    const container = document.getElementById('calendar-list');
    if (!container) {
        console.error("Conteneur #calendar-list introuvable.");
        return;
    }

    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item)').forEach(item => item.remove());

    const openAddBtn = document.getElementById('open-add-calendrier');
    if (openAddBtn && addButtonCard) {
        addButtonCard.innerHTML = '';
        addButtonCard.appendChild(openAddBtn);
        openAddBtn.onclick = () => { document.getElementById('modal-calendrier').style.display = 'block'; };
    } else if (openAddBtn) {
        const card = document.createElement('div');
        card.className = 'grid-item add-item';
        card.appendChild(openAddBtn);
        container.prepend(card);
        openAddBtn.onclick = () => { document.getElementById('modal-calendrier').style.display = 'block'; };
    }

    if (calendarData.length === 0 && (!addButtonCard || container.children.length <= 1)) {
        const msg = document.createElement('p');
        msg.textContent = "Aucun événement programmé pour le moment.";
        msg.classList.add('empty-message');
        if (addButtonCard) container.insertBefore(msg, addButtonCard.nextSibling); else container.appendChild(msg);
    } else {
        container.querySelector('.empty-message')?.remove();
        calendarData.forEach(event => {
            const item = document.createElement('div');
            item.classList.add('grid-item');

            const formatOpts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
            let dateString = 'Date non définie';

            try {
                if (event.date) {
                    const startDateObj = new Date(`${event.date}T${event.time || '00:00:00'}`);
                    dateString = startDateObj.toLocaleDateString('fr-FR', formatOpts);
                    if (event.time) dateString += ` ${event.time.substring(0,5)}`;

                    if (event.endDate && event.endDate !== event.date) {
                        const endDateObj = new Date(`${event.endDate}T${event.endTime || '00:00:00'}`);
                        dateString += ` au ${endDateObj.toLocaleDateString('fr-FR', formatOpts)}`;
                        if (event.endTime) dateString += ` ${event.endTime.substring(0,5)}`;
                    } else if (event.endTime && event.endTime !== event.time) {
                        dateString += ` - ${event.endTime.substring(0,5)}`;
                    }
                }
            } catch (e) {
                console.warn("Erreur formatage date événement:", event, e);
                dateString = "Date invalide";
            }


            item.innerHTML = `
                <h3>${event.title || 'Sans titre'}</h3>
                <p><small><i class="fas fa-clock"></i> ${dateString}</small></p>
                <p>${event.description || 'Pas de description.'}</p>
                <div class="card-actions calendar-actions">
                  <button class="btn-action edit" data-id="${event.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                  <button class="btn-action delete" data-id="${event.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
                </div>`;
            if (addButtonCard) container.insertBefore(item, addButtonCard); else container.appendChild(item);
        });

        if (window.uiCurrentActiveSectionId === 'section-calendrier') {
            applyRandomRotation('#section-calendrier .grid-item:not(.add-item)');
        }
    }
}

function openEditCalendarModal(id) {
    const eventItem = calendarData.find(e => e.id === id);
    if (!eventItem) {
        showNotification("Événement introuvable pour modification.", true);
        return;
    }
    const modal = document.getElementById('modal-edit-calendrier');
    if (!modal) return;

    modal.querySelector('#edit-event-id').value = id;
    modal.querySelector('#edit-event-title').value = eventItem.title || '';
    modal.querySelector('#edit-event-description').value = eventItem.description || '';
    modal.querySelector('#edit-event-date').value = eventItem.date || '';
    modal.querySelector('#edit-event-time').value = eventItem.time || '';
    modal.querySelector('#edit-event-end-date').value = eventItem.endDate || '';
    modal.querySelector('#edit-event-end-time').value = eventItem.endTime || '';

    const submitButton = modal.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = false;

    modal.style.display = 'block';
}

async function deleteCalendarEventItem(id) {
    if (!confirm("Êtes-vous sûr de vouloir effacer cet événement ?")) return;
    try {
        await db.collection(COLLECTIONS.CALENDAR).doc(id).delete();
        showNotification("Événement effacé avec succès.");
    } catch (err) {
        console.error("Erreur suppression événement:", err);
        showNotification("Erreur lors de la suppression de l'événement.", true);
    }
}

// --- LISTENERS POUR LES FORMULAIRES DU MODULE ---
function handleSubmitAddCalendarEvent(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('button[type="submit"]');

    const data = {
        title: form['event-title'].value.trim(),
        description: form['event-description'].value.trim(),
        date: form['event-date'].value,
        time: form['event-time'].value,
        endDate: form['event-end-date'].value,
        endTime: form['event-end-time'].value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.title || !data.date || !data.time) {
        showNotification("Veuillez remplir Titre, Date de début et Heure de début.", true);
        return;
    }
    // Validation optionnelle: endDate doit être >= date
    if (data.endDate && data.endDate < data.date) {
        showNotification("La date de fin ne peut pas être antérieure à la date de début.", true);
        return;
    }
    if (data.endDate === data.date && data.endTime && data.endTime < data.time) {
        showNotification("L'heure de fin ne peut pas être antérieure à l'heure de début pour le même jour.", true);
        return;
    }


    if (submitButton) submitButton.disabled = true;

    db.collection(COLLECTIONS.CALENDAR).add(data)
        .then(() => {
            showNotification('Événement ajouté avec succès!');
            if (modal) {
                resetModalForms(modal);
                modal.style.display = 'none';
            }
        })
        .catch(err => {
            console.error("Erreur ajout événement:", err);
            showNotification("Erreur lors de l'ajout de l'événement.", true);
        })
        .finally(() => {
            if (submitButton) submitButton.disabled = false;
        });
}

function handleSubmitEditCalendarEvent(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('button[type="submit"]');
    const eventId = form['edit-event-id'].value;

    if (!eventId) {
        showNotification("Erreur : Identifiant de l'événement manquant.", true);
        if (submitButton) submitButton.disabled = true;
        return;
    }

    const data = {
        title: form['edit-event-title'].value.trim(),
        description: form['edit-event-description'].value.trim(),
        date: form['edit-event-date'].value,
        time: form['edit-event-time'].value,
        endDate: form['edit-event-end-date'].value,
        endTime: form['edit-event-end-time'].value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.title || !data.date || !data.time) {
        showNotification("Veuillez remplir Titre, Date de début et Heure de début.", true);
        return;
    }
    if (data.endDate && data.endDate < data.date) {
        showNotification("La date de fin ne peut pas être antérieure à la date de début.", true);
        return;
    }
    if (data.endDate === data.date && data.endTime && data.endTime < data.time) {
        showNotification("L'heure de fin ne peut pas être antérieure à l'heure de début pour le même jour.", true);
        return;
    }

    if (submitButton) submitButton.disabled = true;

    db.collection(COLLECTIONS.CALENDAR).doc(eventId).update(data)
        .then(() => {
            showNotification('Événement modifié avec succès!');
            if (modal) {
                modal.style.display = 'none';
            }
        })
        .catch(err => {
            console.error(`Erreur modification événement ID: ${eventId}`, err);
            showNotification("Erreur lors de la modification de l'événement.", true);
        })
        .finally(() => {
            if (submitButton) submitButton.disabled = false;
        });
}

/**
 * Met en place les listeners spécifiques au module Calendrier.
 */
export function setupCalendarListeners() {
    console.log("Attachement des listeners pour le module Calendrier...");

    const formCalendrier = document.getElementById('form-calendrier');
    if (formCalendrier) {
        formCalendrier.addEventListener('submit', handleSubmitAddCalendarEvent);
    } else {
        console.warn("Formulaire #form-calendrier non trouvé.");
    }

    const formEditCalendrier = document.getElementById('form-edit-calendrier');
    if (formEditCalendrier) {
        formEditCalendrier.addEventListener('submit', handleSubmitEditCalendarEvent);
    } else {
        console.warn("Formulaire #form-edit-calendrier non trouvé.");
    }

    const calendarListContainer = document.getElementById('calendar-list');
    if (calendarListContainer) {
        calendarListContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.btn-action');
            if (!button) return;
            const id = button.dataset.id;
            if (!id) return;

            if (button.classList.contains('edit')) {
                openEditCalendarModal(id);
            } else if (button.classList.contains('delete')) {
                deleteCalendarEventItem(id);
            }
        });
    }
}