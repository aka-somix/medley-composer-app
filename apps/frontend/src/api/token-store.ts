const STORAGE_KEY = "medleys.token";

let token: string | null = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
const subscribers = new Set<() => void>();

export function getToken(): string | null {
  return token;
}

export function setToken(next: string | null): void {
  token = next;
  if (typeof localStorage !== "undefined") {
    if (next) localStorage.setItem(STORAGE_KEY, next);
    else localStorage.removeItem(STORAGE_KEY);
  }
  subscribers.forEach((fn) => fn());
}

/** Subscribe to token changes; returns an unsubscribe fn. */
export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
