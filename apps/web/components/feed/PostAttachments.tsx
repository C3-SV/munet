"use client";

import React, { useState } from "react";
import { getAttachmentDownloadUrl, removeOwnAttachment } from "../../lib/api/feed";
import { formatFileSize, isImageAttachment, isPdfAttachment } from "../../lib/attachments";
import type { PostAttachment } from "../../types/common";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconFile } from "../ui/icons";
import { AttachmentCarousel } from "./AttachmentCarousel";
import { AttachmentLightbox } from "./AttachmentLightbox";

interface PostAttachmentsProps {
    postId: string;
    token: string;
    eventId: string;
    attachments: PostAttachment[];
    // Lista actualizada tras retirar un archivo.
    onChange: (attachments: PostAttachment[]) => void;
}

// Adjuntos de una publicación: las imágenes en un carrusel (con visor ampliado) y los PDF en una
// lista. El autor puede quitar cada archivo por separado.
export const PostAttachments = ({ postId, token, eventId, attachments, onChange }: PostAttachmentsProps) => {
    const images = attachments.filter((item) => isImageAttachment(item.mimeType));
    const pdfs = attachments.filter((item) => isPdfAttachment(item.mimeType));
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [pendingRemoval, setPendingRemoval] = useState<PostAttachment | null>(null);
    const [error, setError] = useState<string | null>(null);

    const openPdf = async (attachment: PostAttachment) => {
        if (openingId) {
            return;
        }

        // La URL firmada dura 60 segundos: se pide al hacer clic. La pestaña se abre dentro del clic
        // para que el navegador no la bloquee.
        const tab = window.open("about:blank", "_blank");

        if (tab) {
            tab.opener = null;
        }

        try {
            setError(null);
            setOpeningId(attachment.id);
            const url = await getAttachmentDownloadUrl(postId, { token, eventId }, attachment.id);

            if (tab) {
                tab.location.href = url;
            } else {
                window.location.assign(url);
            }
        } catch (openError) {
            tab?.close();
            setError(openError instanceof Error ? openError.message : "No se pudo abrir el adjunto");
        } finally {
            setOpeningId(null);
        }
    };

    const confirmRemoval = async () => {
        const target = pendingRemoval;
        setPendingRemoval(null);

        if (!target?.canRemove || removingId) {
            return;
        }

        try {
            setError(null);
            setRemovingId(target.id);
            await removeOwnAttachment(postId, { token, eventId }, target.id);
            onChange(attachments.filter((item) => item.id !== target.id));
        } catch (removeError) {
            setError(removeError instanceof Error ? removeError.message : "No se pudo retirar el adjunto");
        } finally {
            setRemovingId(null);
        }
    };

    if (attachments.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 space-y-3">
            {images.length > 0 && (
                <AttachmentCarousel
                    postId={postId}
                    token={token}
                    eventId={eventId}
                    images={images}
                    onOpen={setLightboxIndex}
                    onRemove={setPendingRemoval}
                    removingId={removingId}
                />
            )}

            {pdfs.length > 0 && (
                <ul className="space-y-2" aria-label="Documentos PDF">
                    {pdfs.map((pdf) => (
                        <li key={pdf.id} className="flex items-stretch gap-2">
                            <button
                                type="button"
                                onClick={() => void openPdf(pdf)}
                                disabled={openingId === pdf.id}
                                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left hover:bg-[var(--bg-surface-secondary)] disabled:opacity-60"
                                style={{ border: "1px solid var(--border-color)" }}
                                aria-label={`Abrir el PDF ${pdf.name} en una pestaña nueva`}
                            >
                                <span style={{ color: "var(--text-accent)" }}>
                                    <IconFile size={22} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold font-heading" style={{ color: "var(--text-primary)" }}>
                                        {pdf.name}
                                    </span>
                                    <span className="block text-xs font-body" style={{ color: "var(--text-muted)" }}>
                                        {openingId === pdf.id ? "Abriendo..." : `PDF · ${formatFileSize(pdf.size)}`}
                                    </span>
                                </span>
                            </button>
                            {pdf.canRemove && (
                                <Button
                                    variant="danger-text"
                                    size="sm"
                                    onClick={() => setPendingRemoval(pdf)}
                                    disabled={removingId === pdf.id}
                                    loading={removingId === pdf.id}
                                    aria-label={`Quitar el PDF ${pdf.name}`}
                                >
                                    Quitar
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {error && (
                <p role="alert" className="text-xs font-body" style={{ color: "var(--danger)" }}>
                    {error}
                </p>
            )}

            {lightboxIndex !== null && images.length > 0 && (
                <AttachmentLightbox
                    postId={postId}
                    token={token}
                    eventId={eventId}
                    images={images}
                    startIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                />
            )}

            <ConfirmDialog
                open={pendingRemoval !== null}
                title="¿Quitar este archivo?"
                description="El archivo dejará de estar disponible para quienes leen esta publicación. El texto y los demás archivos se conservan."
                confirmLabel="Quitar archivo"
                tone="danger"
                onCancel={() => setPendingRemoval(null)}
                onConfirm={() => void confirmRemoval()}
            />
        </div>
    );
};
