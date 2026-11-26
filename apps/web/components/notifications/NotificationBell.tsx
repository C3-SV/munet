"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { formatDateTime } from "../../lib/format-datetime";
import { formatBadge, totalUnread } from "../../lib/notifications";
import { useNotificationsStore } from "../../stores/notifications.store";
import { IconAnnouncements, IconChat } from "../ui/icons";

const BellIcon = ({ size = 20 }: { size?: number }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
);

interface NotificationBellProps {
    // Hacia dónde se abre el panel respecto del botón.
    align?: "left" | "right";
}

// Campana con el total de pendientes. Al abrirla lista los avisos nuevos y los mensajes sin
// leer; cada elemento lleva directamente al contenido.
export const NotificationBell = ({ align = "left" }: NotificationBellProps) => {
    const summary = useNotificationsStore((state) => state.summary);
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const containerRef = useRef<HTMLDivElement>(null);

    const total = totalUnread(summary);
    const badge = formatBadge(total);
    const announcements = summary?.announcements;
    const dms = summary?.dms ?? [];

    // Navegar cierra el panel.
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                aria-label={total > 0 ? `Notificaciones: ${total} sin leer` : "Notificaciones"}
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => setOpen((current) => !current)}
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg"
                style={{
                    backgroundColor: "var(--bg-surface-secondary)",
                    border: "1px solid var(--border-color)",
                    color: total > 0 ? "var(--text-primary)" : "var(--text-secondary)",
                }}
            >
                <BellIcon />
                {badge && (
                    <span
                        data-notification-badge
                        aria-hidden="true"
                        className="absolute -right-1 -top-1 min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5"
                        style={{ backgroundColor: "var(--danger)", color: "#fff" }}
                    >
                        {badge}
                    </span>
                )}
            </button>

            {open && (
                <div
                    id={panelId}
                    role="region"
                    aria-label="Notificaciones"
                    className={`absolute top-full z-50 mt-2 max-h-[70vh] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl p-2 ${align === "right" ? "right-0" : "left-0"}`}
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-md)",
                    }}
                >
                    <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide font-heading" style={{ color: "var(--text-secondary)" }}>
                        Notificaciones
                    </p>

                    {total === 0 && (
                        <p className="px-2 py-4 text-sm font-body" style={{ color: "var(--text-muted)" }}>
                            No tienes nada pendiente.
                        </p>
                    )}

                    {announcements && announcements.unreadCount > 0 && (
                        <section aria-label="Avisos nuevos" className="mt-1">
                            <p className="flex items-center gap-2 px-2 py-1 text-xs font-semibold font-heading" style={{ color: "var(--text-secondary)" }}>
                                <IconAnnouncements size={14} />
                                Avisos nuevos
                            </p>
                            <ul>
                                {announcements.latest.map((item) => (
                                    <li key={item.postId}>
                                        <Link
                                            href={`/feed/${announcements.slug}`}
                                            className="block rounded-lg px-2 py-2 hover:bg-[var(--bg-surface-secondary)]"
                                        >
                                            <span className="block truncate text-sm font-semibold font-heading" style={{ color: "var(--text-primary)" }}>
                                                {item.title || item.excerpt}
                                            </span>
                                            <span className="block truncate text-xs font-body" style={{ color: "var(--text-secondary)" }}>
                                                {item.author.name} · {formatDateTime(item.createdAt)}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            {announcements.unreadCount > announcements.latest.length && (
                                <Link
                                    href={`/feed/${announcements.slug}`}
                                    className="block px-2 py-1 text-xs font-semibold font-heading"
                                    style={{ color: "var(--text-accent)" }}
                                >
                                    Ver los {announcements.unreadCount} avisos nuevos
                                </Link>
                            )}
                        </section>
                    )}

                    {dms.length > 0 && (
                        <section aria-label="Mensajes sin leer" className="mt-1">
                            <p className="flex items-center gap-2 px-2 py-1 text-xs font-semibold font-heading" style={{ color: "var(--text-secondary)" }}>
                                <IconChat size={14} />
                                Mensajes directos
                            </p>
                            <ul>
                                {dms.map((item) => (
                                    <li key={item.conversationId}>
                                        <Link
                                            href={`/chat/${item.conversationId}`}
                                            className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[var(--bg-surface-secondary)]"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold font-heading" style={{ color: "var(--text-primary)" }}>
                                                    {item.otherParticipant.name}
                                                </span>
                                                <span className="block truncate text-xs font-body" style={{ color: "var(--text-secondary)" }}>
                                                    {item.lastMessage}
                                                </span>
                                            </span>
                                            <span
                                                aria-label={`${item.unreadCount} sin leer`}
                                                className="min-w-5 shrink-0 rounded-full px-1.5 text-center text-[11px] font-bold leading-5"
                                                style={{ backgroundColor: "var(--danger)", color: "#fff" }}
                                            >
                                                {formatBadge(item.unreadCount)}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
};
