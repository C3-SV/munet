"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAdminRole, useAuthStore } from "../../stores/auth.store";
import { BrandAttribution } from "../../components/layout/BrandAttribution";
import { formatRoleLabel } from "../../lib/role-label";
import { readLastUsedMembershipId, selectableMemberships } from "../../lib/event-selection";

const SelectEventPage = () => {
    const router = useRouter();

    const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
    const hydrated = useAuthStore((state) => state.hydrated);
    const logout = useAuthStore((state) => state.logout);
    const token = useAuthStore((state) => state.token);
    const activeEventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const memberships = useAuthStore((state) => state.memberships);
    const setActiveMembership = useAuthStore((state) => state.setActiveMembership);
    const enterPractice = useAuthStore((state) => state.enterPractice);
    const refreshContext = useAuthStore((state) => state.refreshContext);
    // Eventos elegibles (sin práctica, activos), en orden de selección: el último usado va primero.
    // La práctica tiene su propia tarjeta: no se lista también como un evento más.
    const choices = useMemo(() => selectableMemberships(memberships), [memberships]);
    const lastUsedMembershipId = readLastUsedMembershipId();

    useEffect(() => {
        // Hidrata sesion guardada antes de aplicar reglas de redireccion.
        hydrateAuth();
    }, [hydrateAuth]);

    useEffect(() => {
        if (!hydrated || !token) {
            return;
        }

        // Trae las membresías vigentes antes de elegir. Si la petición falla, queda la copia guardada.
        void refreshContext().catch(() => undefined);
    }, [hydrated, refreshContext, token]);

    useEffect(() => {
        if (!hydrated) {
            return;
        }

        if (!token) {
            router.replace("/login");
            return;
        }

        // Administradores: siempre eligen evento en esta pantalla.
        const hasAdminMembership = memberships.some((membership) =>
            isAdminRole(membership.role),
        );

        if (hasAdminMembership) {
            return;
        }

        // Participante con varias membresías: elige aquí, también cuando cambia de evento desde el menú.
        if (choices.length > 1) {
            return;
        }

        // Participante con una sola membresía: entra directo. Si ya hay contexto activo, no se cambia.
        const onlyChoice = choices[0];

        if (!onlyChoice) {
            return;
        }

        if (!(activeEventId && activeMembershipId)) {
            setActiveMembership(onlyChoice.id);
        }

        router.replace("/feed");
    }, [activeEventId, activeMembershipId, choices, hydrated, memberships, router, setActiveMembership, token]);

    const handleChooseEvent = (membershipId: string) => {
        // Seleccion explicita de contexto para admins (o multi-evento).
        const membership = memberships.find((item) => item.id === membershipId);
        setActiveMembership(membershipId);
        router.replace(
            membership && isAdminRole(membership.role) ? "/admin" : "/feed",
        );
    };

    const handleEnterPractice = () => {
        // La práctica vive solo en memoria; el layout (main) ya está hidratado y no la descarta.
        enterPractice();
        router.push("/feed");
    };

    return (
        <div
            className="min-h-screen flex flex-col px-4 sm:px-6 py-10"
            style={{ backgroundColor: "var(--bg-base)" }}
        >
            <div className="max-w-4xl mx-auto w-full flex-1">
                <header className="mb-8">
                    <h1
                        className="text-3xl sm:text-4xl font-bold font-heading tracking-tight"
                        style={{ color: "var(--text-accent)" }}
                    >
                        Selecciona tu evento
                    </h1>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {choices.map((membership) => (
                        <button
                            key={membership.id}
                            type="button"
                            onClick={() => handleChooseEvent(membership.id)}
                            className="text-left p-5 border border-[var(--border-color)] hover:border-[var(--text-accent)]"
                            style={{
                                backgroundColor: "var(--bg-surface)",
                                borderRadius: "var(--radius-lg)",
                            }}
                        >
                            <h2
                                className="text-xl font-bold font-heading"
                                style={{ color: "var(--text-primary)" }}
                            >
                                {membership.eventName}
                            </h2>
                            {choices.length > 1 && membership.id === lastUsedMembershipId && (
                                <span
                                    className="mt-2 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold font-heading"
                                    style={{
                                        backgroundColor: "var(--sidebar-active-bg)",
                                        color: "var(--sidebar-active-text)",
                                    }}
                                >
                                    Último usado
                                </span>
                            )}
                            <p className="mt-1 text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                                {formatRoleLabel(membership.role)}
                            </p>
                        </button>
                    ))}
                    {token && (
                        <button
                            type="button"
                            onClick={handleEnterPractice}
                            className="text-left p-5 border border-[var(--border-color)] hover:border-[var(--text-accent)]"
                            style={{
                                backgroundColor: "var(--bg-surface)",
                                borderRadius: "var(--radius-lg)",
                            }}
                        >
                            <h2
                                className="text-xl font-bold font-heading"
                                style={{ color: "var(--text-primary)" }}
                            >
                                Modo práctica
                            </h2>
                            <span
                                className="mt-2 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold font-heading"
                                style={{
                                    backgroundColor: "var(--sidebar-active-bg)",
                                    color: "var(--sidebar-active-text)",
                                }}
                            >
                                Práctica
                            </span>
                            <p className="mt-1 text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                                Prueba la plataforma sin publicar nada de verdad: todo se guarda solo en tu navegador.
                            </p>
                        </button>
                    )}
                </div>

                {choices.length === 0 && (
                    <div
                        className="rounded-2xl p-6 mt-4"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                        }}
                    >
                        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                            No hay membresías activas para este usuario.
                        </p>
                    </div>
                )}

                <div className="mt-8">
                    <button
                        type="button"
                        onClick={() => {
                            logout();
                            router.replace("/login");
                        }}
                        className="rounded-xl px-4 py-2 text-sm font-semibold font-heading transition-[opacity,transform,background-color,border-color,color]"
                        style={{ color: "var(--danger)" }}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </div>
            <div className="mt-10 flex justify-center">
                <BrandAttribution />
            </div>
        </div>
    );
};

export default SelectEventPage;
