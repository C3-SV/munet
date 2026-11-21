"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getEventWalls } from "../../lib/api/events";
import { getMyProfile } from "../../lib/api/profiles";
import { buildWallNav } from "../../lib/wall-nav";
import { useTheme } from "../../lib/theme-context";
import { canAccessAdminPanel, isAdminRole, isModeratorRole, useAuthStore } from "../../stores/auth.store";
import type { EventWall } from "../../types/common";
import LogoutButton from "../auth/LogOutButton";
import {
    IconAnnouncements,
    IconChat,
    IconChevronDown,
    IconChevronRight,
    IconClose,
    IconCommittees,
    IconDirectory,
    IconGeneral,
    IconMenu,
    IconTheme,
} from "../ui/icons";
import { Button } from "../ui/Button";

type NavItem = {
    name: string;
    href: string;
    icon: ReactNode;
    current: boolean;
};

// Color del icono: activo usa el token de sidebar activo; inactivo, texto secundario.
const navIconColor = (active: boolean) =>
    active ? "var(--sidebar-active-text)" : "var(--text-secondary)";

// Barra de 3 px en acento: marca el elemento activo sin depender solo del color del texto.
const ActiveBar = () => (
    <span
        aria-hidden="true"
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
        style={{ backgroundColor: "var(--text-accent)" }}
    />
);

// Item plano de navegacion lateral (avisos, general, mi comite, chat, directorio).
const MenuItem = ({ item }: { item: NavItem }) => (
    <li>
        <Link
            href={item.href}
            aria-current={item.current ? "page" : undefined}
            className="relative flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold font-heading"
            style={{
                backgroundColor: item.current ? "var(--sidebar-active-bg)" : "transparent",
                color: item.current ? "var(--sidebar-active-text)" : "var(--text-primary)",
            }}
        >
            {item.current && <ActiveBar />}
            <span
                className="flex size-5 shrink-0 items-center justify-center"
                style={{ color: navIconColor(item.current) }}
            >
                {item.icon}
            </span>
            <span className="flex-1 truncate">{item.name}</span>
        </Link>
    </li>
);

// Render de cada muro de comite dentro del grupo colapsable.
const CommitteeItem = ({ wall, activeSlug }: { wall: EventWall; activeSlug: string | null }) => {
    const isSelected = activeSlug === wall.slug;

    return (
        <li>
            <Link
                href={`/feed/${wall.slug}`}
                aria-current={isSelected ? "page" : undefined}
                className="relative flex min-h-11 items-center gap-2 rounded-lg py-2.5 px-3 text-sm font-medium font-heading"
                style={{
                    color: isSelected ? "var(--sidebar-active-text)" : "var(--text-secondary)",
                    backgroundColor: isSelected ? "var(--sidebar-active-bg)" : "transparent",
                }}
            >
                {isSelected && <ActiveBar />}
                <span className="flex-1 truncate">{wall.committeeName ?? wall.name}</span>
            </Link>
        </li>
    );
};

const formatRole = (role: string) => {
    const lower = role.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const getInitials = (name: string) => {
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => Array.from(part)[0]?.toUpperCase() ?? "")
        .join("");

    return initials || "?";
};

export const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === "dark";

    const token = useAuthStore((state) => state.token);
    const activeEventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const memberships = useAuthStore((state) => state.memberships);
    const practice = useAuthStore((state) => state.practice);
    const enterPractice = useAuthStore((state) => state.enterPractice);

    const activeMembership = useMemo(
        () => memberships.find((membership) => membership.id === activeMembershipId) ?? null,
        [activeMembershipId, memberships],
    );

    // null = automatico (abierto si el muro activo es de un comite del grupo); true/false = eleccion del usuario.
    const [committeesManualOpen, setCommitteesManualOpen] = useState<boolean | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [walls, setWalls] = useState<EventWall[]>([]);
    const [profile, setProfile] = useState<{ name: string; avatar: string | null } | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    const isChatRoom = pathname?.match(/^\/chat\/[a-zA-Z0-9_-]+$/);
    // Slug del muro activo a partir de la ruta /feed/<slug>.
    const activeSlug = pathname?.match(/^\/feed\/([^/]+)$/)?.[1] ?? null;

    useEffect(() => {
        // Al cambiar de ruta cierra el drawer movil y devuelve el grupo de comites a su estado automatico.
        setIsMobileMenuOpen(false);
        setCommitteesManualOpen(null);
    }, [pathname]);

    useEffect(() => {
        if (!isMobileMenuOpen) {
            return;
        }

        // Esc cierra el drawer y el foco se lleva al boton de cierre al abrir.
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsMobileMenuOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        closeButtonRef.current?.focus();

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isMobileMenuOpen]);

    useEffect(() => {
        // Carga muros del evento para construir el menu dinamico (buildWallNav filtra por acceso).
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
        // Carga nombre y avatar de perfil para el bloque inferior del sidebar.
        if (!token || !activeEventId) {
            setProfile(null);
            return;
        }

        let cancelled = false;

        const loadMyProfile = async () => {
            try {
                const myProfile = await getMyProfile({ token, eventId: activeEventId });

                if (!cancelled) {
                    const person = myProfile.profile;
                    const fullName = `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim();

                    setProfile({
                        name: person.displayName?.trim() || fullName,
                        avatar: person.avatar || null,
                    });
                }
            } catch {
                if (!cancelled) {
                    setProfile(null);
                }
            }
        };

        void loadMyProfile();

        return () => {
            cancelled = true;
        };
    }, [activeEventId, token]);

    const nav = useMemo(() => buildWallNav(walls, activeSlug), [walls, activeSlug]);
    const { announcements, general, mine, committees, showCommitteeGroup } = nav;

    const hasActiveCommittee = committees.some((wall) => wall.slug === activeSlug);
    const committeesOpen = committeesManualOpen ?? hasActiveCommittee;

    const canSwitchEventFromSidebar = activeMembership ? isAdminRole(activeMembership.role) : false;
    const canOpenAdminPanel = activeMembership ? canAccessAdminPanel(activeMembership.role) : false;
    const isModerator = activeMembership ? isModeratorRole(activeMembership.role) : false;
    const activeEventName = activeMembership?.eventName ?? "Evento no seleccionado";
    const profileName = profile?.name || "Participante";

    // Entra al modo práctica desde el menú; cierra el drawer móvil aunque la ruta no cambie.
    const handleEnterPractice = () => {
        enterPractice();
        setIsMobileMenuOpen(false);
        router.push("/feed");
    };

    const wallItems: NavItem[] = [
        ...(announcements
            ? [
                  {
                      name: "Avisos",
                      href: `/feed/${announcements.slug}`,
                      icon: <IconAnnouncements size={20} />,
                      current: pathname === `/feed/${announcements.slug}`,
                  },
              ]
            : []),
        ...(general
            ? [
                  {
                      name: "General",
                      href: `/feed/${general.slug}`,
                      icon: <IconGeneral size={20} />,
                      current: pathname === `/feed/${general.slug}` || pathname === "/feed",
                  },
              ]
            : []),
        ...(mine
            ? [
                  {
                      name: mine.committeeName ?? mine.name,
                      href: `/feed/${mine.slug}`,
                      icon: <IconCommittees size={20} />,
                      current: pathname === `/feed/${mine.slug}`,
                  },
              ]
            : []),
    ];

    return (
        <>
            {!isChatRoom && (
                <div
                    className="fixed top-0 left-0 right-0 h-16 z-40 flex items-center justify-between gap-2 px-3 md:hidden shadow-sm"
                    style={{
                        backgroundColor: "var(--bg-sidebar)",
                        borderBottom: "1px solid var(--border-color)",
                    }}
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(true)}
                            aria-label="Abrir menú"
                            aria-expanded={isMobileMenuOpen}
                            aria-controls="sidebar-drawer"
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg"
                            style={{
                                backgroundColor: "var(--bg-surface-secondary)",
                                border: "1px solid var(--border-color)",
                                color: "var(--text-primary)",
                            }}
                        >
                            <IconMenu size={22} />
                        </button>
                        <Link href="/feed" className="shrink-0">
                            <Image
                                src="/logo-munet.png"
                                alt="MUNET"
                                className="h-8 w-auto hover:opacity-80 transition-opacity"
                                style={{ filter: isDark ? "brightness(0) invert(1)" : "none" }}
                                width={954} height={299} unoptimized
                            />
                        </Link>
                    </div>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
                        title={isDark ? "Modo claro" : "Modo oscuro"}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg"
                        style={{
                            backgroundColor: "var(--bg-surface-secondary)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-secondary)",
                        }}
                    >
                        <IconTheme size={20} />
                    </button>
                </div>
            )}

            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    aria-hidden="true"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside
                id="sidebar-drawer"
                className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col px-5 transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none md:visible md:translate-x-0 md:left-0 ${
                    isMobileMenuOpen ? "visible translate-x-0" : "invisible -translate-x-full"
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
                            <Image
                                alt="MUNET"
                                src="/logo-munet.png"
                                className="h-9 w-auto hover:opacity-80 transition-opacity"
                                style={{ filter: isDark ? "brightness(0) invert(1)" : "none" }}
                                width={954} height={299} unoptimized
                            />
                        </Link>
                        <button
                            ref={closeButtonRef}
                            type="button"
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
                        style={{ backgroundColor: "var(--text-accent)", opacity: 0.6 }}
                    />
                    <p
                        className="mt-3 text-sm font-bold font-heading truncate"
                        style={{ color: "var(--text-primary)" }}
                        title={activeEventName}
                    >
                        {activeEventName}
                    </p>
                    {practice ? (
                        <span
                            className="mt-2 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold font-heading"
                            style={{
                                backgroundColor: "var(--sidebar-active-bg)",
                                color: "var(--sidebar-active-text)",
                            }}
                        >
                            Práctica
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={handleEnterPractice}
                            className="mt-1 inline-flex min-h-11 w-fit items-center text-sm font-semibold font-heading hover:underline"
                            style={{ color: "var(--text-accent)" }}
                        >
                            Modo práctica
                        </button>
                    )}
                    {canOpenAdminPanel && (
                        <div className="mt-1 flex flex-col">
                            {canSwitchEventFromSidebar && (
                                <Link
                                    href="/select-event"
                                    className="inline-flex min-h-11 items-center text-sm font-semibold font-heading hover:underline"
                                    style={{ color: "var(--text-accent)" }}
                                >
                                    Cambiar evento
                                </Link>
                            )}
                            <Link
                                href={
                                    isModerator && activeMembership
                                        ? `/admin/events/${activeMembership.eventId}/moderation`
                                        : "/admin"
                                }
                                className="inline-flex min-h-11 items-center text-sm font-semibold font-heading hover:underline"
                                style={{ color: "var(--text-primary)" }}
                            >
                                {isModerator ? "Moderación" : "Panel de administración"}
                            </Link>
                        </div>
                    )}
                </div>

                <nav
                    aria-label="Navegación principal"
                    className="flex flex-1 flex-col mt-8 overflow-y-auto"
                >
                    <ul className="flex flex-col gap-y-1">
                        {wallItems.map((item) => (
                            <MenuItem key={item.href} item={item} />
                        ))}

                        {showCommitteeGroup && (
                            <li>
                                <button
                                    type="button"
                                    onClick={() => setCommitteesManualOpen(!committeesOpen)}
                                    aria-expanded={committeesOpen}
                                    aria-controls="sidebar-committees"
                                    className="flex w-full items-center gap-x-3 rounded-xl p-3 text-left text-sm font-semibold font-heading"
                                    style={{
                                        color: hasActiveCommittee
                                            ? "var(--sidebar-active-text)"
                                            : "var(--text-primary)",
                                    }}
                                >
                                    <span
                                        className="flex size-5 shrink-0 items-center justify-center"
                                        style={{ color: navIconColor(hasActiveCommittee) }}
                                    >
                                        <IconCommittees size={20} />
                                    </span>
                                    <span className="flex-1">Comités</span>
                                    <span
                                        className="flex size-5 shrink-0 items-center justify-center"
                                        style={{ color: "var(--text-muted)" }}
                                        aria-hidden="true"
                                    >
                                        {committeesOpen ? (
                                            <IconChevronDown size={16} />
                                        ) : (
                                            <IconChevronRight size={16} />
                                        )}
                                    </span>
                                </button>

                                {/* Animacion por grid-template-rows (0fr <-> 1fr). visibility cambia al final de la transicion al cerrar. */}
                                <div
                                    className="grid transition-[grid-template-rows,visibility] duration-200 ease-out motion-reduce:transition-none"
                                    style={{
                                        gridTemplateRows: committeesOpen ? "1fr" : "0fr",
                                        visibility: committeesOpen ? "visible" : "hidden",
                                    }}
                                >
                                    <div className="min-h-0 overflow-hidden">
                                        <ul
                                            id="sidebar-committees"
                                            inert={!committeesOpen}
                                            className="mt-1 space-y-1 pl-11 pr-1 max-h-[50vh] overflow-y-auto"
                                        >
                                            {committees.map((wall) => (
                                                <CommitteeItem
                                                    key={wall.id}
                                                    wall={wall}
                                                    activeSlug={activeSlug}
                                                />
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </li>
                        )}
                    </ul>

                    <ul className="mt-6 flex flex-col gap-y-1">
                        <MenuItem
                            item={{
                                name: "Mensajes Directos",
                                href: "/chat",
                                icon: <IconChat size={20} />,
                                current: !!pathname?.startsWith("/chat"),
                            }}
                        />
                        <MenuItem
                            item={{
                                name: "Directorio",
                                href: "/directory",
                                icon: <IconDirectory size={20} />,
                                current: !!pathname?.startsWith("/directory"),
                            }}
                        />
                    </ul>
                </nav>

                <div
                    className="-mx-5 mt-auto shrink-0 p-4"
                    style={{
                        borderTop: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-sidebar)",
                    }}
                >
                    <Link
                        href="/profile"
                        className="flex w-full min-h-11 items-center gap-x-3 rounded-2xl p-2 mb-2"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {profile?.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element -- avatar de URL dinamica: next/image exige hosts remotos en next.config
                            <img
                                src={profile.avatar}
                                alt=""
                                className="size-10 shrink-0 rounded-full object-cover"
                                style={{ border: "2px solid var(--border-color)" }}
                            />
                        ) : (
                            <span
                                aria-hidden="true"
                                className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold font-heading"
                                style={{
                                    backgroundColor: "var(--bg-surface-secondary)",
                                    border: "2px solid var(--border-color)",
                                    color: "var(--text-secondary)",
                                }}
                            >
                                {getInitials(profileName)}
                            </span>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span
                                className="text-sm font-bold font-heading leading-tight truncate"
                                style={{ color: "var(--text-primary)" }}
                            >
                                {profileName}
                            </span>
                            {activeMembership && (
                                <span
                                    className="text-xs font-body truncate"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    {formatRole(activeMembership.role)}
                                </span>
                            )}
                        </div>
                    </Link>

                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="flex w-full min-h-11 items-center gap-x-3 rounded-xl p-2 mb-1 text-sm font-medium font-heading"
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

                    <Button variant="ghost" size="sm" href="/guia" className="w-full">
                        Guía de uso
                    </Button>
                    <LogoutButton />
                </div>
            </aside>
        </>
    );
};
