import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

type PostDraft = {
    content: string;
    postType: "TEXT" | "POLL";
    pollOptions?: string[];
};

interface PostEditorProps {
    onPublish: (draft: PostDraft) => Promise<void> | void;
    disabled?: boolean;
    // Identifica el borrador guardado en sessionStorage (un borrador por muro).
    draftKey?: string;
}

type StoredDraft = {
    postType: "TEXT" | "POLL";
    postText: string;
    pollOptions: string[];
};

const MAX_POST_LENGTH = 500;
const MAX_POLL_OPTIONS = 10;
// El contador solo aparece al superar este porcentaje del límite.
const COUNTER_THRESHOLD = 0.8;

const draftStorageKey = (draftKey: string) => `munet:feed-draft:${draftKey}`;

const readDraft = (draftKey: string): StoredDraft | null => {
    try {
        const raw = window.sessionStorage.getItem(draftStorageKey(draftKey));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<StoredDraft>;
        return {
            postType: parsed.postType === "POLL" ? "POLL" : "TEXT",
            postText: typeof parsed.postText === "string" ? parsed.postText : "",
            pollOptions:
                Array.isArray(parsed.pollOptions) && parsed.pollOptions.length >= 2
                    ? parsed.pollOptions.map((option) => String(option))
                    : ["", ""],
        };
    } catch {
        // Sin acceso a sessionStorage (modo privado, datos bloqueados): se edita sin borrador.
        return null;
    }
};

const writeDraft = (draftKey: string, draft: StoredDraft) => {
    try {
        const isEmpty =
            !draft.postText.trim() && draft.pollOptions.every((option) => !option.trim());
        if (isEmpty && draft.postType === "TEXT") {
            window.sessionStorage.removeItem(draftStorageKey(draftKey));
            return;
        }

        window.sessionStorage.setItem(draftStorageKey(draftKey), JSON.stringify(draft));
    } catch {
        // Si el almacenamiento falla, el borrador simplemente no se conserva.
    }
};

export const PostEditor = ({
    onPublish,
    disabled = false,
    draftKey,
}: PostEditorProps) => {
    const [postType, setPostType] = useState<"TEXT" | "POLL">("TEXT");
    const [postText, setPostText] = useState<string>("");
    const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
    const [isPublishing, setIsPublishing] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    // Evita escribir el borrador antes de haber leído el guardado.
    const [draftReady, setDraftReady] = useState(false);

    useEffect(() => {
        // Restaura el borrador del muro al montar el editor (el padre lo remonta por muro).
        if (draftKey) {
            const stored = readDraft(draftKey);
            if (stored) {
                setPostType(stored.postType);
                setPostText(stored.postText);
                setPollOptions(stored.pollOptions);
            }
        }

        setDraftReady(true);
    }, [draftKey]);

    useEffect(() => {
        // Persiste el borrador en cada cambio, por muro.
        if (!draftKey || !draftReady) {
            return;
        }

        writeDraft(draftKey, { postType, postText, pollOptions });
    }, [draftKey, draftReady, postType, postText, pollOptions]);

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

    const showCounter = postText.length >= MAX_POST_LENGTH * COUNTER_THRESHOLD;

    return (
        <Card className="mb-8 overflow-hidden">
            <div className="px-5 pt-4">
                <div
                    role="group"
                    aria-label="Tipo de publicación"
                    className="inline-flex gap-1 rounded-[var(--radius-sm)] p-1"
                    style={{ border: "1px solid var(--border-color)" }}
                >
                    <Button
                        variant={postType === "TEXT" ? "secondary" : "ghost"}
                        size="sm"
                        aria-pressed={postType === "TEXT"}
                        onClick={() => setPostType("TEXT")}
                    >
                        Publicación
                    </Button>
                    <Button
                        variant={postType === "POLL" ? "secondary" : "ghost"}
                        size="sm"
                        aria-pressed={postType === "POLL"}
                        onClick={() => setPostType("POLL")}
                    >
                        Encuesta
                    </Button>
                </div>
            </div>

            <textarea
                aria-label={postType === "POLL" ? "Pregunta de la encuesta" : "Contenido de la publicación"}
                value={postText}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setPostText(event.target.value)
                }
                placeholder={
                    postType === "POLL"
                        ? "Escribe la pregunta de la encuesta"
                        : "Escribe tu intervención"
                }
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
                                aria-label={`Opción ${index + 1}`}
                                value={option}
                                onChange={(event) => updatePollOption(index, event.target.value)}
                                placeholder={`Opción ${index + 1}`}
                                className="flex-1 min-h-11 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-body outline-none"
                                style={{
                                    backgroundColor: "var(--bg-input)",
                                    border: "1px solid var(--input-border)",
                                    color: "var(--text-primary)",
                                }}
                                disabled={disabled || isPublishing}
                            />
                            {pollOptions.length > 2 && (
                                <Button
                                    variant="danger-text"
                                    size="sm"
                                    onClick={() => removePollOption(index)}
                                    disabled={disabled || isPublishing}
                                >
                                    Quitar
                                </Button>
                            )}
                        </div>
                    ))}

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={addPollOption}
                        disabled={pollOptions.length >= MAX_POLL_OPTIONS || disabled || isPublishing}
                    >
                        + Agregar opción
                    </Button>
                </div>
            )}

            <div
                className="flex flex-wrap justify-between items-center gap-3 px-5 py-3"
                style={{
                    borderTop: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-surface-secondary)",
                }}
            >
                <span
                    className="text-xs font-medium font-body"
                    role={validationError ? "alert" : undefined}
                    style={{ color: validationError ? "var(--danger)" : "var(--text-muted)" }}
                >
                    {validationError
                        ? validationError
                        : showCounter
                          ? `${postText.length}/${MAX_POST_LENGTH}`
                          : ""}
                </span>
                <Button
                    onClick={() => void handlePublish()}
                    disabled={!canPublish}
                    loading={isPublishing}
                >
                    {isPublishing ? "Publicando..." : postType === "POLL" ? "Publicar encuesta" : "Publicar"}
                </Button>
            </div>
        </Card>
    );
};
