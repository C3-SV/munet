const DEFAULT_API_URL = "http://localhost:3002";

// Limpia y normaliza base URL para evitar dobles slash al concatenar.
export const normalizeApiBaseUrl = (value?: string): string => {
    const trimmedValue = value?.trim();

    if (!trimmedValue) {
        return DEFAULT_API_URL;
    }

    return trimmedValue.replace(/\/+$/, "");
};

// Construye URL final de API manteniendo formato consistente.
export const buildApiUrl = (baseUrl: string, path: string): string => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    return `${normalizeApiBaseUrl(baseUrl)}${normalizedPath}`;
};

export const API_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
