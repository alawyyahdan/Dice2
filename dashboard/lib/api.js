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
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
  } else {
    // API merespons HTML/teks (misal 404 dari Nginx atau Express server jika NEXT_PUBLIC_API_URL salah)
    const text = await res.text();
    console.error(`API response is NOT JSON (${res.status}): ${text.substring(0, 100)}...`);
    throw new Error(`Koneksi API Gagal (${res.status}). Pastikan NEXT_PUBLIC_API_URL benar di .env!`);
  }
}

export const api = {
  login: (username, password, token) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password, token }) }),

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

  getDeposits: (params = {}) =>
    apiFetch(`/api/deposit/all?${new URLSearchParams(params)}`),

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

  testPayment: (data) =>
    apiFetch('/api/settings/test-payment', { method: 'POST', body: JSON.stringify(data) }),

  depositAction: (id, action) =>
    apiFetch('/api/deposit/action', { method: 'POST', body: JSON.stringify({ id, action }) }),

  depositResync: () =>
    apiFetch('/api/deposit/resync', { method: 'POST' }),

  getAdminProfile: () =>
    apiFetch('/api/admin/profile'),

  updateAdminProfile: (data) =>
    apiFetch('/api/admin/profile', { method: 'PUT', body: JSON.stringify(data) }),

  setup2FA: () =>
    apiFetch('/api/admin/2fa/setup', { method: 'POST' }),

  verify2FA: (token) =>
    apiFetch('/api/admin/2fa/verify', { method: 'POST', body: JSON.stringify({ token }) }),

  disable2FA: (token) =>
    apiFetch('/api/admin/2fa/disable', { method: 'POST', body: JSON.stringify({ token }) }),

  getLeaderboardAdmin: (filter) =>
    apiFetch(`/api/leaderboard/admin?filter=${filter}`),

  getAnalytics: () =>
    apiFetch('/api/analytics'),

  getMaintenanceStats: () =>
    apiFetch('/api/admin/system/stats'),

  clearSystemCache: () =>
    apiFetch('/api/admin/system/clear-cache', { method: 'POST' }),

  resetDatabase: (data) =>
    apiFetch('/api/admin/system/reset-db', { method: 'POST', body: JSON.stringify(data) }),

  getGroups: () =>
    apiFetch('/api/admin/groups'),

  toggleGroup: (id) =>
    apiFetch(`/api/admin/groups/${id}/toggle`, { method: 'PATCH' }),

  deleteGroup: (id) =>
    apiFetch(`/api/admin/groups/${id}`, { method: 'DELETE' }),

  getGroupStats: (id) =>
    apiFetch(`/api/admin/groups/${id}/stats`),

  getPromotions: () => apiFetch('/api/promotions'),
  createPromotion: (data) => apiFetch('/api/promotions', { method: 'POST', body: JSON.stringify(data) }),
  updatePromotion: (id, data) => apiFetch(`/api/promotions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePromotion: (id) => apiFetch(`/api/promotions/${id}`, { method: 'DELETE' }),

};
