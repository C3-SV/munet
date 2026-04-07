"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAdminRole, useAuthStore } from "../../stores/auth.store";

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

    useEffect(() => {
        hydrateAuth();
    }, [hydrateAuth]);

    useEffect(() => {
        if (!hydrated) {
            return;
        }

        if (!token) {
            router.replace("/login");
            return;
        }

        if (activeEventId && activeMembershipId) {
            router.replace("/feed");
        }
    }, [activeEventId, activeMembershipId, hydrated, router, token]);

    const handleChooseEvent = (membershipId: string) => {
        setActiveMembership(membershipId);
        router.replace("/feed");
    };

    return (
        <div
            className="min-h-screen px-4 sm:px-6 py-10"
            style={{ backgroundColor: "var(--bg-base)" }}
        >
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1
                        className="text-3xl sm:text-4xl font-black font-heading uppercase tracking-tight"
                        style={{ color: "var(--text-accent)" }}
                    >
                        Selecciona tu evento
                    </h1>
                    <p className="mt-2 text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                        Elige el evento con el que quieres trabajar en esta sesion.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {memberships.map((membership) => (
                        <button
                            key={membership.id}
                            type="button"
                            onClick={() => handleChooseEvent(membership.id)}
                            className="text-left rounded-2xl p-5 transition-all hover:scale-[1.01] active:scale-95"
                            style={{
                                backgroundColor: "var(--bg-surface)",
                                border: "1px solid var(--border-color)",
                                boxShadow: "var(--shadow-sm)",
                            }}
                        >
                            <p
                                className="text-[11px] font-extrabold uppercase tracking-widest font-heading"
                                style={{ color: "var(--text-muted)" }}
                            >
                                {membership.eventStatus}
                            </p>
                            <h2
                                className="mt-1 text-xl font-bold font-heading"
                                style={{ color: "var(--text-primary)" }}
                            >
                                {membership.eventName}
                            </h2>
                            <p className="mt-3 text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                                Rol: {membership.role}
                            </p>
                            <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                                {membership.committeeName
                                    ? `Comite: ${membership.committeeName}`
                                    : "Comite: No asignado"}
                            </p>
                            <p className="mt-4 text-xs font-semibold font-heading uppercase tracking-wider" style={{ color: "var(--text-accent)" }}>
                                Entrar al evento
                            </p>
                        </button>
                    ))}
                </div>

                {memberships.length === 0 && (
                    <div
                        className="rounded-2xl p-6 mt-4"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                        }}
                    >
                        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                            No hay membresias activas para este usuario.
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
                        className="rounded-xl px-4 py-2 text-sm font-semibold font-heading transition-all"
                        style={{ color: "#ef4444" }}
                    >
                        Cerrar sesion
                    </button>
                </div>

                {memberships.some((membership) => isAdminRole(membership.role)) && (
                    <p className="mt-3 text-xs font-body" style={{ color: "var(--text-muted)" }}>
                        Como administrador debes seleccionar explicitamente el evento al iniciar sesion.
                    </p>
                )}
            </div>
        </div>
    );
};

export default SelectEventPage;
