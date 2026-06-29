// ─── FIREBASE CONFIG ───
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJw5bEHtfNQr3Wzuotyhp2XS9wVQsJ0nw",
  authDomain: "desafiohv-73554.firebaseapp.com",
  projectId: "desafiohv-73554",
  storageBucket: "desafiohv-73554.firebasestorage.app",
  messagingSenderId: "155643760451",
  appId: "1:155643760451:web:02c404b853b4ce64e169f6",
  measurementId: "G-59H6ECJPTR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ─── AUTH ───
export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logout() {
  await signOut(auth);
}

export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

// ─── FIRESTORE: keys que sincronizamos ───
const SYNC_KEYS = [
  'dhv_activities','dhv_history','dhv_total_stars','dhv_spent_stars',
  'dhv_inventory','dhv_purchase_hist','dhv_claimed_ach','dhv_mode',
  'dhv_rest_day','dhv_tutorial_seen'
];

export async function pushToCloud(uid) {
  const data = {};
  SYNC_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) data[k] = v;
  });
  data._updatedAt = serverTimestamp();
  data._version = 2;
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

export async function pullFromCloud(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return false;
  const data = snap.data();
  let restored = 0;
  SYNC_KEYS.forEach(k => {
    if (data[k] !== undefined) {
      localStorage.setItem(k, data[k]);
      restored++;
    }
  });
  return restored > 0;
}

// ─── MERGE INTELIGENTE: prevalece quien tiene más progreso ───
export async function mergeWithCloud(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    // Primera vez: subir local
    await pushToCloud(uid);
    return 'pushed';
  }
  const cloud = snap.data();
  const localStars  = parseInt(localStorage.getItem('dhv_total_stars') || '0');
  const cloudStars  = parseInt(cloud.dhv_total_stars || '0');
  const localHist   = JSON.parse(localStorage.getItem('dhv_history') || '[]');
  const cloudHist   = JSON.parse(cloud.dhv_history || '[]');

  if (cloudStars > localStars || cloudHist.length > localHist.length) {
    // Cloud tiene más progreso → pull
    SYNC_KEYS.forEach(k => { if (cloud[k] !== undefined) localStorage.setItem(k, cloud[k]); });
    return 'pulled';
  } else {
    // Local tiene más → push
    await pushToCloud(uid);
    return 'pushed';
  }
}
