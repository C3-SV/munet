// Agrupa comentarios y respuestas en hilos de un solo nivel visual.
//
// En la base una respuesta apunta (parentCommentId) al comentario exacto al que responde, sea
// un comentario o otra respuesta. Para que las conversaciones largas se lean bien, incluso en
// pantallas pequeñas, la interfaz no anida más de un nivel: cada hilo muestra su comentario
// raíz y debajo, en orden cronológico, todas las respuestas, indicando a quién responde cada una.

export type ThreadComment = {
    id: string;
    parentCommentId: string | null;
    createdAt: string;
    timestamp?: number;
};

export type ThreadReply<T extends ThreadComment> = {
    comment: T;
    // Comentario al que responde; null si ya no está disponible (eliminado u oculto).
    replyTo: T | null;
    replyToMissing: boolean;
};

export type Thread<T extends ThreadComment> = {
    root: T;
    // La raíz es una respuesta cuyo comentario original ya no está disponible.
    rootReplyToMissing: boolean;
    replies: ThreadReply<T>[];
};

const timeOf = (comment: ThreadComment) =>
    comment.timestamp ?? new Date(comment.createdAt).getTime();

const compare = (a: ThreadComment, b: ThreadComment) =>
    timeOf(a) - timeOf(b) || a.id.localeCompare(b.id);

export const buildThreads = <T extends ThreadComment>(comments: T[]): Thread<T>[] => {
    const byId = new Map(comments.map((comment) => [comment.id, comment]));

    // Sube por la cadena de respuestas hasta el comentario raíz. Si los datos llegaran con una
    // referencia circular, el comentario se trata como su propia raíz: así cada uno aparece
    // una sola vez y nunca se pierde.
    const rootOf = (comment: T): T => {
        const seen = new Set<string>([comment.id]);
        let current = comment;

        while (current.parentCommentId) {
            const parent = byId.get(current.parentCommentId);

            if (!parent) {
                break;
            }

            if (seen.has(parent.id)) {
                return comment;
            }

            seen.add(parent.id);
            current = parent;
        }

        return current;
    };

    const threads = new Map<string, Thread<T>>();
    const sorted = [...comments].sort(compare);

    for (const comment of sorted) {
        const root = rootOf(comment);

        if (!threads.has(root.id)) {
            threads.set(root.id, {
                root,
                rootReplyToMissing: Boolean(root.parentCommentId) && !byId.has(root.parentCommentId as string),
                replies: [],
            });
        }

        if (comment.id === root.id) {
            continue;
        }

        const replyTo = comment.parentCommentId ? byId.get(comment.parentCommentId) ?? null : null;

        threads.get(root.id)!.replies.push({
            comment,
            replyTo,
            replyToMissing: replyTo === null,
        });
    }

    return [...threads.values()].sort((a, b) => compare(a.root, b.root));
};

// Recorta un texto para citarlo en una línea.
export const excerpt = (text: string, max = 80): string => {
    const compact = text.replace(/\s+/g, " ").trim();

    return compact.length > max ? `${compact.slice(0, max - 1).trimEnd()}…` : compact;
};
