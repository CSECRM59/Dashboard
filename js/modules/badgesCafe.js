// js/modules/badgesCafe.js
import { getDb } from '../firebaseService.js';
import { COLLECTIONS } from '../config.js';
// Import firebase pour FieldValue si non exposé par firebaseService
//import firebase from 'firebase/compat/app';
//import 'firebase/compat/firestore'; // Pour FieldValue

const db = getDb();

// --- ÉLÉMENTS DU DOM SPÉCIFIQUES AU MODULE ---
// (On les récupère une fois au lieu de les chercher à chaque fonction)
let searchInput, searchResultsContainer, selectedEmployeeZone, newEmployeePrompt,
    selectedEmployeeDetails, existingKeysListUL, noKeysMessage, assignBadgeForm,
    badgeTypeSelect, cautionAmountGroup, badgeNumberInput, createNewEmployeeBtn,
    deleteEmployeeBtn, badgeMessageDiv, selectedEmployeeIdInput,
    selectedEmployeeNomInput, selectedEmployeePrenomInput;

function cacheDOMElements() {
    searchInput = document.getElementById('employee-search');
    searchResultsContainer = document.getElementById('search-results');
    selectedEmployeeZone = document.getElementById('selected-employee-zone');
    newEmployeePrompt = document.getElementById('new-employee-prompt');
    selectedEmployeeDetails = document.getElementById('selected-employee-details');
    existingKeysListUL = document.querySelector('#existing-keys-list ul');
    noKeysMessage = document.querySelector('#existing-keys-list .no-keys-message');
    assignBadgeForm = document.getElementById('form-assign-badge');
    badgeTypeSelect = document.getElementById('badge-type');
    cautionAmountGroup = document.getElementById('caution-amount-group');
    badgeNumberInput = document.getElementById('badge-number');
    createNewEmployeeBtn = document.getElementById('create-new-employee-btn');
    deleteEmployeeBtn = document.getElementById('delete-employee-btn');
    badgeMessageDiv = document.getElementById('badge-message');
    selectedEmployeeIdInput = document.getElementById('selected-employee-id');
    selectedEmployeeNomInput = document.getElementById('selected-employee-nom');
    selectedEmployeePrenomInput = document.getElementById('selected-employee-prenom');
}

// --- FONCTIONS UI SPÉCIFIQUES AU MODULE ---

function showBadgeUISection(sectionToShow) {
    const sections = {
        'search-results': searchResultsContainer,
        'selected-employee-zone': selectedEmployeeZone,
        'new-employee-prompt': newEmployeePrompt
        // 'delete-zone' est DANS selected-employee-zone, donc pas besoin de le gérer séparément ici
    };

    for (const id in sections) {
        if (sections[id]) {
            sections[id].style.display = (id === sectionToShow) ? 'block' : 'none';
        }
    }
    // Cacher la zone des résultats si on montre autre chose qu'elle-même
    if (searchResultsContainer && sectionToShow !== 'search-results') {
        searchResultsContainer.style.display = 'none';
    }
    if (deleteEmployeeBtn) { // Gérer la visibilité du bouton supprimer
        deleteEmployeeBtn.style.display = (selectedEmployeeZone && selectedEmployeeZone.style.display === 'block' && selectedEmployeeIdInput.value && selectedEmployeeIdInput.value !== "__NEW__") ? 'inline-block' : 'none';
    }
}

function showBadgeNotification(message, isError = false) {
    if (!badgeMessageDiv) {
        console.warn("Élément #badge-message non trouvé, utilisation de alert.");
        alert(message); // Fallback
        return;
    }
    badgeMessageDiv.textContent = message;
    badgeMessageDiv.className = 'message-area'; // Reset classes
    if (isError) {
        badgeMessageDiv.classList.add('error');
        badgeMessageDiv.style.color = 'var(--danger-couleur)';
        badgeMessageDiv.style.borderColor = 'var(--danger-couleur)';
        badgeMessageDiv.style.backgroundColor = '#ffebee';
    } else {
        badgeMessageDiv.classList.add('success');
        badgeMessageDiv.style.color = '#2e7d32';
        badgeMessageDiv.style.borderColor = '#a5d6a7';
        badgeMessageDiv.style.backgroundColor = '#e8f5e9';
    }
    badgeMessageDiv.style.display = 'block';
    badgeMessageDiv.style.padding = '1rem';
    badgeMessageDiv.style.marginTop = '1rem';
    badgeMessageDiv.style.borderRadius = '4px';
    badgeMessageDiv.style.borderWidth = '1px';
    badgeMessageDiv.style.borderStyle = 'solid';
}


// --- LOGIQUE MÉTIER DU MODULE ---

async function searchEmployeesByName(searchTerm) {
    if (!searchResultsContainer || !newEmployeePrompt || !createNewEmployeeBtn) return;

    if (newEmployeePrompt) newEmployeePrompt.style.display = 'none';
    searchResultsContainer.innerHTML = '<p><i>Recherche en cours...</i></p>';
    showBadgeUISection('search-results');

    if (!searchTerm || searchTerm.length < 2) {
        searchResultsContainer.innerHTML = '';
        return;
    }

    const upperCaseSearch = searchTerm.toUpperCase();
    const endTerm = upperCaseSearch + '\uf8ff';

    try {
        const querySnapshot = await db.collection(COLLECTIONS.SALARIES_TEST)
            .where('Nom', '>=', upperCaseSearch)
            .where('Nom', '<', endTerm)
            .orderBy('Nom') // Assurez-vous que l'index existe (Nom ASC)
            // Si vous avez un champ Nom_lowercase, vous pouvez faire :
            // .where('Nom_lowercase', '>=', searchTerm.toLowerCase())
            // .where('Nom_lowercase', '<', searchTerm.toLowerCase() + '\uf8ff')
            // .orderBy('Nom_lowercase')
            .limit(10)
            .get();

        const employees = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        searchResultsContainer.innerHTML = '';

        if (employees.length > 0) {
            employees.forEach(emp => {
                const div = document.createElement('div');
                div.classList.add('result-item'); // Ajouter une classe pour le style
                div.style.padding = '8px'; div.style.cursor = 'pointer'; div.style.borderBottom = '1px solid #eee';
                const prenom = emp.Prenom || emp['Prénom'] || '?'; // Gère les deux cas de champ Prénom
                div.textContent = `${emp.Nom || '?'} ${prenom}`;
                div.dataset.employeeId = emp.id;
                // Stocker les données complètes pour éviter une nouvelle requête
                div.addEventListener('click', () => selectEmployee(emp.id, emp));
                searchResultsContainer.appendChild(div);
            });
        } else {
            searchResultsContainer.innerHTML = '<p><i>Aucun salarié trouvé pour ce nom.</i></p>';
        }

        if (newEmployeePrompt && createNewEmployeeBtn && searchTerm.length >= 2) {
            createNewEmployeeBtn.textContent = `Créer un nouveau salarié "${upperCaseSearch}" ?`;
            newEmployeePrompt.style.display = 'block';
        }

    } catch (error) {
        console.error("Erreur recherche salarié:", error);
        searchResultsContainer.innerHTML = '<p style="color:red;">Erreur lors de la recherche.</p>';
        if (newEmployeePrompt) newEmployeePrompt.style.display = 'none';
        if (error.code === 'failed-precondition') {
            searchResultsContainer.innerHTML += '<br><span style="color:red; font-weight:bold;">Vérifiez la console (F12) pour un lien de création d\'index Firestore.</span>';
        }
    }
}

function selectEmployee(id, data) {
    if (!selectedEmployeeDetails || !selectedEmployeeIdInput || !selectedEmployeeNomInput || !selectedEmployeePrenomInput || !assignBadgeForm) return;

    const prenom = data.Prenom || data['Prénom'] || '?';
    selectedEmployeeDetails.innerHTML = `<strong>Nom :</strong> ${data.Nom || '?'} <br> <strong>Prénom :</strong> ${prenom}`;

    let badgesToDisplay = [];
    if (data.keys && Array.isArray(data.keys)) { // Nouvelle structure
        badgesToDisplay = data.keys;
    } else if (data["Num de Clé"]) { // Ancienne structure
        const convertOldDate = (oldDateStr) => {
            if (!oldDateStr || typeof oldDateStr !== 'string' || !oldDateStr.includes('/')) return null;
            const parts = oldDateStr.split('/');
            return parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : null;
        };
        badgesToDisplay = [{
            keyNumber: data["Num de Clé"],
            type: data["E (echange) R (reglement)"] || '?',
            montant: (data["E (echange) R (reglement)"] === 'R' ? (parseFloat(data["Montant réglé"]) || 7) : 0), // Essaye de parser, sinon 7
            date: convertOldDate(data.Date)
        }];
    }
    updateDisplayedBadges(badgesToDisplay);

    selectedEmployeeIdInput.value = id;
    selectedEmployeeNomInput.value = data.Nom || '?';
    selectedEmployeePrenomInput.value = prenom;

    assignBadgeForm.reset();
    if (cautionAmountGroup) cautionAmountGroup.style.display = 'none';
    if (badgeNumberInput) badgeNumberInput.value = '';

    showBadgeUISection('selected-employee-zone'); // Affiche la zone
    if (searchInput) searchInput.value = ''; // Vide la recherche
    if (searchResultsContainer) searchResultsContainer.innerHTML = '';
}

function updateDisplayedBadges(keysArray) {
    if (!existingKeysListUL || !noKeysMessage) return;
    const listContainer = document.getElementById('existing-keys-list');

    existingKeysListUL.innerHTML = '';
    if (keysArray && keysArray.length > 0) {
        keysArray.forEach(k => {
            const li = document.createElement('li');
            const dateFormatted = k.date ? `<small>(${new Date(k.date + 'T00:00:00').toLocaleDateString('fr-FR')})</small>` : '<small>(Date?)</small>';
            const typeLabel = k.type === 'R' ? 'Caution' : (k.type === 'E' ? 'Echange' : (k.type || '?'));
            const montantDisplay = (k.montant && k.type === 'R') ? ` - ${k.montant}€` : '';
            li.innerHTML = `(${typeLabel}) ${k.keyNumber || '?'} ${montantDisplay} ${dateFormatted}`;
            existingKeysListUL.appendChild(li);
        });
        existingKeysListUL.style.display = 'block';
        noKeysMessage.style.display = 'none';
        if(listContainer) listContainer.style.display = 'block';
    } else {
        existingKeysListUL.style.display = 'none';
        noKeysMessage.style.display = 'block';
        if(listContainer) listContainer.style.display = 'block';
    }
}

async function handleAssignBadgeSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');

    const employeeId = selectedEmployeeIdInput.value;
    const employeeNom = selectedEmployeeNomInput.value;
    const employeePrenom = selectedEmployeePrenomInput.value;
    const badgeNumber = badgeNumberInput.value.trim();
    const badgeType = badgeTypeSelect.value;

    if (!badgeNumber || !badgeType) {
        showBadgeNotification("Veuillez entrer un numéro de badge et choisir un type.", true);
        return;
    }

    const badgeAmount = badgeType === 'R' ? 7 : 0;
    const today = new Date().toISOString().slice(0, 10);
    const newBadgeData = { keyNumber: badgeNumber, type: badgeType, montant: badgeAmount, date: today };

    if (submitButton) submitButton.disabled = true;
    showBadgeNotification("Traitement en cours...", false);

    try {
        if (employeeId === "__NEW__") {
            if (!employeeNom || !employeePrenom || employeePrenom === '?') {
                showBadgeNotification("Nom et Prénom sont requis pour créer un salarié.", true);
                if (submitButton) submitButton.disabled = false;
                return;
            }
            const newEmployeeDoc = {
                Nom: employeeNom.toUpperCase(), // Standardiser le nom en majuscules
                Prenom: employeePrenom,
                Nom_lowercase: employeeNom.toLowerCase(), // Pour la recherche insensible à la casse
                date_creation: today,
                keys: [newBadgeData]
            };
            const docRef = await db.collection(COLLECTIONS.SALARIES_TEST).add(newEmployeeDoc);
            showBadgeNotification(`Salarié ${employeeNom} ${employeePrenom} créé et badge ${badgeNumber} assigné.`, false);
            selectEmployee(docRef.id, newEmployeeDoc); // Sélectionne le nouveau salarié
        } else {
            const employeeRef = db.collection(COLLECTIONS.SALARIES_TEST).doc(employeeId);
            await employeeRef.update({
                keys: firebase.firestore.FieldValue.arrayUnion(newBadgeData)
            });
            showBadgeNotification(`Badge ${badgeNumber} ajouté pour ${employeeNom} ${employeePrenom}.`, false);
            const updatedDoc = await employeeRef.get();
            if (updatedDoc.exists) {
                updateDisplayedBadges(updatedDoc.data().keys || []);
            }
            form.reset();
            if (cautionAmountGroup) cautionAmountGroup.style.display = 'none';
            if (badgeNumberInput) badgeNumberInput.focus();
        }
    } catch (error) {
        console.error("Erreur lors de l'assignation/création:", error);
        showBadgeNotification(`Erreur: ${error.message}`, true);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

function handleCreateNewEmployeeClick() {
    const searchInputValue = searchInput.value.trim().toUpperCase();
    if (!searchInputValue) {
        showBadgeNotification("Le Nom saisi dans la recherche est vide.", true);
        return;
    }
    let prenom = prompt(`Entrez le Prénom pour ${searchInputValue} :`);
    if (prenom === null) return;
    prenom = prenom.trim();
    if (!prenom) {
        showBadgeNotification("Le Prénom est requis.", true);
        return;
    }

    if (searchResultsContainer) searchResultsContainer.innerHTML = '';
    if (newEmployeePrompt) newEmployeePrompt.style.display = 'none';
    showBadgeUISection('selected-employee-zone');

    if (selectedEmployeeDetails) selectedEmployeeDetails.innerHTML = `<strong>Nouveau Salarié</strong><br><strong>Nom :</strong> ${searchInputValue} <br> <strong>Prénom :</strong> ${prenom}`;
    updateDisplayedBadges([]);

    selectedEmployeeIdInput.value = "__NEW__";
    selectedEmployeeNomInput.value = searchInputValue;
    selectedEmployeePrenomInput.value = prenom;

    if (deleteEmployeeBtn) deleteEmployeeBtn.style.display = 'none';
    if (assignBadgeForm) assignBadgeForm.reset();
    if (cautionAmountGroup) cautionAmountGroup.style.display = 'none';
    if (badgeNumberInput) { badgeNumberInput.value = ''; badgeNumberInput.focus(); }
}

async function handleDeleteEmployeeClick() {
    const employeeId = selectedEmployeeIdInput.value;
    const employeeNom = selectedEmployeeNomInput.value || "Inconnu";
    const employeePrenom = selectedEmployeePrenomInput.value || "";

    if (!employeeId || employeeId === "__NEW__") {
        showBadgeNotification("Aucun salarié existant n'est sélectionné pour la suppression.", true);
        return;
    }
    if (deleteEmployeeBtn) deleteEmployeeBtn.disabled = true;
    showBadgeNotification("Vérification des informations de caution...", false);

    let cautionDue = false;
    let lastBadgeNumber = null;
    try {
        const docRef = db.collection(COLLECTIONS.SALARIES_TEST).doc(employeeId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data.keys && Array.isArray(data.keys)) {
                for (const keyEntry of data.keys) {
                    if (keyEntry.type === 'R' && parseFloat(keyEntry.montant) > 0) {
                        cautionDue = true;
                        break;
                    }
                    lastBadgeNumber = keyEntry.keyNumber || lastBadgeNumber;
                }
            } else if (data["E (echange) R (reglement)"] === 'R' && data["Montant réglé"] && data["Montant réglé"].match(/^[1-9]/)) {
                cautionDue = true;
                lastBadgeNumber = data["Num de Clé"];
            } else {
                lastBadgeNumber = data["Num de Clé"];
            }
        } else {
            showBadgeNotification("Erreur : Salarié introuvable.", true);
            if (deleteEmployeeBtn) deleteEmployeeBtn.disabled = false;
            return;
        }

        let confirmationMessage = `Êtes-vous sûr de vouloir supprimer ${employeeNom} ${employeePrenom} ?`;
        if (lastBadgeNumber) confirmationMessage += `\n(Dernier badge connu : ${lastBadgeNumber})`;
        if (cautionDue) confirmationMessage += "\n\n!!! ATTENTION : UNE CAUTION DE 7€ DOIT ÊTRE REMBOURSÉE !!!";

        if (window.confirm(confirmationMessage)) {
            showBadgeNotification("Suppression en cours...", false);
            await docRef.delete();
            showBadgeNotification(`Salarié ${employeeNom} ${employeePrenom} supprimé. ${cautionDue ? 'REMBOURSEMENT CAUTION REQUIS !' : ''}`, false);
            if(searchInput) searchInput.value = '';
            if(searchResultsContainer) searchResultsContainer.innerHTML = '';
            if(selectedEmployeeIdInput) selectedEmployeeIdInput.value = '';
            showBadgeUISection(null); // Cache toutes les sections spécifiques badges
        } else {
            showBadgeNotification("Suppression annulée.", false);
        }
    } catch (error) {
        console.error("Erreur lors de la suppression du salarié:", error);
        showBadgeNotification("Erreur lors de la suppression.", true);
    } finally {
        if (deleteEmployeeBtn) deleteEmployeeBtn.disabled = false;
    }
}

/**
 * Met en place les listeners spécifiques au module Badges Café.
 */
export function setupBadgeEventListeners() {
    // Cache les éléments du DOM une seule fois
    cacheDOMElements();
    console.log("Attachement des listeners pour le module Badges Café...");

    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const searchTerm = searchInput.value.trim();
            searchTimeout = setTimeout(() => {
                searchEmployeesByName(searchTerm);
            }, 300); // Délai pour éviter les requêtes à chaque frappe
        });
    } else { console.error("#employee-search non trouvé."); }

    if (badgeTypeSelect) {
        badgeTypeSelect.addEventListener('change', () => {
            if (cautionAmountGroup) {
                cautionAmountGroup.style.display = badgeTypeSelect.value === 'R' ? 'block' : 'none';
            }
        });
    } else { console.warn("#badge-type non trouvé."); }

    if (assignBadgeForm) {
        assignBadgeForm.addEventListener('submit', handleAssignBadgeSubmit);
    } else { console.error("#form-assign-badge non trouvé."); }

    if (createNewEmployeeBtn) {
        createNewEmployeeBtn.addEventListener('click', handleCreateNewEmployeeClick);
    } else { console.warn("#create-new-employee-btn non trouvé."); }

    if (deleteEmployeeBtn) {
        deleteEmployeeBtn.addEventListener('click', handleDeleteEmployeeClick);
        deleteEmployeeBtn.style.display = 'none'; // Caché par défaut
    } else { console.warn("#delete-employee-btn non trouvé."); }

    // État initial de l'UI pour cette section
    showBadgeUISection(null); // Cache tout par défaut
    if (badgeMessageDiv) badgeMessageDiv.style.display = 'none';
}