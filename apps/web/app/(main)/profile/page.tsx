"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "../../../components/auth/LogOutButton";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/api/client";
import { createMyProfile, getMyProfile, updateMyProfile, uploadMyAvatar } from "../../../lib/api/profiles";
import { buildPersonLabel } from "../../../lib/person-label";
import { formatRoleLabel } from "../../../lib/role-label";
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
    const [alias, setAlias] = useState("");
    const [bio, setBio] = useState("");
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [needsProfile, setNeedsProfile] = useState(false);
    const [newFirstName, setNewFirstName] = useState("");
    const [newLastName, setNewLastName] = useState("");
    const [creatingProfile, setCreatingProfile] = useState(false);
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
                    setAlias(profile.profile.alias ?? "");
                    setBio(profile.profile.bio ?? "");
                }
            } catch (loadError) {
                if (!cancelled) {
                    // 404: la membresía existe pero no tiene perfil; se pide crearlo.
                    if (loadError instanceof ApiError && loadError.status === 404) {
                        setNeedsProfile(true);
                    } else {
                        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el perfil");
                    }
                }
            }
        };

        void loadProfile();

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

    const createProfile = async () => {
        if (!token || !eventId) {
            return;
        }

        try {
            setCreatingProfile(true);
            setError(null);

            const created = await createMyProfile({
                token,
                eventId,
                firstName: newFirstName.trim(),
                lastName: newLastName.trim(),
            });

            setProfileData(created);
            setDisplayName(created.profile.displayName);
            setAlias(created.profile.alias ?? "");
            setBio(created.profile.bio ?? "");
            setNeedsProfile(false);
        } catch (createError) {
            setError(createError instanceof Error ? createError.message : "No se pudo crear tu perfil");
        } finally {
            setCreatingProfile(false);
        }
    };

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
                // Alias vacío = sin alias (se envía null para borrarlo).
                alias: alias.trim() ? alias.trim() : null,
                bio,
            });

            setProfileData(updated);
            setAlias(updated.profile.alias ?? "");
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
            setAvatarError("Solo se permiten imágenes JPG, PNG o WEBP.");
            setAvatarFile(null);
            event.currentTarget.value = "";
            return;
        }

        if (file.size > MAX_AVATAR_BYTES) {
            setAvatarError("La imagen debe pesar máximo 5MB.");
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

    const profileAlias = profileData
        ? buildPersonLabel({ name: profileData.profile.displayName, alias: profileData.profile.alias }).alias
        : null;

    if (!profileData && needsProfile) {
        const canCreate = newFirstName.trim() !== "" && newLastName.trim() !== "" && !creatingProfile;

        return (
            <div className="p-4 sm:p-6 lg:p-12">
                <form
                    className="max-w-3xl mx-auto rounded-2xl p-6 sm:p-8 space-y-5"
                    style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (canCreate) void createProfile();
                    }}
                >
                    <div>
                        <h1 className="text-2xl font-bold font-heading" style={{ color: "var(--text-primary)" }}>
                            Completa tu perfil
                        </h1>
                        <p className="mt-2 text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                            Tu cuenta de administración en este evento aún no tiene perfil. Escribe tu nombre y apellido para crearlo.
                        </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-xs font-semibold font-heading" style={{ color: "var(--text-secondary)" }}>Nombre</span>
                            <input
                                type="text"
                                value={newFirstName}
                                maxLength={100}
                                onChange={(e) => setNewFirstName(e.target.value)}
                                required
                                className="mt-1 w-full rounded-xl px-3 py-2.5 font-body text-sm outline-none"
                                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-semibold font-heading" style={{ color: "var(--text-secondary)" }}>Apellido</span>
                            <input
                                type="text"
                                value={newLastName}
                                maxLength={100}
                                onChange={(e) => setNewLastName(e.target.value)}
                                required
                                className="mt-1 w-full rounded-xl px-3 py-2.5 font-body text-sm outline-none"
                                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                            />
                        </label>
                    </div>
                    {error && (
                        <p className="text-sm font-body" style={{ color: "var(--danger)" }}>
                            {error}
                        </p>
                    )}
                    <div className="flex justify-end">
                        <Button type="submit" disabled={!canCreate} loading={creatingProfile}>
                            {creatingProfile ? "Creando..." : "Crear perfil"}
                        </Button>
                    </div>
                </form>
            </div>
        );
    }

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
                    <h1 className="text-3xl sm:text-4xl font-bold font-heading tracking-tight" style={{ color: "var(--text-accent)" }}>
                        Mi perfil
                    </h1>
                </header>

                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                    <div className="p-6 sm:p-8 flex items-center gap-6" style={{ borderBottom: "1px solid var(--border-color)" }}>
                        {/* Avatar externo de la API: sin next/image porque el host no está en remotePatterns. */}
                        {/* eslint-disable-next-line @next/next/no-img-element -- avatar de URL dinamica: next/image exige hosts remotos en next.config */}
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
                            {(profileData.profile.alias ||
                                `${profileData.profile.firstName} ${profileData.profile.lastName}`.trim() !==
                                    profileData.profile.displayName) && (
                                <p className="text-sm font-body mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                    {`${profileData.profile.firstName} ${profileData.profile.lastName}`.trim()}
                                    {profileAlias ? ` · ${profileAlias}` : ""}
                                </p>
                            )}
                            <p className="text-xs font-semibold font-heading mt-1" style={{ color: "var(--text-secondary)" }}>
                                {profileData.delegationName ?? "Delegación"}
                                <span style={{ color: "var(--text-accent)", opacity: 0.7 }} className="mx-1">
                                    |
                                </span>
                                {profileData.committee?.name ?? "Sin comité"}
                                <span style={{ color: "var(--text-accent)", opacity: 0.7 }} className="mx-1">
                                    |
                                </span>
                                {formatRoleLabel(profileData.role)}
                                {profileData.delegationCode && (
                                    <>
                                        <span style={{ color: "var(--text-accent)", opacity: 0.7 }} className="mx-1">
                                            |
                                        </span>
                                        {profileData.delegationCode}
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2 sm:col-span-2">
                                <label className="block text-xs font-bold font-heading" style={{ color: "var(--text-primary)" }}>
                                    Foto de perfil
                                </label>
                                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            Seleccionar archivo
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={() => void handleAvatarUpload()}
                                            disabled={!avatarFile || uploadingAvatar}
                                            loading={uploadingAvatar}
                                        >
                                            {uploadingAvatar ? "Subiendo..." : "Subir foto"}
                                        </Button>
                                    </div>
                                    {avatarError && (
                                        <p className="text-xs font-body sm:text-right" style={{ color: "var(--danger)" }}>
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
                                        {avatarFile ? avatarFile.name : "Ningún archivo seleccionado"}
                                    </p>
                                    <p className="text-xs font-body mt-0.5" style={{ color: "var(--text-muted)" }}>
                                        {avatarFile
                                            ? `${(avatarFile.size / (1024 * 1024)).toFixed(2)} MB`
                                            : "Formatos: JPG, PNG o WEBP · Máximo 5MB"}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold font-heading" style={{ color: "var(--text-primary)" }}>
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
                                <label className="block text-xs font-bold font-heading" style={{ color: "var(--text-primary)" }}>
                                    Alias
                                </label>
                                <input
                                    type="text"
                                    value={alias}
                                    maxLength={60}
                                    placeholder="Opcional"
                                    onChange={(e) => setAlias(e.target.value)}
                                    className="w-full p-3 rounded-xl font-body text-sm outline-none"
                                    style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                                />
                                <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
                                    Se muestra junto a tu nombre. Máximo 60 caracteres.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold font-heading" style={{ color: "var(--text-primary)" }}>
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
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold font-heading" style={{ color: "var(--text-primary)" }}>
                                Biografía
                            </label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className="w-full min-h-25 p-4 rounded-xl font-body text-[15px] outline-none transition-[opacity,transform,background-color,border-color,color] resize-none"
                                style={{
                                    backgroundColor: "var(--bg-input)",
                                    border: "1px solid var(--input-border)",
                                    color: "var(--text-primary)",
                                }}
                            />
                        </div>

                        {error && (
                            <p className="text-sm font-body" style={{ color: "var(--danger)" }}>
                                {error}
                            </p>
                        )}

                        <div
                            className="pt-6 mt-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-4"
                            style={{ borderTop: "1px solid var(--border-color)" }}
                        >
                            <LogoutButton />
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                {canOpenAdminEditor && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => router.push("/select-event")}
                                        className="w-full sm:w-auto"
                                    >
                                        Cambiar evento
                                    </Button>
                                )}
                                <Button
                                    onClick={saveProfile}
                                    disabled={saving}
                                    loading={saving}
                                    className="w-full sm:w-auto"
                                >
                                    {saving ? "Guardando..." : "Guardar perfil"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
