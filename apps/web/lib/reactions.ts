// Reacciones a publicaciones (me gusta, me encanta, risa y aplausos).

export type ReactionType = "LIKE" | "LOVE" | "LAUGH" | "CLAP";

export type PostReactions = {
    // Cantidad de personas por tipo de reacción.
    counts: Record<ReactionType, number>;
    // Reacción de la persona que mira, o null.
    mine: ReactionType | null;
};

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
    { type: "LIKE", emoji: "👍", label: "Me gusta" },
    { type: "LOVE", emoji: "❤️", label: "Me encanta" },
    { type: "LAUGH", emoji: "😂", label: "Risa" },
    { type: "CLAP", emoji: "👏", label: "Aplausos" },
];

export const emptyReactions = (): PostReactions => ({
    counts: { LIKE: 0, LOVE: 0, LAUGH: 0, CLAP: 0 },
    mine: null,
});

export const totalReactions = (reactions: PostReactions): number =>
    Object.values(reactions.counts).reduce((sum, count) => sum + count, 0);

// Qué debe quedar tras pulsar una reacción: pulsar la propia la retira; otra distinta reemplaza.
export const nextReaction = (mine: ReactionType | null, clicked: ReactionType): ReactionType | null =>
    mine === clicked ? null : clicked;

// Resultado esperado en pantalla al pulsar, sin esperar a la API (actualización optimista).
export const applyReaction = (current: PostReactions, clicked: ReactionType): PostReactions => {
    const next = nextReaction(current.mine, clicked);
    const counts = { ...current.counts };

    if (current.mine) {
        counts[current.mine] = Math.max(0, counts[current.mine] - 1);
    }

    if (next) {
        counts[next] += 1;
    }

    return { counts, mine: next };
};
