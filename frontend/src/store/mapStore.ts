import { useSyncExternalStore } from "react";

interface MapState { satellite: boolean; }
let state: MapState = { satellite: false };
const listeners = new Set<() => void>();

function emit() { listeners.forEach((listener) => listener()); }

export const mapStore = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  toggleBasemap: () => {
    state = { ...state, satellite: !state.satellite };
    emit();
  },
};

export function useMapStore() {
  return useSyncExternalStore(mapStore.subscribe, mapStore.getSnapshot, mapStore.getSnapshot);
}
