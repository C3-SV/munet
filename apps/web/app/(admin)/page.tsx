"use client";

import Link from "next/link";
import { useAuthStore } from "../../stores/auth.store";

export default function AdminDashboard() {
    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const activeMembership = memberships.find((m) => m.id === activeMembershipId);
    const eventName = activeMembership?.eventName ?? "Evento";

    const cards = [
        {
            title: "Eventos y Comités",
            description: "Configura eventos, crea comités y gestiona sus muros correspondientes.",
            href: "/admin/events",
            icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/calendar-event.svg",
        },
        {
            title: "Participantes",
            description: "Registra participantes de forma individual o masiva mediante importación CSV.",
            href: "/admin/participants",
            icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/users.svg",
        },
        {
            title: "Asignaciones",
            description: "Asigna participantes a comités, gestiona moderadores y suspende/reactiva cuentas.",
            href: "/admin/assignments",
            icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/user-check.svg",
        },
        {
            title: "Moderación",
            description: "Supervisa muros, elimina contenido inapropiado y gestiona conversaciones.",
            href: "/admin/moderation",
            icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/shield-alert.svg",
        },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-heading" style={{ color: "var(--text-primary)" }}>
                    Panel de Administración
                </h1>
                <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Bienvenido al centro de control para el evento <strong style={{ color: "var(--text-accent)" }}>{eventName}</strong>.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {cards.map((card) => (
                    <Link
                        key={card.title}
                        href={card.href}
                        className="block p-6 rounded-2xl transition-all hover:scale-[1.01] active:scale-95"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                        }}
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div
                                className="p-3 rounded-xl"
                                style={{
                                    backgroundColor: "color-mix(in srgb, var(--border-color) 40%, transparent)",
                                }}
                            >
                                <img
                                    src={card.icon}
                                    className="size-6"
                                    style={{ filter: "var(--theme-icon-filter)" }}
                                    alt=""
                                />
                            </div>
                            <h2 className="text-xl font-bold font-heading" style={{ color: "var(--text-primary)" }}>
                                {card.title}
                            </h2>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {card.description}
                        </p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
