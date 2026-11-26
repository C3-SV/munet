// Reacciones a publicaciones: tipos permitidos y resumen por publicación.

export const REACTION_TYPES = ['LIKE', 'LOVE', 'LAUGH', 'CLAP'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export type ReactionCounts = Record<ReactionType, number>;

export type ReactionSummary = {
  // Cantidad de personas por tipo de reacción.
  counts: ReactionCounts;
  // La reacción de quien consulta, o null si no ha reaccionado.
  mine: ReactionType | null;
};

export const isReactionType = (value: unknown): value is ReactionType =>
  typeof value === 'string' && (REACTION_TYPES as readonly string[]).includes(value);

export const emptyReactionSummary = (): ReactionSummary => ({
  counts: { LIKE: 0, LOVE: 0, LAUGH: 0, CLAP: 0 },
  mine: null,
});

type ReactionRow = { post_id: string; membership_id: string; reaction: string };

// Agrupa las filas de reacciones por publicación. Ignora tipos desconocidos (por ejemplo, si
// en el futuro se agregan reacciones y esta versión aún no las conoce).
export const summarizeReactions = (
  postIds: string[],
  rows: ReactionRow[],
  membershipId: string
): Map<string, ReactionSummary> => {
  const summaries = new Map<string, ReactionSummary>(postIds.map((id) => [id, emptyReactionSummary()]));

  for (const row of rows) {
    const summary = summaries.get(row.post_id);

    if (!summary || !isReactionType(row.reaction)) {
      continue;
    }

    summary.counts[row.reaction] += 1;

    if (row.membership_id === membershipId) {
      summary.mine = row.reaction;
    }
  }

  return summaries;
};
