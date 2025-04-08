// --- INITIALISATION DE FIREBASE ---
const firebaseConfig = {
  // COLLEZ VOTRE CONFIG Firebase ICI
  apiKey: "AIzaSyCzlrRY437eu0tUCqK99OXtOeyOdYSUYsw",
  authDomain: "appli-cse-56b03.firebaseapp.com",
  projectId: "appli-cse-56b03",
  storageBucket: "appli-cse-56b03.firebasestorage.app",
  messagingSenderId: "892776841086",
  appId: "1:892776841086:web:2a1a7c60be011fda0afd2f"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- VARIABLES GLOBALES ---
let newsData = [];
let membersData = [];
let partnersData = [];
let demandesData = [];
let calendarData = [];
let coffeeData = [];
let salariesDataCache = null; // Pour badge café si besoin
let mySynthChart = null; // Référence graphique
let currentActiveSectionId = null; // ID de la section actuellement visible

// --- GESTION DES MODALS ---
const modals = document.querySelectorAll('.modal');
const closeButtons = document.querySelectorAll('.close');

closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-modal');
        const modalElement = document.getElementById(modalId);
        if (modalElement) modalElement.style.display = 'none';
    });
});

window.onclick = function (event) {
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};

// --- GESTION DE LA NAVIGATION PAR MENU ---
const menuItems = document.querySelectorAll('.menu-item');
const contentSections = document.querySelectorAll('.content');

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        const sectionId = item.getAttribute('data-section');

        // Mettre à jour l'ID de la section active
        currentActiveSectionId = `section-${sectionId}`;

        // Gérer la classe active sur le menu
        menuItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // Afficher/cacher les sections
        contentSections.forEach(sec => {
            if (sec.id === `section-${sectionId}`) {
                sec.classList.add('active');
            } else {
                sec.classList.remove('active');
            }
        });

        // Action spécifique pour la synthèse
        if (sectionId === 'synthese') {
            loadSyntheseData(); // Assure le chargement/mise à jour
        }
        // Appliquer rotations si la section est affichée
        const activeSectionElement = document.getElementById(`section-${sectionId}`);
        if (activeSectionElement) {
             applyRandomRotation(`#${activeSectionElement.id} .grid-item:not(.add-item)`);
             applyRandomRotation(`#${activeSectionElement.id} .synth-card`); // Si on veut aussi pour synthese cards
        }
    });
});

// Activer une section par défaut au chargement
function initializeDefaultSection(defaultSectionId = 'actus') {
     const defaultMenuItem = document.querySelector(`.menu-item[data-section="${defaultSectionId}"]`);
     if (defaultMenuItem) {
         defaultMenuItem.click(); // Simule un clic pour activer la section et lancer les chargements associés
         console.log("Section initiale activée:", defaultSectionId);
     } else if (menuItems.length > 0) {
         menuItems[0].click(); // Fallback sur le premier item
          console.log("Section initiale par défaut activée (fallback):", menuItems[0].getAttribute('data-section'));
     }
}


// --- FONCTION UTILITAIRE POUR NOTIFICATIONS ---
function showNotification(message, isError = false) {
    // Idéalement, créer un élément de notification flottant
    console.log(`Notification: ${message} (Erreur: ${isError})`);
    const msgDiv = document.getElementById('message'); // Tente d'utiliser la div message de badge café
     if (msgDiv && currentActiveSectionId === 'section-badges') {
        msgDiv.textContent = message;
        msgDiv.style.color = isError ? '#c62828' : '#2e7d32';
        msgDiv.style.borderColor = isError ? 'var(--danger-couleur)' : '#a5d6a7';
        msgDiv.style.backgroundColor = isError ? '#ffebee' : '#e8f5e9';
     } else {
        alert(message); // Fallback simple
     }
}

// --- FONCTION POUR APPLIQUER ROTATION ---
function applyRandomRotation(selector) {
    // Ne sélectionne que dans la section active pour optimiser un peu
    const activeSection = document.querySelector('.content.active');
    const container = activeSection || document;
    container.querySelectorAll(selector).forEach(item => {
        // Ne pas réappliquer si déjà fait récemment ? (optionnel)
        const randomRotation = Math.random() * 6 - 3; // -3 à +3 deg
        item.style.transform = `rotate(${randomRotation}deg)`;
    });
}
// Appliquer aux items du menu une seule fois
document.addEventListener('DOMContentLoaded', () => {
    applyRandomRotation('.menu-item');
});


// --- EVENT DELEGATION & ACTION HANDLING ---
// Fonction unique pour attacher les listeners sur un conteneur
function setupActionListeners(containerElement) {
    if (!containerElement || containerElement.dataset.actionListenerAttached) return;
    containerElement.dataset.actionListenerAttached = 'true'; // Marquer comme attaché

    containerElement.addEventListener('click', (event) => {
        const button = event.target.closest('.btn-action');
        if (button && button.dataset.id) {
            event.preventDefault(); event.stopPropagation();
            const action = button.classList.contains('edit') ? 'edit' : (button.classList.contains('delete') ? 'delete' : null);
            const id = button.dataset.id;
            const sectionType = containerElement.closest('.content')?.id.replace('section-', ''); // Type depuis l'ID de la section parente

            if (action && id && sectionType) {
                 console.log(`Action Déléguée: ${action}, ID: ${id}, Section: ${sectionType}`);
                 handleAction(action, sectionType, id);
            }
        }
    });
     // Selects de statut (ex: Demandes, Café)
     containerElement.addEventListener('change', (event) => {
          const select = event.target.closest('select.contact-status, select.coffee-status');
          if (select && select.dataset.id) {
              event.stopPropagation();
              const newStatus = select.value;
              const id = select.dataset.id;
              const collection = select.classList.contains('contact-status') ? 'contact' : 'coffee';
              updateStatus(collection, id, newStatus);
          }
     });
}

// Fonction pour appeler les méthodes CRUD
function handleAction(action, sectionType, id) {
    switch (`${action}-${sectionType}`) {
        case 'edit-actus':      openEditNewsModal(id); break;
        case 'delete-actus':     deleteNews(id); break;
        case 'edit-membres':     openEditMemberModal(id); break;
        case 'delete-membres':    deleteMember(id); break;
        case 'edit-partenaires': openEditPartnerModal(id); break;
        case 'delete-partenaires': deletePartner(id); break;
        case 'edit-calendrier':  openEditCalendarModal(id); break;
        case 'delete-calendrier': deleteCalendarEvent(id); break;
        case 'delete-coffee':    deleteCoffeeReport(id); break; // Pas d'édition pour signalements
        default: console.warn("Action/Type non géré par handleAction:", `${action}-${sectionType}`);
    }
}

// Fonction pour mettre à jour le statut
function updateStatus(collection, docId, newStatus) {
     db.collection(collection).doc(docId).update({ status: newStatus })
        .then(() => showNotification("Statut mis à jour : " + newStatus))
        .catch(error => {
             console.error(`Erreur MàJ statut ${collection}:`, error);
             showNotification("Erreur MàJ statut.", true);
        });
}


// === MODULE ACTUALITÉS ===
function loadNewsFromFirebase() {
    db.collection('news').orderBy('date', 'desc').onSnapshot(snapshot => {
        newsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateNewsList();
         if (currentActiveSectionId === 'section-actus') applyRandomRotation('#section-actus .grid-item:not(.add-item)');
    }, error => console.error("Erreur chargement actus:", error));
}
function updateNewsList() {
    const container = document.getElementById('news-list'); if (!container) return;
    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item)').forEach(item => item.remove());

    const openAddBtn = document.getElementById('open-add-actualite');
     if(openAddBtn && addButtonCard){ addButtonCard.innerHTML = ''; addButtonCard.appendChild(openAddBtn); openAddBtn.onclick = () => {document.getElementById('modal-actualites').style.display = 'block';};}
     else if(openAddBtn){const card=document.createElement('div'); card.className='grid-item add-item'; card.appendChild(openAddBtn); container.prepend(card); openAddBtn.onclick=()=>{document.getElementById('modal-actualites').style.display='block';};}


    if (newsData.length === 0 && container.children.length <= 1) {
         const msg = document.createElement('p'); msg.textContent = "Aucune actualité."; msg.classList.add('empty-message'); container.appendChild(msg);
    } else {
        container.querySelector('.empty-message')?.remove();
        newsData.forEach(news => {
            const item = document.createElement('div'); item.classList.add('grid-item');
            item.innerHTML = `
                ${news.image ? `<img src="${news.image}" alt="${news.title}">` : ''}
                <h3>${news.title}</h3>
                <p>${news.content.substring(0, 150)}...</p>
                <small>Le ${news.date} (${news.status})</small>
                <div class="card-actions news-actions">
                  <button class="btn-action edit" data-id="${news.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                  <button class="btn-action delete" data-id="${news.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
                </div>`;
             if (addButtonCard) container.insertBefore(item, addButtonCard); else container.appendChild(item);
        });
    }
}
function openEditNewsModal(id) { const news = newsData.find(n => n.id === id); if (!news) return; /* ... Remplir form edit ... */ document.getElementById('edit-news-id').value=id; document.getElementById('edit-news-title').value = news.title; document.getElementById('edit-news-content').value = news.content; document.getElementById('edit-news-date').value = news.date; document.getElementById('edit-news-image').value = news.image || ''; document.getElementById('edit-news-status').value = news.status; document.getElementById('modal-edit-actualite').style.display = 'block'; }
function deleteNews(id) { if (!confirm("Effacer cette actu ?")) return; db.collection('news').doc(id).delete().then(()=>showNotification("Actu effacée.")).catch(err=>{console.error(err); showNotification("Erreur suppression", true);}); }
// Form Listeners Actus
document.getElementById('form-actualites').addEventListener('submit', e => { e.preventDefault(); const data={title: e.target['news-title'].value, content:e.target['news-content'].value, date:e.target['news-date'].value, image:e.target['news-image'].value, status:e.target['news-status'].value}; db.collection('news').add(data).then(()=>{ showNotification('Actualité ajoutée!'); e.target.reset(); document.getElementById('modal-actualites').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur ajout', true);}); });
document.getElementById('form-edit-actualite').addEventListener('submit', e => { e.preventDefault(); const id=e.target['edit-news-id'].value; const data={title: e.target['edit-news-title'].value, content:e.target['edit-news-content'].value, date:e.target['edit-news-date'].value, image:e.target['edit-news-image'].value, status:e.target['edit-news-status'].value}; db.collection('news').doc(id).update(data).then(()=>{ showNotification('Actualité modifiée!'); document.getElementById('modal-edit-actualite').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur modif', true);}); });


// === MODULE MEMBRES ===
function loadMembersFromFirebase() {
    db.collection('membres').orderBy('Nom', 'asc').onSnapshot(snapshot => {
        membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateMembersList();
         if (currentActiveSectionId === 'section-membres') applyRandomRotation('#section-membres .grid-item:not(.add-item)');
    }, error => console.error("Erreur chargement membres:", error));
}
function updateMembersList() {
    const container = document.getElementById('members-list'); if (!container) return;
    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item)').forEach(item => item.remove());

    const openAddBtn = document.getElementById('open-add-membre');
    if(openAddBtn && addButtonCard){ addButtonCard.innerHTML=''; addButtonCard.appendChild(openAddBtn); openAddBtn.onclick=()=>{document.getElementById('modal-membres').style.display='block';};}
    else if(openAddBtn){const card=document.createElement('div'); card.className='grid-item add-item'; card.appendChild(openAddBtn); container.prepend(card); openAddBtn.onclick=()=>{document.getElementById('modal-membres').style.display='block';};}


    if (membersData.length === 0 && container.children.length <= 1) {
         const msg = document.createElement('p'); msg.textContent = "Aucun membre."; msg.classList.add('empty-message'); container.appendChild(msg);
    } else {
        container.querySelector('.empty-message')?.remove();
        membersData.forEach(member => {
            const item = document.createElement('div'); const photoURL=member.PhotoURL;
          if (photoURL) { 
            item.classList.add('grid-item', photoURL ? 'polaroid-style' : '');}
             item.innerHTML = `
               ${photoURL ? `<img src="${photoURL}" alt="Photo ${member.Prenom}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div style="display:none; height:100px; background:#f0f0f0; margin:0.5rem; border:1px dashed #ccc; align-items:center; justify-content:center;"><i class="fas fa-user" style="font-size:2rem; color:#ccc;"></i></div>`
               : '<div style="height:100px; background:#f0f0f0; margin:0.5rem; border:1px dashed #ccc; display:flex; align-items:center; justify-content:center;"><i class="fas fa-user" style="font-size:2rem; color:#ccc;"></i></div>'}
               <h3>${member.Prenom||''} ${member.Nom||''}</h3>
               ${(!photoURL)?`<div class="member-details"><p><strong>Rôle:</strong> ${member.Role||'?'}<br><i>Op: ${member.Operation||'?'}</i><br><small><i class="fas fa-envelope"></i> ${member.Mail||'?'}</small></p></div>`:''}
               <div class="card-actions member-actions">
                 <button class="btn-action edit" data-id="${member.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                 <button class="btn-action delete" data-id="${member.id}" title="Supprimer"><i class="fas fa-user-times"></i></button>
               </div>`;
             if (addButtonCard) container.insertBefore(item, addButtonCard); else container.appendChild(item);
        });
    }
}
function openEditMemberModal(id) { const member = membersData.find(m => m.id === id); if (!member) return; document.getElementById('edit-member-id').value=id; /* ... Remplir form edit ... */ document.getElementById('edit-member-nom').value = member.Nom; document.getElementById('edit-member-prenom').value = member.Prenom; document.getElementById('edit-member-mail').value = member.Mail; document.getElementById('edit-member-operation').value = member.Operation; document.getElementById('edit-member-role').value = member.Role; document.getElementById('edit-member-photo').value = member.PhotoURL || ''; document.getElementById('modal-edit-membre').style.display = 'block'; }
function deleteMember(id) { if (!confirm("Retirer ce membre ?")) return; db.collection('membres').doc(id).delete().then(()=>showNotification("Membre retiré.")).catch(err=>{console.error(err); showNotification("Erreur retrait membre", true); }); }
// Form Listeners Membres
document.getElementById('form-membres').addEventListener('submit', e => { e.preventDefault(); const data={Nom:e.target['member-nom'].value, Prenom:e.target['member-prenom'].value, Mail:e.target['member-mail'].value, Operation:e.target['member-operation'].value, Role:e.target['member-role'].value, PhotoURL:e.target['member-photo'].value}; db.collection('membres').add(data).then(()=>{ showNotification('Membre ajouté!'); e.target.reset(); document.getElementById('modal-membres').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur ajout', true);}); });
document.getElementById('form-edit-membre').addEventListener('submit', e => { e.preventDefault(); const id=e.target['edit-member-id'].value; const data={Nom:e.target['edit-member-nom'].value, Prenom:e.target['edit-member-prenom'].value, Mail:e.target['edit-member-mail'].value, Operation:e.target['edit-member-operation'].value, Role:e.target['edit-member-role'].value, PhotoURL:e.target['edit-member-photo'].value}; db.collection('membres').doc(id).update(data).then(()=>{ showNotification('Membre modifié!'); document.getElementById('modal-edit-membre').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur modif', true);}); });


// === MODULE PARTENAIRES ===
function loadPartnersFromFirebase() {
    db.collection('partenaires').orderBy('Nom', 'asc').onSnapshot(snapshot => {
        partnersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updatePartnersList();
        if (currentActiveSectionId === 'section-partenaires') applyRandomRotation('#section-partenaires .grid-item:not(.add-item)');
    }, error => console.error("Erreur chargement partenaires:", error));
}
function updatePartnersList() {
    const container = document.getElementById('partners-list'); if (!container) return;
    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item)').forEach(item => item.remove());

    const openAddBtn = document.getElementById('open-add-partenaire');
     if(openAddBtn && addButtonCard){ addButtonCard.innerHTML=''; addButtonCard.appendChild(openAddBtn); openAddBtn.onclick=()=>{document.getElementById('modal-partenaires').style.display='block';};}
     else if(openAddBtn){const card=document.createElement('div'); card.className='grid-item add-item'; card.appendChild(openAddBtn); container.prepend(card); openAddBtn.onclick=()=>{document.getElementById('modal-partenaires').style.display='block';};}


    if (partnersData.length === 0 && container.children.length <= 1) {
        const msg = document.createElement('p'); msg.textContent = "Aucun partenaire."; msg.classList.add('empty-message'); container.appendChild(msg);
    } else {
        container.querySelector('.empty-message')?.remove();
        partnersData.forEach(partner => {
            const item = document.createElement('div'); item.classList.add('grid-item');
            item.innerHTML = `
                ${partner.Logo ? `<img src="${partner.Logo}" alt="${partner.Nom}" style="height: 50px; width: auto; object-fit: contain; margin-bottom: 1rem; border-radius:0; border:none; box-shadow:none; background:transparent; padding:0;">` : ''}
                <h3>${partner.Nom||'?'}</h3>
                <p><small>Cat: ${partner.Categorie||'?'}</small></p>
                <p>${(partner.Description||'').substring(0,100)}...</p>
                <p style="margin-top:auto;"><a href="${partner.Lien||'#'}" target="_blank" rel="noopener noreferrer">Visiter <i class="fas fa-external-link-alt" style="font-size: 0.7em;"></i></a></p>
                <div class="card-actions partner-actions">
                  <button class="btn-action edit" data-id="${partner.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                  <button class="btn-action delete" data-id="${partner.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
                </div>`;
             if (addButtonCard) container.insertBefore(item, addButtonCard); else container.appendChild(item);
        });
    }
}
function openEditPartnerModal(id) { const partner=partnersData.find(p=>p.id===id); if(!partner) return; /*... Remplir form ... */ document.getElementById('edit-partenaire-id').value=id; document.getElementById('edit-partenaire-categorie').value=partner.Categorie; document.getElementById('edit-partenaire-nom').value=partner.Nom; document.getElementById('edit-partenaire-description').value=partner.Description; document.getElementById('edit-partenaire-lien').value=partner.Lien; document.getElementById('edit-partenaire-logo').value=partner.Logo||''; document.getElementById('modal-edit-partenaire').style.display = 'block';}
function deletePartner(id) { if (!confirm("Effacer ce partenaire ?")) return; db.collection('partenaires').doc(id).delete().then(()=>showNotification("Partenaire effacé.")).catch(err=>{console.error(err); showNotification("Erreur suppression", true);}); }
// Form Listeners Partenaires
document.getElementById('form-partenaires').addEventListener('submit', e => { e.preventDefault(); const data={Categorie:e.target['partenaire-categorie'].value, Nom:e.target['partenaire-nom'].value, Description:e.target['partenaire-description'].value, Lien:e.target['partenaire-lien'].value, Logo:e.target['partenaire-logo'].value}; db.collection('partenaires').add(data).then(()=>{ showNotification('Partenaire ajouté!'); e.target.reset(); document.getElementById('modal-partenaires').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur ajout', true);}); });
document.getElementById('form-edit-partenaire').addEventListener('submit', e => { e.preventDefault(); const id=e.target['edit-partenaire-id'].value; const data={Categorie:e.target['edit-partenaire-categorie'].value, Nom:e.target['edit-partenaire-nom'].value, Description:e.target['edit-partenaire-description'].value, Lien:e.target['edit-partenaire-lien'].value, Logo:e.target['edit-partenaire-logo'].value}; db.collection('partenaires').doc(id).update(data).then(()=>{ showNotification('Partenaire modifié!'); document.getElementById('modal-edit-partenaire').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur modif', true);}); });


// === MODULE DEMANDES ===
function loadDemandesFromFirebase() {
    db.collection('contact').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        demandesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDemandesList();
        // Pas de rotation spécifique ici, mais on pourrait si désiré
    }, error => console.error("Erreur chargement demandes:", error));
}
function updateDemandesList() {
    const container = document.getElementById('demandes-list'); if (!container) return;
    container.innerHTML = ''; // Vider, pas de bouton add ici

    if (demandesData.length === 0) {
         const msg = document.createElement('p'); msg.textContent = "Aucune demande en attente."; msg.classList.add('empty-message'); container.appendChild(msg);
    } else {
        demandesData.forEach(demande => {
            const item = document.createElement('div'); item.classList.add('grid-item');
            const currentStatus = demande.status || "en cours";
            const timestamp = demande.timestamp?.toDate ? demande.timestamp.toDate().toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric'}) : '?';
            let demandesList = Array.isArray(demande.demande) ? demande.demande.join(", ") : (demande.demande || '?');
            item.innerHTML = `
                <h3>${demande.name || '?'} (${demande.operation || '?'})</h3>
                <p><small>${demande.email || '?'}</small></p>
                <p><strong>Produits:</strong> ${demandesList}</p>
                <p>${demande.message || ""}</p>
                <div style="margin-top: auto; padding-top: 0.5rem; border-top: 1px dotted var(--bordure-crayon); display: flex; justify-content: space-between; align-items: center;">
                 <p><small>Reçu: ${timestamp}</small></p>
                 <div class="form-group" style="margin:0;">
                  <label for="status-${demande.id}" style="font-size: 0.8rem; margin-right: 4px;">Statut:</label>
                  <select class="contact-status" data-id="${demande.id}" id="status-${demande.id}" style="padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px; font-size:0.8rem;">
                    <option value="en cours" ${currentStatus === 'en cours' ? 'selected' : ''}>En cours</option>
                    <option value="traité" ${currentStatus === 'traité' ? 'selected' : ''}>Traité</option>
                  </select>
                 </div>
                </div>`;
            container.appendChild(item);
        });
    }
}

// === MODULE CALENDRIER ===
function loadCalendarFromFirebase() {
    db.collection('calendrier').orderBy('date', 'asc').onSnapshot(snapshot => {
        calendarData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateCalendarList();
        if (currentActiveSectionId === 'section-calendrier') applyRandomRotation('#section-calendrier .grid-item:not(.add-item)');
    }, error => console.error("Erreur chargement calendrier:", error));
}
function updateCalendarList() {
    const container = document.getElementById('calendar-list'); if (!container) return;
    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item)').forEach(item => item.remove());

    const openAddBtn = document.getElementById('open-add-calendrier');
    if(openAddBtn && addButtonCard){addButtonCard.innerHTML=''; addButtonCard.appendChild(openAddBtn); openAddBtn.onclick=()=>{document.getElementById('modal-calendrier').style.display='block';};}
    else if(openAddBtn){const card=document.createElement('div'); card.className='grid-item add-item'; card.appendChild(openAddBtn); container.prepend(card); openAddBtn.onclick=()=>{document.getElementById('modal-calendrier').style.display='block';};}

    if (calendarData.length === 0 && container.children.length <= 1) {
         const msg = document.createElement('p'); msg.textContent = "Calendrier vide."; msg.classList.add('empty-message'); container.appendChild(msg);
    } else {
        container.querySelector('.empty-message')?.remove();
        calendarData.forEach(event => {
            const item = document.createElement('div'); item.classList.add('grid-item');
            const formatOpts = {weekday:'short', day:'numeric', month:'short'};
            const startDate = event.date ? new Date(event.date+'T'+(event.time||'00:00')).toLocaleDateString('fr-FR',formatOpts) : '';
            const startTime = event.time?.substring(0,5) || '';
            const endDate = event.endDate ? new Date(event.endDate+'T'+(event.endTime||'00:00')).toLocaleDateString('fr-FR',formatOpts) : '';
            const endTime = event.endTime?.substring(0,5) || '';
            let dateString = startDate;
            if(startTime) dateString+= ` ${startTime}`;
            if(endDate && endDate!==startDate){dateString+= ` au ${endDate}`; if(endTime) dateString+= ` ${endTime}`;}
            else if(endTime && endTime!==startTime){dateString+= ` - ${endTime}`;}

            item.innerHTML = `
                <h3>${event.title||'?'}</h3>
                <p><small><i class="fas fa-clock"></i> ${dateString}</small></p>
                <p>${event.description||''}</p>
                <div class="card-actions calendar-actions">
                  <button class="btn-action edit" data-id="${event.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                  <button class="btn-action delete" data-id="${event.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
                </div>`;
            if (addButtonCard) container.insertBefore(item, addButtonCard); else container.appendChild(item);
        });
    }
}
function openEditCalendarModal(id) { const event = calendarData.find(e => e.id === id); if (!event) return; /* ... Remplir form ... */ document.getElementById('edit-event-id').value = id; document.getElementById('edit-event-title').value=event.title; document.getElementById('edit-event-description').value=event.description; document.getElementById('edit-event-date').value=event.date; document.getElementById('edit-event-time').value=event.time; document.getElementById('edit-event-end-date').value=event.endDate||''; document.getElementById('edit-event-end-time').value=event.endTime||''; document.getElementById('modal-edit-calendrier').style.display = 'block'; }
function deleteCalendarEvent(id) { if (!confirm("Effacer cet événement ?")) return; db.collection('calendrier').doc(id).delete().then(()=>showNotification("Événement effacé.")).catch(err=>{console.error(err); showNotification("Erreur suppression", true);}); }
// Form Listeners Calendrier
document.getElementById('form-calendrier').addEventListener('submit', e => { e.preventDefault(); const data={title:e.target['event-title'].value, description:e.target['event-description'].value, date:e.target['event-date'].value, time:e.target['event-time'].value, endDate:e.target['event-end-date'].value, endTime:e.target['event-end-time'].value}; db.collection('calendrier').add(data).then(()=>{ showNotification('Événement ajouté!'); e.target.reset(); document.getElementById('modal-calendrier').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur ajout', true);}); });
document.getElementById('form-edit-calendrier').addEventListener('submit', e => { e.preventDefault(); const id=e.target['edit-event-id'].value; const data={title:e.target['edit-event-title'].value, description:e.target['edit-event-description'].value, date:e.target['edit-event-date'].value, time:e.target['edit-event-time'].value, endDate:e.target['edit-event-end-date'].value, endTime:e.target['edit-event-end-time'].value}; db.collection('calendrier').doc(id).update(data).then(()=>{ showNotification('Événement modifié!'); document.getElementById('modal-edit-calendrier').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur modif', true);}); });


// === MODULE BADGES CAFÉ === (Pas de liste dynamique de cartes)
function searchEmployee(nom, prenom) { /* ... Inchangé ... */ return db.collection('salaries_test').get().then(snapshot => snapshot.docs.filter(doc => { const d = doc.data(); return (d.Nom || '').toLowerCase() === nom.toLowerCase() && (d["Prénom"] || '').toLowerCase() === prenom.toLowerCase(); })).then(docs => ({ empty: docs.length === 0, docs })); }
function displayEmployee(employeeDoc) { /* ... Inchangé ... */ const div=document.getElementById('employee-info'); const p=document.getElementById('employee-details'); if(employeeDoc && div && p){const data=employeeDoc.data();let html=`<strong>Nom:</strong> ${data.Nom}<br><strong>Prénom:</strong> ${data["Prénom"]}<br>`; if(data.keys?.length>0){html+=`<strong>Clés:</strong><ul>${data.keys.map(k=>`<li>(${k.type}) ${k.keyNumber} - ${k.montant||0}€ <small>(${k.date||'?'})</small></li>`).join('')}</ul>`;}else{html+=`<em>Aucune clé</em><br>`;} p.innerHTML=html; div.style.display='block';}else if(div){div.style.display='none';} }
function addKeyToEmployee(nom, prenom, newKeyNumber, type, montant) { /* ... Inchangé ... */ const msgDiv=document.getElementById('message'); if(msgDiv){msgDiv.textContent=''; msgDiv.style.borderColor='transparent';} searchEmployee(nom,prenom).then(qs=>{const today=new Date().toISOString().slice(0,10); const keyData={keyNumber:newKeyNumber, type:type, montant:montant||0, date:today}; let promise; if(qs.empty){promise=db.collection('salaries_test').add({Nom:nom, "Prénom":prenom, date_creation:today, keys:[keyData]}).then(ref=>({status:"created",msg:`Salarié ${nom} ${prenom} créé.`, id:ref.id})); }else{const docRef=qs.docs[0].ref; promise=docRef.update({keys: firebase.firestore.FieldValue.arrayUnion(keyData)}).then(()=>({status:"updated", msg:`Clé ajoutée pour ${nom} ${prenom}.`,id:docRef.id})); } return promise; }).then(res=>{if(msgDiv){msgDiv.textContent=res.msg; msgDiv.style.color='green'; msgDiv.style.borderColor='green';} db.collection('salaries_test').doc(res.id).get().then(displayEmployee);}).catch(err=>{console.error(err); if(msgDiv){msgDiv.textContent="Erreur ajout clé: "+err.message; msgDiv.style.color='red'; msgDiv.style.borderColor='red';}}); }
// Listeners spécifiques Badges attachés globalement
function handleBadgeSearch() { const n=document.getElementById('filter-nom').value.trim(); const p=document.getElementById('filter-prenom').value.trim(); const msgDiv=document.getElementById('message'); if(n===''||p===''){showNotification('Nom et prénom requis.'); return;} if(msgDiv) { msgDiv.textContent=''; msgDiv.style.borderColor='transparent'; } document.getElementById('employee-info').style.display='none'; searchEmployee(n,p).then(res=>{const empDetails = document.getElementById('employee-details'); const empInfoDiv = document.getElementById('employee-info'); if(!empDetails || !empInfoDiv) return; if(res.empty){empDetails.innerHTML=`Aucun salarié ${n} ${p}.<br>Ajouter clé pour créer.`; empInfoDiv.style.display='block';}else{displayEmployee(res.docs[0]);}}).catch(err=>{console.error(err);if(msgDiv){msgDiv.textContent='Erreur recherche'; msgDiv.style.color='red'; msgDiv.style.borderColor='red';}}); }
function handleBadgeAddKey(e) { e.preventDefault(); const n=document.getElementById('filter-nom').value.trim(); const p=document.getElementById('filter-prenom').value.trim(); const k=document.getElementById('key-number').value.trim(); const t=document.getElementById('key-type').value; const mIn=document.getElementById('key-amount').value.trim(); const m=mIn===""?0:parseFloat(mIn); if(n===''||p===''||k===''){showNotification('Nom, prénom, clé requis.'); return;} if(isNaN(m)){showNotification('Montant invalide'); return;} addKeyToEmployee(n,p,k,t,m); e.target.reset(); document.getElementById('key-number')?.focus(); }


// === MODULE SIGNALEMENTS CAFÉ ===
function loadCoffeeReports() {
    db.collection('coffee').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        coffeeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateCoffeeList();
         // Pas de rotation ici, affichage plus simple
    }, error => console.error("Erreur chargement signalements:", error));
}
function updateCoffeeList() {
    const container = document.getElementById('coffee-list'); if (!container) return;
    container.innerHTML = ''; // Vider

    if (coffeeData.length === 0) {
        const msg = document.createElement('p'); msg.textContent = "Aucun signalement récent."; msg.classList.add('empty-message'); container.appendChild(msg);
    } else {
        coffeeData.forEach(report => {
            const item = document.createElement('div'); item.classList.add('grid-item');
            const currentStatus = report.status || "en cours";
            const timestamp = report.timestamp?.toDate ? report.timestamp.toDate().toLocaleString('fr-FR',{day:'numeric', month:'numeric', hour:'2-digit',minute:'2-digit'}) : '?';
            item.innerHTML = `
                 <h3>${report.machine||'?'} <small>(${report.problem||'?'})</small></h3>
                <p><strong>Par:</strong> ${report.name||'?'} (${report.email||'?'}) / Op: ${report.operation||'?'}</p>
                ${report.comment ? `<p><i>"${report.comment}"</i></p>` : ''}
                 <div class="coffee-actions card-actions" style="justify-content: space-between; margin-top: auto; border-top: 1px dotted #ccc; padding-top: 0.5rem;">
                     <p><small>Signalé: ${timestamp}</small></p>
                     <div style="display:flex; align-items:center; gap: 10px;">
                        <div class="form-group" style="margin:0;">
                            <label for="c-status-${report.id}" style="font-size:0.8rem;">Stat:</label>
                            <select class="coffee-status" data-id="${report.id}" id="c-status-${report.id}" style="padding: 1px 3px; font-size:0.8rem;">
                                <option value="en cours" ${currentStatus==='en cours'?'selected':''}>En cours</option>
                                <option value="traité" ${currentStatus==='traité'?'selected':''}>Traité</option>
                            </select>
                        </div>
                        <button class="btn-action delete" data-id="${report.id}" title="Supprimer"><i class="fas fa-trash"></i></button>
                     </div>
                </div>`;
            container.appendChild(item);
        });
    }
}
function deleteCoffeeReport(id) { if (!confirm("Effacer ce signalement ?")) return; db.collection('coffee').doc(id).delete().then(()=>showNotification("Signalement effacé.")).catch(err=>{console.error(err); showNotification("Erreur suppression", true);}); }

// === MODULE SYNTHESE ===
function loadSyntheseData() {
     const rootStyles = getComputedStyle(document.documentElement);
     const encreTexteColor = rootStyles.getPropertyValue('--encre-texte')?.trim() || '#4a4a4a';
     const postitBleu = (rootStyles.getPropertyValue('--postit-bleu')?.trim() || '#d3f1ff') + 'B3';
     const postitRose = (rootStyles.getPropertyValue('--postit-rose')?.trim() || '#ffe4e1') + 'B3';
     const postitVert = (rootStyles.getPropertyValue('--masking-tape-vert')?.trim() || '#cff0cc') + 'B3';
     const postitPeche = (rootStyles.getPropertyValue('--accent-couleur-2')?.trim() || '#ffb347') + 'B3';
     const postitPrune = '#dda0ddB3';
     const borderBleu='#87CEEB', borderRose='#FFB6C1', borderVert='#90EE90', borderPeche='#FFDAB9', borderPrune='#DDA0DD';

    Promise.all([
        db.collection('news').get(), db.collection('membres').get(), db.collection('partenaires').get(),
        db.collection('contact').where('status', '==', 'en cours').get(),
        db.collection('coffee').where('status', '==', 'en cours').get()
    ]).then((snapshots) => {
        const counts = { news: snapshots[0].size, members: snapshots[1].size, partners: snapshots[2].size, contacts: snapshots[3].size, coffee: snapshots[4].size };

        const synthContainer = document.getElementById('synthese-container');
        if (!synthContainer) return;
        synthContainer.innerHTML = '';

         const synthData = [ /* ... Comme avant ... */ { title: 'Actus', count: counts.news }, { title: 'Membres', count: counts.members }, { title: 'Partenaires', count: counts.partners }, { title: 'Contacts <small>(act.)</small>', count: counts.contacts }, { title: 'Pannes Café <small>(act.)</small>', count: counts.coffee }];
         synthData.forEach(data => { const item = document.createElement('div'); item.classList.add('synth-card'); item.innerHTML = `<h3>${data.title}</h3><p>${data.count}</p>`; synthContainer.appendChild(item); });
        applyRandomRotation('#section-synthese .synth-card'); // Rotation pour synthèse


        const ctx = document.getElementById('synth-chart')?.getContext('2d'); if (!ctx) return;
        const chartLabels = synthData.map(d => d.title.replace(/<small>.*?<\/small>/g, '').trim());
        const chartCounts = synthData.map(d => d.count);
        const chartConfigData = {
             labels: chartLabels,
             datasets: [{ data: chartCounts, backgroundColor: [postitBleu, postitRose, postitVert, postitPeche, postitPrune], borderColor: [borderBleu, borderRose, borderVert, borderPeche, borderPrune], borderWidth: 1.5 }]
        };

        if (mySynthChart) { mySynthChart.data = chartConfigData; mySynthChart.options.plugins.legend.labels.color = encreTexteColor; mySynthChart.update(); }
        else { mySynthChart = new Chart(ctx, { /* ... (Options Chart.js comme avant) ... */
                 type: 'doughnut', data: chartConfigData,
                 options: {
                    responsive: true, maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { family: "'Patrick Hand', cursive", size: 14 }, color: encreTexteColor, padding: 15 }},
                        tooltip: { bodyFont: { family: "'Roboto', sans-serif" }, titleFont: { family: "'Patrick Hand', cursive" }, backgroundColor: 'rgba(74, 74, 74, 0.8)', titleColor: '#ffffff', bodyColor: '#ffffff', padding: 10, cornerRadius: 3 }
                    }
                 }
             }); }
    }).catch(error => console.error("Erreur chargement synthèse:", error));
}

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM prêt.");

    // Attacher les listeners aux conteneurs où la délégation est nécessaire
     contentSections.forEach(section => {
        const container = section.querySelector('.grid'); // Cible la grille pour actions sur cartes
         if(container) setupActionListeners(container);

         // Attacher aussi si section a des selects statiques (ex: badges, café?)
         if(section.querySelector('select.contact-status, select.coffee-status')) {
            setupActionListeners(section); // Attache au conteneur de section
         }
    });

     // Listeners spécifiques pour la section badges (hors délégation)
     const badgePage = document.getElementById('section-badges');
     if (badgePage) {
         document.getElementById('search-employee-btn')?.addEventListener('click', handleBadgeSearch);
         document.getElementById('form-add-key')?.addEventListener('submit', handleBadgeAddKey);
     }


    // Charger TOUTES les données
    loadNewsFromFirebase();
    loadMembersFromFirebase();
    loadPartnersFromFirebase();
    loadDemandesFromFirebase();
    loadCalendarFromFirebase();
    loadCoffeeReports();
    // loadSyntheseData() sera appelée par initializeDefaultSection si c'est la page par défaut

    // Activer la section par défaut (par exemple 'synthèse')
    initializeDefaultSection('synthese');

    console.log("Initialisation terminée.");
});
