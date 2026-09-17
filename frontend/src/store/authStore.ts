import { useSyncExternalStore } from "react";
import type { CurrentUser } from "../services/auth.api";

let user: CurrentUser | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((listener) => listener()); }

export const authStore = {
  getSnapshot: () => user,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setUser: (nextUser: CurrentUser | null) => { user = nextUser; emit(); },
};

export function useAuthStore() {
  return useSyncExternalStore(authStore.subscribe, authStore.getSnapshot, authStore.getSnapshot);
}
