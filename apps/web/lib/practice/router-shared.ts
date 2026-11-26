import type { EventWall } from "../../types/common.ts";
import type { PracticeState } from "./state.ts";
import { toWallView } from "./views.ts";

// Compartido por router.ts y los manejadores de escritura (router-posts, router-comments, router-profile):
// separarlo evita imports circulares entre ellos.

// Error de la práctica con el estado HTTP que la capa de peticiones debe devolver.
export class PracticeRequestError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "PracticeRequestError";
        this.status = status;
    }
}

// Lo que recibe cada manejador. `params` trae los segmentos `:nombre` ya decodificados.
// Las escrituras validan todo antes de mutar `state`; `released` y `wrote` son la salida hacia la pasarela.
export type PracticeRouteContext = {
    params: Readonly<Record<string, string>>;
    query: URLSearchParams;
    body: unknown;
    state: PracticeState;
    now: Date;
    // Ids de los binarios de adjunto que la escritura libera, para que la pasarela los borre.
    released: string[];
    // Verdadero cuando la escritura cambió el estado; las lecturas lo dejan en falso.
    wrote: boolean;
    // Estado HTTP cuando el manejador lo decide (201 o 200 al crear o reutilizar una conversación).
    status?: number;
};

export const requireParam = (params: Readonly<Record<string, string>>, name: string): string => {
    const value = params[name];
    if (value === undefined) {
        throw new Error(`Falta el parámetro de ruta ${name}.`);
    }
    return value;
};

// Cuerpo como objeto: cualquier otra forma (ausente, texto, lista) se lee como objeto vacío.
export const bodyOf = (body: unknown): Record<string, unknown> =>
    typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

// Texto de un valor del cuerpo; cualquier cosa que no sea texto cuenta como vacío.
export const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

// Id nuevo de la práctica: prefijo, número libre de `seq` y avance del contador.
export const nextId = (state: PracticeState, kind: string): string => {
    const id = `practice-${kind}-${state.seq}`;
    state.seq += 1;
    return id;
};

// Muro visible o error: 404 si no existe, 403 si la persona no tiene acceso.
export const readableWallOrThrow = (state: PracticeState, slug: string, forbidden: string): EventWall => {
    const wall = toWallView(state, slug);
    if (wall === null) {
        throw new PracticeRequestError(404, "Muro no encontrado");
    }
    if (!wall.canAccess) {
        throw new PracticeRequestError(403, forbidden);
    }
    return wall;
};

// Publicación no borrada; una borrada se trata como inexistente.
export const visiblePostOrThrow = (state: PracticeState, postId: string) => {
    const post = state.posts.find((item) => item.id === postId && !item.deleted);
    if (post === undefined) {
        throw new PracticeRequestError(404, "Post no encontrado en este evento");
    }
    return post;
};
