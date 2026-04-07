const DEFAULT_LOCAL_API = 'http://localhost:8000/api';
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();

// Always respect configured API URL when provided.
export const API_BASE_URL = configuredApiUrl || DEFAULT_LOCAL_API;
