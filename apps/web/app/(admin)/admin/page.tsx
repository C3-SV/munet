"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuthStore } from "../../../stores/auth.store";
import { IconCalendar, IconDirectory } from "../../../components/ui/icons";

type AdminCard = {
    title: string;
    description: string;
    href: string;
    icon: ReactNode;
};

// Tarjeta de sección del panel. Al pasar el puntero solo cambia el borde y el color
// del título: sin escala ni sombra animada.
const AdminDashboardCard = ({ card }: { card: AdminCard }) => (
    <Link
        href={card.href}
        className="group block rounded-2xl border border-[var(--border-color)] p-6 hover:border-[var(--text-accent)] sm:p-8"
        style={{
            backgroundColor: "var(--bg-surface)",
            boxShadow: "var(--shadow-sm)",
        }}
    >
        <div className="mb-4 flex items-center gap-4">
            <div
                className="rounded-xl p-3 text-[var(--text-secondary)] group-hover:text-[var(--text-accent)]"
                style={{ backgroundColor: "color-mix(in srgb, var(--border-color) 40%, transparent)" }}
            >
                {card.icon}
            </div>
            <h2 className="font-heading text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--text-accent)]">
                {card.title}
            </h2>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {card.description}
        </p>
    </Link>
);

export default function AdminDashboard() {
    const activeEventId = useAuthStore((state) => state.activeEventId);

    // Asignaciones y Moderación no tienen funciones todavía: no se listan aquí.
    const cards: AdminCard[] = [
        {
            title: "Eventos y Comités",
            description: "Configura eventos, crea comités y gestiona sus muros correspondientes.",
            href: "/admin/events",
            icon: <IconCalendar size={24} />,
        },
        {
            title: "Participantes",
            description: "Registra participantes y administra sus cuentas dentro del evento.",
            href: activeEventId
                ? `/admin/events/${activeEventId}/participants`
                : "/admin/events",
            icon: <IconDirectory size={24} />,
        },
    ];

    return (
        <div className="mx-auto max-w-5xl space-y-8">
            <div className="border-b pb-6" style={{ borderColor: "var(--border-color)" }}>
                <h1
                    className="font-heading text-3xl font-bold tracking-tight sm:text-4xl"
                    style={{ color: "var(--text-primary)" }}
                >
                    Panel de Administración
                </h1>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {cards.map((card) => (
                    <AdminDashboardCard key={card.title} card={card} />
                ))}
            </div>
        </div>
    );
}
