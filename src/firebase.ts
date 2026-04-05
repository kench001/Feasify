import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  serverTimestamp, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// --- PRIMARY APP (Used for normal app stuff) ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- SECONDARY APP (Used ONLY for Admins to create users silently) ---
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

// --- AUTHENTICATION FUNCTIONS ---

export async function registerUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
) {
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCred.user.uid;
  await setDoc(doc(db, "users", uid), {
    firstName,
    lastName,
    email,
    createdAt: serverTimestamp(),
  });
  return userCred;
}

export async function loginUser(email: string, password: string) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  return await fbSignOut(auth);
}

// 💥 THE MAGIC FUNCTION: Creates Auth user without logging Admin out
export async function adminCreateUserAuth(email: string, password: string) {
  const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await fbSignOut(secondaryAuth); // Log the new user out of the secondary app immediately
  return userCred.user.uid; // Return the UID so we can save it to Firestore
}

// --- DATABASE FUNCTIONS FOR PROJECTS ---

export async function createProject(userId: string, projectData: any) {
  const docRef = await addDoc(collection(db, "projects"), {
    ...projectData,
    userId: userId,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function getUserProjects(userId: string) {
  const q = query(collection(db, "projects"), where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  }));
}

export async function updateProject(projectId: string, updateData: any) {
  const projectRef = doc(db, "projects", projectId);
  await updateDoc(projectRef, updateData);
}

export async function deleteProject(projectId: string) {
  await deleteDoc(doc(db, "projects", projectId));
}

export { auth, db };