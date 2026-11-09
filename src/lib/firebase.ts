import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Helper for saving user profile
export async function saveUserProfile(userId: string, data: Record<string, any>) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firebase saveUserProfile offline/fallback:', err);
    return false;
  }
}

// Helper for saving match record
export async function saveMatchRecord(matchId: string, matchData: Record<string, any>) {
  try {
    const matchRef = doc(db, 'matches', matchId);
    await setDoc(matchRef, { ...matchData, timestamp: new Date().toISOString() });
    return true;
  } catch (err) {
    console.warn('Firebase saveMatchRecord offline/fallback:', err);
    return false;
  }
}
