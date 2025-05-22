// js/auth.js
import { getAuth, getDb, googleProvider as globalGoogleProvider } from './firebaseService.js'; // Utilise firebaseService
import { showLoginScreen, showAppScreen, globalResetAppState as resetAppState, userEmailDisplay, userInfoArea } from './ui.js'; // Note: resetAppState est renommé
import { initializeAppFeatures, globalAppInitializedFlag } from './main.js'; // Pour le flux d'initialisation
import { showNotification } from './utils.js'; // Pour les notifications
import { COLLECTIONS } from './config.js'; // Pour le nom de la collection membres

const auth = getAuth();
const db = getDb();
const googleProvider = globalGoogleProvider;

// --- VÉRIFICATION AUTORISATION ---
async function checkAuthorization(email) {
    if (!email) {
        console.log("Email non fourni pour la vérification.");
        return false;
    }
    try {
        console.log(`Vérification autorisation pour: ${email}`);
        const querySnapshot = await db.collection(COLLECTIONS.MEMBERS) // Utilise la constante
                                      .where('Mail', '==', email)
                                      .limit(1)
                                      .get();
        const isAuthorized = !querySnapshot.empty;
        if (isAuthorized) {
            console.log(`Email ${email} trouvé. Autorisé.`);
        } else {
            console.log(`Email ${email} NON trouvé. Accès refusé.`);
        }
        return isAuthorized;
    } catch (error) {
        console.error("Erreur Firestore lors de la vérification d'autorisation:", error);
        return false;
    }
}

// --- ACTIONS AUTHENTIFICATION ---
export async function handleGoogleSignIn() {
    const loginErrorMsg = document.getElementById('login-error'); // Peut rester local ou être géré par ui.js
    if (loginErrorMsg) loginErrorMsg.style.display = 'none';
    try {
        const result = await auth.signInWithPopup(googleProvider);
        console.log("Popup Google Sign-In réussie pour:", result?.user?.email);
        // onAuthStateChanged gère la suite
    } catch (error) {
        console.error("Erreur Google Sign-In:", error);
        let message = "Erreur lors de la connexion Google.";
        if (error.code === 'auth/popup-closed-by-user') {
            message = "La fenêtre de connexion a été fermée.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            message = "Connexion annulée.";
        }
        showLoginScreen(message); // géré par ui.js
    }
}

export function handleSignOut() {
    auth.signOut().then(() => {
        console.log("Déconnexion réussie.");
        // onAuthStateChanged gérera le changement d'UI
    }).catch(error => {
        console.error("Erreur lors de la déconnexion:", error);
        // Afficher une notification d'erreur si la déconnexion échoue
        showNotification("Erreur lors de la déconnexion.", true);
    });
}

// --- OBSERVATEUR ÉTAT AUTHENTIFICATION ---
export function setupAuthObserver() {
    auth.onAuthStateChanged(async (user) => {
        console.log("Auth state changed -> User:", user ? user.email : null);

        if (user) {
            let isAuthorized = false;
            try {
                isAuthorized = await checkAuthorization(user.email);
            } catch (error) {
                console.error("Erreur durant la vérification d'autorisation:", error);
                isAuthorized = false;
                showNotification("Erreur lors de la vérification des permissions.", true);
            }

            if (isAuthorized) {
                console.log(`Utilisateur ${user.email} autorisé. Affichage de l'application.`);
                showAppScreen(user); // Géré par ui.js
                initializeAppFeatures(); // Géré par main.js
            } else {
                console.warn(`Accès refusé pour ${user.email}. Votre email n'est pas enregistré comme membre. Déconnexion...`);
                showNotification("Accès refusé. Votre email n'est pas autorisé.", true);
                try {
                    await auth.signOut();
                    // La déconnexion déclenchera onAuthStateChanged avec user=null
                } catch (signOutError) {
                    console.error("Erreur critique lors de la déconnexion forcée:", signOutError);
                    resetAppState(); // Appel de la fonction de ui.js (ou main.js)
                    showLoginScreen("Erreur critique lors de la déconnexion. Veuillez contacter l'administrateur.");
                }
            }
        } else {
            console.log("Utilisateur déconnecté ou état initial non connecté.");
            resetAppState(); // Appel de la fonction de ui.js (ou main.js)
            showLoginScreen(); // Géré par ui.js
        }
    });
    console.log("Observateur d'état d'authentification mis en place.");
}