import type { Post } from "../types/common";

export type FeedSortOrder = "recent" | "oldest";

// Una publicación aparece una sola vez; si llega repetida, gana su primera aparición.
const uniqueById = (posts: readonly Post[]): Post[] => {
    const seen = new Set<string>();

    return posts.filter((post) => {
        if (seen.has(post.id)) {
            return false;
        }

        seen.add(post.id);
        return true;
    });
};

// Fecha de fijado en milisegundos; null si falta o no es una fecha válida.
const pinnedTimeOf = (post: Post): number | null => {
    if (!post.pinnedAt) {
        return null;
    }

    const time = Date.parse(post.pinnedAt);
    return Number.isNaN(time) ? null : time;
};

// Fijados: primero el fijado más recientemente; sin fecha de fijado van al final del grupo.
// Si la fecha de fijado coincide, desempata por fecha de publicación descendente.
const comparePinned = (left: Post, right: Post): number => {
    const leftPinned = pinnedTimeOf(left);
    const rightPinned = pinnedTimeOf(right);

    if (leftPinned !== null && rightPinned !== null && leftPinned !== rightPinned) {
        return rightPinned - leftPinned;
    }

    if (leftPinned !== null && rightPinned === null) {
        return -1;
    }

    if (leftPinned === null && rightPinned !== null) {
        return 1;
    }

    return right.timestamp - left.timestamp;
};

// Orden del feed: fijados primero (por fecha de fijado descendente) y, después, el resto por fecha.
// `sortOrder` solo cambia el orden del resto; los fijados siempre van primero.
// Devuelve una lista nueva, sin duplicados; el orden de entrada se conserva entre empates.
export const orderFeedPosts = (posts: readonly Post[], sortOrder: FeedSortOrder = "recent"): Post[] => {
    const unique = uniqueById(posts);
    const pinned = unique.filter((post) => post.isPinned === true).sort(comparePinned);
    const others = unique
        .filter((post) => post.isPinned !== true)
        .sort((left, right) =>
            sortOrder === "oldest" ? left.timestamp - right.timestamp : right.timestamp - left.timestamp,
        );

    return [...pinned, ...others];
};

// Combina publicaciones ya cargadas con otras recibidas (publicación propia, Realtime o paginación).
// Una publicación que ya estaba se sustituye por su versión recibida en el mismo lugar; las nuevas se
// añaden al final. Nunca deja dos entradas con el mismo id. No modifica las listas de entrada.
export const mergeFeedPosts = (current: readonly Post[], incoming: readonly Post[]): Post[] => {
    const latest = new Map<string, Post>();

    incoming.forEach((post) => {
        latest.set(post.id, post);
    });

    const merged = uniqueById(current).map((post) => latest.get(post.id) ?? post);
    const knownIds = new Set(merged.map((post) => post.id));
    const added = [...latest.values()].filter((post) => !knownIds.has(post.id));

    return [...merged, ...added];
};
