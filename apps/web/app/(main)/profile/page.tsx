"use client";

import Link from "next/link";
import React, { useState } from "react";

const ProfilePage = () => {
    const [profile, setProfile] = useState({
        name: "Rober Morán",
        personaje: "Delegación de Japón",
        committee: "Comité 1",
        email: "rober.moran@munet.org",
        bio: "Delegado apasionado por las relaciones internacionales y el desarrollo sostenible. Preparado para debatir resoluciones en el Comité 1.",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
    });

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setProfile({ ...profile, avatar: imageUrl });
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-12">
            <div className="max-w-3xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-black font-heading uppercase tracking-tight" style={{ color: "var(--text-accent)" }}>
                        Mi perfil
                    </h1>
                    <p className="font-body mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        Administra tu información personal, credenciales y
                        resumen biográfico para que otros delegados puedan
                        conocerte mejor.
                    </p>
                </header>

                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                    <div className="p-6 sm:p-8 flex items-center gap-6" style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <label className="relative shrink-0 cursor-pointer group rounded-full">
                            <img
                                src={profile.avatar}
                                alt="Avatar"
                                className="size-20 sm:size-24 rounded-full object-cover group-hover:opacity-80 transition-opacity"
                                style={{ border: "2px solid var(--border-color)" }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <img
                                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/camera.svg"
                                    className="size-6 filter invert"
                                    alt="Editar foto"
                                />
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageChange}
                            />
                        </label>
                        <div>
                            <h2 className="text-2xl font-bold font-heading" style={{ color: "var(--text-primary)" }}>
                                {profile.name}
                            </h2>
                            <p className="text-[11px] font-extrabold font-heading uppercase tracking-widest mt-1" style={{ color: "var(--text-secondary)" }}>
                                {profile.personaje}{" "}
                                <span style={{ color: "var(--text-accent)", opacity: 0.7 }} className="mx-1">
                                    •
                                </span>{" "}
                                {profile.committee}
                            </p>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                    <img
                                        src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/user.svg"
                                        className="size-4 opacity-60"
                                        alt=""
                                    />
                                    Nombre Completo
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={profile.name}
                                    className="w-full p-3 rounded-xl font-body text-sm outline-none cursor-not-allowed" style={{ backgroundColor: "var(--bg-surface-secondary)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                    <img
                                        src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/flag.svg"
                                        className="size-4 opacity-60"
                                        alt=""
                                    />
                                    Personaje
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={profile.personaje}
                                    className="w-full p-3 rounded-xl font-body text-sm outline-none cursor-not-allowed" style={{ backgroundColor: "var(--bg-surface-secondary)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                    <img
                                        src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/mail.svg"
                                        className="size-4 opacity-60"
                                        alt=""
                                    />
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    readOnly
                                    value={profile.email}
                                    className="w-full p-3 rounded-xl font-body text-sm outline-none cursor-not-allowed" style={{ backgroundColor: "var(--bg-surface-secondary)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                    <img
                                        src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/users-group.svg"
                                        className="size-4 opacity-60"
                                        alt=""
                                    />
                                    Comité Asignado
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={profile.committee}
                                    className="w-full p-3 rounded-xl font-body text-sm outline-none cursor-not-allowed" style={{ backgroundColor: "var(--bg-surface-secondary)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                <img
                                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/file-description.svg"
                                    className="size-4 opacity-60"
                                    alt=""
                                />
                                Resumen Biográfico
                            </label>
                            <textarea
                                value={profile.bio}
                                onChange={(e) =>
                                    setProfile({
                                        ...profile,
                                        bio: e.target.value,
                                    })
                                }
                                placeholder="Describe brevemente tu experiencia y objetivos..."
                                className="w-full min-h-25 p-4 rounded-xl font-body text-[15px] outline-none transition-all resize-none"
                                style={{
                                    backgroundColor: "var(--bg-input)",
                                    border: "1px solid var(--input-border)",
                                    color: "var(--text-primary)",
                                }}
                                onFocus={e => {
                                    e.currentTarget.style.borderColor = "var(--input-focus)";
                                    e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--input-focus) 12%, transparent)";
                                }}
                                onBlur={e => {
                                    e.currentTarget.style.borderColor = "var(--input-border)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            />
                        </div>

                        <div
                            className="pt-6 mt-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-4"
                            style={{ borderTop: "1px solid var(--border-color)" }}
                        >
                            <Link
                                href="/login"
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-body text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                                style={{ color: "#ef4444" }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor = "#ef4444";
                                    e.currentTarget.style.color = "white";
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = "transparent";
                                    e.currentTarget.style.color = "#ef4444";
                                }}
                            >
                                Cerrar sesión
                            </Link>

                            <button
                                className="w-full sm:w-auto px-6 py-3 text-white font-heading font-bold text-sm rounded-xl shadow-md transition-all hover:scale-105 active:scale-95"
                                style={{ backgroundColor: "var(--bubble-me-bg)" }}
                            >
                                Actualizar credenciales
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
