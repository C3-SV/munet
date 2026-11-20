import Link from "next/link";
import type {
    AnchorHTMLAttributes,
    ButtonHTMLAttributes,
    ReactNode,
} from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-text";
export type ButtonSize = "sm" | "md" | "lg";

type SharedButtonProps = {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    leadingIcon?: ReactNode;
    className?: string;
    children?: ReactNode;
};

type NativeButtonProps = SharedButtonProps &
    ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type LinkButtonProps = SharedButtonProps &
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

export type ButtonProps = NativeButtonProps | LinkButtonProps;

// Alturas táctiles: 44 px en móvil. `sm` baja a 36 px solo en escritorio.
const SIZE_CLASS: Record<ButtonSize, string> = {
    sm: "min-h-11 md:min-h-9 px-3 text-xs",
    md: "min-h-11 px-4 text-sm",
    // Acción principal de formularios de acceso (48 px).
    lg: "min-h-12 px-5 text-base",
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
    primary:
        "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] enabled:hover:opacity-90 disabled:bg-[var(--btn-primary-disabled-bg)] disabled:text-[var(--btn-primary-disabled-fg)]",
    secondary:
        "border border-[var(--border-color)] bg-transparent text-[var(--text-primary)] enabled:hover:bg-[var(--bg-surface-secondary)] disabled:text-[var(--text-muted)]",
    ghost:
        "bg-transparent text-[var(--text-accent)] enabled:hover:bg-[var(--bg-surface-secondary)] disabled:text-[var(--text-muted)]",
    danger:
        "bg-[var(--danger)] text-[var(--bg-surface)] enabled:hover:opacity-90 disabled:bg-[var(--danger-bg)] disabled:text-[var(--danger)]",
    "danger-text":
        "bg-transparent text-[var(--danger)] enabled:hover:bg-[var(--danger-bg)] disabled:text-[var(--text-muted)]",
};

const BASE_CLASS =
    "btn inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-heading font-semibold leading-tight no-underline select-none disabled:cursor-not-allowed";

const buildClassName = (
    variant: ButtonVariant,
    size: ButtonSize,
    className?: string,
) => {
    // `danger-text` siempre mantiene zona táctil de 44 px.
    const sizeClass = variant === "danger-text" ? SIZE_CLASS.md : SIZE_CLASS[size];
    return [BASE_CLASS, sizeClass, VARIANT_CLASS[variant], className]
        .filter(Boolean)
        .join(" ");
};

const Spinner = () => (
    <span
        aria-hidden="true"
        className="inline-block size-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none"
    />
);

// Botón público compartido. Con `href` renderiza un enlace de Next (sin <button> dentro de <a>).
export const Button = (props: ButtonProps) => {
    const {
        variant = "primary",
        size = "md",
        loading = false,
        leadingIcon,
        className,
        children,
        ...rest
    } = props;

    const classes = buildClassName(variant, size, className);
    const content = (
        <>
            {loading ? <Spinner /> : leadingIcon ? <span className="inline-flex shrink-0">{leadingIcon}</span> : null}
            {children}
        </>
    );

    if (typeof rest.href === "string") {
        const { href, ...anchorProps } = rest as Omit<LinkButtonProps, keyof SharedButtonProps>;
        return (
            <Link href={href} className={classes} aria-busy={loading || undefined} {...anchorProps}>
                {content}
            </Link>
        );
    }

    const { type = "button", disabled, ...buttonProps } =
        rest as Omit<NativeButtonProps, keyof SharedButtonProps>;

    return (
        <button
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={classes}
            {...buttonProps}
        >
            {content}
        </button>
    );
};
