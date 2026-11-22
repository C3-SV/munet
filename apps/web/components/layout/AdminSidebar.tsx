"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatRoleLabel } from "../../lib/role-label";
import { useTheme } from "../../lib/theme-context";
import { isAdminRole, useAuthStore } from "../../stores/auth.store";
import {
    IconCalendar,
    IconClose,
    IconCommittees,
    IconDashboard,
    IconDirectory,
    IconFile,
    IconMenu,
    IconShield,
    IconTheme,
} from "../ui/icons";

type AdminNavItem = {
    name: string;
    href: string;
    icon: ReactNode;
    current: boolean;
};

const AdminNavLink = ({ item }: { item: AdminNavItem }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Link
            href={item.href}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group flex min-h-11 items-center gap-x-3 rounded-xl p-3 text-sm font-semibold font-heading"
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
            <span
                className="flex size-5 shrink-0 items-center justify-center"
                style={{
                    color: item.current || isHovered ? "var(--sidebar-active-text)" : "var(--text-secondary)",
                }}
            >
                {item.icon}
            </span>
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
    const activeEventId = useAuthStore((state) => state.activeEventId);
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

    const isParticipantsRoute = pathname?.includes("/participants") ?? false;
    const isCommitteesRoute = pathname?.includes("/committees") ?? false;

    const isAdmin = activeMembership ? isAdminRole(activeMembership.role) : false;
    const moderationHref = activeEventId
        ? `/admin/events/${activeEventId}/moderation`
        : "/admin/events";
    const isModerationRoute = pathname?.includes("/moderation") ?? false;
    const auditHref = activeEventId
        ? `/admin/events/${activeEventId}/audit`
        : "/admin/events";
    const isAuditRoute = pathname?.includes("/audit") ?? false;

    const moderationItem: AdminNavItem = {
        name: "Moderación",
        href: moderationHref,
        icon: <IconShield size={20} />,
        current: isModerationRoute,
    };

    // El moderador solo ve Moderación; el resto del panel es de administradores.
    const navigation: AdminNavItem[] = !isAdmin ? [moderationItem] : [
        {
            name: "Inicio Panel",
            href: "/admin",
            icon: <IconDashboard size={20} />,
            current: pathname === "/admin",
        },
        {
            name: "Eventos",
            href: "/admin/events",
            icon: <IconCalendar size={20} />,
            current:
                (pathname?.startsWith("/admin/events") ?? false) &&
                !isParticipantsRoute &&
                !isCommitteesRoute &&
                !isModerationRoute &&
                !isAuditRoute,
        },
        {
            name: "Comités",
            href: activeEventId
                ? `/admin/events/${activeEventId}/committees`
                : "/admin/events",
            icon: <IconCommittees size={20} />,
            current: isCommitteesRoute,
        },
        {
            name: "Participantes",
            href: activeEventId
                ? `/admin/events/${activeEventId}/participants`
                : "/admin/events",
            icon: <IconDirectory size={20} />,
            current: isParticipantsRoute,
        },
        moderationItem,
        {
            name: "Auditoría",
            href: auditHref,
            icon: <IconFile size={20} />,
            current: isAuditRoute,
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
                    {/* Logo local de tamaño fijo; next/image no aporta aquí. */}
                    <Image
                        alt="MUNET Admin"
                        src="/logo-munet.png"
                        className="h-8 w-auto hover:opacity-80 transition-opacity"
                        style={{ filter: isDark ? "brightness(0) invert(1)" : "none" }}
                        width={954} height={299} unoptimized
                    />
                </Link>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleTheme}
                        className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-xs font-heading font-semibold"
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
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg"
                        style={{
                            backgroundColor: "var(--bg-surface-secondary)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                        }}
                        aria-label="Abrir menú"
                        aria-controls="admin-sidebar"
                        aria-expanded={isMobileMenuOpen}
                    >
                        <IconMenu size={22} />
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
                            {/* Logo local de tamaño fijo; next/image no aporta aquí. */}
                            <Image
                                alt="MUNET Admin"
                                src="/logo-munet.png"
                                className="h-9 w-auto hover:opacity-80 transition-opacity"
                                style={{ filter: isDark ? "brightness(0) invert(1)" : "none" }}
                                width={954} height={299} unoptimized
                            />
                        </Link>
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="md:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-md"
                            style={{ color: "var(--text-secondary)" }}
                            aria-label="Cerrar menú"
                        >
                            <IconClose size={22} />
                        </button>
                    </div>
                    <div
                        className="mt-5 h-0.5 w-full rounded-full"
                        style={{ backgroundColor: "var(--text-accent)", opacity: 0.8 }}
                    />
                    <p
                        className="mt-4 text-sm font-bold font-heading truncate"
                        style={{ color: "var(--text-primary)" }}
                        title={activeEventName}
                    >
                        {activeEventName}
                    </p>
                    <div className="mt-3 flex flex-col gap-1.5">
                        {isAdmin && (
                            <Link
                                href="/select-event"
                                className="inline-flex min-h-11 items-center text-xs font-bold font-heading hover:opacity-80 transition-opacity"
                                style={{ color: "var(--text-accent)" }}
                            >
                                Cambiar evento
                            </Link>
                        )}
                        <Link
                            href="/feed"
                            className="inline-flex min-h-11 items-center text-xs font-bold font-heading hover:opacity-80 transition-opacity"
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
                                <AdminNavLink item={item} />
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
                        className="mb-2 flex min-h-11 w-full items-center gap-x-3 rounded-xl p-3 text-sm font-medium font-heading hover:bg-[var(--bg-hover)]"
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
                            <IconTheme size={16} />
                        </span>
                        {isDark ? "Modo claro" : "Modo oscuro"}
                    </button>

                    <Link
                        href="/profile"
                        className="flex min-h-11 w-full items-center gap-x-3 rounded-2xl p-3 text-left hover:bg-[var(--bg-hover)]"
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
                                className="text-xs font-bold"
                                style={{ color: "var(--text-accent)" }}
                            >
                                {formatRoleLabel(activeMembership?.role ?? "ADMIN")}
                            </span>
                        </div>
                    </Link>

                    <button
                        onClick={handleLogout}
                        className="mt-1 min-h-11 w-full rounded-xl p-2.5 text-xs font-semibold font-heading hover:bg-[var(--bg-hover)]"
                        style={{ color: "var(--danger)" }}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </aside>
        </>
    );
};
