import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getToken, setToken, subscribe } from "./token-store.js";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

interface AuthState {
  user: { email: string } | null;
  token: string | null;
  signIn: () => void;
  signOut: () => void;
}

interface GoogleId {
  initialize: (opts: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
  prompt: () => void;
  disableAutoSelect: () => void;
}

function googleId(): GoogleId | undefined {
  return (globalThis as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/** Fetch the invited caller's email; null if the current token is missing/uninvited. */
async function fetchMe(): Promise<{ email: string } | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) setToken(null);
  if (!res.ok) return null;
  return (await res.json()) as { email: string };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());

  // Initialise GIS once it's available; index.html loads the script `async`, so it
  // may not exist yet on mount — poll briefly until it does.
  useEffect(() => {
    const init = (gid: GoogleId) =>
      gid.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => {
          setToken(resp.credential);
          void fetchMe().then(setUser);
        },
      });

    const existing = googleId();
    if (existing) {
      init(existing);
      return;
    }
    const interval = setInterval(() => {
      const gid = googleId();
      if (gid) {
        init(gid);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Mirror token-store changes (e.g. a 401 clearing the token elsewhere).
  useEffect(() => {
    const unsub = subscribe(() => {
      const next = getToken();
      setTokenState(next);
      if (!next) setUser(null);
    });
    return unsub;
  }, []);

  // On first load with a persisted token, confirm we're still invited.
  useEffect(() => {
    if (!getToken()) return;
    void fetchMe().then(setUser);
  }, []);

  const signIn = useCallback(() => googleId()?.prompt(), []);
  const signOut = useCallback(() => {
    googleId()?.disableAutoSelect();
    setToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, token, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
