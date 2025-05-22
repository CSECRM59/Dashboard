// js/modules/actualites.js
import { getDb } from '../firebaseService.js';
import { resetModalForms } from '../ui.js';
import { showNotification, applyRandomRotation } from '../utils.js';
import { IMGUR_CLIENT_ID, COLLECTIONS } from '../config.js';

const db = getDb();

// --- VARIABLES SPÉCIFIQUES AU MODULE ---
let newsData = []; // Données des actualités chargées
// 'localCurrentActiveSectionId' n'est plus explicitement utilisé ici,
// on se fie à window.uiCurrentActiveSectionId mis à jour par ui.js

// --- UPLOAD IMGUR ---
async function uploadToImgur(file, statusElementId, urlInputElementId, submitButtonId) {
    const statusDiv = document.getElementById(statusElementId);
    const urlInput = document.getElementById(urlInputElementId);
    const submitButton = document.getElementById(submitButtonId);

    if (!file) {
        if (statusDiv) statusDiv.textContent = "Aucun fichier sélectionné.";
        return null;
    }

    if (!IMGUR_CLIENT_ID || IMGUR_CLIENT_ID === "VOTRE_CLIENT_ID_IMGUR") {
         console.error("Client ID Imgur manquant ou non configuré !");
         if (statusDiv) statusDiv.textContent = "Erreur: Client ID Imgur non configuré.";
         showNotification("Erreur de configuration Imgur.", true);
         return null;
    }

    if (urlInput) urlInput.value = '';
    if (statusDiv) statusDiv.textContent = 'Téléversement vers Imgur...';
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
            console.log('Imgur Upload OK:', data);
            if (statusDiv) statusDiv.textContent = 'Image téléversée !';
            if (urlInput) urlInput.value = data.data.link;
            if (submitButton) submitButton.disabled = false;
            return data.data.link;
        } else {
            console.error('Erreur API Imgur:', data);
            if (statusDiv) statusDiv.textContent = `Erreur Imgur: ${data.data?.error || 'Inconnue'}`;
            showNotification(`Erreur Imgur: ${data.data?.error || 'Inconnue'}`, true);
            if (submitButton) submitButton.disabled = false;
            return null;
        }
    } catch (error) {
        console.error('Erreur Fetch vers Imgur:', error);
        if (statusDiv) statusDiv.textContent = 'Erreur réseau lors du téléversement.';
        showNotification('Erreur réseau lors du téléversement.', true);
        if (submitButton) submitButton.disabled = false;
        return null;
    }
}

// --- FONCTIONS CRUD ET AFFICHAGE ---
export function loadNewsFromFirebase() {
    db.collection(COLLECTIONS.NEWS).orderBy('date', 'desc').onSnapshot(snapshot => {
        newsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateNewsList();
    }, error => {
        console.error("Erreur chargement actus:", error);
        showNotification("Erreur chargement des actualités.", true);
    });
}

function updateNewsList() {
    const container = document.getElementById('news-list');
    if (!container) {
        console.error("Conteneur #news-list introuvable pour les actualités.");
        return;
    }

    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item), .news-section-title').forEach(item => item.remove());

    const openAddBtn = document.getElementById('open-add-actualite');
    if (openAddBtn && addButtonCard) {
        addButtonCard.innerHTML = ''; // Vider au cas où
        addButtonCard.appendChild(openAddBtn);
        openAddBtn.onclick = () => {
            const modal = document.getElementById('modal-actualites');
            if(modal) {
                // Réinitialiser les champs d'upload avant d'ouvrir la modale d'ajout
                const fileInput = modal.querySelector('#news-image-file');
                const statusDiv = modal.querySelector('#news-upload-status');
                const urlInput = modal.querySelector('#news-image-url');
                const submitButton = modal.querySelector('#submit-add-news'); // Cible le bouton spécifique

                if(fileInput) fileInput.value = null;
                if(statusDiv) statusDiv.textContent = '';
                if(urlInput) urlInput.value = '';
                if(submitButton) submitButton.disabled = false; // S'assurer qu'il est actif
                modal.style.display = 'block';
            }
        };
    } else if (openAddBtn) { // Fallback si addButtonCard n'est pas trouvé mais le bouton existe
        const card = document.createElement('div');
        card.className = 'grid-item add-item';
        card.appendChild(openAddBtn);
        container.prepend(card); // Mettre en premier si la structure est incertaine
        openAddBtn.onclick = () => { document.getElementById('modal-actualites').style.display = 'block'; };
    }


    if (newsData.length === 0 && (!addButtonCard || container.children.length <= 1)) {
        const msg = document.createElement('p');
        msg.textContent = "Aucune actualité à afficher.";
        msg.classList.add('empty-message');
        // Insérer après la carte d'ajout si elle existe, sinon à la fin
        if (addButtonCard && addButtonCard.parentNode === container) {
             container.insertBefore(msg, addButtonCard.nextSibling);
        } else {
            container.appendChild(msg);
        }
        return;
    } else {
        container.querySelector('.empty-message')?.remove();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingNews = [];
    const pastNews = [];

    newsData.forEach(news => {
        if (!news.date) {
            pastNews.push(news);
            return;
        }
        try {
            const newsDate = new Date(news.date); // Les dates Firestore sont souvent déjà des objets Date ou des Timestamps
            const newsDateComparable = new Date(newsDate.getFullYear(), newsDate.getMonth(), newsDate.getDate());

            if (newsDateComparable >= today) {
                upcomingNews.push(news);
            } else {
                pastNews.push(news);
            }
        } catch(e) {
            console.warn("Date d'actualité invalide pour le tri:", news, e);
            pastNews.push(news);
        }
    });

    upcomingNews.sort((a, b) => new Date(a.date) - new Date(b.date));
    pastNews.sort((a, b) => new Date(b.date) - new Date(a.date));

    const createNewsItemHTML = (news) => {
        return `
            ${news.image ? `<img src="${news.image}" alt="${news.title || 'Actualité'}">` : ''}
            <h3>${news.title || 'Sans titre'}</h3>
            <p>${(news.content || '').substring(0, 150)}...</p>
            ${news.link ? `<p style="margin-top: 0.5rem;"><a href="${news.link}" target="_blank" rel="noopener noreferrer" title="Visiter le lien externe">Voir le site <i class="fas fa-external-link-alt" style="font-size: 0.8em;"></i></a></p>` : ''}
            <small>Le ${news.date || '?'} (${news.status || '?'})</small>
            <div class="card-actions news-actions">
              <button class="btn-action edit" data-id="${news.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
              <button class="btn-action delete" data-id="${news.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
            </div>`;
    };

    const addSectionTitle = (titleText, referenceNode) => {
        const titleElement = document.createElement('h3');
        titleElement.textContent = titleText;
        titleElement.classList.add('news-section-title');
        titleElement.style.width = '100%';
        titleElement.style.textAlign = 'left';
        titleElement.style.marginTop = '2.5rem';
        titleElement.style.marginBottom = '1rem';
        titleElement.style.paddingBottom = '0.5rem';
        titleElement.style.borderBottom = '1px dashed var(--accent-couleur-1)';
        titleElement.style.color = 'var(--accent-couleur-1)';
        titleElement.style.gridColumn = '1 / -1';
        container.insertBefore(titleElement, referenceNode);
    };

    // Assurer que la carte d'ajout est toujours présente si le bouton existe
    // Et la retirer temporairement pour la réinsérer au bon endroit
    if (addButtonCard) {
        addButtonCard.remove();
    }


    if (upcomingNews.length > 0) {
        addSectionTitle("Actualités à Venir", null); // null pour ajouter à la fin (avant addButtonCard)
        upcomingNews.forEach(news => {
            const item = document.createElement('div');
            item.classList.add('grid-item');
            item.innerHTML = createNewsItemHTML(news);
            container.appendChild(item); // Ajoute à la fin du conteneur
        });
    }

    if (pastNews.length > 0) {
        addSectionTitle("Actualités Passées", null); // null pour ajouter à la fin (avant addButtonCard)
        pastNews.forEach(news => {
            const item = document.createElement('div');
            item.classList.add('grid-item');
            item.innerHTML = createNewsItemHTML(news);
            container.appendChild(item); // Ajoute à la fin du conteneur
        });
    }
    
    // Réinsérer la carte d'ajout au début si elle existe
    if (addButtonCard) {
        container.prepend(addButtonCard);
    }


    if (window.uiCurrentActiveSectionId === 'section-actus') {
        applyRandomRotation('#section-actus .grid-item:not(.add-item)');
    }
}

function openEditNewsModal(id) {
    const newsItem = newsData.find(n => n.id === id);
    if (!newsItem) {
        showNotification("Actualité introuvable pour modification.", true);
        return;
    }
    const modal = document.getElementById('modal-edit-actualite');
    if (!modal) return;

    modal.querySelector('#edit-news-id').value = id;
    modal.querySelector('#edit-news-title').value = newsItem.title || '';
    modal.querySelector('#edit-news-content').value = newsItem.content || '';
    modal.querySelector('#edit-news-date').value = newsItem.date || '';
    modal.querySelector('#edit-news-link').value = newsItem.link || '';
    modal.querySelector('#edit-news-status').value = newsItem.status || 'Publié';

    const currentImageUrl = newsItem.image || '';
    const imageDisplayDiv = modal.querySelector('#edit-current-image-display');
    const originalUrlInput = modal.querySelector('#edit-news-original-image-url');
    const newUrlInput = modal.querySelector('#edit-news-image-url');
    const fileInput = modal.querySelector('#edit-news-image-file');
    const statusDiv = modal.querySelector('#edit-news-upload-status');
    const submitButton = modal.querySelector('#submit-edit-news'); // Cible le bouton spécifique

    if (originalUrlInput) originalUrlInput.value = currentImageUrl;
    if (imageDisplayDiv) {
        if (currentImageUrl) {
            imageDisplayDiv.innerHTML = `<p style="font-size:0.9em; margin-bottom:5px;">Image actuelle :</p><img src="${currentImageUrl}" alt="Image actuelle" style="max-width: 150px; max-height: 100px; border: 1px solid #ccc; display: block;">`;
        } else {
            imageDisplayDiv.innerHTML = '<p style="font-size:0.9em; margin-bottom:5px;"><i>Pas d\'image actuelle.</i></p>';
        }
    }
    if (newUrlInput) newUrlInput.value = '';
    if (fileInput) fileInput.value = null;
    if (statusDiv) statusDiv.textContent = '';
    if (submitButton) submitButton.disabled = false; // S'assurer qu'il est actif

    modal.style.display = 'block';
}

async function deleteNewsItem(id) {
    if (!confirm("Êtes-vous sûr de vouloir effacer cette actualité ?")) return;
    try {
        await db.collection(COLLECTIONS.NEWS).doc(id).delete();
        showNotification("Actualité effacée avec succès.");
    } catch (err) {
        console.error("Erreur suppression actualité:", err);
        showNotification("Erreur lors de la suppression de l'actualité.", true);
    }
}

function handleSubmitAddNews(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('#submit-add-news');
    const imageUrl = form.querySelector('#news-image-url').value;
    const data = {
        title: form['news-title'].value,
        content: form['news-content'].value,
        date: form['news-date'].value,
        image: imageUrl,
        link: form['news-link'].value.trim(),
        status: form['news-status'].value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.title || !data.content || !data.date) {
        showNotification("Veuillez remplir les champs Titre, Contenu et Date.", true);
        return;
    }
    if (submitButton) submitButton.disabled = true;

    db.collection(COLLECTIONS.NEWS).add(data)
        .then(() => {
            showNotification('Actualité ajoutée avec succès!');
            if (modal) {
                resetModalForms(modal);
                modal.style.display = 'none';
            }
        })
        .catch(err => {
            console.error("Erreur ajout actualité:", err);
            showNotification("Erreur lors de l'ajout de l'actualité.", true);
        })
        .finally(() => { if (submitButton) submitButton.disabled = false; });
}

function handleSubmitEditNews(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal');
    const submitButton = form.querySelector('#submit-edit-news');
    const newsId = form['edit-news-id'].value;

    if (!newsId) {
        showNotification("Erreur : Identifiant de l'actualité manquant.", true);
        if (submitButton) submitButton.disabled = true;
        return;
    }

    const newImageUrl = form.querySelector('#edit-news-image-url').value;
    const originalImageUrl = form.querySelector('#edit-news-original-image-url').value;
    const finalImageUrl = newImageUrl || originalImageUrl;
    const data = {
        title: form['edit-news-title'].value,
        content: form['edit-news-content'].value,
        date: form['edit-news-date'].value,
        image: finalImageUrl,
        link: form['edit-news-link'].value.trim(),
        status: form['edit-news-status'].value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.title || !data.content || !data.date) {
        showNotification("Veuillez remplir les champs Titre, Contenu et Date.", true);
        return;
    }
    if (submitButton) submitButton.disabled = true;

    db.collection(COLLECTIONS.NEWS).doc(newsId).update(data)
        .then(() => {
            showNotification('Actualité modifiée avec succès!');
            if (modal) modal.style.display = 'none';
        })
        .catch(err => {
            console.error(`Erreur modification actualité ID: ${newsId}`, err);
            showNotification("Erreur lors de la modification de l'actualité.", true);
        })
        .finally(() => { if (submitButton) submitButton.disabled = false; });
}

export function setupActualitesListeners() {
    console.log("Attachement des listeners pour le module Actualités...");

    const formActus = document.getElementById('form-actualites');
    if (formActus) {
        formActus.addEventListener('submit', handleSubmitAddNews);
    } else { console.warn("Formulaire #form-actualites non trouvé."); }

    const formEditActus = document.getElementById('form-edit-actualite');
    if (formEditActus) {
        formEditActus.addEventListener('submit', handleSubmitEditNews);
    } else { console.warn("Formulaire #form-edit-actualite non trouvé."); }

    const newsImageInputAdd = document.getElementById('news-image-file');
    if (newsImageInputAdd) {
        newsImageInputAdd.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) uploadToImgur(file, 'news-upload-status', 'news-image-url', 'submit-add-news');
        });
    }

    const newsImageInputEdit = document.getElementById('edit-news-image-file');
    if (newsImageInputEdit) {
        newsImageInputEdit.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) uploadToImgur(file, 'edit-news-upload-status', 'edit-news-image-url', 'submit-edit-news');
        });
    }

    const newsListContainer = document.getElementById('news-list');
    if (newsListContainer) {
        newsListContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.btn-action');
            if (!button || !button.dataset.id) return;
            const id = button.dataset.id;
            if (button.classList.contains('edit')) openEditNewsModal(id);
            else if (button.classList.contains('delete')) deleteNewsItem(id);
        });
    }
}