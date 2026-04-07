import React, { useMemo, useState } from "react";

type PostDraft = {
    content: string;
    postType: "TEXT" | "POLL";
    pollOptions?: string[];
};

interface PostEditorProps {
    onPublish: (draft: PostDraft) => Promise<void> | void;
    disabled?: boolean;
}

const MAX_POST_LENGTH = 500;
const MAX_POLL_OPTIONS = 10;

export const PostEditor = ({
    onPublish,
    disabled = false,
}: PostEditorProps) => {
    const [postType, setPostType] = useState<"TEXT" | "POLL">("TEXT");
    const [postText, setPostText] = useState<string>("");
    const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
    const [isPublishing, setIsPublishing] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    const normalizedPollOptions = useMemo(
        // Limpia opciones para validacion y envio de encuestas.
        () => pollOptions.map((option) => option.trim()).filter((option) => option.length > 0),
        [pollOptions],
    );

    const canPublishPoll = normalizedPollOptions.length >= 2;
    const canPublishText = Boolean(postText.trim());
    const canPublish =
        !disabled &&
        !isPublishing &&
        (postType === "TEXT" ? canPublishText : canPublishText && canPublishPoll);

    const resetEditor = () => {
        // Resetea formulario tras publicacion exitosa.
        setPostText("");
        setPollOptions(["", ""]);
        setValidationError(null);
    };

    const handlePublish = async () => {
        // Valida reglas de encuesta y delega persistencia al contenedor.
        if (!canPublish) {
            return;
        }

        if (postType === "POLL" && normalizedPollOptions.length < 2) {
            setValidationError("La encuesta debe incluir al menos 2 opciones.");
            return;
        }

        setIsPublishing(true);
        setValidationError(null);

        try {
            await onPublish({
                content: postText.trim(),
                postType,
                pollOptions: postType === "POLL" ? normalizedPollOptions : undefined,
            });
            resetEditor();
        } finally {
            setIsPublishing(false);
        }
    };

    const updatePollOption = (index: number, value: string) => {
        // Actualiza una opcion puntual sin perder el resto del arreglo.
        setPollOptions((current) =>
            current.map((option, itemIndex) => (itemIndex === index ? value : option)),
        );
    };

    const addPollOption = () => {
        // Permite agregar opciones hasta el limite de negocio.
        if (pollOptions.length >= MAX_POLL_OPTIONS) {
            return;
        }

        setPollOptions((current) => [...current, ""]);
    };

    const removePollOption = (index: number) => {
        // Mantiene minimo de 2 opciones para cumplir validacion.
        if (pollOptions.length <= 2) {
            return;
        }

        setPollOptions((current) => current.filter((_, itemIndex) => itemIndex !== index));
    };

    return (
        <div
            className="mb-8 rounded-2xl overflow-hidden"
            style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
            }}
        >
            <div className="px-5 pt-4 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setPostType("TEXT")}
                    className="px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider"
                    style={{
                        backgroundColor:
                            postType === "TEXT" ? "var(--bubble-me-bg)" : "var(--bg-surface-secondary)",
                        color: postType === "TEXT" ? "white" : "var(--text-secondary)",
                        border:
                            postType === "TEXT"
                                ? "1px solid transparent"
                                : "1px solid var(--border-color)",
                    }}
                >
                    Publicacion
                </button>
                <button
                    type="button"
                    onClick={() => setPostType("POLL")}
                    className="px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider"
                    style={{
                        backgroundColor:
                            postType === "POLL" ? "var(--bubble-me-bg)" : "var(--bg-surface-secondary)",
                        color: postType === "POLL" ? "white" : "var(--text-secondary)",
                        border:
                            postType === "POLL"
                                ? "1px solid transparent"
                                : "1px solid var(--border-color)",
                    }}
                >
                    Encuesta
                </button>
            </div>

            <textarea
                value={postText}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setPostText(event.target.value)
                }
                placeholder={postType === "POLL" ? "Escribe la pregunta de la encuesta..." : "Que estas pensando?"}
                maxLength={MAX_POST_LENGTH}
                disabled={disabled || isPublishing}
                className="w-full min-h-28 p-5 text-[15px] font-body focus:outline-none resize-none bg-transparent"
                style={{
                    color: "var(--text-primary)",
                    opacity: disabled ? 0.6 : 1,
                }}
            />

            {postType === "POLL" && (
                <div className="px-5 pb-4 space-y-2">
                    {pollOptions.map((option, index) => (
                        <div key={`poll-option-${index}`} className="flex items-center gap-2">
                            <input
                                value={option}
                                onChange={(event) => updatePollOption(index, event.target.value)}
                                placeholder={`Opcion ${index + 1}`}
                                className="flex-1 rounded-lg px-3 py-2 text-sm font-body outline-none"
                                style={{
                                    backgroundColor: "var(--bg-input)",
                                    border: "1px solid var(--input-border)",
                                    color: "var(--text-primary)",
                                }}
                                disabled={disabled || isPublishing}
                            />
                            {pollOptions.length > 2 && (
                                <button
                                    type="button"
                                    onClick={() => removePollOption(index)}
                                    className="px-2.5 py-2 rounded-lg text-xs font-heading font-bold"
                                    style={{
                                        backgroundColor: "var(--bg-surface-secondary)",
                                        border: "1px solid var(--border-color)",
                                        color: "#b91c1c",
                                    }}
                                >
                                    Quitar
                                </button>
                            )}
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={addPollOption}
                        disabled={pollOptions.length >= MAX_POLL_OPTIONS || disabled || isPublishing}
                        className="text-xs font-heading font-bold uppercase tracking-wider"
                        style={{
                            color:
                                pollOptions.length >= MAX_POLL_OPTIONS || disabled || isPublishing
                                    ? "var(--text-muted)"
                                    : "var(--text-accent)",
                            cursor:
                                pollOptions.length >= MAX_POLL_OPTIONS || disabled || isPublishing
                                    ? "not-allowed"
                                    : "pointer",
                        }}
                    >
                        + Agregar opcion
                    </button>
                </div>
            )}

            <div
                className="flex justify-between items-center px-5 py-3"
                style={{
                    borderTop: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-surface-secondary)",
                }}
            >
                <span className="text-xs font-medium font-body" style={{ color: "var(--text-muted)" }}>
                    {validationError ? validationError : `${postText.length}/${MAX_POST_LENGTH}`}
                </span>
                <button
                    onClick={() => void handlePublish()}
                    disabled={!canPublish}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-body font-semibold transition-all text-sm active:scale-95"
                    style={{
                        backgroundColor: canPublish ? "var(--bubble-me-bg)" : "var(--bg-surface-secondary)",
                        color: canPublish ? "white" : "var(--text-muted)",
                        border: `1px solid ${canPublish ? "transparent" : "var(--border-color)"}`,
                        cursor: canPublish ? "pointer" : "not-allowed",
                    }}
                >
                    {isPublishing ? "Publicando..." : postType === "POLL" ? "Publicar encuesta" : "Publicar"}
                </button>
            </div>
        </div>
    );
};
