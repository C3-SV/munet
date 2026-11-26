"use client";

import React, { useEffect, useId, useState } from "react";
import { getAttachmentDownloadUrl } from "../../lib/api/feed";
import { keyToDelta, stepIndex } from "../../lib/carousel";
import type { PostAttachment } from "../../types/common";
import { ModalDialog } from "../ui/ConfirmDialog";
import { IconChevronLeft, IconChevronRight, IconClose } from "../ui/icons";
import { AttachmentImage } from "./AttachmentImage";

interface AttachmentLightboxProps {
    postId: string;
    token: string;
    eventId: string;
    images: PostAttachment[];
    startIndex: number;
    onClose: () => void;
}

// Visor ampliado de las imágenes de una publicación: una a la vez, con flechas (teclado y
// botones), contador y la opción de abrirla en una pestaña nueva. Usa el diálogo compartido, que
// atrapa el foco, cierra con Esc y devuelve el foco al disparador.
export const AttachmentLightbox = ({
    postId,
    token,
    eventId,
    images,
    startIndex,
    onClose,
}: AttachmentLightboxProps) => {
    const titleId = useId();
    const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(images.length - 1, 0)));
    const [openError, setOpenError] = useState<string | null>(null);
    const current = images[index];

    // Flechas izquierda y derecha cambian de imagen.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const delta = keyToDelta(event.key);

            if (delta !== null) {
                event.preventDefault();
                setIndex((value) => stepIndex(value, delta, images.length));
                setOpenError(null);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [images.length]);

    if (!current) {
        return null;
    }

    const go = (delta: number) => {
        setIndex((value) => stepIndex(value, delta, images.length));
        setOpenError(null);
    };

    const openInNewTab = async () => {
        // La pestaña se abre dentro del clic para que el navegador no la bloquee.
        const tab = window.open("about:blank", "_blank");

        if (tab) {
            tab.opener = null;
        }

        try {
            setOpenError(null);
            const url = await getAttachmentDownloadUrl(postId, { token, eventId }, current.id);

            if (tab) {
                tab.location.href = url;
            } else {
                window.location.assign(url);
            }
        } catch (error) {
            tab?.close();
            setOpenError(error instanceof Error ? error.message : "No se pudo abrir la imagen");
        }
    };

    return (
        <ModalDialog titleId={titleId} onClose={onClose} className="!max-w-5xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <div className="min-w-0">
                    <p id={titleId} className="truncate text-sm font-semibold font-heading" style={{ color: "var(--text-primary)" }}>
                        {current.name}
                    </p>
                    <p className="text-xs font-body" style={{ color: "var(--text-muted)" }} aria-live="polite">
                        Imagen {index + 1} de {images.length}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void openInNewTab()}
                        className="min-h-11 rounded-[var(--radius-sm)] px-3 text-sm font-semibold font-heading md:min-h-9"
                        style={{ border: "1px solid var(--border-color)", color: "var(--text-accent)" }}
                    >
                        Abrir en pestaña
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar visor"
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] md:min-h-9 md:min-w-9"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        <IconClose size={18} />
                    </button>
                </div>
            </div>

            <div className="relative p-2 md:p-4">
                {/* Se vuelve a montar al cambiar de imagen para pedir su propia URL firmada. */}
                <AttachmentImage
                    key={current.id}
                    postId={postId}
                    attachmentId={current.id}
                    name={current.name}
                    token={token}
                    eventId={eventId}
                    eager
                    className="min-h-64 w-full rounded-[var(--radius-sm)]"
                />

                {images.length > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={() => go(-1)}
                            disabled={index === 0}
                            aria-label="Imagen anterior"
                            className="absolute left-3 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-30"
                            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                        >
                            <IconChevronLeft size={20} />
                        </button>
                        <button
                            type="button"
                            onClick={() => go(1)}
                            disabled={index === images.length - 1}
                            aria-label="Imagen siguiente"
                            className="absolute right-3 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-30"
                            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                        >
                            <IconChevronRight size={20} />
                        </button>
                    </>
                )}
            </div>

            {openError && (
                <p role="alert" className="px-4 pb-3 text-xs font-body" style={{ color: "var(--danger)" }}>
                    {openError}
                </p>
            )}
        </ModalDialog>
    );
};
