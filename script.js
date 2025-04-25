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
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// --- VARIABLES GLOBALES ---
let newsData = [];
let membersData = [];
let partnersData = [];
let demandesData = [];
let calendarData = [];
let salariesDataCache = null; // Pour badge café si besoin
let mySynthChart = null; // Référence graphique
let currentActiveSectionId = null; // ID de la section actuellement visible
let coffeeData = [];
let coffeeTable = null;
let rechargeTable = null; // <--- AJOUTER CETTE LIGNE
let problemChartInstance = null; // Nouvelle variable globale
let machineChartInstance = null; // Nouvelle variable globale
let statusChartInstance = null;  // Nouvelle variable globale

const IMGUR_CLIENT_ID = "8de31a44dc7b190";

let appInitialized = false;

const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const signInButton = document.getElementById('google-signin-btn');
const signOutButton = document.getElementById('google-signout-btn');
const loginErrorMsg = document.getElementById('login-error');
const userInfoArea = document.getElementById('user-info-area');
const userEmailDisplay = document.getElementById('user-email-display');

// --- OBSERVATEUR ÉTAT AUTHENTIFICATION ---
function resetAppState() {
    console.log("Réinitialisation de l'état de l'application...");
    // Vider les données
    newsData = []; membersData = []; partnersData = []; demandesData = []; calendarData = [];
    salariesDataCache = null; coffeeData = [];
    // Détruire graphiques/tables
    if (mySynthChart) try { mySynthChart.destroy(); } catch(e){ console.error("Erreur destruction mySynthChart", e); } finally { mySynthChart = null; }
    if (coffeeTable) try { coffeeTable.destroy(); } catch(e){ console.error("Erreur destruction coffeeTable", e); } finally { coffeeTable = null; }
    if (rechargeTable) try { rechargeTable.destroy(); } catch(e){ console.error("Erreur destruction rechargeTable", e); } finally { rechargeTable = null; }
    if (problemChartInstance) try { problemChartInstance.destroy(); } catch(e){ console.error("Erreur destruction problemChartInstance", e); } finally { problemChartInstance = null; }
    if (machineChartInstance) try { machineChartInstance.destroy(); } catch(e){ console.error("Erreur destruction machineChartInstance", e); } finally { machineChartInstance = null; }
    if (statusChartInstance) try { statusChartInstance.destroy(); } catch(e){ console.error("Erreur destruction statusChartInstance", e); } finally { statusChartInstance = null; }

    // Vider les conteneurs d'affichage
    // Vérifie attentivement ces lignes =======================================>
    try {
        document.getElementById('news-list')?.querySelectorAll('.grid-item:not(.add-item)').forEach(i => i.remove());
        document.getElementById('members-list')?.querySelectorAll('.grid-item:not(.add-item)').forEach(i => i.remove());
        document.getElementById('partners-list')?.querySelectorAll('.grid-item:not(.add-item)').forEach(i => i.remove());
        const demandesList = document.getElementById('demandes-list');
        if (demandesList) demandesList.innerHTML = ''; // Vider demandes
        document.getElementById('calendar-list')?.querySelectorAll('.grid-item:not(.add-item)').forEach(i => i.remove());
        const coffeeTableContainer = document.getElementById('coffee-table-container');
        if (coffeeTableContainer) coffeeTableContainer.innerHTML = ''; // Vider conteneur table
        const rechargeTableContainer = document.getElementById('recharge-table-container');
        if (rechargeTableContainer) rechargeTableContainer.innerHTML = ''; // Vider conteneur table
        const synthContainer = document.getElementById('synthese-container');
        if (synthContainer) synthContainer.innerHTML = ''; // Vider cartes synthèse
    } catch (error) {
         console.error("Erreur lors du nettoyage des conteneurs DOM:", error);
    }
    // ========================================================================>

    // Effacer le canvas du graphique synthèse
    const synthCtx = document.getElementById('synth-chart')?.getContext('2d');
    if (synthCtx) {
        try {
            synthCtx.clearRect(0, 0, synthCtx.canvas.width, synthCtx.canvas.height);
        } catch(e) { console.error("Erreur clearRect canvas synthèse:", e); }
    }

    // Vider les stats café
     const statTotal = document.getElementById('stat-total-reports');
     const statEnCours = document.getElementById('stat-reports-en-cours');
     const statTraite = document.getElementById('stat-reports-traite');
     if(statTotal) statTotal.textContent = '0';
     if(statEnCours) statEnCours.textContent = '0';
     if(statTraite) statTraite.textContent = '0';

    // Vider zone badges
    const searchInput = document.getElementById('employee-search');
    const searchResults = document.getElementById('search-results');
    if(searchInput) searchInput.value = '';
    if(searchResults) searchResults.innerHTML = '';
    // La fonction showBadgeUISection est définie ailleurs
    if (typeof showBadgeUISection === 'function') {
        showBadgeUISection(null);
    }


    currentActiveSectionId = null; // Réinitialiser section active
    appInitialized = false; // Marquer comme non initialisé
    console.log("État application réinitialisé.");
}

// --- GESTION UI LOGIN/APP ---
function showLoginScreen(errorMessage = null) {
    if (appContainer) appContainer.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'flex'; // Ou 'block' selon ton CSS
    if (loginErrorMsg) {
        if (errorMessage) {
            loginErrorMsg.textContent = errorMessage;
            loginErrorMsg.style.display = 'block';
        } else {
            loginErrorMsg.style.display = 'none';
        }
    }
    if(userInfoArea) userInfoArea.style.display = 'none'; // Cacher infos user
}

function showAppScreen(user) {
    if (loginContainer) loginContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block'; // Afficher l'app
    if (userInfoArea) {
         if (user && userEmailDisplay) {
             userEmailDisplay.textContent = user.email;
             userInfoArea.style.display = 'flex'; // Afficher zone user
         } else {
             userInfoArea.style.display = 'none';
         }
    }
}
// --- VÉRIFICATION AUTORISATION ---
/**
 * Vérifie si un email est présent dans la collection 'membres'.
 * @param {string} email L'email à vérifier.
 * @returns {Promise<boolean>} True si autorisé, False sinon.
 */
async function checkAuthorization(email) {
    if (!email) {
        console.log("Email non fourni pour la vérification.");
        return false;
    }
    try {
        console.log(`Vérification autorisation pour: ${email}`);
        // Utilise 'Mail' comme dans ta structure
        const querySnapshot = await db.collection('membres')
                                      .where('Mail', '==', email)
                                      .limit(1)
                                      .get();
        const isAuthorized = !querySnapshot.empty;
        if (isAuthorized) {
            console.log(`Email ${email} trouvé dans la collection membres. Autorisé.`);
        } else {
            console.log(`Email ${email} NON trouvé dans la collection membres. Accès refusé.`);
        }
        return isAuthorized;
    } catch (error) {
        console.error("Erreur Firestore lors de la vérification d'autorisation:", error);
        // Sécurité : refuser l'accès en cas d'erreur de BDD
        return false;
    }
}
// --- ACTIONS AUTHENTIFICATION ---
async function handleGoogleSignIn() {
    if (loginErrorMsg) loginErrorMsg.style.display = 'none'; // Cache ancienne erreur
    try {
        // Utilise signInWithPopup pour ouvrir la fenêtre Google
        const result = await auth.signInWithPopup(googleProvider);
        // La suite est gérée par onAuthStateChanged
        console.log("Popup Google Sign-In réussie pour:", result?.user?.email);
    } catch (error) {
        console.error("Erreur Google Sign-In:", error);
        // Afficher erreurs spécifiques si possible
        let message = "Erreur lors de la connexion Google.";
        if (error.code === 'auth/popup-closed-by-user') {
            message = "La fenêtre de connexion a été fermée.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            message = "Connexion annulée.";
        }
        showLoginScreen(message);
    }
}

function handleSignOut() {
    auth.signOut().then(() => {
        console.log("Déconnexion réussie.");
        // onAuthStateChanged gérera le changement d'UI
    }).catch(error => {
        console.error("Erreur lors de la déconnexion:", error);
    });
}

/**
 * Met en place l'écouteur Firebase qui réagit aux changements d'état
 * de connexion/déconnexion de l'utilisateur. C'est le point central
 * qui détermine si l'écran de login ou l'application doit être affichée.
 */
function setupAuthObserver() {
    auth.onAuthStateChanged(async (user) => {
        console.log("Auth state changed -> User:", user ? user.email : null); // Utile pour le débogage

        if (user) {
            // L'utilisateur est connecté à Firebase Auth.
            // Étape 1: Vérifier si son email est dans la liste des membres autorisés.
            let isAuthorized = false;
            try {
                isAuthorized = await checkAuthorization(user.email);
            } catch (error) {
                // Si la vérification elle-même échoue (ex: problème réseau, règles Firestore incorrectes),
                // on considère l'utilisateur comme non autorisé par sécurité.
                console.error("Erreur durant la vérification d'autorisation:", error);
                isAuthorized = false;
                // Afficher une erreur plus spécifique avant la déconnexion ?
                showNotification("Erreur lors de la vérification des permissions.", true);
            }

            // Étape 2: Agir en fonction de l'autorisation
            if (isAuthorized) {
                // **CAS 1: Utilisateur connecté ET autorisé**
                console.log(`Utilisateur ${user.email} autorisé. Affichage de l'application.`);
                // Affiche l'interface principale de l'application.
                showAppScreen(user);
                // Initialise toutes les fonctionnalités (chargement data, listeners, etc.).
                // Cette fonction contient le flag `appInitialized` pour éviter les ré-initialisations.
                initializeAppFeatures();
            } else {
                // **CAS 2: Utilisateur connecté MAIS non autorisé**
                console.warn(`Accès refusé pour ${user.email}. Votre email n'est pas enregistré comme membre. Déconnexion...`);
                // Informer l'utilisateur *avant* de déconnecter.
                showNotification("Accès refusé. Votre email n'est pas autorisé.", true); // Utilise alert ou une notification plus visible

                try {
                    // Déconnecter l'utilisateur de Firebase Authentication.
                    await auth.signOut();
                    // Note importante: La déconnexion va déclencher un NOUVEL événement
                    // onAuthStateChanged, mais cette fois avec user=null. C'est cet événement
                    // (le bloc 'else' ci-dessous) qui s'occupera de nettoyer l'état (resetAppState)
                    // et d'afficher l'écran de login (showLoginScreen).
                    // C'est une approche plus propre que de le faire ici directement.
                } catch (signOutError) {
                    // Gérer le cas (rare) où la déconnexion échoue.
                    console.error("Erreur critique lors de la déconnexion forcée après refus d'accès:", signOutError);
                    // L'utilisateur est dans un état incohérent. On force l'affichage du login avec une erreur.
                    resetAppState(); // Tenter de nettoyer quand même
                    showLoginScreen("Erreur critique lors de la déconnexion. Veuillez contacter l'administrateur.");
                }
            }
        } else {
            // **CAS 3: Utilisateur déconnecté** (ou état initial avant la première connexion)
            console.log("Utilisateur déconnecté ou état initial non connecté.");
            // Nettoie toutes les données, instances de tables/graphiques, etc.
            resetAppState();
            // Affiche l'écran de connexion standard.
            showLoginScreen();
        }
    });

    console.log("Observateur d'état d'authentification mis en place.");
}
// --- INITIALISATION SPÉCIFIQUE APP (après auth) ---
function initializeAppFeatures() {
    // Empêche ré-initialisation si déjà fait
    if (appInitialized) {
        console.log("Fonctionnalités déjà initialisées.");
        return;
    }
    console.log("Initialisation des fonctionnalités principales de l'application...");

    // --- 1. Attacher les Listeners Généraux et Spécifiques ---

    // a) Listeners de délégation pour actions Edit/Delete/Statut
    console.log(" -> Attachement des listeners d'actions déléguées...");
    contentSections.forEach(section => {
        // S'assurer que les éléments existent avant d'attacher
        const containerGrid = section.querySelector('.grid');
        const containerSelect = section.querySelector('select.contact-status, select.coffee-status');
        const containerTable = section.querySelector('#coffee-table-container, #recharge-table-container');
        if (containerGrid || containerSelect || containerTable) {
            // La fonction setupActionListeners est définie ailleurs dans le script
            setupActionListeners(section);
        }
    });

    // b) Listeners spécifiques aux formulaires (Add/Edit Modals)
    console.log(" -> Attachement des listeners de formulaires Modals...");

    // ACTUALITÉS
    const formActus = document.getElementById('form-actualites');
    const formEditActus = document.getElementById('form-edit-actualite');
    const newsImageInputAdd = document.getElementById('news-image-file');
    const newsImageInputEdit = document.getElementById('edit-news-image-file');

    if (formActus) {
        formActus.addEventListener('submit', e => {
            e.preventDefault();
            const imageUrl = document.getElementById('news-image-url').value;
            const data = {
                title: e.target['news-title'].value,
                content: e.target['news-content'].value,
                date: e.target['news-date'].value,
                image: imageUrl,
                link: e.target['news-link'].value.trim(),
                status: e.target['news-status'].value
            };
            const submitButton = document.getElementById('submit-add-news');
            if(submitButton) submitButton.disabled = true;
            db.collection('news').add(data).then(() => {
                showNotification('Actualité ajoutée!');
                resetModalForms(formActus.closest('.modal')); // Reset via fonction centralisée
                document.getElementById('modal-actualites').style.display = 'none';
            }).catch(err => {
                console.error("Erreur ajout actualité:", err);
                showNotification('Erreur ajout', true);
            }).finally(() => {
                 if(submitButton) submitButton.disabled = false;
            });
        });
    }
     if (newsImageInputAdd) {
        newsImageInputAdd.addEventListener('change', (event) => {
             const file = event.target.files[0];
             if (file) {
                 uploadToImgur(file, 'news-upload-status', 'news-image-url', 'submit-add-news');
             }
        });
     }

        if (formEditActus) {
        formEditActus.addEventListener('submit', e => {
            e.preventDefault();
            // Ligne existante:
            const id = e.target['edit-news-id'].value;

            // === AJOUT DES LOGS DE DÉBOGAGE ===
            console.log("--- SUBMIT EDIT NEWS ---");
            console.log("Formulaire soumis :", e.target); // Vérifie que c'est le bon formulaire
            const idInput = e.target['edit-news-id']; // Récupère l'élément input lui-même
            console.log("Élément Input ID trouvé :", idInput);
            console.log(">>> VALEUR DE L'ID LU AU MOMENT DU SUBMIT :", id); // <<< LE LOG LE PLUS IMPORTANT

            // Vérification explicite si l'ID est vide
            if (!id || id.trim() === '') {
                console.error("ERREUR FATALE : L'ID est vide au moment de la soumission ! Impossible de mettre à jour.");
                showNotification("Erreur : L'identifiant de l'actualité est manquant.", true);
                // Optionnel : Garder le bouton désactivé si besoin
                const submitButton = document.getElementById('submit-edit-news');
                 if(submitButton) submitButton.disabled = true; // Assure qu'il reste bloqué
                return; // Arrête l'exécution ici pour éviter l'erreur Firestore
            }
            // === FIN DES LOGS DE DÉBOGAGE ===


            const newImageUrl = document.getElementById('edit-news-image-url').value;
            const originalImageUrl = document.getElementById('edit-news-original-image-url').value;
            const finalImageUrl = newImageUrl ? newImageUrl : originalImageUrl;
            const data = {
                title: e.target['edit-news-title'].value,
                content: e.target['edit-news-content'].value,
                date: e.target['edit-news-date'].value,
                image: finalImageUrl,
                link: e.target['edit-news-link'].value.trim(),
                status: e.target['edit-news-status'].value
            };
            const submitButton = document.getElementById('submit-edit-news');
            if(submitButton) submitButton.disabled = true;

            console.log(`Tentative de mise à jour Firestore avec ID : '${id}'`); // Log juste avant l'appel DB

            db.collection('news').doc(id).update(data).then(() => {
                showNotification('Actualité modifiée!');
                 // La ligne suivante pourrait encore causer problème si elle déclenche un reset trop tôt
                 // resetModalForms(formEditActus.closest('.modal'));
                document.getElementById('modal-edit-actualite').style.display = 'none';
                 // On réinitialise via le listener de fermeture standard qui est déjà en place
            }).catch(err => {
                console.error("Erreur modification actualité:", err);
                 console.error("ID utilisé lors de l'erreur:", id); // Log l'ID si erreur
                showNotification('Erreur modif', true);
            }).finally(() => {
                 if(submitButton) submitButton.disabled = false;
            });
        });
    }


    // MEMBRES
    const formMembres = document.getElementById('form-membres');
    const formEditMembres = document.getElementById('form-edit-membre');

    if (formMembres) {
        formMembres.addEventListener('submit', e => {
            e.preventDefault();
            const data={Nom:e.target['member-nom'].value, Prenom:e.target['member-prenom'].value, Mail:e.target['member-mail'].value, Operation:e.target['member-operation'].value, Role:e.target['member-role'].value, PhotoURL:e.target['member-photo'].value};
            const submitButton = formMembres.querySelector('button[type="submit"]');
            if(submitButton) submitButton.disabled = true;
            db.collection('membres').add(data).then(()=>{
                showNotification('Membre ajouté!');
                resetModalForms(formMembres.closest('.modal'));
                document.getElementById('modal-membres').style.display = 'none';
            }).catch(err=>{
                console.error(err); showNotification('Erreur ajout membre', true);
            }).finally(() => {
                if(submitButton) submitButton.disabled = false;
            });
        });
    }

    if (formEditMembres) {
        formEditMembres.addEventListener('submit', e => {
            e.preventDefault();
            const id=e.target['edit-member-id'].value;
            const data={Nom:e.target['edit-member-nom'].value, Prenom:e.target['edit-member-prenom'].value, Mail:e.target['edit-member-mail'].value, Operation:e.target['edit-member-operation'].value, Role:e.target['edit-member-role'].value, PhotoURL:e.target['edit-member-photo'].value};
            const submitButton = formEditMembres.querySelector('button[type="submit"]');
            if(submitButton) submitButton.disabled = true;
            db.collection('membres').doc(id).update(data).then(()=>{
                showNotification('Membre modifié!');
                 resetModalForms(formEditMembres.closest('.modal'));
                document.getElementById('modal-edit-membre').style.display = 'none';
            }).catch(err=>{
                console.error(err); showNotification('Erreur modif membre', true);
            }).finally(() => {
                 if(submitButton) submitButton.disabled = false;
            });
        });
    }

    // PARTENAIRES
    const formPartenaires = document.getElementById('form-partenaires');
    const formEditPartenaires = document.getElementById('form-edit-partenaire');

    if (formPartenaires) {
        formPartenaires.addEventListener('submit', e => {
            e.preventDefault();
            const data={Categorie:e.target['partenaire-categorie'].value, Nom:e.target['partenaire-nom'].value, Description:e.target['partenaire-description'].value, Lien:e.target['partenaire-lien'].value, Logo:e.target['partenaire-logo'].value};
            const submitButton = formPartenaires.querySelector('button[type="submit"]');
            if(submitButton) submitButton.disabled = true;
            db.collection('partenaires').add(data).then(()=>{
                showNotification('Partenaire ajouté!');
                 resetModalForms(formPartenaires.closest('.modal'));
                document.getElementById('modal-partenaires').style.display = 'none';
             }).catch(err=>{
                 console.error(err); showNotification('Erreur ajout partenaire', true);
             }).finally(() => {
                 if(submitButton) submitButton.disabled = false;
             });
        });
    }

    if (formEditPartenaires) {
        formEditPartenaires.addEventListener('submit', e => {
            e.preventDefault();
            const id=e.target['edit-partenaire-id'].value;
            const data={Categorie:e.target['edit-partenaire-categorie'].value, Nom:e.target['edit-partenaire-nom'].value, Description:e.target['edit-partenaire-description'].value, Lien:e.target['edit-partenaire-lien'].value, Logo:e.target['edit-partenaire-logo'].value};
            const submitButton = formEditPartenaires.querySelector('button[type="submit"]');
            if(submitButton) submitButton.disabled = true;
            db.collection('partenaires').doc(id).update(data).then(()=>{
                showNotification('Partenaire modifié!');
                 resetModalForms(formEditPartenaires.closest('.modal'));
                document.getElementById('modal-edit-partenaire').style.display = 'none';
            }).catch(err=>{
                 console.error(err); showNotification('Erreur modif partenaire', true);
            }).finally(() => {
                 if(submitButton) submitButton.disabled = false;
            });
        });
    }

    // CALENDRIER
    const formCalendrier = document.getElementById('form-calendrier');
    const formEditCalendrier = document.getElementById('form-edit-calendrier');

    if (formCalendrier) {
        formCalendrier.addEventListener('submit', e => {
            e.preventDefault();
            const data={title:e.target['event-title'].value, description:e.target['event-description'].value, date:e.target['event-date'].value, time:e.target['event-time'].value, endDate:e.target['event-end-date'].value, endTime:e.target['event-end-time'].value};
             const submitButton = formCalendrier.querySelector('button[type="submit"]');
             if(submitButton) submitButton.disabled = true;
            db.collection('calendrier').add(data).then(()=>{
                showNotification('Événement ajouté!');
                 resetModalForms(formCalendrier.closest('.modal'));
                document.getElementById('modal-calendrier').style.display = 'none';
            }).catch(err=>{
                 console.error(err); showNotification('Erreur ajout événement', true);
            }).finally(() => {
                 if(submitButton) submitButton.disabled = false;
            });
        });
    }

    if (formEditCalendrier) {
        formEditCalendrier.addEventListener('submit', e => {
            e.preventDefault();
            const id=e.target['edit-event-id'].value;
            const data={title:e.target['edit-event-title'].value, description:e.target['edit-event-description'].value, date:e.target['edit-event-date'].value, time:e.target['edit-event-time'].value, endDate:e.target['edit-event-end-date'].value, endTime:e.target['edit-event-end-time'].value};
            const submitButton = formEditCalendrier.querySelector('button[type="submit"]');
            if(submitButton) submitButton.disabled = true;
            db.collection('calendrier').doc(id).update(data).then(()=>{
                showNotification('Événement modifié!');
                 resetModalForms(formEditCalendrier.closest('.modal'));
                document.getElementById('modal-edit-calendrier').style.display = 'none';
            }).catch(err=>{
                 console.error(err); showNotification('Erreur modif événement', true);
            }).finally(() => {
                 if(submitButton) submitButton.disabled = false;
            });
        });
    }

    // c) Listeners pour les boutons d'export CSV/PDF Café
    console.log(" -> Attachement des listeners d'export Café...");
    const exportCsvBtn = document.getElementById('export-recharge-csv-btn');
    const exportPdfBtn = document.getElementById('export-recharge-pdf-btn');

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            if (rechargeTable) {
                try {
                    rechargeTable.download("csv", "problemes_rechargement_cafe.csv", { delimiter: ";" });
                } catch (error) { console.error("Erreur export CSV:", error); showNotification("Erreur export CSV.", true); }
            } else { showNotification("Tableau des rechargements non prêt.", true); }
        });
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            if (rechargeTable) {
                // Vérifier si les librairies PDF sont chargées
                if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined' || !jspdf.jsPDF.API.autoTable) {
                     console.error("Librairies jsPDF ou jsPDF-AutoTable non chargées !");
                     showNotification("Erreur : Librairies PDF manquantes.", true);
                     return;
                }
                try {
                    rechargeTable.download("pdf", "problemes_rechargement_cafe.pdf", { orientation: "landscape", title: "Problèmes Rechargement Café" });
                } catch (error) { console.error("Erreur export PDF:", error); showNotification("Erreur export PDF.", true); }
            } else { showNotification("Tableau des rechargements non prêt.", true); }
        });
    }

    // d) Listeners spécifiques aux Badges Café
    console.log(" -> Configuration des écouteurs Badges post-auth...");
    // La fonction setupBadgeEventListeners est définie ailleurs dans le script
    setupBadgeEventListeners();

    // --- 2. Charger les Données Initiales ---
    console.log(" -> Chargement des données Firebase post-auth...");
    loadNewsFromFirebase();
    loadMembersFromFirebase();
    loadPartnersFromFirebase();
    loadDemandesFromFirebase();
    loadCalendarFromFirebase();
    loadCoffeeReports(); // Important : Charger AVANT d'activer une section dépendante (comme Synthèse ou Café)

    // --- 3. Enregistrement Service Worker ---
    if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
      console.log(" -> Enregistrement SW post-auth.");
      // Utiliser 'load' pour ne pas bloquer le rendu
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('Service Worker enregistré avec succès ! Scope:', registration.scope);
          })
          .catch(error => {
            console.error('Échec de l\'enregistrement du Service Worker:', error);
          });
      });
    }

    // --- 4. Initialisation de l'Interface et Navigation ---
    console.log(" -> Activation section par défaut post-auth...");
    applyRandomRotation('.menu-item'); // Appliquer rotation menu une fois l'app affichée
    initializeDefaultSection('synthese'); // Lance la navigation initiale vers la section souhaitée

    appInitialized = true; // Marquer comme initialisé
    console.log("Initialisation des fonctionnalités terminée.");
}
// --- GESTION DES MODALS ---
const modals = document.querySelectorAll('.modal');
const closeButtons = document.querySelectorAll('.close');

function resetModalForms(modalElement) {
    const forms = modalElement.querySelectorAll('form');
    //forms.forEach(form => form.reset());
forms.forEach(form => {
    // Sélectionne tous les inputs, textareas, selects VISIBLES ou pertinents pour l'utilisateur
    const fieldsToReset = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
    fieldsToReset.forEach(field => {
        if (field.type === 'checkbox' || field.type === 'radio') {
            field.checked = false; // Ou mettre à la valeur par défaut si nécessaire
        } else {
            field.value = ''; // Vide les champs texte, textarea, etc.
        }
    });
    // Pour les selects, tu pourrais vouloir remettre à la première option ou une option vide
    const selects = form.querySelectorAll('select');
    selects.forEach(select => {
        if (select.options.length > 0) {
            select.selectedIndex = 0; // Remet à la première option
        }
    });
});
    // Reset spécifiques aux uploads d'images Actualités
    const newsStatus = modalElement.querySelector('#news-upload-status, #edit-news-upload-status');
    const newsUrlHidden = modalElement.querySelector('#news-image-url, #edit-news-image-url');
    const newsFileInput = modalElement.querySelector('#news-image-file, #edit-news-image-file');
    const newsImgDisplay = modalElement.querySelector('#edit-current-image-display'); // Pour l'édition

    if (newsStatus) newsStatus.textContent = '';
    if (newsUrlHidden) newsUrlHidden.value = '';
    if (newsFileInput) newsFileInput.value = null;
    if (newsImgDisplay) newsImgDisplay.innerHTML = ''; // Vide l'aperçu

    // Réactiver les boutons submit au cas où ils auraient été désactivés
    const submitButtons = modalElement.querySelectorAll('button[type="submit"]');
    submitButtons.forEach(btn => btn.disabled = false);

    console.log(`Formulaires et champs upload réinitialisés pour modal: ${modalElement.id}`);
}

closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-modal');
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            modalElement.style.display = 'none';
            resetModalForms(modalElement); // <-- Appel du reset ici
        }
    });
});

window.onclick = function (event) {
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
            resetModalForms(modal); // <-- Appel du reset ici aussi
        }
    });
};


/**
 * Upload un fichier vers Imgur en utilisant l'API v3 anonyme.
 * @param {File} file Le fichier image à uploader.
 * @param {string} statusElementId ID de l'élément pour afficher le statut.
 * @param {string} urlInputElementId ID de l'input caché pour stocker l'URL.
 * @param {string} submitButtonId ID du bouton de soumission du formulaire.
 * @returns {Promise<string|null>} Une promesse qui résout avec l'URL Imgur ou null en cas d'erreur.
 */
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

    // Réinitialiser l'URL précédente et désactiver le bouton
    if (urlInput) urlInput.value = '';
    if (statusDiv) statusDiv.textContent = 'Téléversement vers Imgur...';
    if (submitButton) submitButton.disabled = true;

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: {
                // Authentification via le Client ID
                Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
                // Ne pas définir 'Content-Type', le navigateur le fera avec la bonne boundary pour FormData
            },
            body: formData,
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('Imgur Upload OK:', data);
            if (statusDiv) statusDiv.textContent = 'Image téléversée !';
            if (urlInput) urlInput.value = data.data.link; // Stocke l'URL
            if (submitButton) submitButton.disabled = false; // Réactive le bouton
            return data.data.link; // Renvoie l'URL
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
// Listener pour le champ d'upload dans la modale d'AJOUT
const newsImageInput = document.getElementById('news-image-file');
if (newsImageInput) {
    newsImageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            uploadToImgur(file, 'news-upload-status', 'news-image-url', 'submit-add-news');
        }
    });
}

// Listener pour le champ d'upload dans la modale d'ÉDITION
const editNewsImageInput = document.getElementById('edit-news-image-file');
if (editNewsImageInput) {
    editNewsImageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            uploadToImgur(file, 'edit-news-upload-status', 'edit-news-image-url', 'submit-edit-news');
        }
    });
}
// --- GESTION DE LA NAVIGATION PAR MENU ---
const menuItems = document.querySelectorAll('.menu-item');
const contentSections = document.querySelectorAll('.content');

// --- GESTION DE LA NAVIGATION PAR MENU ---
menuItems.forEach(item => {
    item.addEventListener('click', () => {
        const sectionId = item.getAttribute('data-section'); // Section vers laquelle on veut aller
        const newActiveSectionId = `section-${sectionId}`; // ID complet de la nouvelle section

        // --- Log pour déboguer la navigation ---
        console.log(`Navigation demandée: DE '${currentActiveSectionId}' VERS '${newActiveSectionId}'`);

        // --- Logique de DESTRUCTION (lorsqu'on quitte la section café) ---
        // Vérifie si la section que l'on QUITTTE ('currentActiveSectionId') est bien 'section-coffee'
        // ET si la NOUVELLE section ('newActiveSectionId') est différente.
        if (currentActiveSectionId === 'section-coffee' && newActiveSectionId !== 'section-coffee') {
            console.log("Tentative de destruction des éléments de la section Café...");
            console.log("Quitting coffee section: Destroying tables and charts...");
            // Détruire la table Tabulator (avec try...catch)
            if (coffeeTable) {
                try {
                    console.log(" -> Destruction de coffeeTable...");
                    coffeeTable.destroy();
                    console.log(" -> coffeeTable détruite.");
                } catch (error) {
                    console.error(" -> Erreur lors de la destruction de coffeeTable:", error);
                    // Continuer même si erreur
                } finally {
                    coffeeTable = null; // Assurer la réinitialisation
                }
            } else {
                console.log(" -> coffeeTable était déjà null.");
            }
if (rechargeTable) {
        try {
            console.log(" -> Destruction de rechargeTable...");
            rechargeTable.destroy();
            console.log(" -> rechargeTable détruite.");
        } catch (error) {
            console.error(" -> Erreur lors de la destruction de rechargeTable:", error);
        } finally {
            rechargeTable = null;
        }
    } else {
        console.log(" -> rechargeTable était déjà null.");
    }
            // Détruire les graphiques (avec try...catch pour chaque)
            if (problemChartInstance) {
                try {
                     console.log(" -> Destruction de problemChartInstance...");
                    problemChartInstance.destroy();
                     console.log(" -> problemChartInstance détruit.");
                } catch (error) {
                    console.error(" -> Erreur lors de la destruction de problemChartInstance:", error);
                } finally {
                    problemChartInstance = null;
                }
            } else {
                 console.log(" -> problemChartInstance était déjà null.");
            }

            if (machineChartInstance) {
                 try {
                     console.log(" -> Destruction de machineChartInstance...");
                    machineChartInstance.destroy();
                     console.log(" -> machineChartInstance détruit.");
                } catch (error) {
                    console.error(" -> Erreur lors de la destruction de machineChartInstance:", error);
                } finally {
                    machineChartInstance = null;
                }
            } else {
                 console.log(" -> machineChartInstance était déjà null.");
            }

            if (statusChartInstance) {
                 try {
                     console.log(" -> Destruction de statusChartInstance...");
                    statusChartInstance.destroy();
                     console.log(" -> statusChartInstance détruit.");
                } catch (error) {
                    console.error(" -> Erreur lors de la destruction de statusChartInstance:", error);
                } finally {
                    statusChartInstance = null;
                }
            } else {
                 console.log(" -> statusChartInstance était déjà null.");
            }
             console.log("Fin de la tentative de destruction des éléments Café.");
                console.log("Finished destroying coffee section elements.");

        }
        // --- Fin de la logique de DESTRUCTION ---

        // === Logique Principale de Navigation (ne devrait plus être bloquée) ===

        // 1. Mettre à jour l'ID de la section qui sera désormais active
        currentActiveSectionId = newActiveSectionId;
        console.log(` -> currentActiveSectionId mis à jour à: ${currentActiveSectionId}`);

        // 2. Gérer la classe 'active' sur les items du menu
        menuItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        console.log(` -> Classe 'active' appliquée au menu item: ${sectionId}`);

        // 3. Afficher/Cacher les sections de contenu
        let sectionAffichee = false;
        contentSections.forEach(sec => {
            if (sec.id === newActiveSectionId) {
                sec.classList.add('active');
                sectionAffichee = true;
                console.log(` -> Section affichée: ${sec.id}`);
            } else {
                sec.classList.remove('active');
            }
        });
         if (!sectionAffichee) {
             console.warn(` -> Aucune section trouvée avec l'ID: ${newActiveSectionId}`);
         }

        // 4. Actions spécifiques lors de l'entrée dans certaines sections

        // Charger la synthèse si on va vers la section synthèse
        if (sectionId === 'synthese') {
            console.log(" -> Appel de loadSyntheseData()");
            loadSyntheseData();
        }

        // Initialiser la table Café si on va vers la section café ET qu'elle n'existe pas
        if (sectionId === 'coffee') {
                console.log(" -> Entering coffee section. Setting up tables and CHARTS via setTimeout...");

    console.log(" -> Déclenchement initialisation tables Café (via setTimeout)...");
    setTimeout(() => {
        // Initialiser la table principale si besoin
        if (!coffeeTable) {
            console.log(" -> Exécution initializeCoffeeTable() depuis setTimeout.");
            initializeCoffeeTable();
        } else {
            console.log(" -> coffeeTable déjà initialisée.");
             // Optionnel: forcer refresh si table existe mais données pas à jour?
             // Normalement géré par onSnapshot déjà.
        }
        // Initialiser la table Rechargement si besoin (AJOUT)
        if (!rechargeTable) {
            console.log(" -> Préparation des données pour rechargeTable DANS setTimeout...");
            // Refaire le filtrage ici avec les données actuelles de coffeeData
            const filteredDataForRechargeInit = coffeeData.filter(report => {
                const currentStatus = (report.status || 'en cours').toLowerCase().trim();
                const statusIsInProgress = currentStatus === 'en cours' || currentStatus === '';
                const problemeText = report.probleme || '';
                const problemeLower = problemeText.toLowerCase();
                // Mots-clés (vérifiez-les !)
                const isRechargeIssue = problemeLower.includes('rechargement') ||
                                        problemeLower.includes('paiement') ||
                                        problemeLower.includes('badge');
                return statusIsInProgress && isRechargeIssue;
            });
            console.log(` -> ${filteredDataForRechargeInit.length} rapports filtrés trouvés pour init rechargeTable.`);
            console.log(" -> Exécution initializeRechargeTable() depuis setTimeout avec données filtrées.");
            initializeRechargeTable(filteredDataForRechargeInit); // MODIFICATION: Passer les données filtrées
        } else {
            console.log(" -> rechargeTable déjà initialisée.");
             // Optionnel : si la table existe déjà mais pourrait ne pas être à jour
             // rechargeTable.setData( /* recalculer les données filtrées ici */ );
        }
        updateCoffeeStatsAndCharts(coffeeData);
         console.log(" -> Finished setup for coffee section inside setTimeout.");

    }, 50); // Court délai
}

        // 5. Appliquer les effets visuels (rotation)
        const activeSectionElement = document.getElementById(newActiveSectionId);
        if (activeSectionElement) {
             // Exclure la section café car elle n'a pas de .grid-item standard
             if (sectionId !== 'coffee') {
                 applyRandomRotation(`#${activeSectionElement.id} .grid-item:not(.add-item)`);
             }
             if (sectionId === 'synthese') { // Appliquer aussi aux cartes de synthèse
                 applyRandomRotation(`#${activeSectionElement.id} .synth-card`);
             }
             console.log(` -> Rotation appliquée (si applicable) à la section: ${newActiveSectionId}`);
        } else {
            console.warn(` -> Élément de section non trouvé pour appliquer la rotation: ${newActiveSectionId}`);
        }
        console.log("--- Fin du traitement du clic menu ---");
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
            console.log(`Affichage actu: ${news.id}, URL Image utilisée: '${news.image}'`);
            const item = document.createElement('div'); item.classList.add('grid-item');
            item.innerHTML = `
                ${news.image ? `<img src="${news.image}" alt="${news.title}">` : ''}
                <h3>${news.title}</h3>
                <p>${news.content.substring(0, 150)}...</p>
                ${news.link ? /* <-- AJOUT : Condition pour afficher le lien */
                    `<p style="margin-top: 0.5rem;"><a href="${news.link}" target="_blank" rel="noopener noreferrer" title="Visiter le lien externe">
                        Voir le site <i class="fas fa-external-link-alt" style="font-size: 0.8em;"></i>
                    </a></p>`
                    : '' /* <-- FIN AJOUT */
                }
                <small>Le ${news.date} (${news.status})</small>
                <div class="card-actions news-actions">
                  <button class="btn-action edit" data-id="${news.id}" title="Modifier"><i class="fas fa-pencil-alt"></i></button>
                  <button class="btn-action delete" data-id="${news.id}" title="Supprimer"><i class="fas fa-eraser"></i></button>
                </div>`;
             if (addButtonCard) container.insertBefore(item, addButtonCard); else container.appendChild(item);
        });
        if (currentActiveSectionId === 'section-actus') {
            applyRandomRotation('#section-actus .grid-item:not(.add-item)');
         }
    }
}
function openEditNewsModal(id) {
    const news = newsData.find(n => n.id === id);
    if (!news) return;

    // Remplir les champs texte/date/select
    document.getElementById('edit-news-id').value = id;
    document.getElementById('edit-news-title').value = news.title;
    document.getElementById('edit-news-content').value = news.content;
    document.getElementById('edit-news-date').value = news.date;
    document.getElementById('edit-news-link').value = news.link || '';
    document.getElementById('edit-news-status').value = news.status;

    // Gérer l'affichage de l'image actuelle et les champs liés à l'image
    const currentImageUrl = news.image || '';
    const imageDisplayDiv = document.getElementById('edit-current-image-display');
    const originalUrlInput = document.getElementById('edit-news-original-image-url');
    const newUrlInput = document.getElementById('edit-news-image-url');
    const fileInput = document.getElementById('edit-news-image-file');
    const statusDiv = document.getElementById('edit-news-upload-status');
    const submitButton = document.getElementById('submit-edit-news');

    // Stocker l'URL originale
    if (originalUrlInput) originalUrlInput.value = currentImageUrl;

    // Afficher l'image actuelle si elle existe
    if (imageDisplayDiv) {
        if (currentImageUrl) {
            imageDisplayDiv.innerHTML = `<p style="font-size:0.9em; margin-bottom:5px;">Image actuelle :</p><img src="${currentImageUrl}" alt="Image actuelle" style="max-width: 150px; max-height: 100px; border: 1px solid #ccc; display: block;">`;
        } else {
            imageDisplayDiv.innerHTML = '<p style="font-size:0.9em; margin-bottom:5px;"><i>Pas d\'image actuelle.</i></p>';
        }
    }

    // Réinitialiser les champs pour un nouvel upload potentiel
    if (newUrlInput) newUrlInput.value = '';
    if (fileInput) fileInput.value = null; // Très important pour pouvoir re-sélectionner le même fichier
    if (statusDiv) statusDiv.textContent = '';
    if (submitButton) submitButton.disabled = false; // Assurer que le bouton est actif

    // Afficher la modale
    document.getElementById('modal-edit-actualite').style.display = 'block';
}


function deleteNews(id) { if (!confirm("Effacer cette actu ?")) return; db.collection('news').doc(id).delete().then(()=>showNotification("Actu effacée.")).catch(err=>{console.error(err); showNotification("Erreur suppression", true);}); }

// Form Listeners Actus

/*document.getElementById('form-actualites').addEventListener('submit', e => {
    e.preventDefault();
    const imageUrl = document.getElementById('news-image-url').value; // <-- Lire l'URL depuis l'input caché

    const data = {
        title: e.target['news-title'].value,
        content: e.target['news-content'].value,
        date: e.target['news-date'].value,
        image: imageUrl, // <-- Utiliser l'URL Imgur (peut être vide si upload échoué/pas fait)
        link: e.target['news-link'].value.trim(),
        status: e.target['news-status'].value
    };

    // Bloquer re-soumission pendant l'enregistrement DB
    const submitButton = document.getElementById('submit-add-news');
    if(submitButton) submitButton.disabled = true;

    db.collection('news').add(data).then(() => {
        showNotification('Actualité ajoutée!');
        e.target.reset(); // Réinitialise le formulaire
        document.getElementById('news-image-url').value = ''; // Vide l'URL cachée
        document.getElementById('news-upload-status').textContent = ''; // Vide le statut
        const fileInput = document.getElementById('news-image-file');
        if(fileInput) fileInput.value = null; // Réinitialise le champ fichier
        document.getElementById('modal-actualites').style.display = 'none';
    }).catch(err => {
        console.error("Erreur ajout actualité:", err);
        showNotification('Erreur ajout', true);
    }).finally(() => {
         if(submitButton) submitButton.disabled = false; // Réactiver dans tous les cas
    });
});

/*document.getElementById('form-edit-actualite').addEventListener('submit', e => {
    e.preventDefault();
    const id = e.target['edit-news-id'].value;
    const newImageUrl = document.getElementById('edit-news-image-url').value; // URL si NOUVEL upload
    const originalImageUrl = document.getElementById('edit-news-original-image-url').value; // URL avant modif

    // Choisir l'URL à sauvegarder: la nouvelle si elle existe, sinon l'originale
    const finalImageUrl = newImageUrl ? newImageUrl : originalImageUrl;

    const data = {
        title: e.target['edit-news-title'].value,
        content: e.target['edit-news-content'].value,
        date: e.target['edit-news-date'].value,
        image: finalImageUrl, // <-- Utiliser l'URL finale
        link: e.target['edit-news-link'].value.trim(),
        status: e.target['edit-news-status'].value
    };

     // Bloquer re-soumission pendant l'enregistrement DB
    const submitButton = document.getElementById('submit-edit-news');
    if(submitButton) submitButton.disabled = true;


    db.collection('news').doc(id).update(data).then(() => {
        showNotification('Actualité modifiée!');
        // Pas besoin de reset le form ici, on ferme juste la modale
        document.getElementById('modal-edit-actualite').style.display = 'none';
        // Le reset des champs upload/status se fera à la prochaine ouverture
    }).catch(err => {
        console.error("Erreur modification actualité:", err);
        showNotification('Erreur modif', true);
    }).finally(() => {
         if(submitButton) submitButton.disabled = false; // Réactiver
    });
});*/

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
          const item = document.createElement('div'); 
          const photoURL=member.PhotoURL;
          
          // ===> CORRECTION ICI <===
            // 1. Ajouter TOUJOURS la classe de base
            item.classList.add('grid-item');

            // 2. Ajouter la classe 'polaroid-style' SEULEMENT si photoURL existe
            if (photoURL) {
                item.classList.add('polaroid-style');
            }
          
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

/*document.getElementById('form-membres').addEventListener('submit', e => { e.preventDefault(); const data={Nom:e.target['member-nom'].value, Prenom:e.target['member-prenom'].value, Mail:e.target['member-mail'].value, Operation:e.target['member-operation'].value, Role:e.target['member-role'].value, PhotoURL:e.target['member-photo'].value}; db.collection('membres').add(data).then(()=>{ showNotification('Membre ajouté!'); e.target.reset(); document.getElementById('modal-membres').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur ajout', true);}); });
document.getElementById('form-edit-membre').addEventListener('submit', e => { e.preventDefault(); const id=e.target['edit-member-id'].value; const data={Nom:e.target['edit-member-nom'].value, Prenom:e.target['edit-member-prenom'].value, Mail:e.target['edit-member-mail'].value, Operation:e.target['edit-member-operation'].value, Role:e.target['edit-member-role'].value, PhotoURL:e.target['edit-member-photo'].value}; db.collection('membres').doc(id).update(data).then(()=>{ showNotification('Membre modifié!'); document.getElementById('modal-edit-membre').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur modif', true);}); });*/


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
/*document.getElementById('form-partenaires').addEventListener('submit', e => { e.preventDefault(); const data={Categorie:e.target['partenaire-categorie'].value, Nom:e.target['partenaire-nom'].value, Description:e.target['partenaire-description'].value, Lien:e.target['partenaire-lien'].value, Logo:e.target['partenaire-logo'].value}; db.collection('partenaires').add(data).then(()=>{ showNotification('Partenaire ajouté!'); e.target.reset(); document.getElementById('modal-partenaires').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur ajout', true);}); });
document.getElementById('form-edit-partenaire').addEventListener('submit', e => { e.preventDefault(); const id=e.target['edit-partenaire-id'].value; const data={Categorie:e.target['edit-partenaire-categorie'].value, Nom:e.target['edit-partenaire-nom'].value, Description:e.target['edit-partenaire-description'].value, Lien:e.target['edit-partenaire-lien'].value, Logo:e.target['edit-partenaire-logo'].value}; db.collection('partenaires').doc(id).update(data).then(()=>{ showNotification('Partenaire modifié!'); document.getElementById('modal-edit-partenaire').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur modif', true);}); });*/


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
/*document.getElementById('form-edit-calendrier').addEventListener('submit', e => { e.preventDefault(); const id=e.target['edit-event-id'].value; const data={title:e.target['edit-event-title'].value, description:e.target['edit-event-description'].value, date:e.target['edit-event-date'].value, time:e.target['edit-event-time'].value, endDate:e.target['edit-event-end-date'].value, endTime:e.target['edit-event-end-time'].value}; db.collection('calendrier').doc(id).update(data).then(()=>{ showNotification('Événement modifié!'); document.getElementById('modal-edit-calendrier').style.display = 'none'; }).catch(err=>{ console.error(err); showNotification('Erreur modif', true);}); });*/


// === MODULE BADGES CAFÉ (Version Dynamique) ===

// Fonction pour afficher/masquer les zones principales
function showBadgeUISection(sectionToShow) {
    const sections = ['search-results', 'selected-employee-zone', 'new-employee-prompt', 'delete-zone'];
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = (id === sectionToShow) ? 'block' : 'none';
            // Pour la zone sélectionnée, on utilise flex pour mieux la gérer si besoin
            if (id === 'selected-employee-zone' && sectionToShow === id) {
                 element.style.display = 'block'; // Ou 'flex' si tu utilises flexbox pour son layout interne
            }
        }
    });
     // Cacher la zone des résultats si on montre autre chose qu'elle-même
     if (sectionToShow !== 'search-results') {
          const resultsContainer = document.getElementById('search-results');
           if(resultsContainer) resultsContainer.style.display = 'none';
     }

    const selectedZone = document.getElementById('selected-employee-zone');
    const deleteBtn = document.getElementById('delete-employee-btn');
     if(selectedZone && deleteBtn) { // Masquer bouton si parent masqué
        deleteBtn.style.display = selectedZone.style.display === 'block' ? 'inline-block' : 'none';
     } else if(deleteBtn){ // Cacher par sécurité si pas de parent trouvé
        deleteBtn.style.display = 'none';
     }
}

// Fonction pour afficher les notifications spécifiques aux badges
function showBadgeNotification(message, isError = false) {
    const msgDiv = document.getElementById('badge-message'); // Utilise la div dédiée
    if (!msgDiv) {
        // Fallback si la div n'existe pas (ne devrait pas arriver avec le nouvel HTML)
        showNotification(message, isError); // Appelle la fonction globale
        return;
    }
    msgDiv.textContent = message;
    msgDiv.className = 'message-area'; // Reset classes
    if (isError) {
        msgDiv.classList.add('error');
        msgDiv.style.color = 'var(--danger-couleur)'; // Styles CSS à définir ou inline
        msgDiv.style.borderColor = 'var(--danger-couleur)';
         msgDiv.style.backgroundColor = '#ffebee';
    } else {
        msgDiv.classList.add('success');
        msgDiv.style.color = '#2e7d32'; // Vert succès
        msgDiv.style.borderColor = '#a5d6a7';
        msgDiv.style.backgroundColor = '#e8f5e9';
    }
     msgDiv.style.display = 'block'; // Assure la visibilité
     msgDiv.style.padding = '1rem';
     msgDiv.style.marginTop = '1rem';
     msgDiv.style.borderRadius = '4px';
     msgDiv.style.borderWidth = '1px';
     msgDiv.style.borderStyle = 'solid';

     // Optionnel: faire disparaître après quelques secondes
    /*
    setTimeout(() => {
        msgDiv.style.display = 'none';
        msgDiv.textContent = '';
    }, 5000);
    */
}


// Nouvelle fonction de recherche dynamique
async function searchEmployeesByName(searchTerm) {
    console.log(`>> Fonction searchEmployeesByName appelée avec searchTerm: "${searchTerm}"`);
    const resultsContainer = document.getElementById('search-results');
    const promptContainer = document.getElementById('new-employee-prompt'); // Le conteneur du bouton "créer"
    const createBtn = document.getElementById('create-new-employee-btn');

     // Masquer le prompt d'ajout au début de chaque recherche
     if (promptContainer) promptContainer.style.display = 'none';

     // Afficher feedback et la zone de résultat
    resultsContainer.innerHTML = '<p><i>Recherche en cours...</i></p>';
    showBadgeUISection('search-results'); // Assure que la zone des résultats est visible

    if (!searchTerm || searchTerm.length < 2) { // Minimum 2 caractères pour chercher ET proposer l'ajout
        console.log("   -> Recherche annulée (trop court)");
        resultsContainer.innerHTML = ''; // Vider les résultats si trop court
        return; // Ne pas afficher le prompt d'ajout non plus
    }

    // Convertir l'entrée en MAJUSCULES
    const upperCaseSearch = searchTerm.toUpperCase();
    const endTerm = upperCaseSearch + '\uf8ff';

    console.log("   -> Préparation de la requête Firestore...");
    console.log(`   -> Requête MAJUSCULES: Nom >= "${upperCaseSearch}", Nom < "${endTerm}"`);

    try {
        // Requête Firestore
        const querySnapshot = await db.collection('salaries_test')
            .where('Nom', '>=', upperCaseSearch)
            .where('Nom', '<', endTerm)
            .orderBy('Nom')
            .limit(10)
            .get();

        console.log(`   -> Requête terminée, ${querySnapshot.size} résultats.`);
        const employees = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        resultsContainer.innerHTML = ''; // Vider avant d'ajouter les nouveaux résultats

        // Afficher les résultats s'il y en a
        if (employees.length > 0) {
            // Le showBadgeUISection('search-results') est déjà fait avant la requête
            employees.forEach(emp => {
                const div = document.createElement('div');
                div.classList.add('result-item');
                const prenom = emp.Prenom || emp['Prénom'] || '?';
                div.textContent = `${emp.Nom || '?'} ${prenom}`;
                div.dataset.employeeId = emp.id;
                div.employeeData = emp;
                div.addEventListener('click', () => selectEmployee(emp.id, emp));
                resultsContainer.appendChild(div);
            });
        } else {
            // Aucun résultat trouvé
            resultsContainer.innerHTML = '<p><i>Aucun salarié trouvé pour ce nom.</i></p>';
        }

        // === NOUVELLE LOGIQUE : Afficher TOUJOURS le prompt d'ajout si searchTerm >= 2 ===
        if (promptContainer && createBtn && searchTerm.length >= 2) {
            console.log("   -> Affichage du prompt pour créer un nouveau salarié.");
            // Mettre à jour le texte du bouton pour être plus spécifique (optionnel)
            createBtn.textContent = `Créer un nouveau salarié "${upperCaseSearch}" ?`;
             promptContainer.style.display = 'block'; // Afficher le prompt et le bouton
        }
         // showBadgeUISection n'est plus utilisé pour le prompt ici, on le gère directement

    } catch (error) {
        console.error("Erreur recherche salarié:", error);
        resultsContainer.innerHTML = '<p style="color:red;">Erreur lors de la recherche.</p>';
        if (promptContainer) promptContainer.style.display = 'none'; // Cacher le prompt en cas d'erreur

        if (error.code === 'failed-precondition') {
            console.error(">>> ERREUR: INDEX FIRESTORE MANQUANT PROBABLE. <<<");
             resultsContainer.innerHTML += '<br><span style="color:red; font-weight:bold;">Vérifiez la console (F12) pour un lien de création d\'index.</span>';
        }
    }
}

// Fonction appelée lors de la sélection d'un salarié dans les résultats
// Fonction appelée lors de la sélection d'un salarié dans les résultats
function selectEmployee(id, data) {
    console.log("Salarié sélectionné (ancienne structure):", id, data);

    const detailsP = document.getElementById('selected-employee-details');
    // Utilise 'Prénom' car c'est ce qu'il y a dans tes données
    const prenom = data['Prénom'] || '?';
    detailsP.innerHTML = `<strong>Nom :</strong> ${data.Nom || '?'} <br> <strong>Prénom :</strong> ${prenom}`;

    // --- PRÉPARATION BADGE À PARTIR DE L'ANCIENNE STRUCTURE ---
    let badgesToDisplay = [];
    const numCle = data["Num de Clé"]; // Lire le champ exact

    if (numCle) { // Si un numéro de clé existe
        console.log("Ancienne structure trouvée avec Num de Clé:", numCle);
        // Fonction helper pour convertir l'ancienne date (optionnel mais recommandé)
        const convertOldDate = (oldDateStr) => {
            if (!oldDateStr || typeof oldDateStr !== 'string' || !oldDateStr.includes('/')) return null;
            const parts = oldDateStr.split('/');
            if (parts.length === 3) {
                // Assure-toi que l'ordre est bon (JJ/MM/AAAA) -> AAAA-MM-JJ
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            return null;
        };

        const badgeObject = {
            keyNumber: numCle, // Utilise la valeur de "Num de Clé"
            type: data["E (echange) R (reglement)"] || '?', // Lire le champ exact du type
            // Pour le montant, on se base sur le type (le champ "Montant réglé" est vide)
            montant: (data["E (echange) R (reglement)"] === 'R' ? 7 : 0),
            date: convertOldDate(data.Date) // Lire le champ Date et essayer de convertir
        };
        badgesToDisplay = [badgeObject]; // Met l'objet unique dans un tableau
    } else {
        console.log("Aucun 'Num de Clé' trouvé pour ce salarié.");
    }
    // --- FIN PRÉPARATION ---

    // Mettre à jour l'affichage
    updateDisplayedBadges(badgesToDisplay); // Fonctionne car on lui passe un tableau formaté

    // Pré-remplir les champs cachés (reste pareil)
    document.getElementById('selected-employee-id').value = id;
    document.getElementById('selected-employee-nom').value = data.Nom || '?';
    document.getElementById('selected-employee-prenom').value = prenom; // Utilise la variable prenom définie plus haut

    // Réinitialiser formulaire d'assignation (reste pareil)
    const assignForm = document.getElementById('form-assign-badge');
    if (assignForm) assignForm.reset();
    document.getElementById('caution-amount-group').style.display = 'none';
    document.getElementById('badge-number').value = '';

    // Afficher zone sélectionnée (reste pareil)
    showBadgeUISection('selected-employee-zone');

    // Gérer bouton supprimer (reste pareil)
    const deleteButton = document.getElementById('delete-employee-btn');
    if (deleteButton) {
        deleteButton.style.display = 'inline-block';
        deleteButton.disabled = false;
    }

    // Effacer recherche (reste pareil)
    const searchInput = document.getElementById('employee-search');
    const resultsContainer = document.getElementById('search-results');
    if (searchInput) searchInput.value = '';
    if (resultsContainer) resultsContainer.innerHTML = '';
}

// Met à jour la liste UL des badges affichés
function updateDisplayedBadges(keysArray) {
     const ul = document.querySelector('#existing-keys-list ul');
     const noKeysMsg = document.querySelector('#existing-keys-list .no-keys-message');
     const listContainer = document.getElementById('existing-keys-list'); // Conteneur global de la liste

    if (!ul || !noKeysMsg || !listContainer) return;

    ul.innerHTML = ''; // Vider la liste précédente

    if (keysArray && keysArray.length > 0) {
        keysArray.forEach(k => {
            const li = document.createElement('li');
             const dateFormatted = k.date ? `<small>(${new Date(k.date + 'T00:00:00').toLocaleDateString('fr-FR')})</small>` : '<small>(Date?)</small>'; // Affichage date FR
             const typeLabel = k.type === 'R' ? 'Caution' : (k.type === 'E' ? 'Echange' : k.type);
             const montantDisplay = k.montant ? ` - ${k.montant}€` : ''; // Affiche montant seulement s'il existe et est > 0

            li.innerHTML = `(${typeLabel}) ${k.keyNumber || '?'} ${montantDisplay} ${dateFormatted}`;
            ul.appendChild(li);
        });
        ul.style.display = 'block';
        noKeysMsg.style.display = 'none';
        listContainer.style.display = 'block'; // Afficher le conteneur H4 + liste
    } else {
        ul.style.display = 'none';
        noKeysMsg.style.display = 'block';
         listContainer.style.display = 'block'; // Afficher quand même le H4 + message "aucun"
    }
}

// Fonction pour gérer la soumission du formulaire d'assignation/création
async function handleAssignBadgeSubmit(event) {
    event.preventDefault();
    const form = event.target;

    const employeeId = document.getElementById('selected-employee-id').value; // Peut être l'ID ou "__NEW__"
    const employeeNom = document.getElementById('selected-employee-nom').value;
    const employeePrenom = document.getElementById('selected-employee-prenom').value;
    const badgeNumber = document.getElementById('badge-number').value.trim();
    const badgeType = document.getElementById('badge-type').value;

    if (!badgeNumber || !badgeType) {
        showBadgeNotification("Veuillez entrer un numéro de badge et choisir un type.", true);
        return;
    }

    const badgeAmount = badgeType === 'R' ? 7 : 0; // Montant fixe pour caution
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const newBadgeData = {
        keyNumber: badgeNumber,
        type: badgeType,
        montant: badgeAmount,
        date: today
    };

     // Bloquer le bouton pour éviter double soumission
     form.querySelector('button[type="submit"]').disabled = true;
     showBadgeNotification("Traitement en cours...", false); // Message temporaire

    try {
        if (employeeId === "__NEW__") {
            // --- Création du Nouveau Salarié ---
            console.log("Création nouveau salarié:", employeeNom, employeePrenom);
            // Vérifier si nom/prénom sont valides
             if (!employeeNom || !employeePrenom || employeePrenom === '?') {
                 showBadgeNotification("Nom et Prénom sont requis pour créer un salarié.", true);
                  form.querySelector('button[type="submit"]').disabled = false; // Réactiver bouton
                 return;
             }

            const newEmployeeDoc = {
                Nom: employeeNom,
                 // Assurer la cohérence du champ Prénom (par exemple, toujours 'Prenom')
                Prenom: employeePrenom,
                date_creation: today,
                keys: [newBadgeData], // Le tableau contient uniquement le nouveau badge
                 // Optionnel : ajouter Nom_lowercase si utilisé pour la recherche
                Nom_lowercase: employeeNom.toLowerCase()
            };

            const docRef = await db.collection('salaries_test').add(newEmployeeDoc);
            console.log("Nouveau salarié créé avec ID:", docRef.id);
             showBadgeNotification(`Salarié ${employeeNom} ${employeePrenom} créé et badge ${badgeNumber} assigné.`, false);
            // Après création, on peut "sélectionner" ce nouveau salarié pour voir sa fiche à jour
             selectEmployee(docRef.id, newEmployeeDoc); // Met à jour l'UI
             // Réinitialiser formulaire est déjà fait dans selectEmployee


        } else {
            // --- Ajout du Badge à un Salarié Existant ---
            console.log("Ajout badge à salarié existant:", employeeId);
            const employeeRef = db.collection('salaries_test').doc(employeeId);
            await employeeRef.update({
                keys: firebase.firestore.FieldValue.arrayUnion(newBadgeData)
            });

             showBadgeNotification(`Badge ${badgeNumber} ajouté pour ${employeeNom} ${employeePrenom}.`, false);

            // Rafraîchir l'affichage des badges
            const updatedDoc = await employeeRef.get();
            if (updatedDoc.exists) {
                 updateDisplayedBadges(updatedDoc.data().keys || []);
                 // Pas besoin de rappeler selectEmployee, juste la liste des badges
            }
            form.reset();
            document.getElementById('caution-amount-group').style.display = 'none'; // Cacher montant
            document.getElementById('badge-number').focus(); // Focus pour ajouter un autre badge?

        }
    } catch (error) {
        console.error("Erreur lors de l'assignation/création:", error);
         showBadgeNotification(`Erreur: ${error.message}`, true);
    } finally {
        // Réactiver le bouton submit dans tous les cas (succès ou erreur)
         form.querySelector('button[type="submit"]').disabled = false;
    }
}

// Fonction déclenchée par le bouton "Créer ce salarié"
function handleCreateNewEmployeeClick() {
    // Récupère le nom DIRECTEMENT depuis le champ de recherche qui a déclenché le prompt
    const searchInputValue = document.getElementById('employee-search').value.trim().toUpperCase();

    if (!searchInputValue) {
        showBadgeNotification("Le Nom saisi dans la recherche est vide. Impossible de créer.", true);
        return;
    }

     let prenom = prompt(`Entrez le Prénom pour ${searchInputValue} :`); // Demande le prénom

     if (prenom === null) return; // Annulé par l'utilisateur
     prenom = prenom.trim();

     if (!prenom) { // Vérifie si le prénom est vide après trim
         showBadgeNotification("Le Prénom est requis pour créer un nouveau salarié.", true);
         return;
     }

    console.log("Préparation création pour:", searchInputValue, prenom);

    // ---- Préparation de l'UI pour l'assignation ----
    // Masquer la liste des résultats et le prompt maintenant qu'on passe à l'assignation
     document.getElementById('search-results').innerHTML = '';
     document.getElementById('new-employee-prompt').style.display = 'none';

    // Afficher la zone principale d'assignation
     showBadgeUISection('selected-employee-zone');

    // Afficher les détails "Nouveau Salarié"
    document.getElementById('selected-employee-details').innerHTML = `<strong>Nouveau Salarié</strong><br><strong>Nom :</strong> ${searchInputValue} <br> <strong>Prénom :</strong> ${prenom}`;
    updateDisplayedBadges([]); // Assure que la liste des badges est vide

    // Pré-remplir les champs cachés pour la création future lors du submit
    document.getElementById('selected-employee-id').value = "__NEW__"; // Marqueur spécial
    document.getElementById('selected-employee-nom').value = searchInputValue;
    document.getElementById('selected-employee-prenom').value = prenom;

    const deleteButton = document.getElementById('delete-employee-btn');
    if (deleteButton) {
        deleteButton.style.display = 'none';
    }
    
     // Préparer le formulaire d'assignation
     const assignForm = document.getElementById('form-assign-badge');
     if(assignForm) assignForm.reset();
     document.getElementById('caution-amount-group').style.display = 'none';
     document.getElementById('badge-number').value = '';
     document.getElementById('badge-number').focus(); // Focus sur le numéro de badge
}

async function handleDeleteEmployeeClick() {
    const employeeId = document.getElementById('selected-employee-id').value;
    const employeeNom = document.getElementById('selected-employee-nom').value || "Inconnu";
    const employeePrenom = document.getElementById('selected-employee-prenom').value || "";
    const deleteButton = document.getElementById('delete-employee-btn');

    // Vérifier si un ID valide est sélectionné (ne pas supprimer "__NEW__")
    if (!employeeId || employeeId === "__NEW__") {
        showBadgeNotification("Aucun salarié existant sélectionné pour la suppression.", true);
        return;
    }

     // Désactiver le bouton pendant l'opération
     if (deleteButton) deleteButton.disabled = true;
     showBadgeNotification("Vérification des informations...", false);


    let cautionDue = false;
    let lastBadgeNumber = null;
    try {
        // Récupérer les données à jour du salarié pour vérifier la caution
        const docRef = db.collection('salaries_test').doc(employeeId);
        const docSnap = await docRef.get();

                if (docSnap.exists) { // <<< Remplacer docSnap.exists() par docSnap.exists
            const data = docSnap.data();

             // Vérifier la structure 'keys' pour une caution
             if (data.keys && Array.isArray(data.keys)) {
                 // Optionnel : Trouver le DERNIER badge avec caution 'R' ? Ou n'importe lequel?
                 // Ici, on cherche si N'IMPORTE QUELLE clé était de type 'R' avec montant
                 for (const keyEntry of data.keys) {
                     if (keyEntry.type === 'R') {
                          const amount = parseFloat(keyEntry.montant); // Vérifier si montant existe et > 0 ?
                          if(!isNaN(amount) && amount > 0){
                                cautionDue = true;
                                // On pourrait stocker keyEntry.keyNumber si besoin
                                break; // On a trouvé une caution, on arrête de chercher
                          }
                     }
                     // Garder une trace du dernier numéro de badge vu
                     lastBadgeNumber = keyEntry.keyNumber || lastBadgeNumber;
                 }
             } else {
                // Si pas de 'keys', vérifier l'ancienne structure (si vous ne l'avez pas migrée)
                if (data["E (echange) R (reglement)"] === 'R') {
                     const amountString = data["Montant réglé"];
                     // Simple vérification pour voir si le montant semble > 0
                      if (amountString && amountString.match(/^[1-9]/)) { // Commence par un chiffre > 0
                         cautionDue = true;
                         lastBadgeNumber = data["Num de Clé"];
                     }
                } else {
                     lastBadgeNumber = data["Num de Clé"];
                }
            }
        } else {
            console.error("Le salarié à supprimer n'a pas été trouvé dans Firestore !");
             showBadgeNotification("Erreur : Salarié introuvable.", true);
              if (deleteButton) deleteButton.disabled = false; // Réactiver
             return;
        }

        // Message de confirmation DYNAMIQUE
        let confirmationMessage = `Êtes-vous sûr de vouloir supprimer ${employeeNom} ${employeePrenom} ?`;
         if(lastBadgeNumber){ // Ajouter le numéro de badge si connu
             confirmationMessage += `\n(Dernier badge connu : ${lastBadgeNumber})`;
         }
        if (cautionDue) {
            confirmationMessage += "\n\n!!! ATTENTION : UNE CAUTION DE 7€ DOIT ÊTRE REMBOURSÉE !!!";
        }

        // Demander confirmation
        if (window.confirm(confirmationMessage)) {
            console.log("Confirmation reçue. Suppression de:", employeeId);
             showBadgeNotification("Suppression en cours...", false);

            // Procéder à la suppression
            await docRef.delete();

            console.log("Salarié supprimé avec succès.");
            showBadgeNotification(`Salarié ${employeeNom} ${employeePrenom} supprimé. ${cautionDue ? 'REMBOURSEMENT CAUTION REQUIS !' : ''}`, false);

            // Réinitialiser l'interface
            document.getElementById('employee-search').value = '';
            document.getElementById('search-results').innerHTML = '';
             document.getElementById('selected-employee-id').value = ''; // Vide l'ID caché
             showBadgeUISection(null); // Cache toutes les sections spécifiques aux badges


        } else {
            console.log("Suppression annulée par l'utilisateur.");
             showBadgeNotification("Suppression annulée.", false);
              if (deleteButton) deleteButton.disabled = false; // Réactiver si annulé
        }

    } catch (error) {
        console.error("Erreur lors de la suppression du salarié:", error);
        showBadgeNotification("Erreur lors de la suppression.", true);
        if (deleteButton) deleteButton.disabled = false; // Réactiver en cas d'erreur
    }
}


// --- Attachement des écouteurs d'événements ---
// (Doit être appelé après le chargement du DOM, par exemple dans DOMContentLoaded)
// --- Attachement des écouteurs d'événements (Corrigé) ---
function setupBadgeEventListeners() {
    console.log(">>> Tentative d'attachement des écouteurs Badge...");

    // Déclarer TOUTES les variables d'éléments AU DÉBUT
    const searchInput = document.getElementById('employee-search');
    const badgeTypeSelect = document.getElementById('badge-type');
    const assignForm = document.getElementById('form-assign-badge');
    const createNewBtn = document.getElementById('create-new-employee-btn');
    const deleteBtn = document.getElementById('delete-employee-btn'); // <<< Déclaration ICI

    console.log("    Element #employee-search trouvé:", searchInput);
    console.log("    Element #badge-type trouvé:", badgeTypeSelect);
    console.log("    Element #form-assign-badge trouvé:", assignForm);
    console.log("    Element #create-new-employee-btn trouvé:", createNewBtn);
    console.log("    Element #delete-employee-btn trouvé:", deleteBtn); // Log après déclaration

    // --- Attacher l'écouteur pour la recherche ---
    if (searchInput) {
        console.log("    Attachement 'input' sur searchInput...");
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const searchTerm = searchInput.value.trim();
            searchTimeout = setTimeout(() => {
                searchEmployeesByName(searchTerm);
            }, 300);
        });
    } else {
        console.error("ERREUR: #employee-search non trouvé !");
    }

    // --- Attacher l'écouteur pour le type de badge ---
    if (badgeTypeSelect) {
         console.log("    Attachement 'change' sur badgeTypeSelect...");
        badgeTypeSelect.addEventListener('change', () => {
            const cautionGroup = document.getElementById('caution-amount-group');
            if (cautionGroup) {
                cautionGroup.style.display = badgeTypeSelect.value === 'R' ? 'block' : 'none';
            }
        });
    } else {
         console.warn("Attention: #badge-type non trouvé lors de l'init.");
    }

    // --- Attacher l'écouteur pour la soumission du formulaire ---
    if (assignForm) {
         console.log("    Attachement 'submit' sur assignForm...");
        assignForm.addEventListener('submit', handleAssignBadgeSubmit);
    } else {
        console.error("ERREUR: #form-assign-badge non trouvé !");
    }

    // --- Attacher l'écouteur pour le bouton Créer ---
     if (createNewBtn) {
          console.log("    Attachement 'click' sur createNewBtn...");
         createNewBtn.addEventListener('click', handleCreateNewEmployeeClick);
     } else {
         console.warn("Attention: #create-new-employee-btn non trouvé lors de l'init.");
     }

    // --- Attacher l'écouteur pour le bouton Supprimer ---
    // Maintenant, on peut utiliser la variable 'deleteBtn' car elle est déclarée plus haut
    if (deleteBtn) {
        console.log("    Attachement 'click' sur deleteBtn...");
        deleteBtn.addEventListener('click', handleDeleteEmployeeClick);
        // Cacher initialement (sera montré par selectEmployee)
         deleteBtn.style.display = 'none';
    } else {
        // Message différent car le bouton n'existe peut-être pas encore au chargement initial
        // (Bien qu'avec l'HTML fixe, il devrait être trouvé)
        console.warn("Attention: Bouton #delete-employee-btn non trouvé via getElementById.");
    }

    console.log("<<< Fin de l'attachement des écouteurs Badge.");
}

// --- Appel initial dans DOMContentLoaded ---
/*
document.addEventListener('DOMContentLoaded', () => {
    // ... autres initialisations ...
    setupBadgeEventListeners();
    // ... reste du code ...
});
*/

// --- SUPPRESSION de l'ancien code (à faire dans ton fichier principal) ---
// function searchEmployee(...) { /* ... SUPPRIMER ... */ }
// function displayEmployee(...) { /* ... SUPPRIMER ... */ }
// function addKeyToEmployee(...) { /* ... SUPPRIMER ... */ }
// function handleBadgeSearch() { /* ... SUPPRIMER ... */ }
// function handleBadgeAddKey(e) { /* ... SUPPRIMER ... */ }
// Supprimer aussi les anciens listeners attachés dans DOMContentLoaded pour cette section

// === MODULE SIGNALEMENTS CAFÉ ===
// Fonction pour calculer et afficher les stats et graphiques
function updateCoffeeStatsAndCharts(data) {
    console.log("Mise à jour des stats et graphiques Café...");
    const statsContainer = document.getElementById('coffee-analytics-area');
    if (!data || data.length === 0) {
        console.log("Aucune donnée café pour les statistiques.");
        // Optionnel : Mettre à zéro ou afficher un message dans les zones de stats/charts
        document.getElementById('stat-total-reports').textContent = '0';
        document.getElementById('stat-reports-en-cours').textContent = '0';
        document.getElementById('stat-reports-traite').textContent = '0';
        // Vider les graphiques s'ils existent
        if (problemChartInstance) problemChartInstance.destroy(); problemChartInstance = null;
        if (machineChartInstance) machineChartInstance.destroy(); machineChartInstance = null;
        if (statusChartInstance) statusChartInstance.destroy(); statusChartInstance = null;
        // Afficher un message dans les conteneurs de graphiques ?
        return;
    }

    // Calculs
    const totalReports = data.length;
    const problemCounts = {};
    const machineCounts = {};
    const statusCounts = { 'en cours': 0, 'traité': 0 };

    data.forEach(report => {
        // Compter les problèmes
        const probleme = report.probleme || "Non spécifié"; // Gérer les cas vides
        problemCounts[probleme] = (problemCounts[probleme] || 0) + 1;

        // Compter les machines
        const machine = report.machine || "Inconnue"; // Gérer les cas vides
        machineCounts[machine] = (machineCounts[machine] || 0) + 1;

        // Compter les statuts
        const normalizedStatus = (report.status || 'en cours').toLowerCase().trim();

        // Incrémenter le compteur correspondant au statut normalisé
        if (statusCounts.hasOwnProperty(normalizedStatus)) {
            statusCounts[normalizedStatus]++;
        } else if (normalizedStatus === '') {
            // Si la chaîne vide doit être comptée comme 'en cours'
            statusCounts['en cours']++;
        } else {
            // Si un autre statut normalisé apparaît (non prévu), on le logue mais on ne le compte pas dans les stats principales
             console.warn(`Statut non prévu rencontré après normalisation: "${normalizedStatus}" pour le rapport ID: ${report.id || 'inconnu'}`);
             // Optionnel : Ajouter une catégorie "autres" si besoin
             // statusCounts['autres'] = (statusCounts['autres'] || 0) + 1;
        }
    });

    // Mise à jour des stats simples
    document.getElementById('stat-total-reports').textContent = totalReports;
    document.getElementById('stat-reports-en-cours').textContent = statusCounts['en cours'] || 0;
    document.getElementById('stat-reports-traite').textContent = statusCounts['traité'] || 0;

    // --- Préparation données pour les graphiques ---

    // Fonction utilitaire pour trier et limiter les données pour les graphiques
    const prepareChartData = (counts, limit = 7) => {
        // Convertit {label: count} en [{label: label, count: count}]
        let sortedData = Object.entries(counts).map(([label, count]) => ({ label, count }));
        // Trie par nombre décroissant
        sortedData.sort((a, b) => b.count - a.count);

        let labels = [];
        let dataValues = [];
        let otherCount = 0;

        if (sortedData.length > limit) {
            labels = sortedData.slice(0, limit).map(item => item.label);
            dataValues = sortedData.slice(0, limit).map(item => item.count);
            // Calcule le total pour "Autres"
            otherCount = sortedData.slice(limit).reduce((sum, item) => sum + item.count, 0);
            if (otherCount > 0) {
                labels.push("Autres");
                dataValues.push(otherCount);
            }
        } else {
            labels = sortedData.map(item => item.label);
            dataValues = sortedData.map(item => item.count);
        }
        return { labels, dataValues };
    };

    // Couleurs (vous pouvez les personnaliser)
    const chartColors = [
        'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
        'rgba(199, 199, 199, 0.6)', 'rgba(83, 102, 255, 0.6)', 'rgba(100, 255, 100, 0.6)'
    ];
     const chartBorderColors = chartColors.map(color => color.replace('0.6', '1')); // Bordures opaques

    // 1. Graphique Problèmes (Barres)

    const defaultFontSize = 7; // Définissez la taille de police souhaitée ici (ex: 10)
    const tooltipFontSize = 11; // Taille pour les infobulles si besoin
    
    const problemChartData = prepareChartData(problemCounts);
    const problemCtx = document.getElementById('problem-chart')?.getContext('2d');
    if (problemCtx) {
        const chartOptions = {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { // <-- AJOUT/MODIFICATION
                            size: defaultFontSize
                        }
                    }
                },
                y: { // Si indexAxis: 'y', c'est l'axe des catégories
                     ticks: {
                        font: { // <-- AJOUT/MODIFICATION
                            size: defaultFontSize
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false }, // Légende désactivée ici
                tooltip: { // Optionnel : ajuster aussi l'infobulle
                    bodyFont: { size: tooltipFontSize },
                    titleFont: { size: tooltipFontSize + 1 } // Titre un peu plus grand
                }
            }
        };

        if (problemChartInstance) { // Mise à jour
            problemChartInstance.data.labels = problemChartData.labels;
            problemChartInstance.data.datasets[0].data = problemChartData.dataValues;
            problemChartInstance.update();
        } else { // Création
            problemChartInstance = new Chart(problemCtx, {
                type: 'bar',
                data: {
                    labels: problemChartData.labels,
                    datasets: [{
                        label: 'Nombre de signalements',
                        data: problemChartData.dataValues,
                        backgroundColor: chartColors,
                        borderColor: chartBorderColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y', // Barres horizontales pour lisibilité
                    scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }, // Commence à 0, pas de décimales
                    plugins: { legend: { display: false } } // Cache la légende
                }
            });
        }
    } else { console.error("Canvas #problem-chart introuvable"); }

    // 2. Graphique Machines (Barres)
    const machineChartData = prepareChartData(machineCounts);
    const machineCtx = document.getElementById('machine-chart')?.getContext('2d');
     if (machineCtx) {
        const chartOptions = {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { // <-- AJOUT/MODIFICATION
                            size: defaultFontSize
                        }
                    }
                },
                y: { // Si indexAxis: 'y', c'est l'axe des catégories
                     ticks: {
                        font: { // <-- AJOUT/MODIFICATION
                            size: defaultFontSize
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false }, // Légende désactivée ici
                tooltip: { // Optionnel : ajuster aussi l'infobulle
                    bodyFont: { size: tooltipFontSize },
                    titleFont: { size: tooltipFontSize + 1 } // Titre un peu plus grand
                }
            }
        };
        if (machineChartInstance) { // Mise à jour
            machineChartInstance.data.labels = machineChartData.labels;
            machineChartInstance.data.datasets[0].data = machineChartData.dataValues;
            machineChartInstance.update();
        } else { // Création
            machineChartInstance = new Chart(machineCtx, {
                type: 'bar',
                data: {
                    labels: machineChartData.labels,
                    datasets: [{
                        label: 'Nombre de signalements',
                        data: machineChartData.dataValues,
                        backgroundColor: chartColors.slice(1).concat(chartColors[0]), // Décale les couleurs
                        borderColor: chartBorderColors.slice(1).concat(chartBorderColors[0]),
                        borderWidth: 1
                    }]
                },
                 options: {
                    responsive: true, maintainAspectRatio: false, // Barres verticales ici
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                    plugins: { legend: { display: false } }
                }
            });
        }
    } else { console.error("Canvas #machine-chart introuvable"); }

    // 3. Graphique Statuts (Camembert)
    const statusLabels = Object.keys(statusCounts);
    const statusDataValues = Object.values(statusCounts);
    // Couleurs spécifiques pour le statut
    const statusColors = [
        statusLabels.includes('en cours') ? 'rgba(255, 159, 64, 0.7)' : null, // Orange pour 'en cours'
        statusLabels.includes('traité') ? 'rgba(75, 192, 192, 0.7)' : null,    // Vert/Cyan pour 'traité'
        // Ajouter d'autres couleurs si d'autres statuts apparaissent
    ].filter(c => c !== null); // Filtre les couleurs nulles
    const statusBorderColors = statusColors.map(color => color.replace('0.7', '1'));

    const statusCtx = document.getElementById('status-chart')?.getContext('2d');
    if (statusCtx) {
        const chartOptions = {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { // <-- AJOUT/MODIFICATION
                            size: defaultFontSize
                        }
                    }
                },
                y: { // Si indexAxis: 'y', c'est l'axe des catégories
                     ticks: {
                        font: { // <-- AJOUT/MODIFICATION
                            size: defaultFontSize
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false }, // Légende désactivée ici
                tooltip: { // Optionnel : ajuster aussi l'infobulle
                    bodyFont: { size: tooltipFontSize },
                    titleFont: { size: tooltipFontSize + 1 } // Titre un peu plus grand
                }
            }
        };
        if (statusChartInstance) { // Mise à jour
            statusChartInstance.data.labels = statusLabels;
            statusChartInstance.data.datasets[0].data = statusDataValues;
            statusChartInstance.data.datasets[0].backgroundColor = statusColors;
             statusChartInstance.data.datasets[0].borderColor = statusBorderColors;
            statusChartInstance.update();
        } else { // Création
            statusChartInstance = new Chart(statusCtx, {
                type: 'pie',
                data: {
                    labels: statusLabels,
                    datasets: [{
                        data: statusDataValues,
                        backgroundColor: statusColors,
                        borderColor: statusBorderColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } } // Légende en bas
                }
            });
        }
    } else { console.error("Canvas #status-chart introuvable"); }

     console.log("Stats et graphiques Café mis à jour.");
}



// Initialise la table Tabulator pour les signalements café
function initializeCoffeeTable() {
    const tableContainer = document.getElementById('coffee-table-container');
    if (!tableContainer) {
        console.error("Le conteneur #coffee-table-container n'a pas été trouvé !");
        return;
    }
    // Évite la réinitialisation si déjà créée (important)
    if (coffeeTable) {
        console.log("La table Café existe déjà. Pas de ré-initialisation.");
        return;
    }

    console.log("Initialisation de la table Tabulator Café (Version Stable)...");
    // Log pour voir les données juste avant l'init (devrait être [] la première fois)
    console.log("Données AVANT initialisation Tabulator:", JSON.stringify(coffeeData.slice(0,1)));

    // Définition des colonnes (version stable avec corrections champs et éditeur select)
    const columns = [
        {
            title: "Date", field: "importTimestamp", // Ou 'timestamp' si c'est ce que vous utilisez
            width: 150, hozAlign: "left", sorter: "datetime",
            sorterParams: { format: "iso" },
            formatter: function(cell) {
                const ts = cell.getValue();
                if (ts && typeof ts.toDate === 'function') {
                    try {
                        return ts.toDate().toLocaleString('fr-FR', { day: 'numeric', month: 'numeric', year:'numeric', hour: '2-digit', minute: '2-digit' });
                    } catch (e) { console.error(`Date Formatter Error:`, e, ts); return "Date invalide"; }
                }
                return "?";
            }
        },
        {
             title: "Téléphone", field: "telephone", // Nouveau champ
             width: 130, headerFilter: "input",
             formatter: function(cell){ return cell.getValue() || "N/A"; }
         },
        { title: "Machine", field: "machine", width: 150, headerFilter: "input" },
        { title: "Problème", field: "probleme", minWidth: 200, headerTooltip:true, formatter: "textarea", headerFilter: "input" },
        { title: "Par", field: "nom", width: 150, headerFilter: "input" },
        { title: "Email", field: "email", width: 180, formatter: "link", formatterParams: { urlPrefix: "mailto:" }, headerTooltip:true, headerFilter: "input" },
        { title: "Opération", field: "operation", width: 100, headerFilter: "input" },
        {
             title: "Date Évén.", field: "dateEvenementRaw", // Utiliser ce champ
             width: 100, hozAlign: "center", sorter: "date", sorterParams: { format: "YYYY-MM-DD" },
             formatter: function(cell){ return cell.getValue() || "-"; }
         },
         {
             title: "Heure Évén.", field: "heureEvenementRaw", // Utiliser ce champ
             width: 90, hozAlign: "center", sorter: "time", sorterParams: { format: "HH:mm" },
             formatter: function(cell){ return cell.getValue() || "-"; }
         },
         // --- NOUVEAU : Moyen de Paiement ---
         {
             title: "Paiement", field: "paiement", // Utiliser ce champ
             width: 100, headerFilter: "input",
             formatter: function(cell){ return cell.getValue() || "N/A"; }
         },
        { title: "Commentaire", field: "commentaire", minWidth: 150, formatter: "textarea", headerTooltip:true, headerFilter: "input" },
        {
            title: "Statut", field: "status", width: 120, hozAlign: "center",
            // Filtre simple (list est ok, mais on peut revenir à select si doute)
            headerFilter: "select", headerFilterParams: {values: {"": "Tous", "en cours": "En cours", "traité": "Traité"}},
            // Éditeur 'select' qui fonctionnait
            editor: "select",
            editorParams: { values: { "en cours": "En cours", "traité": "Traité" } },
            formatter: function(cell) { // Formateur visuel (ne devrait pas poser problème)
                 const value = cell.getValue() || "en cours";
                const isTraite = value === 'traité';
                const color = isTraite ? 'var(--accent-couleur-1)' : 'var(--accent-couleur-2)';
                const text = isTraite ? 'Traité' : 'En cours';
                const icon = isTraite ? 'fa-check-circle' : 'fa-exclamation-circle';
                return `<span style="color: ${color}; font-weight: bold;"><i class="fas ${icon}" style="margin-right: 5px;"></i>${text}</span>`;
            },
            cellEdited: function(cell) { // Callback mise à jour statut
                 const id = cell.getRow().getData().id;
                 const newStatus = cell.getValue();
                 updateStatus('coffee', id, newStatus);
            }
        },
        {
            title: "Action", field: "id", hozAlign: "center", width: 80, headerSort: false,
            formatter: function(cell) { // Bouton Supprimer
                const id = cell.getValue();
                const button = document.createElement("button");
                button.classList.add("btn-action", "delete");
                button.setAttribute("title", "Supprimer ce signalement");
                button.innerHTML = '<i class="fas fa-trash"></i>';
                button.style.padding = "5px";
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteCoffeeReport(id); // Fonction de suppression existante
                });
                return button;
            }
        }
    ];

    // Tentative d'initialisation de Tabulator
    try {
        coffeeTable = new Tabulator(tableContainer, {
            // *** Passer une COPIE des données actuelles ***
            data: [...coffeeData],
            columns: columns, // Utilise les colonnes définies ci-dessus
            layout: "fitColumns",
            pagination: "local",
            paginationSize: 10,
            paginationSizeSelector: [5, 10, 20, 50, 100],
            paginationCounter: "rows",
            placeholder: "Aucun signalement café à afficher", // Message si vide
            movableColumns: true,
            locale: "fr-fr",
            langs:{ // Traduction pagination
                "fr-fr":{
                    "pagination":{
                        "page_size":"Taille page", // etc...
                        "first":"Premier", "last":"Dernier", "prev":"Précédent", "next":"Suivant",
                         "counter":{ "showing": "Affichage", "of": "de", "rows": "lignes", "pages": "pages" }
                    },
                     "headerFilters":{ "default":"filtrer..." }
                }
            },
            // Optionnel : désactiver des fonctionnalités si le doute persiste
            // responsiveLayout: "hide", // Alternative au layout standard si problème de taille
            // history: false, // Désactiver l'historique
        });

        console.log("Table Tabulator Café initialisée (Version Stable) avec", coffeeData.length, "lignes initiales.");

        // Log pour vérifier le rendu après un court délai
         setTimeout(() => {
             if (coffeeTable) {
                 const rowCount = coffeeTable.getRows().length;
                 console.log(`Nombre de lignes dans Tabulator après init/render (Stable): ${rowCount}`);
                 if (rowCount === 0 && coffeeData.length > 0) {
                     console.warn("(Stable) Tabulator affiche 0 ligne alors que coffeeData en contient.");
                 }
             }
         }, 100);

    } catch (error) {
        // Afficher l'erreur spécifique qui a causé l'échec de 'new Tabulator'
        console.error("ERREUR CRITIQUE lors de l'initialisation de Tabulator (Version Stable):", error);
        showNotification("Erreur critique lors de la création du tableau.", true);
        if (tableContainer) tableContainer.innerHTML = "<p style='color: red; padding: 20px;'>Erreur initialisation tableau.</p>";
        coffeeTable = null; // Assurer que la variable est nulle
    }
}

// === MODULE SIGNALEMENTS CAFÉ ===

// ... (updateCoffeeStatsAndCharts reste ici) ...
// ... (initializeCoffeeTable reste ici, mais pensez à corriger le 'select' editor comme indiqué plus bas) ...

// Fonction d'initialisation pour la table des rechargements (VERSION CORRIGÉE)
function initializeRechargeTable(initialData = [])  {
    const tableContainer = document.getElementById('recharge-table-container');
    if (!tableContainer) {
        console.error("Le conteneur #recharge-table-container n'a pas été trouvé !");
        return;
    }
    if (rechargeTable) {
        console.log("La table Rechargement existe déjà. Pas de ré-initialisation.");
        return;
    }

    console.log("Initialisation de la table Tabulator Rechargement (Colonnes Corrigées)...");

    // Définition des colonnes AVEC LES BONS CHAMPS
    const columns = [
        {
            title: "Date Événement", field: "dateEvenementRaw", // <-- Utiliser le bon champ
            width: 130, hozAlign: "left", sorter: "date", // Tri basique sur date
            sorterParams: { format: "YYYY-MM-DD" }, // Ajustez si format différent
             formatter: function(cell){ return cell.getValue() || "?"; } // Affichage simple
        },
         {
            title: "Heure Événement", field: "heureEvenementRaw", // <-- Utiliser le bon champ
            width: 130, hozAlign: "left", sorter: "time", // Tri basique sur heure
            sorterParams: { format: "HH:mm" }, // Ajustez si format différent
             formatter: function(cell){ return cell.getValue() || "?"; } // Affichage simple
        },
        {
             title: "Téléphone", field: "telephone",
             width: 130,
             formatter: function(cell){ return cell.getValue() || "N/A"; }
             // Optionnel : headerFilter: "input"
         },
        { title: "Nom", field: "nom", minWidth: 120, headerFilter: "input" },
        {
             title: "Email", field: "email", // <-- Utiliser 'email' (commun dans forms) ou 'mail' si c'est ça dans Firestore
             minWidth: 150, formatter: "link", formatterParams: { urlPrefix: "mailto:" }, headerFilter: "input"
        },
        { title: "Machine", field: "machine", width: 120, headerFilter: "input" },
        {
            title: "Paiement via...", field: "paiement", // <-- Vérifiez ce nom dans Firestore
            width: 130,
            headerFilter: "input",
            formatter: function(cell) { return cell.getValue() || "N/A"; }
        },
        { title: "Détails", field: "commentaire", minWidth: 150, formatter: "textarea", headerTooltip:true },
    ];

    try {
        rechargeTable = new Tabulator(tableContainer, {
            data: initialData,
            columns: columns, // Utilise les colonnes corrigées
            layout: "fitDataFill",
            pagination: "local",
            paginationSize: 5,
            paginationSizeSelector: [5, 10, 20],
            placeholder: "Aucun problème de rechargement en cours", // Message si vide
            movableColumns: true,
            locale: "fr-fr",
            langs:{ "fr-fr":{ /* ... copier les traductions si besoin ... */ }}
        });
        console.log("Table Tabulator Rechargement initialisée (Colonnes Corrigées).");

    } catch (error) {
        console.error("ERREUR lors de l'initialisation de Tabulator (Rechargement):", error);
        showNotification("Erreur initialisation table Rechargements.", true);
        if (tableContainer) tableContainer.innerHTML = "<p style='color: red; padding: 10px;'>Erreur init. table.</p>";
        rechargeTable = null;
    }
}

// Rappel : Assurez-vous que la fonction loadCoffeeReports
// appelle bien coffeeTable.setData([...coffeeData]) lorsque les données
// arrivent et que coffeeTable existe déjà.

// Exemple simplifié de loadCoffeeReports (gardez les logs onSnapshot) :
// Dans la fonction loadCoffeeReports()
function loadCoffeeReports() {
    db.collection('coffee').orderBy('importTimestamp', 'desc').onSnapshot(snapshot => { // Remis orderBy
        console.log("Coffee onSnapshot: Reçu", snapshot.size, "documents.");
        coffeeData = snapshot.docs.map(doc => {
            const data = doc.data();
            // Assurez-vous que le timestamp est bien un objet Timestamp Firestore
            // Si ce n'est pas le cas, essayez de le convertir ou ajustez le tri/formatage
            return { id: doc.id, ...data };
        });
        console.log("Coffee onSnapshot: coffeeData mis à jour (", coffeeData.length, "lignes).");

        // --- MISE À JOUR DES DEUX TABLES ---

        // 1. Filtrer les données pour la table des rechargements/paiements EN COURS
            console.log("Début du filtrage pour rechargeTable (Filtre Statut Robuste)...");
const rechargeReports = coffeeData.filter(report => {

    // 1. Vérification du Statut (Plus robuste)
    // Prend la valeur du champ 'status', lui donne 'en cours' par défaut si null/undefined,
    // le met en minuscule, et enlève les espaces avant/après.
    const currentStatus = (report.status || 'en cours').toLowerCase().trim();
    // Considère comme 'en cours' si le résultat est 'en cours' ou une chaîne vide.
    const statusIsInProgress = currentStatus === 'en cours' || currentStatus === '';

    // 2. Vérification du Problème (Mots-clés)
    const problemeText = report.probleme || '';
    const problemeLower = problemeText.toLowerCase();
    // Mots-clés à rechercher (vérifiez qu'ils sont corrects)
    const isRechargeIssue = problemeLower.includes('rechargement') ||
                            problemeLower.includes('paiement') ||
                            problemeLower.includes('badge');

    // Log détaillé pour débogage (ESSENTIEL)
    console.log(`  [Check Filter] ID: ${report.id}, Probleme: "${problemeText}", Status Brut: "${report.status}", Status Traité: "${currentStatus}", isRecharge: ${isRechargeIssue}, isInProgress: ${statusIsInProgress} -> Inclure: ${statusIsInProgress && isRechargeIssue}`);

    // 3. Retourner le résultat du filtre
    return statusIsInProgress && isRechargeIssue;
});
console.log(`FIN Filtrage: ${rechargeReports.length} rapports trouvés pour la table Rechargement.`);

// Log pour voir un exemple de rapport filtré (SI il y en a)
if (rechargeReports.length > 0) {
    console.log("Exemple de rapport filtré pour rechargeTable (Statut Robuste):", JSON.stringify(rechargeReports[0]));
} else {
    console.log("Aucun rapport n'a passé le filtre pour rechargeTable.");
    // Si vous savez qu'il devrait y en avoir, vérifiez les logs "[Check Filter]" ci-dessus
    // et comparez avec les données réelles dans Firestore (surtout 'probleme' et 'status').
}
// --- FIN FILTRAGE ---

// --- MISE À JOUR DES TABLES ---
// Mettre à jour la table principale (TOUTES les données)
if (coffeeTable) {
    coffeeTable.setData([...coffeeData])
        .catch(err => { console.error("Coffee onSnapshot: ERREUR coffeeTable.setData:", err); });
}

// Mettre à jour la table des rechargements (DONNÉES FILTRÉES)
if (rechargeTable) {
    rechargeTable.setData([...rechargeReports]) // Utilise les données filtrées !
        .catch(err => { console.error("Coffee onSnapshot: ERREUR rechargeTable.setData:", err); });
}
// --- FIN MISE À JOUR TABLES ---

        // 4. Mettre à jour les stats et graphiques (basés sur TOUTES les données)
        updateCoffeeStatsAndCharts(coffeeData);

    }, error => {
        console.error("Erreur Firestore onSnapshot (Coffee):", error);
        showNotification("Erreur chargement signalements café.", true);
        updateCoffeeStatsAndCharts([]); // Vider stats/charts en cas d'erreur
        if (coffeeTable) coffeeTable.setData([]).catch(e => console.error(e)); // Vider tables aussi
        if (rechargeTable) rechargeTable.setData([]).catch(e => console.error(e));
    });
}


// --- FIN Modifications ---
/*function updateCoffeeList() {
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
}*/
function deleteCoffeeReport(id) { if (!confirm("Effacer ce signalement ?")) return; db.collection('coffee').doc(id).delete().then(()=>showNotification("Signalement effacé.")).catch(err=>{console.error(err); showNotification("Erreur suppression", true);}); }

// === MODULE SYNTHESE ===
function loadSyntheseData() {
    // 1. Définition couleurs et styles (Assurez-vous qu'elles sont définies dans votre CSS)
    const rootStyles = getComputedStyle(document.documentElement);
    const encreTexteColor = rootStyles.getPropertyValue('--encre-texte')?.trim() || '#4a4a4a';
    // Couleurs fonds (avec opacité B3 = ~70%)
    const postitBleu = (rootStyles.getPropertyValue('--postit-bleu')?.trim() || '#d3f1ff') + 'B3';
    const postitRose = (rootStyles.getPropertyValue('--postit-rose')?.trim() || '#ffe4e1') + 'B3';
    const postitVert = (rootStyles.getPropertyValue('--masking-tape-vert')?.trim() || '#cff0cc') + 'B3';
    const postitPeche = (rootStyles.getPropertyValue('--accent-couleur-2')?.trim() || '#ffb347') + 'B3';
    const postitPrune = '#dda0ddB3';
    const postitOrange = '#ffddb3B3'; // Pour Badges
    const postitGris = '#e0e0e0B3';   // Pour Cautions
    // Couleurs bordures (opaques)
    const borderBleu = '#87CEEB';
    const borderRose = '#FFB6C1';
    const borderVert = '#90EE90';
    const borderPeche = '#FFDAB9';
    const borderPrune = '#DDA0DD';
    const borderOrange = '#FFC899';
    const borderGris = '#BEBEBE';

    console.log("Synthèse: Début loadSyntheseData (Gère structures badge HÉTÉROGÈNES).");

    // 2. Récupération des données via Promise.all
    Promise.all([
        db.collection('news').get(),           // Index 0: Actus
        db.collection('membres').get(),        // Index 1: Membres
        db.collection('partenaires').get(),    // Index 2: Partenaires
        db.collection('contact').where('status', '==', 'en cours').get(), // Index 3: Contacts Actifs
        db.collection('salaries_test').get(),   // Index 4: Salariés
        db.collection('analytics').doc('globalCounts').get() // Index 5: Analytics
    ]).then((snapshots) => {
        console.log("Synthèse: Toutes les données Firebase récupérées.");

        // 3. Extraction des snapshots
        const newsSnapshot = snapshots[0];
        const membersSnapshot = snapshots[1];
        const partnersSnapshot = snapshots[2];
        const contactsSnapshot = snapshots[3];
        const salariesSnapshot = snapshots[4]; // Snapshot des salariés
        const analyticsSnapshot = snapshots[5]; 

        // 4. Calcul Pannes Café 'en cours' (depuis variable globale)
        let activeCoffeeCount = 0;
        if (coffeeData && coffeeData.length > 0) {
            coffeeData.forEach(report => {
                const currentStatus = (report.status || 'en cours').toLowerCase().trim();
                if (currentStatus === 'en cours' || currentStatus === '') {
                    activeCoffeeCount++;
                }
            });
        }
        console.log(`Synthèse - Pannes café actives : ${activeCoffeeCount}`);

        // 5. <<< CALCUL HYBRIDE Badges/Cautions (gère 'keys' ET anciens champs) >>>
        let totalBadgesCount = 0;
        let totalCautionAmount = 0.0;

        if (salariesSnapshot && !salariesSnapshot.empty) {
            salariesSnapshot.docs.forEach(doc => {
                const salaryData = doc.data();
                let badgeFoundForThisUser = false; // Pour éviter double comptage

                // --- Priorité 1: Vérifier la structure 'keys' ---
                if (salaryData.keys && Array.isArray(salaryData.keys) && salaryData.keys.length > 0) {
                    badgeFoundForThisUser = true;
                    totalBadgesCount += salaryData.keys.length; // Compte tous les badges dans le tableau

                    // Calculer cautions depuis le tableau 'keys'
                    salaryData.keys.forEach(keyEntry => {
                        if (keyEntry.type === 'R') {
                             if (typeof keyEntry.montant === 'number' && !isNaN(keyEntry.montant)) {
                                 totalCautionAmount += keyEntry.montant;
                             } else {
                                 // Tenter de parser si ce n'est pas un nombre (au cas où une vieille donnée serait mal migrée)
                                 const amount = parseFloat(keyEntry.montant);
                                 if(!isNaN(amount)){
                                    totalCautionAmount += amount;
                                     console.warn(`(keys) Montant caution (type 'R') interprété comme nombre depuis autre type pour salarié ID: ${doc.id}`, keyEntry);
                                 } else {
                                      console.warn(`(keys) Montant invalide/manquant pour caution (type 'R') dans 'keys' du salarié ID: ${doc.id}`, keyEntry);
                                 }
                             }
                         }
                    });
                     console.log(`   -> Salarié ${doc.id}: Trouvé ${salaryData.keys.length} badge(s) via 'keys'.`);
                }

                // --- Priorité 2: Si pas de 'keys', vérifier l'ANCIENNE structure ---
                // Vérifie '!badgeFoundForThisUser' pour éviter double comptage
                else if (!badgeFoundForThisUser) {
                    // Vérifier l'ancien champ "Num de Clé"
                    const oldKeyNum = salaryData["Num de Clé"]; // Utiliser notation crochet
                    if (oldKeyNum && String(oldKeyNum).trim() !== "") {
                        totalBadgesCount++; // Compte 1 badge trouvé via l'ancienne structure
                        badgeFoundForThisUser = true; // Marquer comme trouvé

                        console.log(`   -> Salarié ${doc.id}: Trouvé 1 badge via ancien champ 'Num de Clé'.`);

                        // Vérifier si c'était une caution dans l'ancienne structure
                        const oldType = salaryData["E (echange) R (reglement)"];
                        if (oldType === 'R') {
                            const amountString = salaryData["Montant réglé"];
                            if (amountString && typeof amountString === 'string') {
                                const numericMatch = amountString.match(/^[\d.,]+/); // Extrait début numérique
                                if (numericMatch && numericMatch[0]) {
                                    const numericValueString = numericMatch[0].replace(',', '.'); // Virgule -> Point
                                    const amount = parseFloat(numericValueString);
                                    if (!isNaN(amount)) {
                                        totalCautionAmount += amount;
                                        console.log(`      -> Ancien badge était type 'R', caution ${amount}€ ajoutée.`);
                                    } else {
                                        console.warn(`(Ancien) Montant caution "${amountString}" non parseable ID: ${doc.id}`);
                                    }
                                } else {
                                    console.warn(`(Ancien) Format montant caution "${amountString}" non reconnu ID: ${doc.id}`);
                                }
                            } else {
                                console.warn(`(Ancien) Montant caution manquant/incorrect ID: ${doc.id} (type R)`);
                            }
                        }
                    }
                }

                // Si, après les deux vérifications, on n'a rien trouvé pour cet utilisateur
                if (!badgeFoundForThisUser) {
                     console.log(`   -> Salarié ${doc.id}: Aucune info badge valide trouvée (ni 'keys' ni 'Num de Clé').`);
                }
            });
        } else {
            console.log("Synthèse - Collection salariés vide ou non chargée.");
        }

        // Arrondir le total à 2 décimales
        totalCautionAmount = parseFloat(totalCautionAmount.toFixed(2));
        console.log(`Synthèse - TOTAL Badges distribués (hybride): ${totalBadgesCount}`);
        console.log(`Synthèse - TOTAL Cautions (€) (hybride): ${totalCautionAmount}`);

        // 5bis. <<< EXTRACTION DES COMPTES ANALYTICS >>> (NOUVEAU BLOC)
    let totalViews = 0;
    let totalInstalls = 0;
    if (analyticsSnapshot.exists) {
        const analyticsData = analyticsSnapshot.data();
        totalViews = analyticsData.totalViews || 0; // Prend la valeur ou 0 si non défini
        totalInstalls = analyticsData.totalInstalls || 0;
    } else {
        // Le document n'existe peut-être pas encore, ce n'est pas forcément une erreur
        console.warn("Synthèse: Document 'globalCounts' (ou nom similaire) introuvable dans la collection 'analytics'. Les compteurs Vues/Installs seront à 0.");
    }
     console.log(`Synthèse - Vues récupérées: ${totalViews}, Installations récupérées: ${totalInstalls}`);
        
        // 6. Consolidation des Comptes
        const counts = {
            news: newsSnapshot.size,
            members: membersSnapshot.size,
            partners: partnersSnapshot.size,
            contacts: contactsSnapshot.size,
            coffee: activeCoffeeCount,
            totalBadges: totalBadgesCount,
            cautionAmount: totalCautionAmount,
            views: totalViews,  
            installs: totalInstalls 
        };
        console.log("Synthèse - Counts finaux pour affichage:", JSON.stringify(counts));

        // 7. Configuration des Cartes de Synthèse
    const postitViolet = (rootStyles.getPropertyValue('--postit-violet')?.trim() || '#e6e0f8') + 'B3'; // Exemple: Violet clair
    const postitTurquoise = (rootStyles.getPropertyValue('--postit-turquoise')?.trim() || '#cceeee') + 'B3'; // Exemple: Turquoise clair
    const borderViolet = rootStyles.getPropertyValue('--border-violet')?.trim() || '#b3a6d9';
    const borderTurquoise = rootStyles.getPropertyValue('--border-turquoise')?.trim() || '#99cccc';

        const synthData = [
            { title: 'Actus', countKey: 'news', color: postitBleu, borderColor: borderBleu },
            { title: 'Membres', countKey: 'members', color: postitRose, borderColor: borderRose },
            { title: 'Partenaires', countKey: 'partners', color: postitVert, borderColor: borderVert },
            { title: 'Contacts <small>(act.)</small>', countKey: 'contacts', color: postitPeche, borderColor: borderPeche },
            { title: 'Pannes Café <small>(act.)</small>', countKey: 'coffee', color: postitPrune, borderColor: borderPrune },
            { title: 'Badges Dist.', countKey: 'totalBadges', color: postitOrange, borderColor: borderOrange },
            { title: 'Total Cautions', countKey: 'cautionAmount', unit: '€', color: postitGris, borderColor: borderGris },
            { title: 'Vues App', countKey: 'views', color: postitViolet, borderColor: borderViolet },
        { title: 'Installs PWA', countKey: 'installs', color: postitTurquoise, borderColor: borderTurquoise }
        ];

        // 8. Génération des Cartes dans le DOM
        const synthContainer = document.getElementById('synthese-container');
        if (!synthContainer) {
            console.error("Synthèse: Conteneur 'synthese-container' INTROUVABLE.");
            return;
        }
        synthContainer.innerHTML = ''; // Vider
        synthData.forEach(data => {
            const countValue = counts[data.countKey];
            const displayValue = countValue !== undefined ? countValue : '?';
            const unit = data.unit || '';
            const item = document.createElement('div');
            item.classList.add('synth-card');
            item.style.backgroundColor = data.color.slice(0, -2); // Couleur sans opacité pour fond
            item.innerHTML = `<h3>${data.title}</h3><p>${displayValue}${unit}</p>`;
            synthContainer.appendChild(item);
        });
        applyRandomRotation('#section-synthese .synth-card'); // Rotation
        console.log("Synthèse: Cartes DOM générées.");

        // 9. Mise à jour du Graphique Doughnut
        const ctx = document.getElementById('synth-chart')?.getContext('2d');
        if (!ctx) {
            console.warn("Synthèse: Canvas 'synth-chart' introuvable.");
            return; // Ne pas continuer si pas de canvas
        }

        const chartLabels = synthData.map(d => d.title.replace(/<small>.*?<\/small>/g, '').trim());
        const chartCounts = synthData.map(d => counts[d.countKey] !== undefined ? counts[d.countKey] : 0);
        const chartBackgroundColors = synthData.map(d => d.color); // Utilise couleurs définies (avec opacité)
        const chartBorderColors = synthData.map(d => d.borderColor);

        const chartConfigData = {
            labels: chartLabels,
            datasets: [{
                label: 'Quantité/Montant',
                data: chartCounts,
                backgroundColor: chartBackgroundColors,
                borderColor: chartBorderColors,
                borderWidth: 1.5
            }]
        };

        const chartOptions = { // Options améliorées
             responsive: true,
             maintainAspectRatio: true,
             plugins: {
                 legend: { position: 'bottom', labels: { font: { family: "'Patrick Hand', cursive", size: 10 }, color: encreTexteColor, padding: 10 } },
                 tooltip: {
                     bodyFont: { family: "'Roboto', sans-serif", size: 11 },
                     titleFont: { family: "'Patrick Hand', cursive", size: 12 },
                     backgroundColor: 'rgba(74, 74, 74, 0.85)',
                     titleColor: '#ffffff', bodyColor: '#ffffff', padding: 10, cornerRadius: 3,
                     callbacks: {
                         label: function(context) {
                             let label = context.dataset.label || '';
                             if (label) { label += ': '; }
                             let value = context.parsed || 0;
                             const sourceData = synthData[context.dataIndex];
                             if (sourceData && sourceData.unit) { label += value + ' ' + sourceData.unit; } else { label += value; }
                             return label;
                         }
                     }
                 }
             }
         };

        // Mettre à jour ou créer le graphique
        if (mySynthChart && mySynthChart.ctx) { // Vérifie si le contexte existe toujours (évite erreurs rares)
             try {
                mySynthChart.data = chartConfigData;
                mySynthChart.options = chartOptions;
                mySynthChart.update();
                console.log("Synthèse: Graphique existant mis à jour.");
            } catch (chartError){
                 console.error("Erreur mise à jour Chart.js:", chartError);
                  mySynthChart.destroy(); // Détruire si erreur pour forcer recréation
                  mySynthChart = null;
                 // Tenter recréation
                 mySynthChart = new Chart(ctx, { type: 'doughnut', data: chartConfigData, options: chartOptions });
                 console.log("Synthèse: Graphique recréé après erreur de mise à jour.");
             }
        } else {
             if (mySynthChart){ // Si variable existe mais contexte perdu
                 mySynthChart.destroy();
                 mySynthChart = null;
             }
            mySynthChart = new Chart(ctx, { type: 'doughnut', data: chartConfigData, options: chartOptions });
            console.log("Synthèse: Nouveau graphique créé.");
        }

        console.log("Synthèse: Mise à jour DOM/Graphique terminée.");

    }).catch(error => {
        console.error("Synthèse: Erreur critique pendant récupération ou traitement:", error);
        const synthContainer = document.getElementById('synthese-container');
        if (synthContainer) {
             synthContainer.innerHTML = '<p class="error-message" style="color: red; text-align: center;">Erreur chargement synthèse.</p>';
        }
    });

    console.log("Synthèse: Fin de loadSyntheseData (appel asynchrone lancé).");
}

// --- INITIALISATION ---








// --- INITIALISATION PRINCIPALE (DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM prêt. Mise en place de l'initialisation de base et de l'observateur d'authentification.");

    // --- 1. Fonctions d'aide pour l'initialisation des listeners ---
    // (Ces fonctions regroupent les attachements de listeners qui doivent être prêts immédiatement)

    /**
     * Attache les listeners pour la fermeture des modales (bouton 'X' et clic extérieur).
     */
    function initializeModalListeners() {
        console.log(" -> Initialisation des listeners de modales...");
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.getAttribute('data-modal');
                const modalElement = document.getElementById(modalId);
                if (modalElement) {
                    modalElement.style.display = 'none';
                    // La fonction resetModalForms est définie ailleurs dans le script
                    resetModalForms(modalElement);
                }
            });
        });

        window.onclick = function (event) {
            modals.forEach(modal => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                     // La fonction resetModalForms est définie ailleurs dans le script
                    resetModalForms(modal);
                }
            });
        };
    }

    /**
     * Attache les listeners aux éléments du menu de navigation principal.
     * La logique détaillée de changement de section est dans la fonction appelée par le listener.
     */
    function initializeNavigationListeners() {
        console.log(" -> Initialisation des listeners de navigation principale...");
        // La logique de clic est maintenant encapsulée dans la définition de la fonction
        // initializeNavigationListeners DANS la portée globale ou une section dédiée "NAVIGATION".
        // Assurez-vous que la fonction qui contient la boucle menuItems.forEach(...)
        // est bien définie et appelée ici si elle n'est pas globale.
        // Si elle est globale, l'appel ici n'est pas nécessaire car elle est déjà définie.
        // MAIS, si elle est définie comme une fonction locale, elle doit être appelée :
        // Exemple :
        // if (typeof setupMenuNavigation === 'function') { // Vérifie si la fonction existe
        //     setupMenuNavigation(); // Appelle la fonction qui attache les listeners aux menuItems
        // } else {
        //     console.error("La fonction pour initialiser la navigation du menu est introuvable !");
        // }
        // --- Pour cet exemple, nous supposons que la fonction initializeNavigationListeners
        // --- (contenant la boucle menuItems.forEach) est définie globalement ---
        // (Si elle est définie ailleurs, décommentez et adaptez le bloc 'if' ci-dessus)

        // ---> Appel Direct de la fonction qui boucle sur menuItems <---
        // (Assurez-vous que cette fonction est bien définie globalement ou importée si modules)
        if (typeof initializePrimaryNavigation === 'function') {
             initializePrimaryNavigation(); // Nom suggéré pour la fonction qui boucle sur menuItems
        } else {
             console.warn("Fonction initializePrimaryNavigation non trouvée, en attente d'une définition globale ou d'une refactorisation.")
             // Fallback: Recopier la boucle ici si elle n'est pas dans une fonction séparée
             /*
             menuItems.forEach(item => {
                 item.addEventListener('click', handleMenuItemClick); // handleMenuItemClick serait la fonction contenant toute la logique de clic
             });
             */
        }


    }

    // --- 2. Attacher les Listeners Essentiels ---

    // a) Boutons de Connexion / Déconnexion
    console.log(" -> Attachement des listeners d'authentification...");
    if (signInButton) {
        signInButton.addEventListener('click', handleGoogleSignIn);
    } else {
        console.error("ERREUR: Bouton de connexion Google (#google-signin-btn) non trouvé !");
    }
    if (signOutButton) {
        // Ce bouton est dans #app-container, mais le listener doit être prêt
        signOutButton.addEventListener('click', handleSignOut);
    } else {
        // C'est normal si l'app n'est pas encore affichée, mais le bouton DOIT exister dans le HTML
        console.warn("Bouton de déconnexion (#google-signout-btn) non trouvé au chargement. S'assurer qu'il existe dans #app-container.");
    }

    // b) Fermeture des Modales
    initializeModalListeners();

    // c) Navigation Principale (Menu)
    // Assurez-vous que la fonction initializeNavigationListeners ci-dessus
    // appelle bien la fonction qui contient la boucle menuItems.forEach OU
    // que cette boucle est directement appelée ici.
    // (La fonction handleMenuItemClick qui contient la logique de navigation est définie ailleurs)
    initializeNavigationListeners(); // Attache les listeners du menu

    // --- 3. Démarrer l'Observateur d'Authentification ---
    console.log(" -> Mise en place de l'observateur d'état d'authentification...");
    // La fonction setupAuthObserver est définie ailleurs dans le script
    setupAuthObserver();

    // --- 4. État Initial de l'Interface ---
    console.log(" -> Affichage de l'écran de connexion par défaut...");
    // Afficher l'écran de login pendant que l'état d'auth est vérifié.
    // L'observateur corrigera l'affichage si l'utilisateur est déjà connecté et autorisé.
    showLoginScreen();

    // --- Fin de l'initialisation de base ---
    console.log("Initialisation de base terminée. Attente de l'état d'authentification pour charger les fonctionnalités de l'application...");

    // Rappel : TOUTES les initialisations spécifiques à l'application (chargement des données,
    // listeners de formulaires complexes, initialisation des tables/graphiques, etc.)
    // sont maintenant déclenchées par la fonction `initializeAppFeatures()`
    // qui est appelée SEULEMENT APRÈS une connexion réussie ET autorisée
    // via l'observateur `onAuthStateChanged` dans `setupAuthObserver()`.
});

// --- Définition de la fonction d'initialisation de la navigation (exemple) ---
// (Placez ceci avec les autres définitions de fonctions globales)
/**
 * Attache les écouteurs de clic aux éléments du menu principal.
 */
function initializePrimaryNavigation() { // Nom plus spécifique
     menuItems.forEach(item => {
        // 'handleMenuItemClick' est la fonction (définie ailleurs)
        // qui contient TOUTE la logique complexe de changement de section,
        // destruction/création d'éléments café, appel de loadSyntheseData, etc.
         item.addEventListener('click', handleMenuItemClick); // Assurez-vous que handleMenuItemClick existe
     });
}

/**
 * Gère le clic sur un élément du menu principal.
 * (C'est votre ancienne logique de la boucle forEach des menuItems)
 */
function handleMenuItemClick(event) {
     // 'this' ou event.currentTarget fait référence à l'élément cliqué
     const item = event.currentTarget;
     const sectionId = item.getAttribute('data-section');
     const newActiveSectionId = `section-${sectionId}`;

     console.log(`Navigation MENU demandée: DE '${currentActiveSectionId}' VERS '${newActiveSectionId}'`);

     // --- Logique de DESTRUCTION Café ---
     if (currentActiveSectionId === 'section-coffee' && newActiveSectionId !== 'section-coffee') {
         console.log("Quitting coffee section: Destroying tables and charts...");
         // ... (code de destruction existant) ...
         if (coffeeTable) try { coffeeTable.destroy(); coffeeTable = null; } catch(e){} finally { coffeeTable = null; }
         if (rechargeTable) try { rechargeTable.destroy(); rechargeTable = null; } catch(e){} finally { rechargeTable = null; }
         if (problemChartInstance) try { problemChartInstance.destroy(); } catch(e){} finally { problemChartInstance = null; }
         if (machineChartInstance) try { machineChartInstance.destroy(); } catch(e){} finally { machineChartInstance = null; }
         if (statusChartInstance) try { statusChartInstance.destroy(); } catch(e){} finally { statusChartInstance = null; }
         console.log("Finished destroying coffee section elements.");
     }

     // --- Logique Principale de Navigation ---
     currentActiveSectionId = newActiveSectionId;
     menuItems.forEach(i => i.classList.remove('active'));
     item.classList.add('active');
     contentSections.forEach(sec => {
         sec.classList.toggle('active', sec.id === newActiveSectionId);
     });

     // --- Actions Spécifiques ---
     if (sectionId === 'synthese') {
         // La fonction loadSyntheseData est définie ailleurs
         loadSyntheseData();
     }
     if (sectionId === 'coffee') {
         // Initialiser via setTimeout (code existant)
          setTimeout(() => {
              if (!coffeeTable) initializeCoffeeTable();
              if (!rechargeTable) {
                  const filteredData = coffeeData.filter(/* ... logique de filtre ... */);
                  initializeRechargeTable(filteredData);
              }
              updateCoffeeStatsAndCharts(coffeeData);
          }, 50);
     }

     // --- Rotation ---
     const activeSectionElement = appContainer.querySelector('.content.active');
     if (activeSectionElement) {
         // La fonction applyRandomRotation est définie ailleurs
         if (sectionId !== 'coffee') {
             applyRandomRotation(`#${activeSectionElement.id} .grid-item:not(.add-item)`);
         }
         if (sectionId === 'synthese') {
             applyRandomRotation(`#${activeSectionElement.id} .synth-card`);
         }
     }
     console.log("--- Fin du traitement du clic menu ---");
// Récupère le bouton (fais-le une seule fois, idéalement avec les autres const globales)
const scrollToTopBtn = document.getElementById("scrollToTopBtn");

// Seuil en pixels après lequel le bouton apparaît
const scrollThreshold = 150;

// Fonction pour afficher/cacher le bouton
function toggleScrollTopButton() {
  if (!scrollToTopBtn) return; // Sécurité si le bouton n'existe pas

  if (document.body.scrollTop > scrollThreshold || document.documentElement.scrollTop > scrollThreshold) {
    // Utilise display block/none (simple)
    scrollToTopBtn.style.display = "block";

    // Ou utilise opacity/visibility pour l'effet de fondu (avec le CSS commenté)
    // scrollToTopBtn.classList.add("visible");

  } else {
    // Utilise display block/none
    scrollToTopBtn.style.display = "none";

    // Ou utilise opacity/visibility pour l'effet de fondu
    // scrollToTopBtn.classList.remove("visible");
  }
}

// Fonction pour remonter en haut de page
function scrollToTop() {
  window.scrollTo({top: 0, behavior: 'smooth'}); // Défilement fluide
}

// Écouteur pour le scroll de la page
window.addEventListener('scroll', toggleScrollTopButton);

// Écouteur pour le clic sur le bouton
if (scrollToTopBtn) {
  scrollToTopBtn.addEventListener('click', scrollToTop);
} else {
    console.warn("Le bouton scrollToTopBtn n'a pas été trouvé.");
}
}
