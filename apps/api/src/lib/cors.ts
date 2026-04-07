const DEFAULT_WEB_APP_URL = 'http://localhost:3000';

// Normaliza el origen permitido para CORS.
// Acepta:
// - URL completa (http/https)
// - host sin esquema (agrega https por defecto)
// - valor vacío (usa localhost para desarrollo)
export const normalizeAllowedOrigin = (value?: string): string => {
  const trimmedValue = value?.trim();

  // Sin valor configurado: priorizamos DX local para desarrollo.
  if (!trimmedValue) {
    return DEFAULT_WEB_APP_URL;
  }

  // Si ya trae protocolo solo limpiamos slash final para comparar origen exacto.
  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue.replace(/\/+$/, '');
  }

  // Si solo llega host (ej: munet.app), asumimos https por seguridad.
  return `https://${trimmedValue.replace(/\/+$/, '')}`;
};
