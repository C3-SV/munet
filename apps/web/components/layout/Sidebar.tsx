"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getEventWalls } from "../../lib/api/events";
import { getMyProfile } from "../../lib/api/profiles";
import { useTheme } from "../../lib/theme-context";
import { isAdminRole, useAuthStore } from "../../stores/auth.store";
import type { EventWall } from "../../types/common";

type NavItem = {
    name: string;
    href: string;
    icon: string;
    current: boolean;
    canAccess: boolean;
};

const MenuItem = ({ item, isDark }: { item: NavItem; isDark: boolean }) => (
    <Link
        href={item.href}
        className="group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold font-heading transition-all"
        style={{
            backgroundColor: item.current ? "var(--sidebar-active-bg)" : "transparent",
            color: item.current ? "var(--sidebar-active-text)" : "var(--text-primary)",
            opacity: item.canAccess ? 1 : 0.55,
        }}
    >
        <img
            src={item.icon}
            className="size-5 transition-opacity"
            style={{
                opacity: item.current ? 1 : 0.5,
                filter: isDark ? "invert(1)" : "none",
            }}
            alt=""
        />
        <span className="flex-1">{item.name}</span>
        {!item.canAccess && (
            <img
                src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/lock.svg"
                className="size-4"
                style={{ opacity: 0.7, filter: isDark ? "invert(1)" : "none" }}
                alt="Sin acceso"
            />
        )}
    </Link>
);

const CommitteeItem = ({
    wall,
    pathname,
    isDark,
}: {
    wall: EventWall;
    pathname: string | null;
    isDark: boolean;
}) => {
    const isSelected = pathname === `/feed/${wall.slug}`;

    return (
        <li>
            <Link
                href={`/feed/${wall.slug}`}
                className="flex items-center gap-2 rounded-lg py-2.5 px-3 -ml-3 text-sm font-heading font-medium transition-colors"
                style={{
                    color: isSelected ? "var(--sidebar-active-text)" : "var(--text-secondary)",
                    backgroundColor: isSelected ? "var(--sidebar-active-bg)" : "transparent",
                    opacity: wall.canAccess ? 1 : 0.55,
                }}
            >
                <span className="flex-1 truncate">{wall.committeeName ?? wall.name}</span>
                {!wall.canAccess && (
                    <img
                        src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/lock.svg"
                        className="size-3.5"
                        style={{ opacity: 0.8, filter: isDark ? "invert(1)" : "none" }}
                        alt="Sin acceso"
                    />
                )}
            </Link>
        </li>
    );
};

export const Sidebar = () => {
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === "dark";

    const token = useAuthStore((state) => state.token);
    const activeEventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const memberships = useAuthStore((state) => state.memberships);

    const activeMembership = useMemo(
        () => memberships.find((membership) => membership.id === activeMembershipId) ?? null,
        [activeMembershipId, memberships],
    );

    const [isComitesOpen, setIsComitesOpen] = useState(pathname?.includes("comite") || false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [walls, setWalls] = useState<EventWall[]>([]);
    const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

    const isChatRoom = pathname?.match(/^\/chat\/[a-zA-Z0-9_-]+$/);

    useEffect(() => {
        if (pathname?.includes("comite")) {
            setIsComitesOpen(true);
        }
    }, [pathname]);

    useEffect(() => {
        if (!token || !activeEventId) {
            return;
        }

        let cancelled = false;

        const loadWalls = async () => {
            try {
                const response = await getEventWalls({
                    token,
                    eventId: activeEventId,
                });

                if (!cancelled) {
                    setWalls(response.walls);
                }
            } catch {
                if (!cancelled) {
                    setWalls([]);
                }
            }
        };

        void loadWalls();

        return () => {
            cancelled = true;
        };
    }, [activeEventId, token]);

    useEffect(() => {
        if (!token || !activeEventId) {
            setProfileAvatar(null);
            return;
        }

        let cancelled = false;

        const loadMyProfile = async () => {
            try {
                const profile = await getMyProfile({ token, eventId: activeEventId });

                if (!cancelled) {
                    setProfileAvatar(profile.profile.avatar || null);
                }
            } catch {
                if (!cancelled) {
                    setProfileAvatar(null);
                }
            }
        };

        void loadMyProfile();

        return () => {
            cancelled = true;
        };
    }, [activeEventId, token]);

    const generalWall =
        walls.find((wall) => wall.kind === "general") ??
        walls.find((wall) => !wall.committeeId && wall.kind !== "announcements") ??
        null;

    const announcementsWall = walls.find((wall) => wall.kind === "announcements") ?? null;
    const committeeWalls = walls.filter((wall) => wall.kind === "committee");
    const canSwitchEventFromSidebar = activeMembership ? isAdminRole(activeMembership.role) : false;
    const activeEventName = activeMembership?.eventName ?? "Evento no seleccionado";

    const navigation: NavItem[] = [
        ...(generalWall
            ? [
                  {
                      name: "Muro General",
                      href: `/feed/${generalWall.slug}`,
                      icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/world.svg",
                      current:
                          pathname === `/feed/${generalWall.slug}` || pathname === "/feed",
                      canAccess: generalWall.canAccess,
                  },
              ]
            : []),
        ...(announcementsWall
            ? [
                  {
                      name: "Avisos",
                      href: `/feed/${announcementsWall.slug}`,
                      icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/bell.svg",
                      current: pathname === `/feed/${announcementsWall.slug}`,
                      canAccess: announcementsWall.canAccess,
                  },
              ]
            : []),
    ];

    return (
        <>
            {!isChatRoom && (
                <div
                    className="fixed top-0 left-0 right-0 h-16 z-40 flex items-center justify-between px-4 md:hidden shadow-sm"
                    style={{
                        backgroundColor: "var(--bg-sidebar)",
                        borderBottom: "1px solid var(--border-color)",
                    }}
                >
                    <Link href="/feed" className="shrink-0">
                        <img
                            src="/logo-munet.png"
                            alt="MUNET"
                            className="h-8 w-auto hover:opacity-80 transition-opacity"
                            style={{ filter: isDark ? "brightness(0) invert(1)" : "none" }}
                        />
                    </Link>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            className="px-3 py-2 rounded-lg transition-all text-xs font-heading font-semibold min-w-[6.5rem]"
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
                        >
                            Menu
                        </button>
                    </div>
                </div>
            )}

            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside
                className={`fixed inset-y-0 right-0 md:left-0 md:right-auto z-50 flex h-screen w-64 flex-col px-5 transition-transform duration-300 ease-in-out ${
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
                        <Link href="/feed" className="shrink-0">
                            <img
                                alt="MUNET"
                                src="/logo-munet.png"
                                className="h-9 w-auto hover:opacity-80 transition-opacity"
                                style={{ filter: isDark ? "brightness(0) invert(1)" : "none" }}
                            />
                        </Link>
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="md:hidden p-1.5 rounded-md transition-all"
                            style={{ color: "var(--text-muted)" }}
                        >
                            Close
                        </button>
                    </div>
                    <div
                        className="mt-5 h-0.5 w-full rounded-full"
                        style={{ backgroundColor: "var(--text-accent)", opacity: 0.6 }}
                    />
                    <p
                        className="mt-3 text-[10px] font-extrabold uppercase tracking-widest font-heading"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Evento actual
                    </p>
                    <p
                        className="mt-1 text-sm font-bold font-heading truncate"
                        style={{ color: "var(--text-primary)" }}
                        title={activeEventName}
                    >
                        {activeEventName}
                    </p>
                    {canSwitchEventFromSidebar && (
                        <Link
                            href="/select-event"
                            className="mt-3 text-[11px] font-extrabold uppercase tracking-widest font-heading"
                            style={{ color: "var(--text-accent)" }}
                        >
                            Cambiar evento
                        </Link>
                    )}
                </div>

                <nav className="flex flex-1 flex-col mt-8 overflow-y-auto">
                    <ul className="flex flex-1 flex-col gap-y-6">
                        <li className="space-y-1">
                            {navigation.map((item) => (
                                <MenuItem key={item.name} item={item} isDark={isDark} />
                            ))}
                        </li>

                        <li>
                            <button
                                onClick={() => setIsComitesOpen(!isComitesOpen)}
                                className="group flex w-full items-center gap-x-3 rounded-xl p-3 text-left transition-all"
                                style={{ color: "var(--text-primary)" }}
                            >
                                <img
                                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/users.svg"
                                    className="size-5"
                                    style={{
                                        opacity: 0.5,
                                        filter: isDark ? "invert(1)" : "none",
                                    }}
                                    alt=""
                                />
                                <span className="flex-1 text-sm font-semibold font-heading">
                                    Muros de comites
                                </span>
                                <span style={{ opacity: 0.4 }}>
                                    {isComitesOpen ? "v" : ">"}
                                </span>
                            </button>

                            <div
                                className="mt-1 transition-all duration-300 overflow-hidden"
                                style={{
                                    maxHeight: isComitesOpen ? "50vh" : "0",
                                    opacity: isComitesOpen ? 1 : 0,
                                }}
                            >
                                <ul className="pl-11 pr-1 space-y-1 max-h-[50vh] overflow-y-auto">
                                    {committeeWalls.map((wall) => (
                                        <CommitteeItem
                                            key={wall.id}
                                            wall={wall}
                                            pathname={pathname}
                                            isDark={isDark}
                                        />
                                    ))}
                                    {committeeWalls.length === 0 && (
                                        <li
                                            className="text-xs font-body py-2"
                                            style={{ color: "var(--text-muted)" }}
                                        >
                                            Sin comites disponibles.
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </li>

                        <li>
                            <Link
                                href="/chat"
                                className="group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold font-heading transition-all"
                                style={{
                                    backgroundColor: pathname?.startsWith("/chat")
                                        ? "var(--sidebar-active-bg)"
                                        : "transparent",
                                    color: pathname?.startsWith("/chat")
                                        ? "var(--sidebar-active-text)"
                                        : "var(--text-primary)",
                                }}
                            >
                                <img
                                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/message-circle.svg"
                                    className="size-5 transition-opacity"
                                    style={{
                                        opacity: pathname?.startsWith("/chat") ? 1 : 0.5,
                                        filter: isDark ? "invert(1)" : "none",
                                    }}
                                    alt=""
                                />
                                Mensajes Directos
                            </Link>
                        </li>
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
                        className="flex w-full items-center gap-x-3 rounded-xl p-3 mb-2 text-sm font-medium font-heading transition-all"
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
                        className="flex w-full items-center gap-x-3 rounded-2xl p-3 transition-all group text-left"
                        style={{ color: "var(--text-primary)" }}
                    >
                        <div className="relative shrink-0">
                            <img
                                src={
                                    profileAvatar ??
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        activeMembership?.participantCode ?? "Usuario",
                                    )}&background=E5E7EB&color=111827`
                                }
                                alt="User Profile"
                                className="size-10 rounded-full object-cover"
                                style={{ border: "2px solid var(--border-color)" }}
                            />
                        </div>
                        <div className="flex flex-1 flex-col min-w-0">
                            <span
                                className="text-sm font-bold font-heading leading-tight truncate"
                                style={{ color: "var(--text-primary)" }}
                            >
                                {activeMembership?.participantCode ?? "Participante"}
                            </span>
                            <span
                                className="text-[10px] font-extrabold uppercase tracking-widest"
                                style={{ color: "var(--text-accent)" }}
                            >
                                {activeMembership?.role ?? "ROL"}
                            </span>
                        </div>
                    </Link>
                </div>
            </aside>
        </>
    );
};
