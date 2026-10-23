"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthStore } from "../../../stores/auth.store";

type AdminCard = {
    title: string;
    description: string;
    href: string;
    icon: string;
};

const AdminDashboardCard = ({ card }: { card: AdminCard }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Link
            href={card.href}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="block p-6 sm:p-8 rounded-2xl transition-all duration-200 hover:scale-[1.01] active:scale-95"
            style={{
                backgroundColor: "var(--bg-surface)",
                border: isHovered
                    ? "1px solid var(--text-accent)"
                    : "1px solid var(--border-color)",
                boxShadow: isHovered
                    ? "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
                    : "var(--shadow-sm)",
            }}
        >
            <div className="flex items-center gap-4 mb-4">
                <div
                    className="p-3 rounded-xl transition-colors duration-200"
                    style={{
                        backgroundColor: isHovered
                            ? "color-mix(in srgb, var(--text-accent) 15%, transparent)"
                            : "color-mix(in srgb, var(--border-color) 40%, transparent)",
                    }}
                >
                    <img
                        src={card.icon}
                        className="size-6"
                        style={{ filter: "var(--theme-icon-filter)" }}
                        alt=""
                    />
                </div>
                <h2
                    className="text-xl font-bold font-heading transition-colors duration-200"
                    style={{ color: isHovered ? "var(--text-accent)" : "var(--text-primary)" }}
                >
                    {card.title}
                </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {card.description}
            </p>
        </Link>
    );
};

export default function AdminDashboard() {
    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const activeMembership = memberships.find((membership) => membership.id === activeMembershipId);
    const eventName = activeMembership?.eventName ?? "Evento";

    const cards: AdminCard[] = [
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
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="border-b pb-6" style={{ borderColor: "var(--border-color)" }}>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-heading" style={{ color: "var(--text-primary)" }}>
                    Panel de Administración
                </h1>
                <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    Bienvenido al centro de control para el evento{" "}
                    <strong className="font-bold" style={{ color: "var(--text-accent)" }}>
                        {eventName}
                    </strong>.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {cards.map((card) => (
                    <AdminDashboardCard key={card.title} card={card} />
                ))}
            </div>
        </div>
    );
}