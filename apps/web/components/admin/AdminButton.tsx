"use client";

// Botón primario y secundario reutilizable para el panel admin.

type AdminButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "danger";
    loading?: boolean;
    icon?: string; // URL de ícono Tabler
};

export const AdminButton = ({
    variant = "primary",
    loading = false,
    icon,
    children,
    disabled,
    ...props
}: AdminButtonProps) => {
    const isPrimary = variant === "primary";
    const isDanger = variant === "danger";

    const baseStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        borderRadius: "0.75rem",
        padding: "0.625rem 1.25rem",
        fontSize: "0.875rem",
        fontWeight: 600,
        fontFamily: "var(--font-heading)",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
        border: "none",
        outline: "none",
        transition: "all 0.15s ease",
    };

    const variantStyle: React.CSSProperties = isPrimary
        ? {
              backgroundColor: "var(--text-accent)",
              color: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }
        : isDanger
          ? {
                backgroundColor: "rgba(239,68,68,0.12)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.25)",
            }
          : {
                backgroundColor: "var(--bg-surface-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-color)",
            };

    return (
        <button
            {...props}
            disabled={disabled || loading}
            style={{ ...baseStyle, ...variantStyle, ...props.style }}
            onMouseEnter={(e) => {
                if (!disabled && !loading) {
                    if (isPrimary) {
                        e.currentTarget.style.opacity = "0.88";
                        e.currentTarget.style.transform = "translateY(-1px)";
                    } else if (isDanger) {
                        e.currentTarget.style.backgroundColor =
                            "rgba(239,68,68,0.18)";
                    } else {
                        e.currentTarget.style.backgroundColor =
                            "var(--bg-hover)";
                    }
                }
                props.onMouseEnter?.(e);
            }}
            onMouseLeave={(e) => {
                if (!disabled && !loading) {
                    e.currentTarget.style.opacity = disabled || loading ? "0.6" : "1";
                    e.currentTarget.style.transform = "translateY(0)";
                    if (isPrimary) {
                        // reset handled by opacity
                    } else if (isDanger) {
                        e.currentTarget.style.backgroundColor =
                            "rgba(239,68,68,0.12)";
                    } else {
                        e.currentTarget.style.backgroundColor =
                            "var(--bg-surface-secondary)";
                    }
                }
                props.onMouseLeave?.(e);
            }}
        >
            {loading ? (
                <span
                    className="inline-block animate-spin rounded-full border-2 border-t-transparent"
                    style={{
                        width: 14,
                        height: 14,
                        borderColor: isPrimary
                            ? "rgba(255,255,255,0.6)"
                            : "var(--text-secondary)",
                        borderTopColor: "transparent",
                    }}
                />
            ) : (
                icon && (
                    <img
                        src={icon}
                        className="size-4"
                        style={{
                            filter: isPrimary ? "invert(1)" : "var(--theme-icon-filter)",
                        }}
                        alt=""
                    />
                )
            )}
            {children}
        </button>
    );
};
