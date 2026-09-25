import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export const ADMINS_COLLECTION = "admins";

export interface AdminSession {
  user: User;
  role: string | null;
  status: string | null;
}

export function subscribeToAdminSession(
  callback: (session: AdminSession | null) => void,
) {
  let unsubscribeDoc: (() => void) | null = null;

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    // Tear down any previous admins/{uid} listener.
    if (unsubscribeDoc) {
      unsubscribeDoc();
      unsubscribeDoc = null;
    }

    if (!user) {
      callback(null);
      return;
    }

    // Only check the Firestore admins/{uid} record
    unsubscribeDoc = onSnapshot(
      doc(db, ADMINS_COLLECTION, user.uid),
      (snap) => {
        const data = snap.data();
        callback({
          user,
          role: (data?.role as string | undefined) ?? null,
          status: (data?.status as string | undefined) ?? null,
        });
      },
      () => {
        // Permission denied means not an admin
        callback({ user, role: null, status: null });
      },
    );
  });

  return () => {
    if (unsubscribeDoc) unsubscribeDoc();
    unsubscribeAuth();
  };
}

export async function signInAdmin(
  email: string,
  password: string,
): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signUpAdmin(
  name: string,
  email: string,
  password: string,
): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  const displayName = name.trim();
  if (displayName) {
    await updateProfile(user, { displayName });
  }
  // Store the account in the `admins` collection. New sign-ups start with
  // role "pending"; an existing admin approves them by changing `role` to
  // "admin" directly in Firestore.
  await setDoc(doc(db, ADMINS_COLLECTION, user.uid), {
    uid: user.uid,
    name: displayName,
    email: email.trim(),
    role: "pending",
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function signOutAdmin(): Promise<void> {
  await firebaseSignOut(auth);
}

export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/operation-not-allowed":
      return "Email/password sign-up is disabled for this project.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Unable to sign in right now. Please try again.";
  }
}
