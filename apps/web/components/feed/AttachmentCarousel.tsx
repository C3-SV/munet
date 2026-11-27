"use client";

import React, { useRef, useState } from "react";
import { indexFromScroll, keyToDelta, stepIndex } from "../../lib/carousel";
import type { PostAttachment } from "../../types/common";
import { Button } from "../ui/Button";
import { IconChevronLeft, IconChevronRight } from "../ui/icons";
import { AttachmentImage } from "./AttachmentImage";

interface AttachmentCarouselProps {
    postId: string;
    token: string;
    eventId: string;
    images: PostAttachment[];
    // Abre una imagen en el visor ampliado.
    onOpen: (index: number) => void;
    // Pide quitar una imagen (solo el autor).
    onRemove?: (attachment: PostAttachment) => void;
    removingId?: string | null;
}

const prefersReducedMotion = () => {
    try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
        return false;
    }
};

// Imágenes de una publicación. Con una sola se muestra sin controles; con varias, como carrusel
// deslizable (táctil, flechas y teclado) con contador. Cada imagen pide su URL firmada solo cuando
// la diapositiva está por verse.
export const AttachmentCarousel = ({
    postId,
    token,
    eventId,
    images,
    onOpen,
    onRemove,
    removingId = null,
}: AttachmentCarouselProps) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
    const several = images.length > 1;

    const goTo = (target: number) => {
        const track = trackRef.current;

        if (!track) {
            return;
        }

        const next = stepIndex(target, 0, images.length);
        track.scrollTo({ left: next * track.clientWidth, behavior: prefersReducedMotion() ? "auto" : "smooth" });
        setIndex(next);
    };

    const handleScroll = () => {
        const track = trackRef.current;

        if (track) {
            setIndex(indexFromScroll(track.scrollLeft, track.clientWidth, images.length));
        }
    };

    return (
        <div
            role={several ? "group" : undefined}
            aria-roledescription={several ? "carrusel" : undefined}
            aria-label={several ? `Imágenes de la publicación (${images.length})` : undefined}
            tabIndex={several ? 0 : undefined}
            onKeyDown={(event) => {
                const delta = keyToDelta(event.key);

                if (several && delta !== null && event.target === event.currentTarget) {
                    event.preventDefault();
                    goTo(index + delta);
                }
            }}
            className="relative overflow-hidden rounded-[var(--radius-sm)] focus-visible:outline focus-visible:outline-2"
            style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-surface-secondary)" }}
        >
            <div
                ref={trackRef}
                onScroll={handleScroll}
                className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {images.map((image, position) => (
                    <div
                        key={image.id}
                        role={several ? "group" : undefined}
                        aria-roledescription={several ? "diapositiva" : undefined}
                        aria-label={several ? `${position + 1} de ${images.length}` : undefined}
                        className="relative w-full shrink-0 snap-center"
                    >
                        <button
                            type="button"
                            onClick={() => onOpen(position)}
                            aria-label={`Ver imagen ${image.name} ampliada`}
                            className="block w-full"
                        >
                            {/* Solo la diapositiva activa observa el viewport y pide su URL firmada. */}
                            {position === index ? (
                                <AttachmentImage
                                    postId={postId}
                                    attachmentId={image.id}
                                    name={image.name}
                                    token={token}
                                    eventId={eventId}
                                    className="w-full"
                                />
                            ) : (
                                <div className="min-h-40 w-full" aria-hidden="true" />
                            )}
                        </button>

                        {image.canRemove && onRemove && (
                            <div className="absolute right-2 top-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onRemove(image)}
                                    disabled={removingId === image.id}
                                    loading={removingId === image.id}
                                    aria-label={`Quitar imagen ${image.name}`}
                                >
                                    Quitar
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {several && (
                <>
                    <span
                        className="absolute bottom-2 right-2 rounded-full px-2.5 py-0.5 text-xs font-bold font-heading"
                        style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
                        aria-live="polite"
                    >
                        {index + 1}/{images.length}
                    </span>

                    <button
                        type="button"
                        onClick={() => goTo(index - 1)}
                        disabled={index === 0}
                        aria-label="Imagen anterior"
                        className="absolute left-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-30"
                        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    >
                        <IconChevronLeft size={20} />
                    </button>
                    <button
                        type="button"
                        onClick={() => goTo(index + 1)}
                        disabled={index === images.length - 1}
                        aria-label="Imagen siguiente"
                        className="absolute right-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-30"
                        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    >
                        <IconChevronRight size={20} />
                    </button>

                    <div className="flex items-center justify-center gap-1.5 py-2" role="tablist" aria-label="Elegir imagen">
                        {images.map((image, position) => (
                            <button
                                key={image.id}
                                type="button"
                                role="tab"
                                aria-selected={position === index}
                                aria-label={`Ir a la imagen ${position + 1}`}
                                onClick={() => goTo(position)}
                                className="size-2.5 rounded-full"
                                style={{
                                    backgroundColor: position === index ? "var(--text-accent)" : "var(--border-color)",
                                }}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
