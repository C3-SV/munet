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
                    <h1 className="text-3xl sm:text-4xl font-black text-primary font-heading uppercase tracking-tight">
                        Mi perfil
                    </h1>
                    <p className="font-body mt-2 text-body-secondary text-sm">
                        Administra tu información personal, credenciales y
                        resumen biográfico para que otros delegados puedan
                        conocerte mejor.
                    </p>
                </header>

                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6 sm:p-8 flex items-center gap-6 border-b border-gray-100">
                        <label className="relative shrink-0 cursor-pointer group rounded-full">
                            <img
                                src={profile.avatar}
                                alt="Avatar"
                                className="size-20 sm:size-24 rounded-full border border-gray-100 object-cover shadow-sm group-hover:opacity-80 transition-opacity"
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
                            <h2 className="text-2xl font-bold text-titles font-heading">
                                {profile.name}
                            </h2>
                            <p className="text-[11px] font-extrabold text-body-secondary font-heading uppercase tracking-widest mt-1">
                                {profile.personaje}{" "}
                                <span className="text-primary opacity-70 mx-1">
                                    •
                                </span>{" "}
                                {profile.committee}
                            </p>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-titles font-heading uppercase tracking-wide">
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
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-500 font-body text-sm outline-none cursor-not-allowed"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-titles font-heading uppercase tracking-wide">
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
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-500 font-body text-sm outline-none cursor-not-allowed"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-titles font-heading uppercase tracking-wide">
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
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-500 font-body text-sm outline-none cursor-not-allowed"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-titles font-heading uppercase tracking-wide">
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
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-500 font-body text-sm outline-none cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-titles font-heading uppercase tracking-wide">
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
                                className="w-full min-h-25 p-4 bg-white border border-gray-300 rounded-xl text-body font-body text-[15px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm resize-none"
                            />
                        </div>

                        <div className="pt-6 mt-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
                            <Link
                                href="/login"
                                className="w-full sm:w-auto px-5 py-2.5 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-body text-sm font-semibold transition-all hover:scale-105 duration-300 active:scale-95"
                            >
                                Cerrar sesión
                            </Link>

                            <button className="w-full sm:w-auto px-6 py-3 bg-primary text-white font-heading font-bold text-sm rounded-xl shadow-md hover:bg-accent transition-all hover:scale-105 duration-300 active:scale-95">
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
