// script.js - Thème Carnet de Croquis Complet

// --- Import Rough Notation (Nécessaire car type="module") ---
import { annotate, annotationGroup } from 'https://unpkg.com/rough-notation?module';

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
let salariesDataCache = null; // Pour la recherche rapide badge café
let mySynthChart = null;
let currentPageIndex = 0;
const pages = document.querySelectorAll('#sketchbook .page');
const tabs = document.querySelectorAll('.sketchbook-tabs .tab');
let activeAnnotations = []; // Annotations RoughNotation actives
let isRoughNotationReady = (typeof annotate === 'function'); // Vérifie si la lib est chargée


// --- GESTION DE LA NAVIGATION PAR PAGES/ONGLETS ---
function showPage(targetSectionId) {
    let targetIndex = -1;
    pages.forEach((page, index) => {
        if (page.id === `section-${targetSectionId}`) {
            targetIndex = index;
        }
    });

    if (targetIndex === -1 || targetIndex === currentPageIndex) {
         // S'assurer que la page active actuelle est bien marquée et annotée
         if (targetIndex !== -1 && pages[targetIndex]) {
             pages.forEach(p => p.classList.remove('active')); // Nettoyage au cas où
             pages[targetIndex].classList.add('active');
             applyRoughNotationToPage(pages[targetIndex]);
         }
        return;
    }

    // Cacher l'ancienne page
    if (currentPageIndex >= 0 && currentPageIndex < pages.length && pages[currentPageIndex]) {
        pages[currentPageIndex].classList.remove('active');
    }
    clearRoughAnnotations();

    // Afficher la nouvelle page
    if (targetIndex >= 0 && targetIndex < pages.length && pages[targetIndex]) {
        pages[targetIndex].classList.add('active');
        currentPageIndex = targetIndex;

         // Donner un léger délai pour que le rendu se fasse avant d'annoter
         setTimeout(() => {
             applyRoughNotationToPage(pages[currentPageIndex]);
         }, 150);
    }

    // Mettre à jour l'onglet actif
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-section') === targetSectionId);
    });

    console.log("Affichage page:", targetSectionId, "Index:", currentPageIndex);

    // Recharger données synthèse / graphique si cette page est affichée
    if (targetSectionId === 'synthese') {
        loadSyntheseData();
    }
}

function initializeFirstPage() {
    const defaultSectionId = 'synthese'; // <<<--- Changer ici
    let defaultPageIndex = -1;

    // Trouver l'index de la page synthèse
    pages.forEach((page, index) => {
        if (page.getAttribute('data-section') === defaultSectionId) {
            defaultPageIndex = index;
        }
        // Assurer que toutes les autres pages sont inactives
        page.classList.remove('active');
    });

    // Si on trouve la page synthèse, l'afficher
    if (defaultPageIndex !== -1 && pages[defaultPageIndex]) {
        pages[defaultPageIndex].classList.add('active');
        currentPageIndex = defaultPageIndex; // Mettre à jour l'index courant

        // Activer l'onglet correspondant
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-section') === defaultSectionId);
        });

        // Appliquer les annotations Rough Notation (avec délai)
        setTimeout(() => {
             applyRoughNotationToPage(pages[defaultPageIndex]);
        }, 200);

         // Charger spécifiquement les données de synthèse au démarrage
        loadSyntheseData();

        console.log("Page initiale définie sur:", defaultSectionId);

    } else {
        // Fallback: si 'synthese' n'existe pas, ouvrir la première page
        console.warn("Page 'synthese' non trouvée, ouverture de la première page.");
        if (pages.length > 0 && pages[0]) {
             pages[0].classList.add('active');
             currentPageIndex = 0;
             const firstSectionId = pages[0].getAttribute('data-section');
             tabs.forEach(tab => {
                tab.classList.toggle('active', tab.getAttribute('data-section') === firstSectionId);
            });
             setTimeout(() => { applyRoughNotationToPage(pages[0]); }, 200);
             if(firstSectionId === 'synthese') loadSyntheseData(); // Charger si c'est quand même synthese
        }
    }
}

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const sectionId = tab.getAttribute('data-section');
        showPage(sectionId);
    });
});

// --- GESTION DES MODALS --- (Inchangée a priori)
const modals = document.querySelectorAll('.modal');
const closeButtons = document.querySelectorAll('.close');
closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-modal');
        if(modalId) {
            const modalElement = document.getElementById(modalId);
            if(modalElement) modalElement.style.display = 'none';
        }
    });
});
window.onclick = function (event) {
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};

// --- ROUGH NOTATION ---
function applyRoughNotationToPage(pageElement) {
    clearRoughAnnotations();
    if (!pageElement || !isRoughNotationReady) return; // Vérifie si page et lib existent

    console.log("Application de Rough Notation à la page:", pageElement.id);

    const title = pageElement.querySelector('.page-title');
    if (title) {
        // underline, box, circle, cross-off, highlight, strike-through, bracket
        const annotation = annotate(title, { type: 'underline', color: 'var(--underline-couleur)', strokeWidth: 2, padding: [0, 0, 3, 0], iterations: 2 });
        activeAnnotations.push(annotation);
        annotation.show();
    }

    const addCards = pageElement.querySelectorAll('.add-item');
    addCards.forEach(card => {
        const annotation = annotate(card, { type: 'box', color: 'var(--bordure-crayon)', strokeWidth: 1, padding: 8, iterations: 1 });
        activeAnnotations.push(annotation);
        annotation.show();
    });

    // Exemple : Surligner les statuts 'Publié' dans les actus
     if (pageElement.id === 'section-actus') {
         pageElement.querySelectorAll('small').forEach(el => {
            if (el.textContent.includes('(Publié)')) {
                 const annotation = annotate(el, { type: 'highlight', color: 'var(--highlight-couleur)', iterations: 1, multiline: true, padding: [0,2] });
                activeAnnotations.push(annotation);
                annotation.show();
             }
         });
     }
      // Exemple: Encadrer les noms des membres
     /* if (pageElement.id === 'section-membres') {
          pageElement.querySelectorAll('.grid-item:not(.add-item) h3').forEach(el => {
              const annotation = annotate(el, { type: 'box', color: 'rgba(100,100,100,0.5)', strokeWidth: 1, padding: 2 });
               activeAnnotations.push(annotation);
               annotation.show();
          });
      }*/
}

function clearRoughAnnotations() {
    activeAnnotations.forEach(a => a.remove());
    activeAnnotations = [];
}

// --- FONCTION UTILITAIRE POUR NOTIFICATIONS ---
function showNotification(message, isError = false) {
    // Idéalement, créer un élément de notification dédié dans le DOM
    console.log(`Notification: ${message} (Erreur: ${isError})`);
    alert(message); // Simple pour l'instant
}

// --- FONCTION UTILITAIRE POUR TROUVER CONTAINER DANS PAGE ---
function getListContainer(sectionId) {
    const page = document.getElementById(`section-${sectionId}`);
    return page?.querySelector(`#${sectionId}-list`) || page?.querySelector('.page-grid');
}

// --- FONCTION UTILITAIRE POUR EVENT DELEGATION ACTIONS ---
function setupActionListeners(containerElement) {
    if (!containerElement) return;

    // Supprimer ancien listener potentiel (simple approche, peut être optimisée)
    const listenerAttached = containerElement.dataset.actionListenerAttached;
    if (listenerAttached) return; // Ne pas attacher plusieurs fois
    containerElement.dataset.actionListenerAttached = 'true';

    containerElement.addEventListener('click', (event) => {
        const button = event.target.closest('.btn-action');
        if (button && button.dataset.id) {
            event.preventDefault(); // Empêche comportement par défaut si c'est un lien
            event.stopPropagation(); // Empêche propagation

            const action = button.classList.contains('edit') ? 'edit' : (button.classList.contains('delete') ? 'delete' : null);
            const id = button.dataset.id;
            const sectionType = containerElement.closest('.page')?.getAttribute('data-section'); // Trouve la section parente

            if (!action || !id || !sectionType) return;

            console.log(`Action déléguée: ${action}, ID: ${id}, Section: ${sectionType}`);
            handleAction(action, sectionType, id);
        }
    });

     // Gérer les <select> de statut aussi
     containerElement.addEventListener('change', (event) => {
          const select = event.target.closest('select.contact-status, select.coffee-status');
          if (!select || !select.dataset.id) return;

          event.stopPropagation();

          const newStatus = select.value;
          const id = select.dataset.id;
          const collection = select.classList.contains('contact-status') ? 'contact' : 'coffee';

          db.collection(collection).doc(id).update({ status: newStatus })
             .then(() => showNotification("Statut mis à jour en " + newStatus))
             .catch(error => {
                 console.error(`Erreur MàJ statut ${collection}:`, error);
                 showNotification("Erreur MàJ statut.", true);
             });
     });
}

// Fonction centrale pour appeler la bonne méthode CRUD
function handleAction(action, sectionType, id) {
    switch (`${action}-${sectionType}`) {
        case 'edit-actus': openEditModal(id); break;
        case 'delete-actus': deleteNews(id); break;
        case 'edit-membres': openEditMemberModal(id); break;
        case 'delete-membres': deleteMember(id); break;
        case 'edit-partenaires': openEditPartnerModal(id); break;
        case 'delete-partenaires': deletePartner(id); break;
        case 'edit-calendrier': openEditCalendarModal(id); break;
        case 'delete-calendrier': deleteCalendarEvent(id); break;
        case 'delete-coffee': deleteCoffeeReport(id); break;
        default: console.warn("Action/Type non géré par handleAction:", `${action}-${sectionType}`);
    }
}

// === MODULE ACTUALITÉS ===
function loadNewsFromFirebase() {
  db.collection('news')
    .orderBy('date', 'desc')
    .onSnapshot(snapshot => {
      newsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateNewsList();
      if (currentPageIndex === 0 && pages[0]?.id === 'section-actus') { // S'assurer que c'est bien la page active
          applyRoughNotationToPage(pages[0]);
      }
    }, error => console.error("Erreur chargement actus:", error));
}
function updateNewsList() {
    const container = getListContainer('actus');
    if (!container) return;
    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item)').forEach(item => item.remove());

    const openAddButton = document.getElementById('open-add-actualite');
    if (openAddButton && addButtonCard) {
        addButtonCard.innerHTML = '';
        addButtonCard.appendChild(openAddButton);
        openAddButton.onclick = () => { document.getElementById('modal-actualites').style.display = 'block'; };
    } else if(openAddButton){ // Recréer si add-item n'existait pas
         const card = document.createElement('div');
         card.className = 'grid-item add-item';
         card.appendChild(openAddButton);
         container.prepend(card);
         openAddButton.onclick = () => { document.getElementById('modal-actualites').style.display = 'block'; };
    }

    if (newsData.length === 0 && container.children.length <= 1) {
        const msg = document.createElement('p'); msg.textContent = "Aucun croquis d'actualité."; msg.classList.add('empty-message'); container.appendChild(msg);
    } else {
        container.querySelector('.empty-message')?.remove();
        newsData.forEach(news => {
            const item = document.createElement('div');
            item.classList.add('grid-item');
            item.innerHTML = `
               ${news.image ? `<img src="${news.image}" alt="${news.title}">` : ''}
               <h3>${news.title}</h3>
               <p>${news.content.substring(0, 150)}${news.content.length > 150 ? '...' : ''}</p>
               <small>Date: ${news.date} (${news.status})</small>
               <div class="card-actions">
                 <button class="btn-action edit" data-id="${news.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                 <button class="btn-action delete" data-id="${news.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
               </div>
            `;
            if (addButtonCard) container.insertBefore(item, addButtonCard);
            else container.appendChild(item);
        });
    }
}
function openEditModal(id) {
  const news = newsData.find(n => n.id === id); if (!news) return;
  document.getElementById('edit-news-id').value = news.id;
  document.getElementById('edit-news-title').value = news.title;
  document.getElementById('edit-news-content').value = news.content;
  document.getElementById('edit-news-date').value = news.date;
  document.getElementById('edit-news-image').value = news.image || '';
  document.getElementById('edit-news-status').value = news.status;
  document.getElementById('modal-edit-actualite').style.display = 'block';
}
function deleteNews(id) {
  if (!confirm("Effacer cette actualité ?")) return;
  db.collection('news').doc(id).delete()
    .then(() => showNotification("Actualité effacée !"))
    .catch(error => { console.error("Erreur suppression actu:", error); showNotification("Erreur suppression", true); });
}
document.getElementById('form-actualites').addEventListener('submit', e => { e.preventDefault(); const data={title: e.target['news-title'].value, content:e.target['news-content'].value, date:e.target['news-date'].value, image:e.target['news-image'].value, status:e.target['news-status'].value}; db.collection('news').add(data).then(()=>{ showNotification('Actualité ajoutée!'); e.target.reset(); document.getElementById('modal-actualites').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur ajout', true);}); });
document.getElementById('form-edit-actualite').addEventListener('submit', e => { e.preventDefault(); const id=e.target['edit-news-id'].value; const data={title: e.target['edit-news-title'].value, content:e.target['edit-news-content'].value, date:e.target['edit-news-date'].value, image:e.target['edit-news-image'].value, status:e.target['edit-news-status'].value}; db.collection('news').doc(id).update(data).then(()=>{ showNotification('Actualité modifiée!'); document.getElementById('modal-edit-actualite').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur modif', true);}); });

// === MODULE MEMBRES ===
function loadMembersFromFirebase() {
    db.collection('membres').orderBy('Nom', 'asc').onSnapshot(snapshot => {
        membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateMembersList();
         if (pages[currentPageIndex]?.getAttribute('data-section') === 'membres') { applyRoughNotationToPage(pages[currentPageIndex]); }
    }, error => console.error("Erreur chargement membres:", error));
}
/**
 * Met à jour l'affichage de la liste des membres dans le carnet.
 */
function updateMembersList() {
    // 1. Trouver le conteneur de la liste des membres
    const container = getListContainer('membres');
    if (!container) {
        console.error("ERREUR: Conteneur #members-list ou .page-grid introuvable dans #section-membres.");
        return; // Arrêter si le conteneur n'est pas trouvé
    }
    console.log("Mise à jour de la liste des membres dans:", container);

    // 2. Préserver et réinitialiser le bouton "Ajouter"
    const addButtonCard = container.querySelector('.grid-item.add-item');
    const openAddButton = document.getElementById('open-add-membre');

    if (openAddButton && addButtonCard) {
        // Vider l'intérieur de la carte add-item et y remettre le bouton (pour assurer propreté)
        addButtonCard.innerHTML = '';
        addButtonCard.appendChild(openAddButton);
        // Réattacher l'événement onclick (plus sûr que addEventListener dans ce cas de recréation)
        openAddButton.onclick = () => {
            document.getElementById('modal-membres').style.display = 'block';
        };
    } else if (openAddButton) {
        // Si addButtonCard n'existait pas, on le recrée et on le met au début
        console.log("Création de la carte .add-item pour membres.");
        const newAddItemCard = document.createElement('div');
        newAddItemCard.classList.add('grid-item', 'add-item');
        newAddItemCard.appendChild(openAddButton);
        container.prepend(newAddItemCard); // Ajoute au tout début de la grille
        openAddButton.onclick = () => {
            document.getElementById('modal-membres').style.display = 'block';
        };
    } else {
        console.warn("Bouton #open-add-membre introuvable.");
    }

    // 3. Supprimer les anciennes cartes de membre (UNIQUEMENT celles qui ne sont pas le bouton add)
    container.querySelectorAll('.grid-item:not(.add-item)').forEach(item => item.remove());
    console.log("Anciennes cartes membres supprimées.");

    // 4. Vérifier si des données sont disponibles
    console.log("Données membres à afficher:", membersData); // Afficher les données reçues
    if (!membersData || membersData.length === 0) {
        console.log("Aucune donnée membre à afficher.");
        // Vérifier si le message "vide" existe déjà pour éviter doublon
        if (!container.querySelector('.empty-message')) {
            const msg = document.createElement('p');
            msg.textContent = "Aucun membre dessiné dans cette section.";
            msg.classList.add('empty-message'); // Pour pouvoir le retrouver/supprimer
            container.appendChild(msg); // Ajouter après le bouton add
        }
    } else {
        // 5. Supprimer l'éventuel message "vide"
        container.querySelector('.empty-message')?.remove();

        // 6. Créer et ajouter les cartes pour chaque membre
        console.log(`Création de ${membersData.length} carte(s) membre...`);
        membersData.forEach(member => {
            const item = document.createElement('div');
            // Vérifier la présence et la casse des champs !
            const prenom = member.Prenom || '';
            const nom = member.Nom || '';
            const photoURL = member.PhotoURL || null;
            const role = member.Role || 'N/A';
            const operation = member.Operation || 'N/A';
            const mail = member.Mail || 'N/A';

            item.classList.add('grid-item'); // Classe de base
            if (photoURL) {
                item.classList.add('polaroid-style'); // Classe conditionnelle
            }

            // Construction de l'HTML interne de la carte
            item.innerHTML = `
                ${photoURL ?
                    `<img src="${photoURL}" alt="Photo ${prenom}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"> <!-- Cache image si erreur -->
                     <div style="display:none; height:100px; background:#f0f0f0; margin:0.5rem; border:1px dashed #ccc; align-items:center; justify-content:center;">
                         <i class="fas fa-user" style="font-size:2rem; color:#ccc;"></i> <!-- Fallback si image ne charge pas -->
                     </div>`
                    :
                    `<div style="height:100px; background:#f0f0f0; margin:0.5rem; border:1px dashed #ccc; display:flex; align-items:center; justify-content:center;">
                         <i class="fas fa-user" style="font-size:2rem; color:#ccc;"></i>
                     </div>`
                }
                <!-- Le titre principal est toujours affiché -->
                <h3>${prenom} ${nom}</h3>
                <!-- Détails affichés seulement si pas de style polaroid OU si pas de photo -->
                ${(!photoURL || !item.classList.contains('polaroid-style')) ?
                    `<div class="member-details">
                        <p><strong>Rôle :</strong> ${role}</p>
                        <p><i>Opération : ${operation}</i></p>
                        <p><small><i class="fas fa-envelope" style="opacity:0.7"></i> ${mail}</small></p>
                    </div>`
                    : '' // Pas de détails si c'est un polaroid avec photo affichée
                }
                <!-- Actions toujours en bas -->
                <div class="card-actions member-actions"> <!-- Classe spécifique + classe commune -->
                    <button class="btn-action edit" data-id="${member.id}" title="Modifier">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="btn-action delete" data-id="${member.id}" title="Supprimer">
                        <i class="fas fa-user-times"></i>
                    </button>
                </div>
            `;

            // Ajouter la carte à la grille
            // Si le bouton "add" existe, insérer avant, sinon ajouter à la fin
            if (addButtonCard) {
                container.insertBefore(item, addButtonCard);
            } else {
                container.appendChild(item);
            }
        });
        console.log("Cartes membres créées et ajoutées.");
    }

    // 7. Attacher les listeners d'événements délégués au conteneur
    setupActionListeners(container);
    console.log("Listeners attachés au conteneur membres.");

     // 8. Si la page est active, appliquer les annotations
     if (pages[currentPageIndex]?.getAttribute('data-section') === 'membres') {
        console.log("Application de Rough Notation à la page membres (après update).");
        applyRoughNotationToPage(pages[currentPageIndex]);
     } else {
        console.log("Page membres non active, pas d'application de Rough Notation pour le moment.");
     }

     console.log("Fin updateMembersList.");
}
function openEditMemberModal(id) { const member = membersData.find(m => m.id === id); if (!member) return; document.getElementById('edit-member-id').value=id; document.getElementById('edit-member-nom').value = member.Nom; document.getElementById('edit-member-prenom').value = member.Prenom; document.getElementById('edit-member-mail').value = member.Mail; document.getElementById('edit-member-operation').value = member.Operation; document.getElementById('edit-member-role').value = member.Role; document.getElementById('edit-member-photo').value = member.PhotoURL || ''; document.getElementById('modal-edit-membre').style.display = 'block'; }
function deleteMember(id) { if (!confirm("Retirer ce membre du carnet ?")) return; db.collection('membres').doc(id).delete().then(()=>showNotification("Membre retiré !")).catch(err=>{ console.error(err); showNotification("Erreur retrait membre", true); }); }
document.getElementById('form-membres').addEventListener('submit', e => { e.preventDefault(); const data={Nom:e.target['member-nom'].value, Prenom:e.target['member-prenom'].value, Mail:e.target['member-mail'].value, Operation:e.target['member-operation'].value, Role:e.target['member-role'].value, PhotoURL:e.target['member-photo'].value}; db.collection('membres').add(data).then(()=>{ showNotification('Membre ajouté !'); e.target.reset(); document.getElementById('modal-membres').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur ajout', true);}); });
document.getElementById('form-edit-membre').addEventListener('submit', e => { e.preventDefault(); const id=e.target['edit-member-id'].value; const data={Nom:e.target['edit-member-nom'].value, Prenom:e.target['edit-member-prenom'].value, Mail:e.target['edit-member-mail'].value, Operation:e.target['edit-member-operation'].value, Role:e.target['edit-member-role'].value, PhotoURL:e.target['edit-member-photo'].value}; db.collection('membres').doc(id).update(data).then(()=>{ showNotification('Membre modifié !'); document.getElementById('modal-edit-membre').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur modif', true);}); });

// === MODULE PARTENAIRES ===
function loadPartnersFromFirebase() {
    db.collection('partenaires').orderBy('Nom', 'asc').onSnapshot(snapshot => {
        partnersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updatePartnersList();
        if (pages[currentPageIndex]?.getAttribute('data-section') === 'partenaires') { applyRoughNotationToPage(pages[currentPageIndex]); }
    }, error => console.error("Erreur chargement partenaires:", error));
}
function updatePartnersList() {
    const container = getListContainer('partenaires'); if (!container) return;
    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item)').forEach(item => item.remove());

    const openAddButton = document.getElementById('open-add-partenaire');
    if (openAddButton && addButtonCard) { addButtonCard.innerHTML = ''; addButtonCard.appendChild(openAddButton); openAddButton.onclick = () => { document.getElementById('modal-partenaires').style.display = 'block'; }; }
    else if (openAddButton) { const card = document.createElement('div'); card.className = 'grid-item add-item'; card.appendChild(openAddButton); container.prepend(card); openAddButton.onclick = () => { document.getElementById('modal-partenaires').style.display = 'block'; }; }


    if (partnersData.length === 0 && container.children.length <= 1) {
         const msg = document.createElement('p'); msg.textContent = "Aucun partenaire griffonné."; msg.classList.add('empty-message'); container.appendChild(msg);
    } else {
        container.querySelector('.empty-message')?.remove();
        partnersData.forEach(partner => {
            const item = document.createElement('div'); item.classList.add('grid-item');
            item.innerHTML = `
                ${partner.Logo ? `<img src="${partner.Logo}" alt="Logo ${partner.Nom}" style="height: 50px; width: auto; object-fit: contain; margin-bottom: 1rem; border-radius:0;">` : ''}
                <h3>${partner.Nom}</h3>
                <p><small>Catégorie: ${partner.Categorie}</small></p>
                <p>${partner.Description.substring(0, 100)}${partner.Description.length > 100 ? '...' : ''}</p>
                <p style="margin-top:auto;"><a href="${partner.Lien}" target="_blank" rel="noopener noreferrer">Visiter <i class="fas fa-external-link-alt" style="font-size: 0.7em;"></i></a></p>
                <div class="card-actions">
                  <button class="btn-action edit" data-id="${partner.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                  <button class="btn-action delete" data-id="${partner.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
                </div>`;
             if (addButtonCard) container.insertBefore(item, addButtonCard); else container.appendChild(item);
        });
    }
}
function openEditPartnerModal(id) { const partner=partnersData.find(p=>p.id===id); if(!partner) return; document.getElementById('edit-partenaire-id').value=id; document.getElementById('edit-partenaire-categorie').value=partner.Categorie; document.getElementById('edit-partenaire-nom').value=partner.Nom; document.getElementById('edit-partenaire-description').value=partner.Description; document.getElementById('edit-partenaire-lien').value=partner.Lien; document.getElementById('edit-partenaire-logo').value=partner.Logo||''; document.getElementById('modal-edit-partenaire').style.display = 'block';}
function deletePartner(id) { if (!confirm("Effacer ce partenaire ?")) return; db.collection('partenaires').doc(id).delete().then(()=>showNotification("Partenaire effacé!")).catch(err=>{ console.error(err); showNotification("Erreur suppression", true);}); }
document.getElementById('form-partenaires').addEventListener('submit', e => { e.preventDefault(); const data={Categorie:e.target['partenaire-categorie'].value, Nom:e.target['partenaire-nom'].value, Description:e.target['partenaire-description'].value, Lien:e.target['partenaire-lien'].value, Logo:e.target['partenaire-logo'].value}; db.collection('partenaires').add(data).then(()=>{ showNotification('Partenaire ajouté!'); e.target.reset(); document.getElementById('modal-partenaires').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur ajout', true);}); });
document.getElementById('form-edit-partenaire').addEventListener('submit', e => { e.preventDefault(); const id=e.target['edit-partenaire-id'].value; const data={Categorie:e.target['edit-partenaire-categorie'].value, Nom:e.target['edit-partenaire-nom'].value, Description:e.target['edit-partenaire-description'].value, Lien:e.target['edit-partenaire-lien'].value, Logo:e.target['edit-partenaire-logo'].value}; db.collection('partenaires').doc(id).update(data).then(()=>{ showNotification('Partenaire modifié!'); document.getElementById('modal-edit-partenaire').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur modif', true);}); });

// === MODULE DEMANDES ===
function loadDemandesFromFirebase() {
    db.collection('contact').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        demandesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDemandesList();
        if (pages[currentPageIndex]?.getAttribute('data-section') === 'demandes') { applyRoughNotationToPage(pages[currentPageIndex]); }
    }, error => console.error("Erreur chargement demandes:", error));
}
function updateDemandesList() {
    const container = getListContainer('demandes'); if (!container) return;
    // Pas de bouton "Ajouter" pour cette section
    container.innerHTML = ''; // Vider complètement

    if (demandesData.length === 0) {
        const msg = document.createElement('p'); msg.textContent = "Aucune demande en attente."; msg.classList.add('empty-message'); container.appendChild(msg);
    } else {
        demandesData.forEach(demande => {
            const item = document.createElement('div'); item.classList.add('grid-item');
            const currentStatus = demande.status || "en cours";
            const timestamp = demande.timestamp?.toDate ? demande.timestamp.toDate().toLocaleDateString('fr-FR') : (demande.timestamp || 'N/A');
            let demandesList = Array.isArray(demande.demande) ? demande.demande.join(", ") : (demande.demande || 'Non spécifié');

            item.innerHTML = `
                <h3>${demande.name || "Anonyme"} (${demande.operation || 'N/A'})</h3>
                <p><small>${demande.email || "Email non fourni"}</small></p>
                <p><strong>Demandes :</strong> ${demandesList}</p>
                <p>${demande.message || ""}</p>
                <p><small>Reçu le: ${timestamp}</small></p>
                <div class="form-group" style="margin-top: 1rem; border-top: 1px dotted var(--bordure-crayon); padding-top: 0.5rem;">
                  <label for="status-${demande.id}" style="font-family:var(--font-label); font-size: 0.9rem;">Statut:</label>
                  <select class="contact-status" data-id="${demande.id}" id="status-${demande.id}" style="display:inline-block; width:auto; margin-left:5px; padding:2px 5px; border:1px solid var(--bordure-crayon); border-radius:3px; font-size:0.9em;">
                    <option value="en cours" ${currentStatus === 'en cours' ? 'selected' : ''}>En cours</option>
                    <option value="traité" ${currentStatus === 'traité' ? 'selected' : ''}>Traité</option>
                  </select>
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
        if (pages[currentPageIndex]?.getAttribute('data-section') === 'calendrier') { applyRoughNotationToPage(pages[currentPageIndex]); }
    }, error => console.error("Erreur chargement calendrier:", error));
}
function updateCalendarList() {
    const container = getListContainer('calendrier'); if (!container) return;
    const addButtonCard = container.querySelector('.add-item');
    container.querySelectorAll('.grid-item:not(.add-item)').forEach(item => item.remove());

    const openAddButton = document.getElementById('open-add-calendrier');
     if (openAddButton && addButtonCard) { addButtonCard.innerHTML = ''; addButtonCard.appendChild(openAddButton); openAddButton.onclick = () => { document.getElementById('modal-calendrier').style.display = 'block'; }; }
     else if (openAddButton) { const card = document.createElement('div'); card.className = 'grid-item add-item'; card.appendChild(openAddButton); container.prepend(card); openAddButton.onclick = () => { document.getElementById('modal-calendrier').style.display = 'block'; }; }

    if (calendarData.length === 0 && container.children.length <= 1) {
         const msg = document.createElement('p'); msg.textContent = "Calendrier vide."; msg.classList.add('empty-message'); container.appendChild(msg);
    } else {
        container.querySelector('.empty-message')?.remove();
        calendarData.forEach(event => {
            const item = document.createElement('div'); item.classList.add('grid-item');
            const startDate = event.date ? new Date(event.date + 'T' + (event.time || '00:00')).toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long'}) : '';
            const startTime = event.time ? event.time.substring(0,5) : '';
            const endDate = event.endDate ? new Date(event.endDate + 'T' + (event.endTime || '00:00')).toLocaleDateString('fr-FR',{day:'numeric', month:'long'}) : '';
            const endTime = event.endTime ? event.endTime.substring(0,5) : '';
            let dateString = startDate;
            if(startTime) dateString += ` à ${startTime}`;
            if(endDate && endDate !== startDate.split(' ')[1]+' '+startDate.split(' ')[2]) dateString += ` jusqu'au ${endDate}`; // Evite répétition si même jour
            if(endTime && endTime !== startTime) dateString += (endDate && endDate !== startDate ? ` à ${endTime}` : ` - ${endTime}`);

            item.innerHTML = `
                <h3>${event.title}</h3>
                <p><strong><i class="fas fa-clock" style="opacity:0.7; margin-right: 3px;"></i></strong> ${dateString}</p>
                <p>${event.description}</p>
                <div class="card-actions">
                  <button class="btn-action edit" data-id="${event.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                  <button class="btn-action delete" data-id="${event.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
                </div>`;
            if (addButtonCard) container.insertBefore(item, addButtonCard); else container.appendChild(item);
        });
    }
}
function openEditCalendarModal(id) { const event=calendarData.find(e=>e.id===id); if(!event) return; document.getElementById('edit-event-id').value=id; document.getElementById('edit-event-title').value=event.title; document.getElementById('edit-event-description').value=event.description; document.getElementById('edit-event-date').value=event.date; document.getElementById('edit-event-time').value=event.time; document.getElementById('edit-event-end-date').value=event.endDate||''; document.getElementById('edit-event-end-time').value=event.endTime||''; document.getElementById('modal-edit-calendrier').style.display = 'block'; }
function deleteCalendarEvent(id) { if (!confirm("Effacer cet événement ?")) return; db.collection('calendrier').doc(id).delete().then(()=>showNotification("Événement effacé !")).catch(err=>{ console.error(err); showNotification("Erreur suppression", true);}); }
document.getElementById('form-calendrier').addEventListener('submit', e => { e.preventDefault(); const data={title:e.target['event-title'].value, description:e.target['event-description'].value, date:e.target['event-date'].value, time:e.target['event-time'].value, endDate:e.target['event-end-date'].value, endTime:e.target['event-end-time'].value}; db.collection('calendrier').add(data).then(()=>{ showNotification('Événement ajouté !'); e.target.reset(); document.getElementById('modal-calendrier').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur ajout', true);}); });
document.getElementById('form-edit-calendrier').addEventListener('submit', e => { e.preventDefault(); const id=e.target['edit-event-id'].value; const data={title:e.target['edit-event-title'].value, description:e.target['edit-event-description'].value, date:e.target['edit-event-date'].value, time:e.target['edit-event-time'].value, endDate:e.target['edit-event-end-date'].value, endTime:e.target['edit-event-end-time'].value}; db.collection('calendrier').doc(id).update(data).then(()=>{ showNotification('Événement modifié !'); document.getElementById('modal-edit-calendrier').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur modif', true);}); });


// === MODULE BADGES CAFÉ === (Pas de grille, utilise static-content-area)
function searchEmployee(nom, prenom) { /* ... Inchangé (doit fonctionner si #employee-info est sur la page) ... */ return db.collection('salaries_test').get().then(snapshot => snapshot.docs.filter(doc => { const d = doc.data(); return (d.Nom || '').toLowerCase() === nom.toLowerCase() && (d["Prénom"] || '').toLowerCase() === prenom.toLowerCase(); })).then(docs => ({ empty: docs.length === 0, docs }));}
function displayEmployee(employeeDoc) { /* ... Inchangé (cible #employee-info, #employee-details) ... */ const div=document.getElementById('employee-info'); const p=document.getElementById('employee-details'); if(employeeDoc && div && p){const data=employeeDoc.data();let html=`<strong>Nom:</strong> ${data.Nom}<br><strong>Prénom:</strong> ${data["Prénom"]}<br>`; if(data.keys?.length>0){html+=`<strong>Clés:</strong><ul>${data.keys.map(k=>`<li>(${k.type}) ${k.keyNumber} - ${k.montant||0}€ <small>(${k.date||'?'})</small></li>`).join('')}</ul>`;}else{html+=`<em>Aucune clé</em><br>`;} p.innerHTML=html; div.style.display='block';}else if(div){div.style.display='none';} }
function addKeyToEmployee(nom, prenom, newKeyNumber, type, montant) { /* ... Inchangé (appelle searchEmployee, displayEmployee) ... */ const msgDiv=document.getElementById('message'); msgDiv.textContent=''; msgDiv.style.borderColor='transparent'; searchEmployee(nom,prenom).then(qs=>{const today=new Date().toISOString().slice(0,10); const keyData={keyNumber:newKeyNumber, type:type, montant:montant||0, date:today}; let promise; if(qs.empty){promise=db.collection('salaries_test').add({Nom:nom, "Prénom":prenom, date_creation:today, keys:[keyData]}).then(ref=>({status:"created",msg:`Salarié ${nom} ${prenom} créé.`, id:ref.id})); }else{const docRef=qs.docs[0].ref; promise=docRef.update({keys: firebase.firestore.FieldValue.arrayUnion(keyData)}).then(()=>({status:"updated", msg:`Clé ajoutée pour ${nom} ${prenom}.`,id:docRef.id})); } return promise; }).then(res=>{msgDiv.textContent=res.msg; msgDiv.style.color='green'; msgDiv.style.borderColor='green'; db.collection('salaries_test').doc(res.id).get().then(displayEmployee);}).catch(err=>{console.error(err); msgDiv.textContent="Erreur ajout clé: "+err.message; msgDiv.style.color='red'; msgDiv.style.borderColor='red';});}
// Les listeners pour ce module sont attachés globalement car les éléments sont statiques sur leur page
document.getElementById('search-employee-btn')?.addEventListener('click', ()=>{const n=document.getElementById('filter-nom').value.trim(); const p=document.getElementById('filter-prenom').value.trim(); const msgDiv=document.getElementById('message'); if(n===''||p===''){showNotification('Nom et prénom requis.'); return;} msgDiv.textContent=''; msgDiv.style.borderColor='transparent'; document.getElementById('employee-info').style.display='none'; searchEmployee(n,p).then(res=>{if(res.empty){document.getElementById('employee-details').innerHTML=`Aucun salarié trouvé pour <strong>${n} ${p}</strong>.<br>Ajouter une clé pour créer sa fiche.`; document.getElementById('employee-info').style.display='block';}else{displayEmployee(res.docs[0]);}}).catch(err=>{console.error(err);msgDiv.textContent='Erreur recherche'; msgDiv.style.color='red'; msgDiv.style.borderColor='red';}); });
document.getElementById('form-add-key')?.addEventListener('submit', e=>{e.preventDefault(); const n=document.getElementById('filter-nom').value.trim(); const p=document.getElementById('filter-prenom').value.trim(); const k=document.getElementById('key-number').value.trim(); const t=document.getElementById('key-type').value; const mIn=document.getElementById('key-amount').value.trim(); const m=mIn===""?0:parseFloat(mIn); if(n===''||p===''||k===''){showNotification('Nom, prénom et n° clé requis.'); return;} if(isNaN(m)){showNotification('Montant invalide'); return;} addKeyToEmployee(n,p,k,t,m); e.target.reset(); document.getElementById('key-number').focus(); });

// === MODULE SIGNALEMENTS CAFÉ ===
function loadCoffeeReports() {
    db.collection('coffee').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        coffeeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateCoffeeList();
        if (pages[currentPageIndex]?.getAttribute('data-section') === 'coffee') { applyRoughNotationToPage(pages[currentPageIndex]); }
    }, error => console.error("Erreur chargement signalements:", error));
}
function updateCoffeeList() {
    const container = getListContainer('coffee'); if (!container) return;
    container.innerHTML = ''; // Pas de bouton Ajouter

    if (coffeeData.length === 0) {
         const msg = document.createElement('p'); msg.textContent = "Aucun signalement récent."; msg.classList.add('empty-message'); container.appendChild(msg);
    } else {
        coffeeData.forEach(report => {
            const item = document.createElement('div'); item.classList.add('grid-item');
            const currentStatus = report.status || "en cours";
            const timestamp = report.timestamp?.toDate ? report.timestamp.toDate().toLocaleString('fr-FR') : (report.timestamp || 'N/A');
            item.innerHTML = `
                <h3>${report.machine || 'Machine ?'} <small>(${report.problem || 'Problème ?'})</small></h3>
                <p><strong>Par:</strong> ${report.name || '?'} (${report.email || '?'}) / Op: ${report.operation || '?'}</p>
                ${report.comment ? `<p><i>"${report.comment}"</i></p>` : ''}
                <p><small>Signalé le: ${timestamp}</small></p>
                <div class="coffee-actions card-actions" style="justify-content: space-between;">
                     <div class="form-group" style="margin:0;">
                        <label for="c-status-${report.id}" style="font-family:var(--font-label); font-size:0.8rem;">Stat:</label>
                        <select class="coffee-status" data-id="${report.id}" id="c-status-${report.id}" style="display:inline-block; width:auto; padding:1px 3px; font-size:0.8em; border:1px solid var(--bordure-crayon);">
                            <option value="en cours" ${currentStatus==='en cours'?'selected':''}>En cours</option>
                            <option value="traité" ${currentStatus==='traité'?'selected':''}>Traité</option>
                        </select>
                    </div>
                    <button class="btn-action delete" data-id="${report.id}" title="Supprimer"><i class="fas fa-trash"></i></button>
                </div>`;
            container.appendChild(item);
        });
    }
}
function deleteCoffeeReport(id) { if (!confirm("Effacer ce signalement ?")) return; db.collection('coffee').doc(id).delete().then(()=>showNotification("Signalement effacé.")).catch(err=>{console.error(err); showNotification("Erreur suppression", true);}); }

// === MODULE SYNTHESE ===
function loadSyntheseData() {
     const rootStyles = getComputedStyle(document.documentElement);
     const encreTexteColor = rootStyles.getPropertyValue('--encre-texte').trim();
     // Ajouter récupération des couleurs pour chart si besoin
      const colorHighlight = rootStyles.getPropertyValue('--highlight-couleur')?.trim() || 'rgba(255,235,59,0.5)';
     const colorPrimary = rootStyles.getPropertyValue('--underline-couleur')?.trim() || '#677BC4';
     const colorSecondary = rootStyles.getPropertyValue('--accent-couleur-2')?.trim() || '#ffb347';
     const colorPaper = rootStyles.getPropertyValue('--papier-bg')?.trim() || '#fdfdfa';
     const colorInk = rootStyles.getPropertyValue('--encre-texte')?.trim() || '#3d3a3a';
     const colorGray = rootStyles.getPropertyValue('--encre-secondaire')?.trim() || '#6e6a6a';


    Promise.all([
        db.collection('news').get(), db.collection('membres').get(), db.collection('partenaires').get(),
        db.collection('contact').where('status', '==', 'en cours').get(),
        db.collection('coffee').where('status', '==', 'en cours').get()
    ]).then((snapshots) => {
        const counts = { news: snapshots[0].size, members: snapshots[1].size, partners: snapshots[2].size, contacts: snapshots[3].size, coffee: snapshots[4].size };

        const synthContainer = document.getElementById('synthese-container');
        if (!synthContainer) return;
        synthContainer.innerHTML = '';

         const synthData = [
            { title: 'Actus', count: counts.news, icon: 'fa-newspaper' }, { title: 'Membres', count: counts.members, icon: 'fa-users' },
            { title: 'Partenaires', count: counts.partners, icon: 'fa-handshake' }, { title: 'Contacts <small>(act.)</small>', count: counts.contacts, icon: 'fa-address-book' },
            { title: 'Pannes Café <small>(act.)</small>', count: counts.coffee, icon: 'fa-mug-hot' }
        ];
        synthData.forEach(data => { /* ... Création des .synth-card comme avant ... */
             const item = document.createElement('div'); item.classList.add('synth-card');
             item.innerHTML = `<h3><i class="fas ${data.icon}"></i> ${data.title}</h3><p>${data.count}</p>`;
             synthContainer.appendChild(item);
         });


        // Graphique
        const ctx = document.getElementById('synth-chart')?.getContext('2d');
        if (!ctx) return;
        const chartLabels = synthData.map(d => d.title.replace(/<small>.*?<\/small>/g, '').trim());
        const chartCounts = synthData.map(d => d.count);
         const chartBGColors = [colorPrimary+'99', colorSecondary+'99', colorGray+'99', colorPaper+'99', colorInk+'99'].slice(0, chartLabels.length); // Couleurs + opacité
         const chartBorderColors = [colorPrimary, colorSecondary, colorGray, colorInk, '#aaaaaa'].slice(0, chartLabels.length);


        const chartConfigData = {
            labels: chartLabels,
            datasets: [{
                data: chartCounts,
                backgroundColor: chartBGColors,
                borderColor: chartBorderColors,
                borderWidth: 1.5,
                 hoverOffset: 8, // Effet au survol
                 hoverBorderColor: colorInk
            }]
        };

        if (mySynthChart) {
            mySynthChart.data = chartConfigData;
            mySynthChart.options.plugins.legend.labels.color = encreTexteColor;
            mySynthChart.update();
        } else {
            mySynthChart = new Chart(ctx, {
                type: 'doughnut', data: chartConfigData,
                 options: {
                    responsive: true, maintainAspectRatio: false, // Permet de gérer la taille via container CSS
                    animation: { delay: 200 },
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { family: "'Patrick Hand', cursive", size: 13 }, color: encreTexteColor, padding: 15 } },
                        tooltip: {
                            enabled: true, backgroundColor: colorInk+'E6', titleColor: colorPaper, bodyColor: colorPaper, padding: 8, cornerRadius: 3,
                            bodyFont: { family: "'Roboto', sans-serif" }, titleFont: { family: "'Patrick Hand', cursive" }, boxPadding: 4
                         }
                     },
                     cutout: '60%' // Taille du trou
                }
             });
        }
    }).catch(error => console.error("Erreur chargement synthèse:", error));
}


// --- INITIALISATION FINALE ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Carnet prêt ! Initialisation...");
    isRoughNotationReady = (typeof annotate === 'function'); // Confirmer que la lib est là

    initializeFirstPage();

    // Charger les données initiales
    loadNewsFromFirebase();
    loadMembersFromFirebase(); // <-- Vérifier cette ligne
    loadPartnersFromFirebase();
    loadDemandesFromFirebase();
    loadCalendarFromFirebase();
    loadCoffeeReports();
    // loadSyntheseData est appelé via showPage quand la section devient active

    // Attacher les listeners délégués à chaque page qui contient une grille ou des actions
    pages.forEach(page => {
        // La condition `querySelector` assure qu'on n'ajoute pas de listener inutilement
        if (page.querySelector('.page-grid') || page.querySelector('.static-content-area select')) {
             setupActionListeners(page);
        }
    });

    console.log("Initialisation terminée.");
});