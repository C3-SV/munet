const DEFAULT_WEB_APP_URL = 'http://localhost:3000';

// Normaliza el origen permitido para CORS.
// Acepta:
// - URL completa (http/https)
// - host sin esquema (agrega https por defecto)
// - valor vacío (usa localhost para desarrollo)
export const normalizeAllowedOrigin = (value?: string): string => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return DEFAULT_WEB_APP_URL;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue.replace(/\/+$/, '');
  }

  return `https://${trimmedValue.replace(/\/+$/, '')}`;
};
