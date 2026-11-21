import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ATTACHMENT_ACCEPT,
    ATTACHMENTS_BACKEND_READY,
    formatFileSize,
    validateAttachment,
} from "../../lib/attachments";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { IconClose, IconFile, IconPaperclip } from "../ui/icons";

type PostDraft = {
    content: string;
    postType: "TEXT" | "POLL";
    pollOptions?: string[];
    attachment?: File;
};

interface PostEditorProps {
    onPublish: (draft: PostDraft) => Promise<void> | void;
    disabled?: boolean;
    // Identifica el borrador guardado en sessionStorage (un borrador por evento y muro).
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
    // Un adjunto como máximo; no se guarda en el borrador (un File no es serializable).
    const [attachment, setAttachment] = useState<File | null>(null);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
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
        setAttachment(null);
        setAttachmentError(null);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        // Valida tipo y tamaño al elegir; un archivo inválido no reemplaza al actual.
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) {
            return;
        }

        const error = validateAttachment(file);
        setAttachmentError(error);

        if (!error) {
            setAttachment(file);
        }
    };

    const removeAttachment = () => {
        setAttachment(null);
        setAttachmentError(null);
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
                attachment: attachment ?? undefined,
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

            {/* El foco se dibuja en el contenedor: el Card recorta (overflow-hidden) cualquier outline externo. */}
            <div className="mx-5 mt-3 mb-4 rounded-[var(--radius-sm)] border border-[var(--input-border)] bg-[var(--bg-input)] focus-within:border-[var(--input-focus)] focus-within:shadow-[0_0_0_1px_var(--input-focus)]">
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
                    className="block w-full min-h-28 px-4 py-3 text-[15px] font-body outline-none focus-visible:outline-none resize-none bg-transparent"
                    style={{
                        color: "var(--text-primary)",
                        opacity: disabled ? 0.6 : 1,
                    }}
                />
            </div>

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

            {(attachment || attachmentError) && (
                <div className="px-5 pb-4 space-y-2">
                    {attachment && (
                        <div
                            className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2"
                            style={{
                                border: "1px solid var(--border-color)",
                                backgroundColor: "var(--bg-surface-secondary)",
                            }}
                        >
                            <span style={{ color: "var(--text-accent)" }}>
                                <IconFile size={20} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p
                                    className="truncate text-sm font-semibold font-heading"
                                    style={{ color: "var(--text-primary)" }}
                                    title={attachment.name}
                                >
                                    {attachment.name}
                                </p>
                                <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
                                    {formatFileSize(attachment.size)}
                                    {!ATTACHMENTS_BACKEND_READY &&
                                        " · El servidor aún no guarda adjuntos: se publicará sin el archivo."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={removeAttachment}
                                aria-label={`Quitar adjunto ${attachment.name}`}
                                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] md:min-h-9 md:min-w-9"
                            >
                                <IconClose size={16} />
                            </button>
                        </div>
                    )}
                    {attachmentError && (
                        <p role="alert" className="text-xs font-body" style={{ color: "var(--danger)" }}>
                            {attachmentError}
                        </p>
                    )}
                </div>
            )}

            <div
                className="flex flex-wrap justify-between items-center gap-3 px-5 py-3"
                style={{
                    borderTop: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-surface-secondary)",
                }}
            >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ATTACHMENT_ACCEPT}
                        onChange={handleFileChange}
                        disabled={disabled || isPublishing}
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden="true"
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon={<IconPaperclip size={16} />}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || isPublishing}
                        aria-label="Adjuntar archivo, JPG o PNG hasta 5 MB, o PDF hasta 20 MB"
                    >
                        Adjuntar
                    </Button>
                    <span
                        className="min-w-0 text-xs font-medium font-body"
                        role={validationError ? "alert" : undefined}
                        style={{ color: validationError ? "var(--danger)" : "var(--text-muted)" }}
                    >
                        {validationError
                            ? validationError
                            : showCounter
                              ? `${postText.length}/${MAX_POST_LENGTH}`
                              : ""}
                    </span>
                </div>
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
