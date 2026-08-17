"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuthStore } from "../../stores/auth.store";

export default function AdminDashboard() {
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const memberships = useAuthStore((state) => state.memberships);

    const activeMembership = useMemo(
        () => memberships.find((m) => m.id === activeMembershipId) ?? null,
        [activeMembershipId, memberships],
    );

    const modules = [
        {
            title: "Eventos y Comités",
            description: "Configura los eventos activos, crea comités y genera sus muros de comunicación.",
            href: "/admin/events",
            sprint: "Sprint 1",
            icon: "📅",
        },
        {
            title: "Participantes",
            description: "Registra participantes de forma individual o masiva mediante importación de archivos CSV.",
            href: "/admin/participants",
            sprint: "Sprint 2",
            icon: "👥",
        },
        {
            title: "Asignaciones y Cuentas",
            description: "Asigna participantes a comités, gestiona moderadores y suspende o reactiva cuentas.",
            href: "/admin/assignments",
            sprint: "Sprint 3",
            icon: "🔗",
        },
        {
            title: "Moderación de Contenido",
            description: "Supervisa muros, elimina contenido inapropiado, fija publicaciones y bloquea conversaciones.",
            href: "/admin/moderation",
            sprint: "Sprint 4",
            icon: "🛡️",
        },
    ];

    return (
        <div className="max-w-6xl mx-auto">
            <header className="mb-10">
                <h1
                    className="text-3xl sm:text-4xl font-black font-heading uppercase tracking-tight"
                    style={{ color: "var(--text-accent)" }}
                >
                    Panel de Administración
                </h1>
                <p className="mt-2 text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                    Bienvenido, <span className="font-bold">{activeMembership?.participantCode}</span>. Gestiona la configuración y moderación del evento <span className="font-bold">{activeMembership?.eventName}</span>.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {modules.map((mod) => (
                    <div
                        key={mod.title}
                        className="rounded-2xl p-6 flex flex-col justify-between transition-all hover:scale-[1.01]"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                        }}
                    >
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-3xl">{mod.icon}</span>
                                <span
                                    className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full"
                                    style={{
                                        backgroundColor: "var(--bg-surface-secondary)",
                                        color: "var(--text-accent)",
                                        border: "1px solid var(--border-color)",
                                    }}
                                >
                                    {mod.sprint}
                                </span>
                            </div>
                            <h2
                                className="text-xl font-bold font-heading"
                                style={{ color: "var(--text-primary)" }}
                            >
                                {mod.title}
                            </h2>
                            <p className="mt-2 text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                                {mod.description}
                            </p>
                        </div>

                        <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                            <Link
                                href={mod.href}
                                className="inline-flex items-center text-xs font-bold font-heading uppercase tracking-wider hover:underline"
                                style={{ color: "var(--text-accent)" }}
                            >
                                Configurar módulo →
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
