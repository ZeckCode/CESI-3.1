const DEFAULT_LOCAL_API = 'http://localhost:8000/api';
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const forceLocalApi = String(import.meta.env.VITE_FORCE_LOCAL_API || '').toLowerCase() === 'true';

// Respect VITE_API_URL by default; allow explicit local override when needed.
export const API_BASE_URL = forceLocalApi ? DEFAULT_LOCAL_API : (configuredApiUrl || DEFAULT_LOCAL_API);
