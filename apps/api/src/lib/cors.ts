const DEFAULT_WEB_APP_URL = 'http://localhost:3000';

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
