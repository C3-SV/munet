"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Menú de acciones por fila. Se renderiza en un portal para que el
// overflow de la tabla no lo recorte.

export type AdminActionMenuItem = {
    label: string;
    onSelect: () => void;
    danger?: boolean;
    disabled?: boolean;
};

type AdminActionsMenuProps = {
    items: AdminActionMenuItem[];
    label?: string;
    disabled?: boolean;
};

const MENU_WIDTH = 224;
const ESTIMATED_ITEM_HEIGHT = 40;

export const AdminActionsMenu = ({
    items,
    label,
    disabled = false,
}: AdminActionsMenuProps) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const openMenu = () => {
        const rect = buttonRef.current?.getBoundingClientRect();

        if (!rect) {
            return;
        }

        const estimatedHeight = items.length * ESTIMATED_ITEM_HEIGHT + 8;
        const top =
            rect.bottom + 6 + estimatedHeight > window.innerHeight
                ? Math.max(8, rect.top - estimatedHeight - 6)
                : rect.bottom + 6;
        const left = Math.max(
            8,
            Math.min(
                rect.right - MENU_WIDTH,
                window.innerWidth - MENU_WIDTH - 8,
            ),
        );

        setPosition({ top, left });
        setOpen(true);
    };

    useEffect(() => {
        if (!open) {
            return;
        }

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;

            if (
                menuRef.current?.contains(target) ||
                buttonRef.current?.contains(target)
            ) {
                return;
            }

            setOpen(false);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        const closeMenu = () => setOpen(false);

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("resize", closeMenu);
        window.addEventListener("scroll", closeMenu, true);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("resize", closeMenu);
            window.removeEventListener("scroll", closeMenu, true);
        };
    }, [open]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (open) {
                        setOpen(false);
                        return;
                    }

                    openMenu();
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold font-heading transition-colors"
                style={{
                    backgroundColor: "var(--bg-surface-secondary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-secondary)",
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                }}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={label ?? "Acciones"}
            >
                Acciones
                <span aria-hidden>▾</span>
            </button>

            {open &&
                position &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        className="fixed rounded-xl p-1"
                        style={{
                            top: position.top,
                            left: position.left,
                            width: MENU_WIDTH,
                            zIndex: 90,
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-md)",
                        }}
                    >
                        {items.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                disabled={item.disabled}
                                onClick={() => {
                                    setOpen(false);
                                    item.onSelect();
                                }}
                                className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold font-heading transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                    color: item.danger
                                        ? "#ef4444"
                                        : "var(--text-primary)",
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>,
                    document.body,
                )}
        </>
    );
};
