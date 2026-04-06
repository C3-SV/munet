"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPublicProfile } from "../../../../lib/api/profiles";
import { useAuthStore } from "../../../../stores/auth.store";
import type { PublicProfile } from "../../../../types/common";

const PublicProfilePage = () => {
    const params = useParams();
    const router = useRouter();
    const membershipId =
        typeof params?.membershipId === "string" ? params.membershipId : "";

    const token = useAuthStore((state) => state.token);
    const eventId = useAuthStore((state) => state.activeEventId);

    const [profile, setProfile] = useState<PublicProfile | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!membershipId || !token || !eventId) {
            return;
        }

        let cancelled = false;

        const loadProfile = async () => {
            try {
                const data = await getPublicProfile(membershipId, { token, eventId });

                if (!cancelled) {
                    setProfile(data);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el perfil");
                }
            }
        };

        void loadProfile();

        return () => {
            cancelled = true;
        };
    }, [eventId, membershipId, token]);

    return (
        <div className="p-4 sm:p-6 lg:p-12">
            <div className="max-w-3xl mx-auto">
                {!profile ? (
                    <div
                        className="rounded-2xl p-6"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                        }}
                    >
                        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                            {error ?? "Cargando perfil..."}
                        </p>
                    </div>
                ) : (
                    <div
                        className="rounded-2xl overflow-hidden"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                        }}
                    >
                        <div
                            className="p-6 sm:p-8 flex items-center gap-6"
                            style={{ borderBottom: "1px solid var(--border-color)" }}
                        >
                            <img
                                src={profile.profile.avatar}
                                alt={profile.profile.displayName}
                                className="size-20 sm:size-24 rounded-full object-cover"
                                style={{ border: "2px solid var(--border-color)" }}
                            />
                            <div>
                                <h1
                                    className="text-2xl font-bold font-heading"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {profile.profile.displayName}
                                </h1>
                                <p
                                    className="text-[11px] font-extrabold uppercase tracking-widest mt-1"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    {profile.role}
                                    <span style={{ color: "var(--text-accent)", opacity: 0.7 }} className="mx-1">
                                        •
                                    </span>
                                    {profile.committee?.name ?? "Sin comite"}
                                </p>
                            </div>
                        </div>

                        <div className="p-6 sm:p-8 space-y-4">
                            <div>
                                <p className="text-xs font-bold font-heading uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                                    Delegacion
                                </p>
                                <p className="text-sm font-body mt-1" style={{ color: "var(--text-primary)" }}>
                                    {profile.delegationName ?? "No especificada"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-bold font-heading uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                                    Institucion
                                </p>
                                <p className="text-sm font-body mt-1" style={{ color: "var(--text-primary)" }}>
                                    {profile.institutionName ?? "No especificada"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-bold font-heading uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                                    Biografia
                                </p>
                                <p className="text-sm font-body mt-1 whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
                                    {profile.profile.bio || "Este participante aun no ha agregado una biografia."}
                                </p>
                            </div>

                            <div className="pt-3 flex flex-col sm:flex-row gap-2">
                                <button
                                    type="button"
                                    disabled
                                    className="w-full sm:w-auto rounded-xl px-4 py-2.5 text-sm font-heading font-semibold"
                                    style={{
                                        backgroundColor: "var(--bg-surface-secondary)",
                                        border: "1px solid var(--border-color)",
                                        color: "var(--text-muted)",
                                        cursor: "not-allowed",
                                    }}
                                >
                                    Enviar mensaje (Proximamente)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.back()}
                                    className="w-full sm:w-auto rounded-xl px-4 py-2.5 text-sm font-heading font-semibold"
                                    style={{
                                        backgroundColor: "var(--sidebar-active-bg)",
                                        border: "1px solid var(--border-color)",
                                        color: "var(--text-accent)",
                                    }}
                                >
                                    Volver
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicProfilePage;
