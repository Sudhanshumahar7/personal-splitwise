/**
 * Auth Store — Zustand
 * Manages user authentication state globally.
 */

import { create } from 'zustand';
import { authApi } from '../api/client';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // true on initial load while checking session

  // ── Actions ──────────────────────────────────────────────────────────────

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  login: async (email, password) => {
    const response = await authApi.login({ email, password });
    set({ user: response.data, isAuthenticated: true });
    return response.data;
  },

  signup: async (name, email, password) => {
    const response = await authApi.signup({ name, email, password });
    return response.data;
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore errors on logout
    } finally {
      set({ user: null, isAuthenticated: false });
      window.location.href = '/login';
    }
  },

  fetchMe: async () => {
    try {
      const response = await authApi.me();
      set({ user: response.data, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

export default useAuthStore;
