"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAdminRole, useAuthStore } from "../../stores/auth.store";
import { BrandAttribution } from "../../components/layout/BrandAttribution";
import { formatRoleLabel } from "../../lib/role-label";
import { withoutPracticeMembership } from "../../lib/practice/membership";

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
    // La práctica tiene su propia tarjeta: no se lista también como un evento más.
    const realMemberships = withoutPracticeMembership(memberships);

    useEffect(() => {
        // Hidrata sesion guardada antes de aplicar reglas de redireccion.
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

        const hasAdminMembership = memberships.some((membership) =>
            isAdminRole(membership.role),
        );
        const firstMembership = memberships[0];

        // Si ya existe contexto activo:
        // - Admin puede quedarse en selector para cambiar de evento manualmente.
        // - Participante debe volver al feed.
        if (activeEventId && activeMembershipId) {
            if (hasAdminMembership) {
                return;
            }

            router.replace("/feed");
            return;
        }

        // Participantes sin rol admin entran directo al primer evento.
        if (!hasAdminMembership && firstMembership) {
            // Aunque esté en /select-event, el delegado no debe quedarse aquí.
            setActiveMembership(firstMembership.id);
            router.replace("/feed");
        }
    }, [activeEventId, activeMembershipId, hydrated, memberships, router, setActiveMembership, token]);

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
                    {realMemberships.map((membership) => (
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

                {realMemberships.length === 0 && (
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
