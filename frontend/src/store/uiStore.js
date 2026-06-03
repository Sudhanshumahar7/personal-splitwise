/**
 * UI Store — Zustand
 * Manages global UI state: theme, toast notifications.
 */

import { create } from 'zustand';

// Read theme from localStorage on first load
const getInitialTheme = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('theme') || 'light';
  }
  return 'light';
};

let toastId = 0;

const useUIStore = create((set, get) => ({
  // ── Theme ────────────────────────────────────────────────────────────────
  theme: getInitialTheme(),

  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme: newTheme });
  },

  initTheme: () => {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
    set({ theme });
  },

  // ── Toast Notifications ──────────────────────────────────────────────────
  toasts: [],

  addToast: (message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  // Convenience helpers
  toast: {
    success: (msg) => useUIStore.getState().addToast(msg, 'success'),
    error: (msg) => useUIStore.getState().addToast(msg, 'error'),
    info: (msg) => useUIStore.getState().addToast(msg, 'info'),
  },
}));

export default useUIStore;
