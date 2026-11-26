"use client";

import { useEffect, useRef, useState } from "react";
import { reactToPost, unreactToPost } from "../../lib/api/reactions";
import { REACTIONS, applyReaction, emptyReactions, type PostReactions, type ReactionType } from "../../lib/reactions";

interface ReactionBarProps {
    postId: string;
    token: string;
    eventId: string;
    reactions?: PostReactions;
    // Resumen actualizado (propio o confirmado por la API) para que la publicación lo conserve.
    onChange: (reactions: PostReactions) => void;
}

// Reacciones de una publicación: se agregan, cambian o retiran con un toque y se ven al instante.
// Si la API falla, la pantalla vuelve al estado anterior y avisa.
export const ReactionBar = ({ postId, token, eventId, reactions, onChange }: ReactionBarProps) => {
    const [pendingType, setPendingType] = useState<ReactionType | null>(null);
    const [error, setError] = useState<string | null>(null);
    const current = reactions ?? emptyReactions();
    // Último resumen mostrado, para volver a él si falla la API.
    const currentRef = useRef(current);

    useEffect(() => {
        currentRef.current = current;
    }, [current]);

    const handleToggle = async (type: ReactionType) => {
        if (pendingType) {
            return;
        }

        const previous = currentRef.current;
        const optimistic = applyReaction(previous, type);

        setPendingType(type);
        setError(null);
        onChange(optimistic);

        try {
            const confirmed =
                optimistic.mine === null
                    ? await unreactToPost(postId, { token, eventId })
                    : await reactToPost(postId, optimistic.mine, { token, eventId });

            onChange(confirmed);
        } catch (reactionError) {
            onChange(previous);
            setError(reactionError instanceof Error ? reactionError.message : "No se pudo registrar tu reacción");
        } finally {
            setPendingType(null);
        }
    };

    return (
        <div className="mt-3">
            <div role="group" aria-label="Reacciones" className="flex flex-wrap items-center gap-2">
                {REACTIONS.map(({ type, emoji, label }) => {
                    const count = current.counts[type];
                    const selected = current.mine === type;

                    return (
                        <button
                            key={type}
                            type="button"
                            data-reaction={type}
                            aria-pressed={selected}
                            aria-label={`${label}${count > 0 ? `: ${count}` : ""}${selected ? " (tu reacción)" : ""}`}
                            title={selected ? `${label}: pulsa para retirarla` : label}
                            disabled={pendingType !== null}
                            onClick={() => void handleToggle(type)}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-heading font-semibold transition-colors disabled:opacity-70 md:min-h-9"
                            style={{
                                color: selected ? "var(--text-accent)" : "var(--text-secondary)",
                                backgroundColor: selected
                                    ? "color-mix(in srgb, var(--text-accent) 12%, transparent)"
                                    : "var(--bg-surface-secondary)",
                                border: selected
                                    ? "1px solid color-mix(in srgb, var(--text-accent) 40%, transparent)"
                                    : "1px solid var(--border-color)",
                            }}
                        >
                            <span aria-hidden="true">{emoji}</span>
                            {count > 0 && <span>{count}</span>}
                        </button>
                    );
                })}
            </div>

            {error && (
                <p role="alert" className="mt-1.5 text-xs font-body" style={{ color: "var(--danger)" }}>
                    {error}
                </p>
            )}
        </div>
    );
};
