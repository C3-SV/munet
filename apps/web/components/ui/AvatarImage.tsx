"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

interface AvatarImageProps {
    src?: string | null;
    alt?: string;
    className?: string;
    style?: CSSProperties;
    // Se muestra si no hay foto o si la imagen no carga (borrada, sin red, URL inválida).
    fallback: ReactNode;
}

// Foto de perfil con respaldo: si la imagen falla, aparece el avatar predeterminado en vez de
// un icono de imagen rota. Se reinicia al cambiar la foto, así que un cambio se refleja de inmediato.
export const AvatarImage = ({ src, alt = "", className, style, fallback }: AvatarImageProps) => {
    const url = src?.trim() || "";
    const [failedUrl, setFailedUrl] = useState<string | null>(null);

    if (!url || failedUrl === url) {
        return <>{fallback}</>;
    }

    return (
        // Avatares externos de la API: sin next/image porque el host no está en remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element -- avatar de URL dinamica: next/image exige hosts remotos en next.config
        <img
            src={url}
            alt={alt}
            className={className}
            style={style}
            onError={() => setFailedUrl(url)}
        />
    );
};
