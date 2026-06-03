/**
 * Axios API Client — PersonalSplitWise Frontend
 * 
 * - withCredentials: true → sends HTTP-only JWT cookie automatically
 * - Response interceptor → redirects to /login on 401
 * - Base URL from VITE_API_URL env or Vite proxy in dev
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Required for HTTP-only cookie to be sent
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Response Interceptor ──────────────────────────────────────────────────
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — redirect to login
      if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Typed API helpers ──────────────────────────────────────────────────────

export const authApi = {
  signup: (data) => client.post('/api/auth/signup', data),
  login: (data) => client.post('/api/auth/login', data),
  me: () => client.get('/api/auth/me'),
  logout: () => client.post('/api/auth/logout'),
};

export const groupsApi = {
  list: () => client.get('/api/groups'),
  create: (data) => client.post('/api/groups', data),
  get: (groupId) => client.get(`/api/groups/${groupId}`),
  getBalances: (groupId) => client.get(`/api/groups/${groupId}/balances`),
  addMember: (groupId, data) => client.post(`/api/groups/${groupId}/members`, data),
  removeMember: (groupId, userId) => client.delete(`/api/groups/${groupId}/members/${userId}`),
  updateMemberRole: (groupId, userId, data) => client.patch(`/api/groups/${groupId}/members/${userId}/role`, data),
};

export const expensesApi = {
  listByGroup: (groupId) => client.get(`/api/expenses/groups/${groupId}/expenses`),
  create: (data) => client.post('/api/expenses', data),
  update: (expenseId, data) => client.put(`/api/expenses/${expenseId}`, data),
  delete: (expenseId) => client.delete(`/api/expenses/${expenseId}`),
};

export const settlementsApi = {
  create: (data) => client.post('/api/settlements', data),
};

export const chatApi = {
  getHistory: (expenseId) => client.get(`/api/expenses/${expenseId}/messages`),
};

export const dashboardApi = {
  getSummary: () => client.get('/api/dashboard/summary'),
};

export default client;
