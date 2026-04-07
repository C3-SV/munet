"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "../../../components/auth/LogOutButton";
import { getMyProfile, updateMyProfile, uploadMyAvatar } from "../../../lib/api/profiles";
import { isAdminRole, useAuthStore } from "../../../stores/auth.store";
import type { MyProfile } from "../../../types/common";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const ProfilePage = () => {
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const eventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const memberships = useAuthStore((state) => state.memberships);

    const [profileData, setProfileData] = useState<MyProfile | null>(null);
    const [displayName, setDisplayName] = useState("");
    const [bio, setBio] = useState("");
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const canOpenAdminEditor = useMemo(() => {
        if (!activeMembershipId) {
            return false;
        }

        const activeMembership = memberships.find((membership) => membership.id === activeMembershipId);

        return Boolean(activeMembership && isAdminRole(activeMembership.role));
    }, [activeMembershipId, memberships]);

    useEffect(() => {
        // Carga perfil propio del evento activo.
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        const loadProfile = async () => {
            try {
                const profile = await getMyProfile({ token, eventId });

                if (!cancelled) {
                    setProfileData(profile);
                    setDisplayName(profile.profile.displayName);
                    setBio(profile.profile.bio ?? "");
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
    }, [eventId, token]);

    const saveProfile = async () => {
        // Guarda nombre visible/bio sin tocar campos bloqueados.
        if (!token || !eventId || !profileData) {
            return;
        }

        try {
            setSaving(true);
            setError(null);

            const updated = await updateMyProfile({
                token,
                eventId,
                displayName,
                bio,
            });

            setProfileData(updated);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar el perfil");
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
        // Validaciones de archivo antes de intentar subida.
        const file = event.target.files?.[0] ?? null;

        if (!file) {
            setAvatarFile(null);
            return;
        }

        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            setAvatarError("Solo se permiten imagenes JPG, PNG o WEBP.");
            setAvatarFile(null);
            event.currentTarget.value = "";
            return;
        }

        if (file.size > MAX_AVATAR_BYTES) {
            setAvatarError("La imagen debe pesar maximo 5MB.");
            setAvatarFile(null);
            event.currentTarget.value = "";
            return;
        }

        setAvatarError(null);
        setAvatarFile(file);
    };

    const handleAvatarUpload = async () => {
        // Sube avatar al backend (storage) y refresca estado local.
        if (!token || !eventId || !avatarFile) {
            return;
        }

        try {
            setUploadingAvatar(true);
            setAvatarError(null);

            const updated = await uploadMyAvatar(avatarFile, { token, eventId });
            setProfileData(updated);
            setAvatarFile(null);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (uploadError) {
            setAvatarError(uploadError instanceof Error ? uploadError.message : "No se pudo subir la foto.");
        } finally {
            setUploadingAvatar(false);
        }
    };

    if (!profileData) {
        return (
            <div className="p-4 sm:p-6 lg:p-12">
                <div className="max-w-3xl mx-auto rounded-2xl p-6" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                    <span className="font-body text-sm" style={{ color: "var(--text-secondary)" }}>
                        Cargando perfil...
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-12">
            <div className="max-w-3xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-black font-heading uppercase tracking-tight" style={{ color: "var(--text-accent)" }}>
                        Mi perfil
                    </h1>
                    <p className="font-body mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        Información pública y credenciales del evento actual.
                    </p>
                </header>

                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                    <div className="p-6 sm:p-8 flex items-center gap-6" style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <img
                            src={profileData.profile.avatar}
                            alt="Avatar"
                            className="size-20 sm:size-24 rounded-full object-cover"
                            style={{ border: "2px solid var(--border-color)" }}
                        />
                        <div>
                            <h2 className="text-2xl font-bold font-heading" style={{ color: "var(--text-primary)" }}>
                                {profileData.profile.displayName}
                            </h2>
                            <p className="text-[11px] font-extrabold font-heading uppercase tracking-widest mt-1" style={{ color: "var(--text-secondary)" }}>
                                {profileData.delegationName ?? "Delegacion"}
                                <span style={{ color: "var(--text-accent)", opacity: 0.7 }} className="mx-1">
                                    |
                                </span>
                                {profileData.committee?.name ?? "Sin comité"}
                            </p>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2 sm:col-span-2">
                                <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                    Foto de perfil
                                </label>
                                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-2.5 rounded-xl font-heading font-bold text-sm transition-all"
                                            style={{
                                                backgroundColor: "var(--bg-surface-secondary)",
                                                border: "1px solid var(--border-color)",
                                                color: "var(--text-primary)",
                                            }}
                                        >
                                            Seleccionar archivo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleAvatarUpload()}
                                            disabled={!avatarFile || uploadingAvatar}
                                            className="px-4 py-2.5 font-heading font-bold text-sm rounded-xl transition-all"
                                            style={{
                                                backgroundColor:
                                                    !avatarFile || uploadingAvatar
                                                        ? "var(--bg-surface-secondary)"
                                                        : "var(--bubble-me-bg)",
                                                border:
                                                    !avatarFile || uploadingAvatar
                                                        ? "1px solid var(--border-color)"
                                                        : "1px solid transparent",
                                                color:
                                                    !avatarFile || uploadingAvatar
                                                        ? "var(--text-muted)"
                                                        : "white",
                                                cursor:
                                                    !avatarFile || uploadingAvatar ? "not-allowed" : "pointer",
                                            }}
                                        >
                                            {uploadingAvatar ? "Subiendo..." : "Subir foto"}
                                        </button>
                                    </div>
                                    {avatarError && (
                                        <p className="text-xs font-body sm:text-right" style={{ color: "#b91c1c" }}>
                                            {avatarError}
                                        </p>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={handleAvatarSelection}
                                    className="hidden"
                                />
                                <div
                                    className="w-full rounded-xl px-3 py-2.5"
                                    style={{
                                        backgroundColor: "var(--bg-surface-secondary)",
                                        border: "1px solid var(--input-border)",
                                    }}
                                >
                                    <p className="text-sm font-body" style={{ color: "var(--text-primary)" }}>
                                        {avatarFile ? avatarFile.name : "Ningun archivo seleccionado"}
                                    </p>
                                    <p className="text-xs font-body mt-0.5" style={{ color: "var(--text-muted)" }}>
                                        {avatarFile
                                            ? `${(avatarFile.size / (1024 * 1024)).toFixed(2)} MB`
                                            : "Formatos: JPG, PNG o WEBP · Maximo 5MB"}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                    Nombre mostrado
                                </label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full p-3 rounded-xl font-body text-sm outline-none"
                                    style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                    Correo
                                </label>
                                <input
                                    type="email"
                                    readOnly
                                    value={profileData.email ?? "Sin correo"}
                                    className="w-full p-3 rounded-xl font-body text-sm outline-none cursor-not-allowed"
                                    style={{ backgroundColor: "var(--bg-surface-secondary)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                    Rol
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={profileData.role}
                                    className="w-full p-3 rounded-xl font-body text-sm outline-none cursor-not-allowed"
                                    style={{ backgroundColor: "var(--bg-surface-secondary)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                    Comité
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={profileData.committee?.name ?? "Sin comité"}
                                    className="w-full p-3 rounded-xl font-body text-sm outline-none cursor-not-allowed"
                                    style={{ backgroundColor: "var(--bg-surface-secondary)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                Biografía
                            </label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className="w-full min-h-25 p-4 rounded-xl font-body text-[15px] outline-none transition-all resize-none"
                                style={{
                                    backgroundColor: "var(--bg-input)",
                                    border: "1px solid var(--input-border)",
                                    color: "var(--text-primary)",
                                }}
                            />
                        </div>

                        {error && (
                            <p className="text-sm font-body" style={{ color: "#b91c1c" }}>
                                {error}
                            </p>
                        )}

                        <div
                            className="pt-6 mt-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-4"
                            style={{ borderTop: "1px solid var(--border-color)" }}
                        >
                            <LogoutButton />
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                {canOpenAdminEditor && activeMembershipId && (
                                    <button
                                        onClick={() => router.push(`/profile/${activeMembershipId}`)}
                                        className="w-full sm:w-auto px-4 py-3 font-heading font-bold text-sm rounded-xl transition-all"
                                        style={{
                                            backgroundColor: "var(--sidebar-active-bg)",
                                            color: "var(--text-accent)",
                                            border: "1px solid var(--border-color)",
                                        }}
                                    >
                                        Editar mi perfil
                                    </button>
                                )}
                                {canOpenAdminEditor && (
                                    <button
                                        onClick={() => router.push("/select-event")}
                                        className="w-full sm:w-auto px-4 py-3 font-heading font-bold text-sm rounded-xl transition-all"
                                        style={{
                                            backgroundColor: "var(--bg-surface-secondary)",
                                            color: "var(--text-secondary)",
                                            border: "1px solid var(--border-color)",
                                        }}
                                    >
                                        Cambiar evento
                                    </button>
                                )}
                                <button
                                    onClick={saveProfile}
                                    disabled={saving}
                                    className="w-full sm:w-auto px-6 py-3 text-white font-heading font-bold text-sm rounded-xl shadow-md transition-all"
                                    style={{
                                        backgroundColor: "var(--bubble-me-bg)",
                                        opacity: saving ? 0.7 : 1,
                                    }}
                                >
                                    {saving ? "Guardando..." : "Guardar perfil"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
