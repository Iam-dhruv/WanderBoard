import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  updateProfile,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { ok, err, type Result, type AppUser } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();
// Request email scope so we always get the user's email from Google
googleProvider.addScope('email');

// After any sign-up, write a user profile doc to Firestore.
// This creates the /users/{uid} document used by security rules.
async function createUserDocument(uid: string, displayName: string, email: string) {
  await setDoc(
    doc(db, 'users', uid),
    { uid, displayName, email, createdAt: serverTimestamp() },
    { merge: true }  // idempotent — safe to call on repeated sign-ins
  );
}

export async function ensureUserDocumentForUser(user: User): Promise<void> {
  await createUserDocument(
    user.uid,
    user.displayName ?? 'Traveler',
    user.email ?? ''
  );
}

function toAppUser(cred: UserCredential): AppUser {
  const u = cred.user;
  return {
    uid:         u.uid,
    email:       u.email,
    displayName: u.displayName,
    photoURL:    u.photoURL,
  };
}

// ─── Map Firebase error codes → human-readable messages ──────────────────────
// Never expose raw Firebase error codes to the UI.

function mapAuthError(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use':    'An account with this email already exists.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/user-not-found':          'Invalid email or password.',
    'auth/wrong-password':          'Invalid email or password.',
    'auth/invalid-credential':      'Invalid email or password.',
    'auth/too-many-requests':       'Too many attempts. Please wait a moment and try again.',
    'auth/popup-closed-by-user':    'Sign-in cancelled.',
    'auth/network-request-failed':  'Network error. Check your connection and try again.',
  };
  return map[code] ?? 'An unexpected error occurred. Please try again.';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<Result<AppUser>> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await createUserDocument(cred.user.uid, displayName, email);
    return ok(toAppUser(cred));
  } catch (e: any) {
    return err(mapAuthError(e.code));
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<Result<AppUser>> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDocumentForUser(cred.user);
    return ok(toAppUser(cred));
  } catch (e: any) {
    return err(mapAuthError(e.code));
  }
}

export async function signInWithGoogle(): Promise<Result<AppUser>> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    // For Google sign-in, create the user doc on first sign-in (merge is safe)
    await ensureUserDocumentForUser(cred.user);
    return ok(toAppUser(cred));
  } catch (e: any) {
    return err(mapAuthError(e.code));
  }
}

export async function signOut(): Promise<Result<void>> {
  try {
    await fbSignOut(auth);
    return ok(undefined);
  } catch (e: any) {
    return err('Failed to sign out. Please try again.');
  }
}
