import { useSyncExternalStore } from "react";

// Open/closed state of the Settings popup. It lives outside React components because pages are
// remounted when the display currency changes, and the popup must stay open while that happens.
let open = false;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const openSettings = () => {
  open = true;
  emit();
};
export const closeSettings = () => {
  open = false;
  emit();
};
export const useSettingsOpen = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open
  );
