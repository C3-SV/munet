"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../ui/Button";

// Acciones de una fila del panel admin: una acción primaria siempre visible y,
// si hay más, un menú "Más acciones" con teclado (flechas, Inicio, Fin), Esc y
// devolución del foco al disparador.

export type RowActionItem = {
    label: string;
    href?: string;
    onSelect?: () => void;
    tone?: "default" | "danger";
};

type RowActionsProps = {
    primary: { label: string; href: string };
    items?: RowActionItem[];
    // Nombre accesible del disparador. Conviene incluir la fila, p. ej. "Más acciones para Evento 2026".
    menuLabel?: string;
};

const MENU_ITEM_CLASS =
    "flex min-h-11 w-full items-center rounded-[var(--radius-sm)] px-3 text-left text-sm font-semibold font-heading hover:bg-[var(--bg-surface-secondary)] md:min-h-9";

const IconMore = () => (
    <svg
        aria-hidden="true"
        focusable="false"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
    >
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
    </svg>
);

export const RowActions = ({
    primary,
    items = [],
    menuLabel = "Más acciones",
}: RowActionsProps) => {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLUListElement>(null);
    const menuId = useId();
    const hasItems = items.length > 0;

    // Al abrir, el foco pasa al primer elemento del menú.
    useEffect(() => {
        if (open) {
            menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        }
    }, [open]);

    const getMenuItems = () =>
        Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

    const handleMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
        const menuItems = getMenuItems();

        if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
            return;
        }

        if (menuItems.length === 0) {
            return;
        }

        const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);

        if (event.key === "ArrowDown") {
            event.preventDefault();
            menuItems[(currentIndex + 1) % menuItems.length]?.focus();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            const previousIndex = currentIndex <= 0 ? menuItems.length - 1 : currentIndex - 1;
            menuItems[previousIndex]?.focus();
        } else if (event.key === "Home") {
            event.preventDefault();
            menuItems[0]?.focus();
        } else if (event.key === "End") {
            event.preventDefault();
            menuItems[menuItems.length - 1]?.focus();
        }
    };

    return (
        <div className="inline-flex items-center justify-end gap-2">
            <Button href={primary.href} variant="secondary" size="sm">
                {primary.label}
            </Button>

            {hasItems && (
                <div
                    ref={wrapperRef}
                    className="relative"
                    onBlur={(event) => {
                        // Cierra el menú cuando el foco sale del disparador y del menú.
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setOpen(false);
                        }
                    }}
                >
                    <button
                        ref={triggerRef}
                        type="button"
                        aria-label={menuLabel}
                        aria-haspopup="menu"
                        aria-expanded={open}
                        aria-controls={menuId}
                        onClick={() => setOpen((value) => !value)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-secondary)] md:min-h-9 md:min-w-9"
                    >
                        <IconMore />
                    </button>

                    {open && (
                        <ul
                            id={menuId}
                            ref={menuRef}
                            role="menu"
                            aria-label={menuLabel}
                            onKeyDown={handleMenuKeyDown}
                            // Evita que el clic en un elemento quite el foco antes de ejecutarlo.
                            onMouseDown={(event) => event.preventDefault()}
                            className="absolute right-0 top-full z-20 mt-1 w-52 space-y-0.5 rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-[var(--bg-surface)] p-1.5"
                            style={{ boxShadow: "var(--shadow-md)" }}
                        >
                            {items.map((item) => {
                                const toneClass =
                                    item.tone === "danger"
                                        ? "text-[var(--danger)]"
                                        : "text-[var(--text-primary)]";

                                return (
                                    <li key={item.label} role="none">
                                        {item.href ? (
                                            <Link
                                                role="menuitem"
                                                href={item.href}
                                                className={`${MENU_ITEM_CLASS} ${toneClass}`}
                                                onClick={() => setOpen(false)}
                                            >
                                                {item.label}
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                role="menuitem"
                                                className={`${MENU_ITEM_CLASS} ${toneClass}`}
                                                onClick={() => {
                                                    setOpen(false);
                                                    item.onSelect?.();
                                                }}
                                            >
                                                {item.label}
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};
