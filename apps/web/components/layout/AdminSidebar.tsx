"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../lib/theme-context";
import { useAuthStore } from "../../stores/auth.store";

type AdminNavItem = {
    name: string;
    href: string;
    icon: string;
    current: boolean;
};

const AdminNavLink = ({ item, isDark }: { item: AdminNavItem; isDark: boolean }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Link
            href={item.href}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold font-heading transition-all duration-150"
            style={{
                backgroundColor: item.current
                    ? "var(--sidebar-active-bg)"
                    : isHovered
                        ? "var(--bg-hover)"
                        : "transparent",
                color: item.current
                    ? "var(--sidebar-active-text)"
                    : "var(--text-primary)",
            }}
        >
            <img
                src={item.icon}
                className="size-5 transition-opacity"
                style={{
                    opacity: item.current || isHovered ? 1 : 0.5,
                    filter: isDark ? "invert(1)" : "none",
                }}
                alt=""
            />
            <span className="flex-1">{item.name}</span>
        </Link>
    );
};

export const AdminSidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === "dark";
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const memberships = useAuthStore((state) => state.memberships);
    const logout = useAuthStore((state) => state.logout);

    const activeMembership = useMemo(
        () => memberships.find((m) => m.id === activeMembershipId) ?? null,
        [activeMembershipId, memberships],
    );

    const activeEventName = activeMembership?.eventName ?? "Evento no seleccionado";

    // Cierra el panel movil al cambiar de ruta.
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    const handleLogout = () => {
        logout();
        router.replace("/login");
    };

    const navigation: AdminNavItem[] = [
        {
            name: "Inicio Panel",
            href: "/admin",
            icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/layout-dashboard.svg",
            current: pathname === "/admin",
        },
        {
            name: "Eventos y Comités",
            href: "/admin/events",
            icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/calendar-event.svg",
            current: pathname?.startsWith("/admin/events") ?? false,
        },
        {
            name: "Participantes",
            href: "/admin/participants",
            icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/users.svg",
            current: pathname?.startsWith("/admin/participants") ?? false,
        },
        {
            name: "Asignaciones",
            href: "/admin/assignments",
            icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/user-check.svg",
            current: pathname?.startsWith("/admin/assignments") ?? false,
        },
        {
            name: "Moderación",
            href: "/admin/moderation",
            icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/shield-alert.svg",
            current: pathname?.startsWith("/admin/moderation") ?? false,
        },
    ];

    return (
        <>
            <div
                className="fixed top-0 left-0 right-0 z-40 flex h-16 items-center justify-between px-4 shadow-sm md:hidden"
                style={{
                    backgroundColor: "var(--bg-sidebar)",
                    borderBottom: "1px solid var(--border-color)",
                }}
            >
                <Link href="/admin" className="shrink-0">
                    <img
                        alt="MUNET Admin"
                        src="/logo-munet.png"
                        className="h-8 w-auto hover:opacity-80 transition-opacity"
                        style={{ filter: isDark ? "brightness(0) invert(1)" : "none" }}
                    />
                </Link>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleTheme}
                        className="px-3 py-2 rounded-lg transition-all text-xs font-heading font-semibold"
                        style={{
                            backgroundColor: "var(--bg-surface-secondary)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-secondary)",
                        }}
                        aria-label="Cambiar tema"
                    >
                        {isDark ? "Modo claro" : "Modo oscuro"}
                    </button>
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 rounded-lg transition-all active:scale-95"
                        style={{
                            backgroundColor: "var(--bg-surface-secondary)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                        }}
                        aria-controls="admin-sidebar"
                        aria-expanded={isMobileMenuOpen}
                    >
                        Menú
                    </button>
                </div>
            </div>

            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside
                id="admin-sidebar"
                className={`fixed inset-y-0 right-0 z-50 flex h-screen w-64 flex-col px-5 transition-transform duration-300 ease-in-out md:left-0 md:right-auto ${
                    isMobileMenuOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
                }`}
                style={{
                    backgroundColor: "var(--bg-sidebar)",
                    borderRight: "1px solid var(--border-color)",
                    boxShadow: isMobileMenuOpen ? "var(--shadow-md)" : "var(--shadow-sm)",
                }}
            >
                <div className="flex flex-col mt-8 md:mt-10 shrink-0">
                    <div className="flex items-center justify-between">
                        <Link href="/admin" className="shrink-0">
                            <img
                                alt="MUNET Admin"
                                src="/logo-munet.png"
                                className="h-9 w-auto hover:opacity-80 transition-opacity"
                                style={{ filter: isDark ? "brightness(0) invert(1)" : "none" }}
                            />
                        </Link>
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="md:hidden p-1.5 rounded-md transition-all text-xs font-semibold font-heading"
                            style={{ color: "var(--text-muted)" }}
                            aria-label="Cerrar menú"
                        >
                            Cerrar
                        </button>
                    </div>
                    <div
                        className="mt-5 h-0.5 w-full rounded-full"
                        style={{ backgroundColor: "var(--text-accent)", opacity: 0.8 }}
                    />
                    <p
                        className="mt-4 text-[10px] font-extrabold uppercase tracking-widest font-heading"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Panel de Control
                    </p>
                    <p
                        className="mt-1 text-sm font-bold font-heading truncate"
                        style={{ color: "var(--text-primary)" }}
                        title={activeEventName}
                    >
                        {activeEventName}
                    </p>
                    <div className="mt-3 flex flex-col gap-1.5">
                        <Link
                            href="/select-event"
                            className="text-[11px] font-extrabold uppercase tracking-widest font-heading hover:opacity-80 transition-opacity"
                            style={{ color: "var(--text-accent)" }}
                        >
                            Cambiar evento
                        </Link>
                        <Link
                            href="/feed"
                            className="text-[11px] font-extrabold uppercase tracking-widest font-heading hover:opacity-80 transition-opacity"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            ← Volver al Feed
                        </Link>
                    </div>
                </div>

                <nav aria-label="Navegación administrativa" className="flex flex-1 flex-col mt-8 overflow-y-auto">
                    <ul className="flex flex-col gap-y-1">
                        {navigation.map((item) => (
                            <li key={item.name}>
                                <AdminNavLink item={item} isDark={isDark} />
                            </li>
                        ))}
                    </ul>
                </nav>

                <div
                    className="-mx-5 mt-auto p-4"
                    style={{
                        borderTop: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-sidebar)",
                    }}
                >
                    <button
                        onClick={toggleTheme}
                        className="flex w-full items-center gap-x-3 rounded-xl p-3 mb-2 text-sm font-medium font-heading transition-all hover:bg-[var(--bg-hover)]"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        <span
                            className="size-9 min-w-9 flex items-center justify-center rounded-lg"
                            style={{
                                backgroundColor: "var(--bg-surface-secondary)",
                                border: "1px solid var(--border-color)",
                                color: "var(--text-secondary)",
                            }}
                        >
                            <img
                                src={
                                    isDark
                                        ? "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/sun.svg"
                                        : "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/moon.svg"
                                }
                                className="size-4"
                                style={{ filter: isDark ? "invert(1)" : "none" }}
                                alt=""
                            />
                        </span>
                        {isDark ? "Modo claro" : "Modo oscuro"}
                    </button>

                    <Link
                        href="/profile"
                        className="flex w-full items-center gap-x-3 rounded-2xl p-3 text-left transition-all hover:bg-[var(--bg-hover)]"
                        style={{ color: "var(--text-primary)" }}
                    >
                        <div className="flex flex-1 flex-col min-w-0">
                            <span
                                className="text-sm font-bold font-heading leading-tight truncate"
                                style={{ color: "var(--text-primary)" }}
                            >
                                {activeMembership?.participantCode ?? "Administrador"}
                            </span>
                            <span
                                className="text-[10px] font-extrabold uppercase tracking-widest"
                                style={{ color: "var(--text-accent)" }}
                            >
                                {activeMembership?.role ?? "ADMIN"}
                            </span>
                        </div>
                    </Link>

                    <button
                        onClick={handleLogout}
                        className="mt-1 w-full rounded-xl p-2.5 text-xs font-semibold font-heading transition-all hover:bg-[var(--bg-hover)]"
                        style={{ color: "#ef4444" }}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </aside>
        </>
    );
};
