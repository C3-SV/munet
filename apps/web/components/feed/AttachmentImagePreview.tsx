"use client";

import React, { useEffect, useRef, useState } from "react";
import { getAttachmentDownloadUrl } from "../../lib/api/feed";

interface AttachmentImagePreviewProps {
    postId: string;
    token: string;
    eventId: string;
    name: string;
    // Abre la imagen a tamaño completo (el mismo flujo que el enlace del archivo).
    onOpen: () => void;
    disabled?: boolean;
}

// Vista previa de un adjunto de imagen. La URL firmada se pide a la API solo cuando la
// imagen está por entrar en pantalla, así un muro largo no pide una URL por cada publicación.
// La URL dura 60 segundos: alcanza para cargar la imagen; si falla, se omite la vista previa
// y el archivo sigue disponible desde su fila.
export const AttachmentImagePreview = ({
    postId,
    token,
    eventId,
    name,
    onOpen,
    disabled = false,
}: AttachmentImagePreviewProps) => {
    const containerRef = useRef<HTMLButtonElement>(null);
    const [src, setSrc] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const node = containerRef.current;

        if (!node || src || failed) {
            return;
        }

        let cancelled = false;

        const load = async () => {
            try {
                const url = await getAttachmentDownloadUrl(postId, { token, eventId });

                if (!cancelled) {
                    setSrc(url);
                }
            } catch {
                if (!cancelled) {
                    setFailed(true);
                }
            }
        };

        if (typeof IntersectionObserver === "undefined") {
            void load();
            return () => {
                cancelled = true;
            };
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    observer.disconnect();
                    void load();
                }
            },
            { rootMargin: "200px" },
        );

        observer.observe(node);

        return () => {
            cancelled = true;
            observer.disconnect();
        };
    }, [postId, token, eventId, src, failed]);

    if (failed) {
        return null;
    }

    return (
        <button
            ref={containerRef}
            type="button"
            onClick={onOpen}
            disabled={disabled}
            aria-label={`Ver imagen ${name} en una pestaña nueva`}
            className={`block w-full overflow-hidden rounded-[var(--radius-sm)] ${loaded ? "" : "min-h-32 animate-pulse"}`}
            style={{
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-surface-secondary)",
            }}
        >
            {src && (
                // La URL es firmada y externa: next/image no puede optimizarla sin configurar el dominio.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src}
                    alt={name}
                    referrerPolicy="no-referrer"
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                    className="mx-auto block max-h-96 w-auto max-w-full object-contain"
                />
            )}
            {!loaded && <span className="sr-only">Cargando vista previa</span>}
        </button>
    );
};
