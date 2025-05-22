// js/ui.js
import { applyRandomRotation, showGlobalNotification } from './utils.js';

// Importer les fonctions des modules qui doivent être appelées lors de la navigation
// ou pour la réinitialisation.
// Note : Si ces fonctions sont mises sur `window` dans main.js, les imports ne sont pas stricts.
// Sinon, il faut les importer. Pour une meilleure pratique modulaire, on les importe.
import { renderExposantCalendar, loadPlanningForMonth as loadExposantPlanningForMonth } from './modules/exposants.js';
// Si d'autres modules ont des fonctions de cleanup ou d'init spécifiques à la navigation, importez-les ici.

// --- ÉLÉMENTS DU DOM ---
export const loginContainer = document.getElementById('login-container');
export const appContainer = document.getElementById('app-container');
export const signInButton = document.getElementById('google-signin-btn');
export const signOutButton = document.getElementById('google-signout-btn');
export const loginErrorMsg = document.getElementById('login-error');
export const userInfoArea = document.getElementById('user-info-area');
export const userEmailDisplay = document.getElementById('user-email-display');

export const menuItems = document.querySelectorAll('.menu-item');
export const contentSections = document.querySelectorAll('.content');

const modals = document.querySelectorAll('.modal');
const closeButtons = document.querySelectorAll('.close');
const scrollToTopBtn = document.getElementById("scrollToTopBtn");

// --- ÉTAT DE LA NAVIGATION ---
export let currentActiveSectionId = null;
// window.uiCurrentActiveSectionId est utilisé pour que les modules puissent vérifier la section active.
// C'est une béquille. Idéalement, passer l'info ou utiliser un store d'état.

// --- GESTION UI LOGIN/APP ---
export function showLoginScreen(errorMessage = null) {
    if (appContainer) appContainer.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'flex';
    if (loginErrorMsg) {
        loginErrorMsg.textContent = errorMessage || '';
        loginErrorMsg.style.display = errorMessage ? 'block' : 'none';
    }
    if (userInfoArea) userInfoArea.style.display = 'none';
}

export function showAppScreen(user) {
    if (loginContainer) loginContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';
    if (userInfoArea && userEmailDisplay) {
         if (user && user.email) {
             userEmailDisplay.textContent = user.email;
             userInfoArea.style.display = 'flex';
         } else {
             userInfoArea.style.display = 'none';
         }
    }
}

// --- GESTION DES MODALS ---
export function resetModalForms(modalElement) {
    if (!modalElement) { console.warn("resetModalForms: modalElement est null."); return; }
    const forms = modalElement.querySelectorAll('form');
    forms.forEach(form => {
        form.reset(); // Méthode standard pour réinitialiser les formulaires (champs texte, select, checkbox)
        // Assurer que les champs cachés pour les URL d'images sont aussi vidés
        form.querySelectorAll('input[type="hidden"][id*="-url"]').forEach(hiddenInput => hiddenInput.value = '');
        // Vider les statuts d'upload
        form.querySelectorAll('div[id*="-upload-status"]').forEach(statusDiv => statusDiv.textContent = '');
        // Vider les prévisualisations d'images
        form.querySelectorAll('div[id*="-current-image-display"], div[id*="-current-partner-logo-display"], div[id*="-current-exposant-logo-display"]').forEach(displayDiv => displayDiv.innerHTML = '');
        // Réactiver les boutons submit
        form.querySelectorAll('button[type="submit"]').forEach(btn => btn.disabled = false);
    });
    console.log(`UI: Formulaires réinitialisés pour modal: ${modalElement.id}`);
}

export function initializeModalListeners() {
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal');
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                modalElement.style.display = 'none';
                resetModalForms(modalElement);
            }
        });
    });
    window.addEventListener('click', (event) => {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
                resetModalForms(modal);
            }
        });
    });
}

// --- GESTION DE LA NAVIGATION PAR MENU ---
export function handleMenuItemClick(event) {
    const item = event.currentTarget;
    const sectionId = item.getAttribute('data-section');
    const newActiveSectionId = `section-${sectionId}`;

    console.log(`UI: Navigation MENU demandée: DE '${currentActiveSectionId}' VERS '${newActiveSectionId}'`);

    // --- Logique de DESTRUCTION des éléments spécifiques à la section quittée ---
    if (currentActiveSectionId === 'section-coffee' && newActiveSectionId !== 'section-coffee') {
        console.log("UI: Quitting coffee section. Destroying tables and charts...");
        if (window.coffeeTable) try { window.coffeeTable.destroy(); window.coffeeTable = null; } catch(e){ console.error("UI Err destroy coffeeTable", e); }
        if (window.rechargeTable) try { window.rechargeTable.destroy(); window.rechargeTable = null; } catch(e){ console.error("UI Err destroy rechargeTable", e); }
        if (window.problemChartInstance) try { window.problemChartInstance.destroy(); window.problemChartInstance = null;} catch(e){ console.error("UI Err destroy problemChart", e); }
        if (window.machineChartInstance) try { window.machineChartInstance.destroy(); window.machineChartInstance = null;} catch(e){ console.error("UI Err destroy machineChart", e); }
        if (window.statusChartInstance) try { window.statusChartInstance.destroy(); window.statusChartInstance = null;} catch(e){ console.error("UI Err destroy statusChart", e); }
        // Tu pourrais appeler une fonction de cleanup exportée par signalementsCafe.js ici
        // if (typeof window.cleanupCoffeeModule === 'function') window.cleanupCoffeeModule();
    }
    if (currentActiveSectionId === 'section-synthese' && newActiveSectionId !== 'section-synthese') {
        if (window.mySynthChart) try { window.mySynthChart.destroy(); window.mySynthChart = null; } catch(e){ console.error("UI Err destroy mySynthChart", e); }
    }
    // Ajouter ici la destruction pour d'autres sections si elles ont des éléments dynamiques persistants (ex: calendrier des exposants si besoin)
    // Cependant, le calendrier des exposants est re-rendu à chaque entrée, donc pas forcément besoin de le détruire explicitement ici.

    currentActiveSectionId = newActiveSectionId;
    window.uiCurrentActiveSectionId = newActiveSectionId; // Pour que les modules puissent y accéder

    menuItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    contentSections.forEach(sec => sec.classList.toggle('active', sec.id === newActiveSectionId));

    // --- Actions spécifiques à l'ENTRÉE dans certaines sections ---
    if (sectionId === 'synthese' && typeof window.loadSyntheseData === 'function') {
        window.loadSyntheseData();
    }
    if (sectionId === 'coffee') {
        setTimeout(() => { // Délai pour s'assurer que la section est visible
            if (!window.coffeeTable && typeof window.initializeCoffeeTable === 'function') window.initializeCoffeeTable();
            if (!window.rechargeTable && typeof window.initializeRechargeTable === 'function') {
                const filteredData = (window.coffeeData || []).filter(report =>
                    ((report.status || 'en cours').toLowerCase().trim() === 'en cours' || (report.status || 'en cours').toLowerCase().trim() === '') &&
                    (report.probleme || '').toLowerCase().match(/rechargement|paiement|badge/)
                );
                window.initializeRechargeTable(filteredData);
            }
            if (typeof window.updateCoffeeStatsAndCharts === 'function') window.updateCoffeeStatsAndCharts(window.coffeeData || []);
        }, 50);
    }
    if (sectionId === 'exposants') {
        console.log("UI: Activation section Exposants - Rendu calendrier.");
        // currentCalendarDate est géré dans exposants.js, on utilise la date du jour pour l'entrée.
        const todayForExposantCal = new Date();
        renderExposantCalendar(); // Fonction importée
        loadExposantPlanningForMonth(todayForExposantCal.getFullYear(), todayForExposantCal.getMonth()); // Fonction importée
    }

    // Appliquer les effets visuels de rotation
    const activeSectionElement = document.getElementById(newActiveSectionId);
    if (activeSectionElement) {
         if (sectionId !== 'coffee' && sectionId !== 'exposants') { // Pas de .grid-item standard dans ces sections pour la rotation générale
             applyRandomRotation(`#${activeSectionElement.id} .grid-item:not(.add-item)`);
         }
         if (sectionId === 'exposants') { // Rotation spécifique pour les cartes exposants
            applyRandomRotation(`#exposants-list .grid-item:not(.add-item)`);
         }
         if (sectionId === 'synthese') {
             applyRandomRotation(`#${activeSectionElement.id} .synth-card`);
         }
    }
    console.log(`UI: Fin du traitement du clic menu pour ${newActiveSectionId}`);
}

export function initializeNavigationListeners() {
    menuItems.forEach(item => item.addEventListener('click', handleMenuItemClick));
    applyRandomRotation('.menu-item'); // Rotation initiale du menu
}

export function initializeDefaultSection(defaultSectionId = 'synthese') { // Changé pour synthèse par défaut
     const defaultMenuItem = document.querySelector(`.menu-item[data-section="${defaultSectionId}"]`);
     if (defaultMenuItem) {
         defaultMenuItem.click();
         console.log("UI: Section initiale activée:", defaultSectionId);
     } else if (menuItems.length > 0) {
         menuItems[0].click();
         console.log("UI: Section initiale par défaut activée (fallback):", menuItems[0].getAttribute('data-section'));
     }
}

// --- RÉINITIALISATION DE L'ÉTAT DE L'UI ---
export function globalResetAppState() {
    console.log("UI: Réinitialisation de l'état de l'UI...");
    try {
        // Vider les listes des sections CRUD
        ['news-list', 'members-list', 'partners-list', 'demandes-list', 'calendar-list', 'infosUtiles-list', 'exposants-list'].forEach(listId => {
            const list = document.getElementById(listId);
            if (list) {
                list.querySelectorAll('.grid-item:not(.add-item), .category-title-h4, .news-section-title').forEach(i => i.remove());
                // Ajouter un message "vide" si nécessaire (pourrait être géré par les updateList des modules)
            }
        });

        // Nettoyer section Exposants Calendrier
        const calendarGrid = document.getElementById('exposant-calendar-grid');
        if (calendarGrid) calendarGrid.innerHTML = '';
        const monthYearDisplay = document.getElementById('current-month-year-exposant');
        if (monthYearDisplay) monthYearDisplay.textContent = '';
        const plannedList = document.getElementById('planned-exposants-list');
        if(plannedList) plannedList.innerHTML = '';

        // Nettoyer section Café
        const coffeeTableContainer = document.getElementById('coffee-table-container');
        if (coffeeTableContainer) coffeeTableContainer.innerHTML = '';
        const rechargeTableContainer = document.getElementById('recharge-table-container');
        if (rechargeTableContainer) rechargeTableContainer.innerHTML = '';
        ['stat-total-reports', 'stat-reports-en-cours', 'stat-reports-traite'].forEach(id => {
            const el = document.getElementById(id); if (el) el.textContent = '0';
        });
        ['problem-chart', 'machine-chart', 'status-chart'].forEach(id => {
            const canvas = document.getElementById(id);
            if(canvas) { const ctx = canvas.getContext('2d'); if (ctx) ctx.clearRect(0,0, canvas.width, canvas.height); }
        });

        // Nettoyer section Synthèse
        const synthContainer = document.getElementById('synthese-container');
        if (synthContainer) synthContainer.innerHTML = '';
        const synthCtx = document.getElementById('synth-chart')?.getContext('2d');
        if (synthCtx) synthCtx.clearRect(0, 0, synthCtx.canvas.width, synthCtx.canvas.height);

        // Nettoyer section Badges Café
        const searchInput = document.getElementById('employee-search'); if(searchInput) searchInput.value = '';
        const searchResults = document.getElementById('search-results'); if(searchResults) searchResults.innerHTML = '';
        const selectedZone = document.getElementById('selected-employee-zone'); if(selectedZone) selectedZone.style.display = 'none';
        const newPrompt = document.getElementById('new-employee-prompt'); if(newPrompt) newPrompt.style.display = 'none';
        const badgeMsg = document.getElementById('badge-message'); if(badgeMsg) { badgeMsg.textContent = ''; badgeMsg.style.display = 'none'; }

    } catch (error) {
         console.error("UI: Erreur lors du nettoyage des conteneurs DOM:", error);
    }
    currentActiveSectionId = null;
    window.uiCurrentActiveSectionId = null; // Réinitialiser aussi la variable globale
    console.log("UI: État de l'UI réinitialisé.");
}

// --- SCROLL TO TOP ---
const scrollThreshold = 150;
function toggleScrollTopButton() {
  if (!scrollToTopBtn) return;
  if (document.body.scrollTop > scrollThreshold || document.documentElement.scrollTop > scrollThreshold) {
    scrollToTopBtn.style.display = "block";
  } else {
    scrollToTopBtn.style.display = "none";
  }
}
function scrollToTop() {
  window.scrollTo({top: 0, behavior: 'smooth'});
}
export function initializeScrollToTop() {
    window.addEventListener('scroll', toggleScrollTopButton);
    if (scrollToTopBtn) {
      scrollToTopBtn.addEventListener('click', scrollToTop);
    }
}