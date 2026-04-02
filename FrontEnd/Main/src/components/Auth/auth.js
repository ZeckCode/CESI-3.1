// src/auth/auth.js
export const TOKEN_KEY = "access_token";
export const LEGACY_TOKEN_KEYS = ["token", "authToken"];
export const USER_KEY = "user";

export function setToken(token) {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);

  // Keep legacy keys in sync so older screens continue to work.
  LEGACY_TOKEN_KEYS.forEach((key) => localStorage.setItem(key, token));
}

export function setAuth({ token, user }) {
  setToken(token);
  if (user !== undefined) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getToken() {
  const canonical = localStorage.getItem(TOKEN_KEY);
  if (canonical) return canonical;

  for (const key of LEGACY_TOKEN_KEYS) {
    const legacy = localStorage.getItem(key);
    if (legacy) {
      localStorage.setItem(TOKEN_KEY, legacy);
      return legacy;
    }
  }

  return null;
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  LEGACY_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(USER_KEY);
}

export function isAuthed() {
  return Boolean(getToken());
}
