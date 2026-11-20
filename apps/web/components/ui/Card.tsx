import type { CSSProperties } from "react";

// default: caja con borde y sombra suave (contenedores).
// flat: sin sombra ni borde lateral; solo separador inferior (ítems de lista).
// official: borde izquierdo de 4 px en --signal (avisos oficiales).
export type CardVariant = "default" | "flat" | "official";

interface CardProps {
    children: React.ReactNode;
    className?: string;
    variant?: CardVariant;
}

const VARIANT_STYLE: Record<CardVariant, CSSProperties> = {
    default: {
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
    },
    flat: {
        backgroundColor: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-color)",
        borderRadius: "0",
    },
    official: {
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-color)",
        borderLeft: "4px solid var(--signal)",
        borderRadius: "var(--radius-lg)",
    },
};

// El padding lo decide cada uso: la base no impone espacio interior.
export const Card = ({ children, className = "", variant = "default" }: CardProps) => (
    <div className={className} style={VARIANT_STYLE[variant]}>
        {children}
    </div>
);
