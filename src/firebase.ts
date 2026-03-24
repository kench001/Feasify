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
} from "firebase/firestore"; // Added new Firestore imports here

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

// --- DATABASE FUNCTIONS FOR PROJECTS ---

// 1. Create a new project
export async function createProject(userId: string, projectData: any) {
  const docRef = await addDoc(collection(db, "projects"), {
    ...projectData,
    userId: userId, // Ties the project to the logged-in user
    createdAt: serverTimestamp()
  });
  return docRef.id; // Returns the new unique project ID
}

// 2. Get all projects for a specific user
export async function getUserProjects(userId: string) {
  // Queries Firestore for projects where the userId matches the logged-in user
  const q = query(collection(db, "projects"), where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  
  // Maps the confusing Firestore data into a clean array we can use in React
  return querySnapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  }));
}

// 3. Update an existing project
export async function updateProject(projectId: string, updateData: any) {
  const projectRef = doc(db, "projects", projectId);
  await updateDoc(projectRef, updateData);
}

// 4. Delete a project
export async function deleteProject(projectId: string) {
  await deleteDoc(doc(db, "projects", projectId));
}

export { auth, db };