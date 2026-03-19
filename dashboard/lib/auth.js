export function setToken(token) {
  document.cookie = `admin_token=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 3600}; SameSite=Strict`;
}

export function getToken() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )admin_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearToken() {
  document.cookie = 'admin_token=; path=/; max-age=0';
}

export function isAuthenticated() {
  return !!getToken();
}
