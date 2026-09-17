import { useSyncExternalStore } from "react";

let selectedProjectId: string | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((listener) => listener()); }

export const projectStore = {
  getSnapshot: () => selectedProjectId,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setSelectedProject: (projectId: string | null) => {
    selectedProjectId = projectId;
    emit();
  },
};

export function useSelectedProject() {
  return useSyncExternalStore(projectStore.subscribe, projectStore.getSnapshot, projectStore.getSnapshot);
}
