import { API_URL, buildApiUrl } from "./base-url";

export class ApiError extends Error {
    status: number;
    payload: unknown;

    constructor(message: string, status: number, payload: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.payload = payload;
    }
}

type RequestOptions = {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    token: string;
    eventId?: string | null;
    body?: unknown;
    cache?: RequestCache;
};

export const requestApi = async <T>(
    path: string,
    { method = "GET", token, eventId, body, cache = "no-store" }: RequestOptions,
): Promise<T> => {
    // Cliente base para requests autenticados; agrega token y evento activo.
    const response = await fetch(buildApiUrl(API_URL, path), {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(eventId ? { "x-event-id": eventId } : {}),
        },
        cache,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const payload = await response.json().catch(() => ({}));

    // Homologa errores backend para manejo centralizado en UI.
    if (!response.ok) {
        throw new ApiError(
            (payload as { error?: string })?.error ?? "Error en la solicitud",
            response.status,
            payload,
        );
    }

    return payload as T;
};
