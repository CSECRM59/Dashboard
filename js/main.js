// js/main.js
import { firebaseConfig, COLLECTIONS, IMGUR_CLIENT_ID } from './config.js';
import { getAuth, getDb, googleProvider } from './firebaseService.js'; // Importe les instances Firebase

// Initialisation Firebase (si firebaseService.js ne le fait pas déjà globalement)
// Normalement, firebaseService.js devrait s'en charger.
// import firebase from 'firebase/compat/app';
// if (!firebase.apps.length) {
//     firebase.initializeApp(firebaseConfig);
// }

import { setupAuthObserver, handleGoogleSignIn, handleSignOut } from './auth.js';
import {
    initializeModalListeners,
    initializeNavigationListeners,
    initializeDefaultSection,
    showLoginScreen,
    globalResetAppState, // Fonction de ui.js pour réinitialiser le DOM des sections
    signInButton, signOutButton, // Éléments DOM pour auth listeners
    initializeScrollToTop
} from './ui.js';
import { showGlobalNotification, applyRandomRotation as globalApplyRandomRotation } from './utils.js'; // showNotification est maintenant showGlobalNotification

// --- Importation des modules ---
import { loadNewsFromFirebase, setupActualitesListeners } from './modules/actualites.js';
import { loadMembersFromFirebase, setupMembresListeners } from './modules/membres.js';
import { loadPartnersFromFirebase, setupPartnersListeners } from './modules/partenaires.js';
import { loadDemandesFromFirebase, setupDemandesListeners } from './modules/demandes.js';
import { loadCalendarFromFirebase, setupCalendarListeners } from './modules/calendrier.js';
import { loadInfosUtilesFromFirebase, setupInfosUtilesListeners } from './modules/infosUtiles.js'; // NOUVEAU

import { setupBadgeEventListeners } from './modules/badgesCafe.js'; // Pas de "load" initial pour badges
import {
    loadCoffeeReports,
    setupCoffeeListeners,
    initializeCoffeeTable as initCoffeeTableModule,
    initializeRechargeTable as initRechargeTableModule,
    updateCoffeeStatsAndCharts as updateCoffeeChartsModule,
    // cleanupCoffeeModule // Optionnel, si ui.js l'utilise
} from './modules/signalementsCafe.js';
import { loadSyntheseData as loadSyntheseDataModule } from './modules/synthese.js';
import { registerServiceWorker } from './modules/PWA.js';
import { loadExposantsFromFirebase, setupExposantsListeners } from './modules/exposants.js';

// --- PARTAGE DE VARIABLES/FONCTIONS GLOBALES (via window pour la transition) ---
// Nécessaire car ui.js (handleMenuItemClick) et d'autres modules (synthese)
// peuvent encore dépendre de ces références globales.
// Idéalement, réduire au maximum et passer par des imports/exports ou des événements.

// Instances Firebase (déjà disponibles via getDb, getAuth mais pour compatibilité ascendante du code existant)
window.db = getDb();
window.auth = getAuth();
window.googleProvider = googleProvider; // Si un module en a besoin directement
window.COLLECTIONS = COLLECTIONS;
window.IMGUR_CLIENT_ID_GLOBAL = IMGUR_CLIENT_ID; // Pour actualites.js si uploadToImgur n'est pas dans un service dédié

// Données et instances de modules
window.coffeeData = []; // Mis à jour par signalementsCafe.js
window.salariesDataCache = null; // Pour badgesCafe.js (si utilisé)

window.mySynthChart = null; // Géré par synthese.js
window.coffeeTable = null;   // Géré par signalementsCafe.js
window.rechargeTable = null; // Géré par signalementsCafe.js
window.problemChartInstance = null; // Géré par signalementsCafe.js
window.machineChartInstance = null; // Géré par signalementsCafe.js
window.statusChartInstance = null;  // Géré par signalementsCafe.js

// Rendre des fonctions de modules accessibles globalement si `ui.js` (handleMenuItemClick) les appelle directement
// Plutôt que d'importer dans ui.js. C'est une béquille temporaire.
window.loadSyntheseData = loadSyntheseDataModule;
window.initializeCoffeeTable = initCoffeeTableModule;
window.initializeRechargeTable = initRechargeTableModule;
window.updateCoffeeStatsAndCharts = updateCoffeeChartsModule;
window.applyRandomRotation = globalApplyRandomRotation; // Si des modules l'appellent encore globalement
// window.cleanupCoffeeModule = cleanupCoffeeModule; // Si ui.js doit l'appeler

// --- GESTION DE L'ÉTAT DE L'APPLICATION ---
export let globalAppInitializedFlag = false;

/**
 * Initialise toutes les fonctionnalités principales de l'application après une authentification réussie.
 * Est appelée depuis auth.js.
 */
export function initializeAppFeatures() {
    if (globalAppInitializedFlag) {
        console.log("MAIN: Fonctionnalités déjà initialisées.");
        return;
    }
    console.log("MAIN: Initialisation des fonctionnalités principales de l'application...");

    // Attacher les listeners spécifiques aux modules (formulaires, actions spécifiques)
    setupActualitesListeners();
    setupMembresListeners();
    setupPartnersListeners();
    setupDemandesListeners(); // Pour les changements de statut
    setupCalendarListeners();
    setupInfosUtilesListeners();
    setupBadgeEventListeners(); // Pour la section badges
    setupCoffeeListeners(); // Pour les exports CSV/PDF, etc.
    setupExposantsListeners();
    // Charger les données initiales des modules
    // ui.js (via handleMenuItemClick) appellera loadSyntheseData si c'est la section par défaut
    loadNewsFromFirebase(window.uiCurrentActiveSectionId); // Passe la section active pour la rotation
    loadMembersFromFirebase();
    loadPartnersFromFirebase();
    loadDemandesFromFirebase();
    loadCalendarFromFirebase();
    loadInfosUtilesFromFirebase();
    loadCoffeeReports(); // Charge les données café qui seront utilisées par la section café et synthèse
    loadExposantsFromFirebase();
    // Enregistrement du Service Worker
    registerServiceWorker();

    // Activer la section par défaut. Cela va déclencher les chargements spécifiques à la section
    // (comme loadSyntheseData ou l'initialisation des tables café via handleMenuItemClick dans ui.js)
    // Assurez-vous que appContainer est visible avant de cliquer.
    const appContainerElement = document.getElementById('app-container');
    if (appContainerElement && appContainerElement.style.display === 'block') {
        initializeDefaultSection('synthese'); // Ou la section de votre choix
    } else {
        console.warn("MAIN: App container non visible, initializeDefaultSection reportée ou à vérifier.");
        // La section par défaut sera activée par le premier clic utilisateur ou
        // lorsque `showAppScreen` est appelé dans `auth.js`. `initializeDefaultSection`
        // doit être appelé à ce moment-là.
        // Actuellement, `initializeDefaultSection` est appelé dans `auth.js` après `showAppScreen`,
        // ce qui est correct. L'appel ici est une redondance si `auth.js` le fait déjà bien.
        // Pour plus de clarté, on peut laisser `auth.js` gérer l'appel à `initializeDefaultSection`
        // après `showAppScreen()`.
    }
    // La rotation du menu est gérée par `initializeNavigationListeners` dans `ui.js`.
    globalApplyRandomRotation('.menu-item'); // Assurer que le menu a sa rotation

    globalAppInitializedFlag = true;
    console.log("MAIN: Initialisation des fonctionnalités de l'app terminée.");
}

/**
 * Réinitialise l'état global de l'application.
 * Est appelée depuis auth.js lors de la déconnexion ou d'un accès refusé.
 */
export function resetAppState() {
    console.log("MAIN: Réinitialisation globale de l'état de l'application demandée...");
    
    // Signaler que l'app n'est plus initialisée
    globalAppInitializedFlag = false;

    // Vider les données globales qui pourraient persister
    window.coffeeData = [];
    window.salariesDataCache = null;
    // ... autres données globales spécifiques à l'application ...

    // Détruire les instances globales de graphiques et tables (le code existant le fait bien)
    if (window.mySynthChart) try { window.mySynthChart.destroy(); } catch(e){console.error("Err destroy mySynthChart",e)} finally { window.mySynthChart = null; }
    if (window.coffeeTable) try { window.coffeeTable.destroy(); } catch(e){console.error("Err destroy coffeeTable",e)} finally { window.coffeeTable = null; }
    if (window.rechargeTable) try { window.rechargeTable.destroy(); } catch(e){console.error("Err destroy rechargeTable",e)} finally { window.rechargeTable = null; }
    if (window.problemChartInstance) try { window.problemChartInstance.destroy(); } catch(e){console.error("Err destroy problemChart",e)} finally { window.problemChartInstance = null; }
    if (window.machineChartInstance) try { window.machineChartInstance.destroy(); } catch(e){console.error("Err destroy machineChart",e)} finally { window.machineChartInstance = null; }
    if (window.statusChartInstance) try { window.statusChartInstance.destroy(); } catch(e){console.error("Err destroy statusChart",e)} finally { window.statusChartInstance = null; }

    // Réinitialiser l'UI (vider les listes, cacher des éléments, etc.)
    // Cette fonction est maintenant dans ui.js
    globalResetAppState();

    console.log("MAIN: État application (global) réinitialisé.");
}


// --- POINT D'ENTRÉE PRINCIPAL (DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("MAIN: DOM prêt.");

    // Attacher les listeners globaux d'UI (connexion, modales, navigation, scroll)
    if (signInButton) {
        signInButton.addEventListener('click', handleGoogleSignIn);
    } else {
        console.error("MAIN: Bouton google-signin-btn non trouvé!");
    }

    if (signOutButton) {
        signOutButton.addEventListener('click', handleSignOut);
    } else {
        // Normal si l'utilisateur n'est pas encore connecté, mais l'élément doit exister dans le HTML.
        console.warn("MAIN: Bouton google-signout-btn non trouvé (sera dans app-container).");
    }

    initializeModalListeners();
    initializeNavigationListeners(); // Met en place les clics sur le menu et la rotation initiale du menu
    initializeScrollToTop();

    // Démarrer l'observateur d'authentification Firebase.
    // C'est LUI qui déclenchera `initializeAppFeatures()` (via `auth.js`) après une connexion réussie
    // OU `resetAppState()` si l'utilisateur se déconnecte ou n'est pas autorisé.
    setupAuthObserver();

    // Afficher l'écran de login par défaut.
    // `onAuthStateChanged` dans `auth.js` corrigera l'affichage si l'utilisateur est déjà connecté et autorisé.
    showLoginScreen();

    console.log("MAIN: Initialisation de base terminée. Attente de l'état d'authentification...");
});