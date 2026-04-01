import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/config/firebase';
import type { AppUser } from '@/types';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  user:    AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Map Firebase User → our AppUser ──────────────────────────────────────────
// Keeps Firebase types out of the rest of the codebase.

function toAppUser(fbUser: User): AppUser {
  return {
    uid:         fbUser.uid,
    email:       fbUser.email,
    displayName: fbUser.displayName,
    photoURL:    fbUser.photoURL,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged fires immediately with the current user (or null),
    // then on every sign-in / sign-out. Unsubscribe on unmount.
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? toAppUser(fbUser) : null);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
