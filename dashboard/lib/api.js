const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )admin_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

export const api = {
  login: (username, password) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getUsers: (params = {}) =>
    apiFetch(`/api/users?${new URLSearchParams(params)}`),

  getUser: (telegramId) =>
    apiFetch(`/api/users/${telegramId}`),

  getBets: (params = {}) =>
    apiFetch(`/api/bets?${new URLSearchParams(params)}`),

  getVolume7d: () =>
    apiFetch(`/api/bets/volume7d`),

  getAngpaos: (params = {}) =>
    apiFetch(`/api/angpao?${new URLSearchParams(params)}`),

  deleteAngpao: (id) =>
    apiFetch(`/api/angpao/${id}`, { method: 'DELETE' }),

  getWithdraws: (params = {}) =>
    apiFetch(`/api/withdraw?${new URLSearchParams(params)}`),

  approveWithdraw: (id, adminNote) =>
    apiFetch(`/api/withdraw/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ adminNote }) }),

  rejectWithdraw: (id, adminNote) =>
    apiFetch(`/api/withdraw/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ adminNote }) }),

  adjustBalance: (telegramId, amount, note, includeTurnover) =>
    apiFetch('/api/balance/adjust', { method: 'PATCH', body: JSON.stringify({ telegramId, amount, note, includeTurnover }) }),

  deleteUser: (telegramId) =>
    apiFetch(`/api/users/${telegramId}`, { method: 'DELETE' }),

  deleteBank: (telegramId, accountNumber) =>
    apiFetch(`/api/users/${telegramId}/bank/${accountNumber}`, { method: 'DELETE' }),

  banUser: (telegramId) =>
    apiFetch(`/api/users/${telegramId}/ban`, { method: 'PUT' }),

  getSettings: () =>
    apiFetch('/api/settings'),

  updateSettings: (data) =>
    apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),

  getSystemStatus: () =>
    apiFetch('/api/settings/status'),
};
