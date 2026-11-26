"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getAttachmentDownloadUrl } from "../../lib/api/feed";

interface AttachmentImageProps {
    postId: string;
    attachmentId: string;
    name: string;
    token: string;
    eventId: string;
    // Carga de inmediato (visor ampliado). Si no, espera a estar por entrar en pantalla.
    eager?: boolean;
    className?: string;
}

// Imagen de un adjunto. La URL firmada dura 60 segundos y se pide a la API solo cuando la imagen
// está por verse, así un muro largo o un carrusel de 10 imágenes no pide todas a la vez. Una vez
// cargada, la imagen se queda aunque la URL venza. Si falla, ofrece reintentar.
export const AttachmentImage = ({
    postId,
    attachmentId,
    name,
    token,
    eventId,
    eager = false,
    className = "",
}: AttachmentImageProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [src, setSrc] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const requestedRef = useRef(-1);

    const load = useCallback(async () => {
        try {
            const url = await getAttachmentDownloadUrl(postId, { token, eventId }, attachmentId);
            setSrc(url);
        } catch {
            setFailed(true);
        }
    }, [attachmentId, eventId, postId, token]);

    useEffect(() => {
        const node = containerRef.current;

        // Cada intento (inicial o «Reintentar») pide la URL una sola vez.
        if (!node || requestedRef.current === attempt) {
            return;
        }

        if (eager || typeof IntersectionObserver === "undefined") {
            requestedRef.current = attempt;
            void load();
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    observer.disconnect();
                    requestedRef.current = attempt;
                    void load();
                }
            },
            { rootMargin: "300px" },
        );

        observer.observe(node);

        return () => observer.disconnect();
    }, [attempt, eager, load]);

    const retry = () => {
        setFailed(false);
        setLoaded(false);
        setSrc(null);
        setAttempt((current) => current + 1);
    };

    return (
        <div
            ref={containerRef}
            className={`flex items-center justify-center ${loaded ? "" : "min-h-40 animate-pulse"} ${className}`}
            style={{ backgroundColor: "var(--bg-surface-secondary)" }}
        >
            {failed ? (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                        No se pudo cargar la imagen.
                    </p>
                    <button
                        type="button"
                        onClick={retry}
                        className="min-h-11 rounded-[var(--radius-sm)] px-3 text-sm font-semibold font-heading md:min-h-9"
                        style={{ border: "1px solid var(--border-color)", color: "var(--text-accent)" }}
                    >
                        Reintentar
                    </button>
                </div>
            ) : (
                src && (
                    // La URL es firmada y externa: next/image no puede optimizarla sin configurar el dominio.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={src}
                        alt={name}
                        referrerPolicy="no-referrer"
                        onLoad={() => setLoaded(true)}
                        onError={() => setFailed(true)}
                        className="block max-h-[70vh] w-auto max-w-full object-contain"
                    />
                )
            )}
            {!loaded && !failed && <span className="sr-only">Cargando imagen</span>}
        </div>
    );
};
