// js/firebaseService.js
//import firebase from 'firebase/compat/app';
//import 'firebase/compat/firestore';
//import 'firebase/compat/auth'; // Si des fonctions ici nécessitent auth
import { firebaseConfig } from './config.js';

// S'assurer que Firebase est initialisé
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const db = firebase.firestore();
export const auth = firebase.auth(); // Exporter auth d'ici est une option
export const googleProvider = new firebase.auth.GoogleAuthProvider(); // Idem

/**
 * Récupère une instance de Firestore.
 * @returns {firebase.firestore.Firestore}
 */
export function getDb() {
    return db;
}

/**
 * Récupère une instance de Firebase Auth.
 * @returns {firebase.auth.Auth}
 */
export function getAuth() {
    return auth;
}

/**
 * Fonction générique pour mettre à jour le statut d'un document.
 * @param {string} collectionName Nom de la collection.
 * @param {string} docId ID du document.
 * @param {string} newStatus Nouveau statut.
 * @returns {Promise<void>}
 */
export async function updateDocumentStatus(collectionName, docId, newStatus) {
    try {
        await db.collection(collectionName).doc(docId).update({ status: newStatus });
        // La notification sera gérée par le module appelant ou une fonction de notif globale
    } catch (error) {
        console.error(`Erreur MàJ statut ${collectionName} doc ${docId}:`, error);
        throw error; // Renvoyer l'erreur pour que le module appelant la gère
    }
}

// Tu pourrais ajouter d'autres fonctions génériques ici si tu en identifies le besoin :
// - fetchData(collectionName, orderByField, orderDirection)
// - addDocument(collectionName, data)
// - updateDocument(collectionName, docId, data)
// - deleteDocument(collectionName, docId)
// Mais attention à ne pas rendre ce service trop complexe ou trop rigide.
// Souvent, les requêtes spécifiques restent mieux dans leurs modules respectifs.