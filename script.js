// --- INITIALISATION DE FIREBASE ---
const firebaseConfig = {
  // Colle ici ta configuration Firebase
  apiKey: "AIzaSyCzlrRY437eu0tUCqK99OXtOeyOdYSUYsw",
  authDomain: "appli-cse-56b03.firebaseapp.com",
  projectId: "appli-cse-56b03",
  storageBucket: "appli-cse-56b03.firebasestorage.app",
  messagingSenderId: "892776841086",
  appId: "1:892776841086:web:2a1a7c60be011fda0afd2f"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Variables pour stocker les données
let newsData = [];
let membersData = [];
let partnersData = [];
let demandesData = [];
let calendarData = [];
let coffeeData = []; // Ajouté pour les signalements café

// --- GESTION DES MODALS ---
const modals = document.querySelectorAll('.modal');
const closeButtons = document.querySelectorAll('.close');

closeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('data-modal');
    document.getElementById(modalId).style.display = 'none';
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
const menuItems = document.querySelectorAll('.menu-item'); // Garder une référence
menuItems.forEach(item => {
  item.addEventListener('click', () => {
    const section = item.getAttribute('data-section');
    // Gérer la classe active pour le style (optionnel)
    menuItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    // Afficher la section correspondante
    document.querySelectorAll('.content').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`section-${section}`).classList.add('active');

    // Si la section synthèse est activée, recharger/redessiner le graphique
    if (section === 'synthese' && window.mySynthChart) {
        loadSyntheseData(); // Recharge les données ET redessine le graphique
    }
  });
});

// Activer la première section par défaut (par exemple, actus)
document.addEventListener('DOMContentLoaded', () => {
    if (menuItems.length > 0) {
        menuItems[0].click(); // Simule un clic sur le premier item
    }
});


// Boutons d'ouverture des modaux d'ajout (récupérés via les boutons dans les grilles)
// Les écouteurs sont ajoutés dans les fonctions update...List() car les boutons sont recréés.


// --- FONCTION UTILITAIRE POUR NOTIFICATIONS (si besoin) ---
function showNotification(message, isError = false) {
    // Remplace alert() par quelque chose de plus intégré si tu veux
    console.log(`Notification: ${message} (Erreur: ${isError})`);
    alert(message); // Garde alert pour la simplicité pour l'instant
}

// === MODULE ACTUALITÉS ===
function loadNewsFromFirebase() {
  db.collection('news')
    .orderBy('date', 'desc')
    .onSnapshot(snapshot => {
      newsData = [];
      snapshot.forEach(doc => {
        newsData.push({ id: doc.id, ...doc.data() });
      });
      updateNewsList();
      applyRandomRotation('.grid-item:not(.add-item)'); // Appliquer la rotation après mise à jour
    }, error => console.error("Erreur de chargement des actualités :", error));
}

function updateNewsList() {
  const container = document.getElementById('news-list');
  // Préserver le bouton d'ajout
  const addButton = container.querySelector('.add-item');
  container.innerHTML = ''; // Vider la grille sauf le bouton ajout
  if (addButton) container.appendChild(addButton); // Réinsérer le bouton ajout en premier

  // Attacher l'écouteur au bouton d'ajout (s'il existe)
   const openAddButton = document.getElementById('open-add-actualite');
    if (openAddButton) {
        openAddButton.onclick = () => { // Use onclick pour écraser l'ancien listener si nécessaire
            document.getElementById('modal-actualites').style.display = 'block';
        };
    }


  if (newsData.length === 0) {
    const msg = document.createElement('p');
    msg.textContent = "Aucune actualité pour le moment.";
    // Insérer après le bouton ajout s'il existe
    if (addButton && addButton.nextSibling) {
         container.insertBefore(msg, addButton.nextSibling);
    } else if (addButton) {
        container.appendChild(msg);
    } else {
        container.innerHTML = ''; // Vider s'il n'y avait pas de bouton ajout
        container.appendChild(msg);
    }
  } else {
    newsData.forEach(news => {
      const item = document.createElement('div');
      item.classList.add('grid-item');
      item.innerHTML = `
        ${news.image ? `<img src="${news.image}" alt="Image ${news.title}">` : ''}
        <h3>${news.title}</h3>
        <p>${news.content.substring(0, 100)}${news.content.length > 100 ? '...' : ''}</p>
        <small>Publié le: ${news.date} - Statut: ${news.status}</small>
        <div class="news-actions"> <!-- Actions en bas -->
          <button class="btn-action edit edit-news" data-id="${news.id}" title="Modifier">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button class="btn-action delete delete-news" data-id="${news.id}" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      container.appendChild(item); // Ajouter après le bouton d'ajout
    });
  }

  // Réattacher les listeners pour edit/delete
  attachActionListeners('.edit-news', openEditModal);
  attachActionListeners('.delete-news', deleteNews);
}

function openEditModal(id) {
  const news = newsData.find(n => n.id === id);
  if (!news) return;
  document.getElementById('edit-news-id').value = news.id;
  document.getElementById('edit-news-title').value = news.title;
  document.getElementById('edit-news-content').value = news.content;
  document.getElementById('edit-news-date').value = news.date;
  document.getElementById('edit-news-image').value = news.image || '';
  document.getElementById('edit-news-status').value = news.status;
  document.getElementById('modal-edit-actualite').style.display = 'block';
}

document.getElementById('form-actualites').addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('news-title').value;
  const content = document.getElementById('news-content').value;
  const date = document.getElementById('news-date').value;
  const image = document.getElementById('news-image').value;
  const status = document.getElementById('news-status').value;
  db.collection('news').add({ title, content, date, image, status })
    .then(() => {
      showNotification("Actualité enregistrée !");
      e.target.reset();
      document.getElementById('modal-actualites').style.display = 'none';
      // Pas besoin d'appeler loadSyntheseData ici, onSnapshot le fera
    })
    .catch(error => console.error("Erreur lors de l'ajout de l'actualité :", error));
});

document.getElementById('form-edit-actualite').addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('edit-news-id').value;
  const title = document.getElementById('edit-news-title').value;
  const content = document.getElementById('edit-news-content').value;
  const date = document.getElementById('edit-news-date').value;
  const image = document.getElementById('edit-news-image').value;
  const status = document.getElementById('edit-news-status').value;
  db.collection('news').doc(id).update({ title, content, date, image, status })
    .then(() => {
      showNotification("Actualité modifiée !");
      document.getElementById('modal-edit-actualite').style.display = 'none';
      // Pas besoin d'appeler loadSyntheseData ici, onSnapshot le fera
    })
    .catch(error => console.error("Erreur lors de la modification de l'actualité :", error));
});

function deleteNews(id) {
  if (confirm("Voulez-vous vraiment supprimer cette actualité ?")) {
    db.collection('news').doc(id).delete()
      .then(() => showNotification("Actualité supprimée !"))
      .catch(error => console.error("Erreur lors de la suppression de l'actualité :", error));
    // La mise à jour de la synthèse se fera via onSnapshot
  }
}

// === MODULE MEMBRES ===
function loadMembersFromFirebase() {
  db.collection('membres')
    .orderBy('Nom', 'asc')
    .onSnapshot(snapshot => {
      membersData = [];
      snapshot.forEach(doc => {
        membersData.push({ id: doc.id, ...doc.data() });
      });
      updateMembersList();
      applyRandomRotation('.grid-item:not(.add-item)');
    }, error => console.error("Erreur de chargement des membres :", error));
}

function updateMembersList() {
  const container = document.getElementById('members-list');
  const addButton = container.querySelector('.add-item');
  container.innerHTML = '';
  if (addButton) container.appendChild(addButton);

   const openAddButton = document.getElementById('open-add-membre');
    if (openAddButton) {
        openAddButton.onclick = () => {
            document.getElementById('modal-membres').style.display = 'block';
        };
    }

  if (membersData.length === 0) {
     const msg = document.createElement('p');
     msg.textContent = "Aucun membre pour le moment.";
     if (addButton && addButton.nextSibling) container.insertBefore(msg, addButton.nextSibling);
     else if (addButton) container.appendChild(msg);
     else { container.innerHTML = ''; container.appendChild(msg); }
  } else {
    membersData.forEach(member => {
      const item = document.createElement('div');
      item.classList.add('grid-item');
      // Style Polaroid simple
      item.innerHTML = `
         ${member.PhotoURL ? `<img src="${member.PhotoURL}" alt="Photo de ${member.Prenom}" style="margin-bottom: 1rem;">` : '<div style="height:150px; background:#eee; display:flex; align-items:center; justify-content:center; margin-bottom:1rem;"><i class="fas fa-user" style="font-size: 3rem; color: #ccc;"></i></div>'}
         <div style="padding: 0 0.5rem;"> <!-- Zone pour le texte -->
            <h3 style="margin-bottom: 0.2rem;">${member.Prenom} ${member.Nom}</h3>
            <p style="font-size: 0.85rem; margin-bottom: 0.1rem;">${member.Role}</p>
            <p style="font-size: 0.8rem; color: var(--encre-secondaire);">${member.Mail}</p>
            <p style="font-size: 0.8rem; color: var(--encre-secondaire);">Op: ${member.Operation}</p>
         </div>
         <div class="member-actions">
           <button class="btn-action edit edit-member" data-id="${member.id}" title="Modifier">
             <i class="fas fa-pencil-alt"></i>
           </button>
           <button class="btn-action delete delete-member" data-id="${member.id}" title="Supprimer">
             <i class="fas fa-trash"></i>
           </button>
         </div>
       `;
      container.appendChild(item);
    });
  }

  attachActionListeners('.edit-member', openEditMemberModal);
  attachActionListeners('.delete-member', deleteMember);
}

function openEditMemberModal(id) {
  const member = membersData.find(m => m.id === id);
  if (!member) return;
  document.getElementById('edit-member-id').value = member.id;
  document.getElementById('edit-member-nom').value = member.Nom;
  document.getElementById('edit-member-prenom').value = member.Prenom;
  document.getElementById('edit-member-mail').value = member.Mail;
  document.getElementById('edit-member-operation').value = member.Operation;
  document.getElementById('edit-member-role').value = member.Role;
  document.getElementById('edit-member-photo').value = member.PhotoURL || '';
  document.getElementById('modal-edit-membre').style.display = 'block';
}

document.getElementById('form-membres').addEventListener('submit', e => {
  e.preventDefault();
  const Nom = document.getElementById('member-nom').value;
  const Prenom = document.getElementById('member-prenom').value;
  const Mail = document.getElementById('member-mail').value;
  const Operation = document.getElementById('member-operation').value;
  const Role = document.getElementById('member-role').value;
  const PhotoURL = document.getElementById('member-photo').value;
  db.collection('membres').add({ Nom, Prenom, Mail, Operation, Role, PhotoURL })
    .then(() => {
      showNotification("Membre ajouté !");
      e.target.reset();
      document.getElementById('modal-membres').style.display = 'none';
    })
    .catch(error => console.error("Erreur lors de l'ajout du membre :", error));
});

document.getElementById('form-edit-membre').addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('edit-member-id').value;
  const Nom = document.getElementById('edit-member-nom').value;
  const Prenom = document.getElementById('edit-member-prenom').value;
  const Mail = document.getElementById('edit-member-mail').value;
  const Operation = document.getElementById('edit-member-operation').value;
  const Role = document.getElementById('edit-member-role').value;
  const PhotoURL = document.getElementById('edit-member-photo').value;
  db.collection('membres').doc(id).update({ Nom, Prenom, Mail, Operation, Role, PhotoURL })
    .then(() => {
      showNotification("Membre modifié !");
      document.getElementById('modal-edit-membre').style.display = 'none';
    })
    .catch(error => console.error("Erreur lors de la modification du membre :", error));
});

function deleteMember(id) {
  if (confirm("Voulez-vous vraiment supprimer ce membre ?")) {
    db.collection('membres').doc(id).delete()
      .then(() => showNotification("Membre supprimé !"))
      .catch(error => console.error("Erreur lors de la suppression du membre :", error));
  }
}

// === MODULE PARTENAIRES ===
function loadPartnersFromFirebase() {
  db.collection('partenaires')
    .orderBy('Nom', 'asc')
    .onSnapshot(snapshot => {
      partnersData = [];
      snapshot.forEach(doc => {
        partnersData.push({ id: doc.id, ...doc.data() });
      });
      updatePartnersList();
      applyRandomRotation('.grid-item:not(.add-item)');
    }, error => console.error("Erreur de chargement des partenaires :", error));
}

function updatePartnersList() {
  const container = document.getElementById('partners-list');
  const addButton = container.querySelector('.add-item');
  container.innerHTML = '';
  if(addButton) container.appendChild(addButton);

  const openAddButton = document.getElementById('open-add-partenaire');
    if (openAddButton) {
        openAddButton.onclick = () => {
            document.getElementById('modal-partenaires').style.display = 'block';
        };
    }

  if (partnersData.length === 0) {
     const msg = document.createElement('p');
     msg.textContent = "Aucun partenaire pour le moment.";
     if (addButton && addButton.nextSibling) container.insertBefore(msg, addButton.nextSibling);
     else if (addButton) container.appendChild(msg);
     else { container.innerHTML = ''; container.appendChild(msg); }
  } else {
    partnersData.forEach(partner => {
      const item = document.createElement('div');
      item.classList.add('grid-item');
      item.innerHTML = `
        ${partner.Logo ? `<img src="${partner.Logo}" alt="Logo ${partner.Nom}" style="height: 60px; width: auto; object-fit: contain; margin-bottom: 1rem; border: none; padding: 0; background: transparent; box-shadow: none;">` : ''}
        <h3>${partner.Nom}</h3>
        <p><em>Catégorie : ${partner.Categorie}</em></p>
        <p>${partner.Description.substring(0, 100)}${partner.Description.length > 100 ? '...' : ''}</p>
        <p><a href="${partner.Lien}" target="_blank">Visiter le site</a></p>
        <div class="partner-actions">
          <button class="btn-action edit edit-partner" data-id="${partner.id}" title="Modifier">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button class="btn-action delete delete-partner" data-id="${partner.id}" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  attachActionListeners('.edit-partner', openEditPartnerModal);
  attachActionListeners('.delete-partner', deletePartner);
}

function openEditPartnerModal(id) {
  const partner = partnersData.find(p => p.id === id);
  if (!partner) return;
  document.getElementById('edit-partenaire-id').value = partner.id;
  document.getElementById('edit-partenaire-categorie').value = partner.Categorie;
  document.getElementById('edit-partenaire-nom').value = partner.Nom;
  document.getElementById('edit-partenaire-description').value = partner.Description;
  document.getElementById('edit-partenaire-lien').value = partner.Lien;
  document.getElementById('edit-partenaire-logo').value = partner.Logo || '';
  document.getElementById('modal-edit-partenaire').style.display = 'block';
}

document.getElementById('form-partenaires').addEventListener('submit', e => {
  e.preventDefault();
  const Categorie = document.getElementById('partenaire-categorie').value;
  const Nom = document.getElementById('partenaire-nom').value;
  const Description = document.getElementById('partenaire-description').value;
  const Lien = document.getElementById('partenaire-lien').value;
  const Logo = document.getElementById('partenaire-logo').value;
  db.collection('partenaires').add({ Categorie, Nom, Description, Lien, Logo })
    .then(() => {
      showNotification("Partenaire ajouté !");
      e.target.reset();
      document.getElementById('modal-partenaires').style.display = 'none';
    })
    .catch(error => console.error("Erreur lors de l'ajout du partenaire :", error));
});

document.getElementById('form-edit-partenaire').addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('edit-partenaire-id').value;
  const Categorie = document.getElementById('edit-partenaire-categorie').value;
  const Nom = document.getElementById('edit-partenaire-nom').value;
  const Description = document.getElementById('edit-partenaire-description').value;
  const Lien = document.getElementById('edit-partenaire-lien').value;
  const Logo = document.getElementById('edit-partenaire-logo').value;
  db.collection('partenaires').doc(id).update({ Categorie, Nom, Description, Lien, Logo })
    .then(() => {
      showNotification("Partenaire modifié !");
      document.getElementById('modal-edit-partenaire').style.display = 'none';
    })
    .catch(error => console.error("Erreur lors de la modification du partenaire :", error));
});

function deletePartner(id) {
  if (confirm("Voulez-vous vraiment supprimer ce partenaire ?")) {
    db.collection('partenaires').doc(id).delete()
      .then(() => showNotification("Partenaire supprimé !"))
      .catch(error => console.error("Erreur lors de la suppression du partenaire :", error));
  }
}

// === MODULE DEMANDES ===
function loadDemandesFromFirebase() {
  db.collection('contact')
    .orderBy('timestamp', 'desc')
    .onSnapshot(snapshot => {
      demandesData = [];
      snapshot.forEach(doc => {
        demandesData.push({ id: doc.id, ...doc.data() });
      });
      updateDemandesList();
      applyRandomRotation('.grid-item:not(.add-item)');
    }, error => console.error("Erreur lors du chargement des demandes :", error));
}

function updateDemandesList() {
  const container = document.getElementById('demandes-list');
  container.innerHTML = ''; // Pas de bouton "Ajouter" ici a priori

  if (demandesData.length === 0) {
    const msg = document.createElement('p');
    msg.textContent = "Aucune demande pour le moment.";
    container.appendChild(msg);
  } else {
    demandesData.forEach(demande => {
      const item = document.createElement('div');
      item.classList.add('grid-item');

      let demandesList = Array.isArray(demande.demande) ? demande.demande.join(", ") : (demande.demande || 'Non spécifié');
      const currentStatus = demande.status || "en cours";
      const timestamp = demande.timestamp?.toDate ? demande.timestamp.toDate().toLocaleDateString('fr-FR') : (demande.timestamp || 'Date inconnue');

      item.innerHTML = `
        <h3>Demande de: ${demande.name || "Anonyme"}</h3>
        <p><strong>Contact:</strong> ${demande.email || "Non fourni"}</p>
        <p><strong>Opération:</strong> ${demande.operation || "Non fournie"}</p>
        <p><strong>Message:</strong> ${demande.message || ""}</p>
        <p><strong>Produits:</strong> ${demandesList}</p>
        <p><small>Reçu le: ${timestamp}</small></p>
        <div class="form-group" style="margin-top: 1rem; border-top: 1px dotted var(--bordure-crayon); padding-top: 1rem;">
          <label for="status-${demande.id}" style="font-family: var(--font-corps); font-size: 0.9rem; color: var(--encre-texte);">Statut:</label>
          <select class="contact-status" data-id="${demande.id}" id="status-${demande.id}">
            <option value="en cours" ${currentStatus === 'en cours' ? 'selected' : ''}>En cours</option>
            <option value="traité" ${currentStatus === 'traité' ? 'selected' : ''}>Traité</option>
          </select>
        </div>
      `;
      container.appendChild(item);
    });
  }

  // Listener pour le changement de statut
    document.querySelectorAll('.contact-status').forEach(select => {
        // Supprimer l'ancien listener s'il existe pour éviter les doublons
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);

        newSelect.addEventListener('change', (e) => {
            const newStatus = e.target.value;
            const id = newSelect.getAttribute('data-id');
            db.collection('contact').doc(id).update({ status: newStatus })
                .then(() => {
                showNotification("Statut mis à jour en " + newStatus);
                })
                .catch(error => {
                console.error("Erreur lors de la mise à jour du statut :", error);
                });
        });
    });
}

// === MODULE CALENDRIER ===
function loadCalendarFromFirebase() {
  db.collection('calendrier')
    .orderBy('date', 'asc') // Tri par date de début
    .onSnapshot(snapshot => {
      calendarData = [];
      snapshot.forEach(doc => {
        calendarData.push({ id: doc.id, ...doc.data() });
      });
      updateCalendarList();
      applyRandomRotation('.grid-item:not(.add-item)');
    }, error => console.error("Erreur chargement calendrier:", error));
}

function updateCalendarList() {
  const container = document.getElementById('calendar-list');
  const addButton = container.querySelector('.add-item');
  container.innerHTML = '';
  if(addButton) container.appendChild(addButton);

   const openAddButton = document.getElementById('open-add-calendrier');
    if (openAddButton) {
        openAddButton.onclick = () => {
            document.getElementById('modal-calendrier').style.display = 'block';
        };
    }


  if (calendarData.length === 0) {
     const msg = document.createElement('p');
     msg.textContent = "Aucun événement pour le moment.";
     if (addButton && addButton.nextSibling) container.insertBefore(msg, addButton.nextSibling);
     else if (addButton) container.appendChild(msg);
     else { container.innerHTML = ''; container.appendChild(msg); }
  } else {
    calendarData.forEach(event => {
      const item = document.createElement('div');
      item.classList.add('grid-item');
      // Formater les dates
      const startDate = event.date ? new Date(event.date + 'T' + (event.time || '00:00')).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '';
      const startTime = event.time || '';
      const endDate = event.endDate ? new Date(event.endDate + 'T' + (event.endTime || '00:00')).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '';
      const endTime = event.endTime || '';

      let dateString = `Le ${startDate}`;
      if (startTime) dateString += ` à ${startTime}`;
      if (endDate && endDate !== startDate) {
          dateString += ` jusqu'au ${endDate}`;
          if (endTime) dateString += ` à ${endTime}`;
      } else if (endTime && endTime !== startTime) {
          dateString += ` jusqu'à ${endTime}`;
      }

      item.innerHTML = `
        <h3>${event.title}</h3>
        <p><strong>Quand :</strong> ${dateString}</p>
        <p>${event.description}</p>
        <div class="calendar-actions">
          <button class="btn-action edit edit-calendar" data-id="${event.id}" title="Modifier">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button class="btn-action delete delete-calendar" data-id="${event.id}" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      container.appendChild(item);
    });
  }
  attachActionListeners('.edit-calendar', openEditCalendarModal);
  attachActionListeners('.delete-calendar', deleteCalendarEvent);
}

function openEditCalendarModal(id) {
  const event = calendarData.find(e => e.id === id);
  if (!event) return;
  document.getElementById('edit-event-id').value = event.id;
  document.getElementById('edit-event-title').value = event.title;
  document.getElementById('edit-event-description').value = event.description;
  document.getElementById('edit-event-date').value = event.date;
  document.getElementById('edit-event-time').value = event.time;
  document.getElementById('edit-event-end-date').value = event.endDate || '';
  document.getElementById('edit-event-end-time').value = event.endTime || '';
  document.getElementById('modal-edit-calendrier').style.display = 'block';
}

document.getElementById('form-calendrier').addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('event-title').value;
  const description = document.getElementById('event-description').value;
  const date = document.getElementById('event-date').value;
  const time = document.getElementById('event-time').value;
  const endDate = document.getElementById('event-end-date').value;
  const endTime = document.getElementById('event-end-time').value;

  db.collection('calendrier').add({ title, description, date, time, endDate, endTime })
    .then(() => {
      showNotification("Événement ajouté !");
      e.target.reset();
      document.getElementById('modal-calendrier').style.display = 'none';
    })
    .catch(error => console.error("Erreur ajout événement:", error));
});

document.getElementById('form-edit-calendrier').addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('edit-event-id').value;
  const title = document.getElementById('edit-event-title').value;
  const description = document.getElementById('edit-event-description').value;
  const date = document.getElementById('edit-event-date').value;
  const time = document.getElementById('edit-event-time').value;
  const endDate = document.getElementById('edit-event-end-date').value;
  const endTime = document.getElementById('edit-event-end-time').value;

  db.collection('calendrier').doc(id).update({ title, description, date, time, endDate, endTime })
    .then(() => {
      showNotification("Événement modifié !");
      document.getElementById('modal-edit-calendrier').style.display = 'none';
    })
    .catch(error => console.error("Erreur modif événement:", error));
});

function deleteCalendarEvent(id) {
  if (confirm("Voulez-vous vraiment supprimer cet événement ?")) {
    db.collection('calendrier').doc(id).delete()
      .then(() => showNotification("Événement supprimé !"))
      .catch(error => console.error("Erreur suppr événement:", error));
  }
}

// === MODULE BADGES CAFÉ ===

function searchEmployee(nom, prenom) {
  console.log("Recherche salarié insensible à la casse :", nom, prenom);
  return db.collection('salaries_test')
    .get()
    .then(snapshot => {
      const filteredDocs = snapshot.docs.filter(doc => {
        const data = doc.data();
        // Vérifier l'existence des champs avant d'utiliser toLowerCase()
        const docNom = data.Nom || '';
        const docPrenom = data["Prénom"] || '';
        return docNom.toLowerCase() === nom.toLowerCase() &&
               docPrenom.toLowerCase() === prenom.toLowerCase();
      });
      return {
        empty: filteredDocs.length === 0,
        docs: filteredDocs
      };
    });
}

function displayEmployee(employeeDoc) {
  const employeeInfoDiv = document.getElementById('employee-info');
  const detailsP = document.getElementById('employee-details');

  if (employeeDoc) {
    const data = employeeDoc.data();
    let infoHtml = `<strong>Nom :</strong> ${data.Nom}<br>
                    <strong>Prénom :</strong> ${data["Prénom"]}<br>`;
    if (data.keys && data.keys.length > 0) {
      infoHtml += `<strong>Clés :</strong><ul> ${data.keys.map(k => {
        return `<li>(${k.type}) ${k.keyNumber} - ${k.montant || 0}€ <small>(${k.date || 'pas de date'})</small></li>`;
      }).join('')}</ul>`;
    } else {
      infoHtml += `<em>Aucune clé enregistrée</em><br>`;
    }
    detailsP.innerHTML = infoHtml;
    employeeInfoDiv.style.display = 'block';
  } else {
     employeeInfoDiv.style.display = 'none';
  }
}

function addKeyToEmployee(nom, prenom, newKeyNumber, type, montant) {
  searchEmployee(nom, prenom)
    .then(querySnapshot => {
      const today = new Date().toISOString().slice(0, 10); // format AAAA-MM-JJ
      const keyData = {
            keyNumber: newKeyNumber,
            type: type,
            montant: montant || 0, // Assurer une valeur par défaut
            date: today
          };

      if (querySnapshot.empty) {
        // Création
        return db.collection('salaries_test').add({
          Nom: nom,
          "Prénom": prenom,
          date_creation: today, // date de création
          keys: [keyData]
        }).then((docRef) => {
          return { status: "created", message: `Salarié ${nom} ${prenom} créé avec la clé ${newKeyNumber}.`, newDocId: docRef.id };
        });
      } else {
        // Mise à jour
        const docRef = querySnapshot.docs[0].ref;
        // Utiliser FieldValue.arrayUnion pour ajouter la clé de manière atomique
        return docRef.update({
             keys: firebase.firestore.FieldValue.arrayUnion(keyData)
        }).then(() => {
             return { status: "updated", message: `Clé ${newKeyNumber} ajoutée pour ${nom} ${prenom}.`, docId: docRef.id };
        });
      }
    })
    .then(result => {
      const messageDiv = document.getElementById('message');
      messageDiv.textContent = result.message;
      messageDiv.style.color = "green";
      messageDiv.style.borderColor = "green"; // Adapter au style CSS

      // Recharge la fiche salarié pour mettre à jour l'affichage
       const targetId = result.newDocId || result.docId;
        if (targetId) {
            db.collection('salaries_test').doc(targetId).get().then(displayEmployee);
        } else { // Fallback si on n'a pas l'ID (ne devrait pas arriver)
             searchEmployee(nom, prenom).then(qs => {
                if (!qs.empty) displayEmployee(qs.docs[0]);
            });
        }

    })
    .catch(error => {
      console.error("Erreur lors de l'ajout de la clé :", error);
      const messageDiv = document.getElementById('message');
      messageDiv.textContent = "Erreur lors de l'ajout de la clé: " + error.message;
      messageDiv.style.color = "red";
      messageDiv.style.borderColor = "red"; // Adapter au style CSS
    });
}

document.getElementById('search-employee-btn').addEventListener('click', () => {
  const nom = document.getElementById('filter-nom').value.trim();
  const prenom = document.getElementById('filter-prenom').value.trim();
  const messageDiv = document.getElementById('message');

  if (nom === "" || prenom === "") {
    showNotification("Veuillez renseigner le nom et le prénom.");
    return;
  }

  messageDiv.textContent = "";
  messageDiv.style.color = ""; // Réinitialiser couleur/bordure
  messageDiv.style.borderColor = "transparent";
  document.getElementById('employee-info').style.display = 'none'; // Cacher par défaut

  searchEmployee(nom, prenom)
    .then(result => {
      if (result.empty) {
        document.getElementById('employee-details').innerHTML = `Aucun salarié trouvé pour <strong>${nom} ${prenom}</strong>.<br>Vous pouvez ajouter une clé pour créer sa fiche.`;
        document.getElementById('employee-info').style.display = 'block'; // Afficher la zone pour ajout
      } else {
        displayEmployee(result.docs[0]); // Afficher la fiche existante
      }
    })
    .catch(error => {
      console.error("Erreur lors de la recherche du salarié :", error);
      messageDiv.textContent = "Erreur lors de la recherche.";
      messageDiv.style.color = "red";
       messageDiv.style.borderColor = "red";
    });
});

document.getElementById('form-add-key').addEventListener('submit', e => {
  e.preventDefault();

  const nom = document.getElementById('filter-nom').value.trim();
  const prenom = document.getElementById('filter-prenom').value.trim();
  const keyNumber = document.getElementById('key-number').value.trim();
  const keyType = document.getElementById('key-type').value;
  const montantInput = document.getElementById('key-amount').value.trim();
  const montant = montantInput === "" ? 0 : parseFloat(montantInput); // Défaut 0 si vide

  if (nom === "" || prenom === "" || keyNumber === "") {
    showNotification("Veuillez renseigner le nom, le prénom et le numéro de clé.");
    return;
  }
   if (isNaN(montant)) {
        showNotification("Le montant saisi n'est pas un nombre valide.");
        return;
    }


  addKeyToEmployee(nom, prenom, keyNumber, keyType, montant);

  // Réinitialisation DU FORMULAIRE DE CLÉ seulement
  document.getElementById('key-number').value = '';
  // document.getElementById('key-type').value = 'E'; // Garder le type sélectionné ?
  document.getElementById('key-amount').value = '';
});


// === MODULE SIGNALEMENTS CAFÉ ===
function loadCoffeeReports() {
  db.collection('coffee')
    .orderBy('timestamp', 'desc')
    .onSnapshot(snapshot => {
      coffeeData = [];
      snapshot.forEach(doc => {
        coffeeData.push({ id: doc.id, ...doc.data() });
      });
      updateCoffeeList();
      applyRandomRotation('.grid-item:not(.add-item)');
    }, error => console.error("Erreur chargement signalements café:", error));
}

function updateCoffeeList() {
  const container = document.getElementById('coffee-list');
  container.innerHTML = ''; // Pas de bouton ajout ici

  if (coffeeData.length === 0) {
    const msg = document.createElement('p');
    msg.textContent = "Aucun signalement pour le moment.";
    container.appendChild(msg);
  } else {
    coffeeData.forEach(report => {
      const item = document.createElement('div');
      item.classList.add('grid-item');
      const currentStatus = report.status || "en cours";
      const timestamp = report.timestamp?.toDate ? report.timestamp.toDate().toLocaleString('fr-FR') : (report.timestamp || 'Date inconnue');

      item.innerHTML = `
        <h3>Signalement : ${report.machine || 'Machine non spécifiée'}</h3>
        <p><strong>Problème:</strong> ${report.problem || ''}</p>
        <p><strong>Par:</strong> ${report.name || 'Anonyme'} (${report.email || 'email non fourni'})</p>
        <p><strong>Opération:</strong> ${report.operation || 'Non fournie'}</p>
        ${report.comment ? `<p><strong>Commentaire:</strong> ${report.comment}</p>` : ''}
        <p><small>Signalé le: ${timestamp}</small></p>

        <div class="coffee-actions" style="margin-top: 1rem; border-top: 1px dotted var(--bordure-crayon); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <div class="form-group" style="margin-bottom: 0;">
            <label for="coffee-status-${report.id}" style="font-family: var(--font-corps); font-size: 0.9rem; margin-right: 0.5rem;">Statut:</label>
            <select class="coffee-status" data-id="${report.id}" id="coffee-status-${report.id}">
              <option value="en cours" ${currentStatus === 'en cours' ? 'selected' : ''}>En cours</option>
              <option value="traité" ${currentStatus === 'traité' ? 'selected' : ''}>Traité</option>
            </select>
          </div>
          <button class="btn-action delete delete-coffee" data-id="${report.id}" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      container.appendChild(item);
    });
  }

   // Listener pour le changement de statut
    document.querySelectorAll('.coffee-status').forEach(select => {
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);

        newSelect.addEventListener('change', e => {
            const newStatus = e.target.value;
            const id = newSelect.getAttribute('data-id');
            db.collection('coffee').doc(id).update({ status: newStatus })
                .then(() => {
                    showNotification(`Statut du signalement mis à jour : ${newStatus}`);
                })
                .catch(error => {
                    console.error("Erreur maj statut café:", error);
                    showNotification("Erreur maj statut", true);
                });
            });
    });

   // Listener pour la suppression
   attachActionListeners('.delete-coffee', (id) => {
        if (confirm("Voulez-vous vraiment supprimer ce signalement ?")) {
            deleteCoffeeReport(id);
        }
   });
}

function deleteCoffeeReport(id) {
  db.collection('coffee').doc(id).delete()
    .then(() => {
      showNotification("Signalement supprimé avec succès.");
    })
    .catch(error => {
      console.error("Erreur suppr signalement:", error);
      showNotification("Erreur suppr signalement", true);
    });
}

// === MODULE SYNTHESE ===
// === MODULE SYNTHESE ===
let mySynthChart = null; // Garder une référence au graphique

function loadSyntheseData() {
  // --- Récupération des couleurs CSS ---
  const rootStyles = getComputedStyle(document.documentElement);
  const encreTexteColor = rootStyles.getPropertyValue('--encre-texte').trim();
  const papierBgColor = rootStyles.getPropertyValue('--papier-bg').trim(); // Au cas où
  const postitBleu = rootStyles.getPropertyValue('--postit-bleu').trim() + 'B3'; // Ajoute ~70% opacité (B3 hex)
  const postitRose = rootStyles.getPropertyValue('--postit-rose').trim() + 'B3';
  const postitVert = rootStyles.getPropertyValue('--masking-tape-vert').trim() + 'B3'; // Utiliser une autre couleur postit/masking
  const postitPeche = rootStyles.getPropertyValue('--accent-couleur-2').trim() + 'B3'; // Utiliser accent 2
  const postitPrune = '#dda0ddB3'; // Couleur codée en dur si pas de variable CSS
  // Couleurs des bordures (plus foncées/opaques)
  const borderBleu = '#87CEEB';
  const borderRose = '#FFB6C1';
  const borderVert = '#90EE90';
  const borderPeche = '#FFDAB9';
  const borderPrune = '#DDA0DD';
  // --- Fin récupération couleurs ---


  Promise.all([
    db.collection('news').get(),
    db.collection('membres').get(),
    db.collection('partenaires').get(),
    db.collection('contact').where('status', '==', 'en cours').get(),
    db.collection('coffee').where('status', '==', 'en cours').get()
  ]).then((snapshots) => {
    const newsCount = snapshots[0].size;
    const membersCount = snapshots[1].size;
    const partnersCount = snapshots[2].size;
    const contactsCount = snapshots[3].size;
    const coffeeCount = snapshots[4].size;

    // Mise à jour des cartes synthèse
    const synthContainer = document.getElementById('synthese-container');
    synthContainer.innerHTML = `
        <div class="synth-card"><h3>Actualités</h3><p>${newsCount}</p></div>
        <div class="synth-card"><h3>Membres</h3><p>${membersCount}</p></div>
        <div class="synth-card"><h3>Partenaires</h3><p>${partnersCount}</p></div>
        <div class="synth-card"><h3>Contacts <small>(en cours)</small></h3><p>${contactsCount}</p></div>
        <div class="synth-card"><h3>Pannes Café <small>(en cours)</small></h3><p>${coffeeCount}</p></div>
    `;
    applyRandomRotation('.synth-card');

    // Création/Mise à jour du graphique
    const ctx = document.getElementById('synth-chart').getContext('2d');
    const chartData = {
        labels: ['Actualités', 'Membres', 'Partenaires', 'Contacts (en cours)', 'Pannes Café (en cours)'],
        datasets: [{
          data: [newsCount, membersCount, partnersCount, contactsCount, coffeeCount],
          backgroundColor: [ // Utiliser les couleurs récupérées ou définies
            postitBleu,
            postitRose,
            postitVert,
            postitPeche,
            postitPrune
          ],
          borderColor: [ // Utiliser les couleurs de bordure définies
             borderBleu,
             borderRose,
             borderVert,
             borderPeche,
             borderPrune
            ],
          borderWidth: 1.5 // Bordure un peu plus visible
        }]
      };

      if (mySynthChart) {
          mySynthChart.data = chartData;
          mySynthChart.options.plugins.legend.labels.color = encreTexteColor; // Mettre à jour la couleur aussi
          mySynthChart.update();
      } else {
          mySynthChart = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: {
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    font: {
                      family: "'Patrick Hand', cursive",
                       size: 14
                    },
                    // *** CORRECTION ICI ***
                    color: encreTexteColor // Utiliser la variable JS récupérée
                  }
                },
                 tooltip: {
                    bodyFont: { family: "'Roboto', sans-serif" }, // Utiliser var(--font-corps) indirectement
                    titleFont: { family: "'Patrick Hand', cursive" }, // Utiliser var(--font-titre-secondaire) indirectement
                    backgroundColor: 'rgba(74, 74, 74, 0.8)', // Couleur tooltip (gris foncé semi-transparent)
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    padding: 10,
                    cornerRadius: 3
                 }
              },
            }
          });
      }

  }).catch(error => {
    console.error("Erreur chargement données synthèse:", error);
  });
}

// --- Fonctions Utilitaires Thème Atelier ---

// Appliquer une rotation aléatoire aux éléments
function applyRandomRotation(selector) {
    document.querySelectorAll(selector).forEach(item => {
        const randomRotation = Math.random() * 6 - 3; // Rotation entre -3 et +3 degrés
        item.style.transform = `rotate(${randomRotation}deg)`;
    });
}
// Appliquer rotation aux éléments du menu aussi
document.addEventListener('DOMContentLoaded', () => {
     applyRandomRotation('.menu-item');
     // La rotation des grid-items se fera après leur chargement/mise à jour
});


// Attacher les écouteurs d'événements de manière plus robuste
// (Utile car les éléments sont recréés dynamiquement)
function attachActionListeners(selector, callback) {
    const container = document.querySelector('.content.active') || document; // Cible la section active si possible
    container.querySelectorAll(selector).forEach(button => {
        // Supprime l'ancien listener avant d'ajouter le nouveau pour éviter les doublons
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener('click', (e) => {
            // Trouve l'ID depuis data-id
            let target = e.target;
             // Remonte jusqu'au bouton si on clique sur l'icône <i>
            while (target && !target.matches(selector)) {
                target = target.parentNode;
            }
            if (target) {
                const id = target.getAttribute('data-id');
                if (id && callback) {
                     callback(id);
                } else {
                    console.warn("ID ou callback manquant pour le bouton", target);
                }
            }

        });
    });
}


// --- CHARGEMENT INITIAL ---
window.addEventListener('DOMContentLoaded', () => {
  // Charger les données pour toutes les sections
  loadNewsFromFirebase();
  loadMembersFromFirebase();
  loadPartnersFromFirebase();
  loadDemandesFromFirebase();
  loadCalendarFromFirebase();
  loadCoffeeReports();
  loadSyntheseData(); // Charger la synthèse initiale

  // La première section est activée par le code de navigation menu
});
