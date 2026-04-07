"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createConversation } from "../../../../lib/api/chat";
import { getEventCommittees, type EventCommittee } from "../../../../lib/api/events";
import {
    getPublicProfile,
    updatePublicProfileAsAdmin,
    uploadPublicAvatarAsAdmin,
} from "../../../../lib/api/profiles";
import { isAdminRole, useAuthStore } from "../../../../stores/auth.store";
import type { PublicProfile } from "../../../../types/common";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const PublicProfilePage = () => {
    const params = useParams();
    const router = useRouter();
    const membershipId = typeof params?.membershipId === "string" ? params.membershipId : "";

    const token = useAuthStore((state) => state.token);
    const eventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const memberships = useAuthStore((state) => state.memberships);

    const [profile, setProfile] = useState<PublicProfile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isOpeningChat, setIsOpeningChat] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [bio, setBio] = useState("");
    const [delegationName, setDelegationName] = useState("");
    const [institutionName, setInstitutionName] = useState("");
    const [committeeId, setCommitteeId] = useState("");
    const [committees, setCommittees] = useState<EventCommittee[]>([]);

    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const activeMembership = useMemo(
        () => memberships.find((membership) => membership.id === activeMembershipId) ?? null,
        [activeMembershipId, memberships],
    );

    const actorIsAdmin = Boolean(activeMembership && isAdminRole(activeMembership.role));
    const isSelfProfile = Boolean(activeMembershipId && activeMembershipId === membershipId);
    const targetIsAdmin = Boolean(profile && isAdminRole(profile.role));
    const canEditProfile = actorIsAdmin && (isSelfProfile || !targetIsAdmin);

    useEffect(() => {
        // Carga perfil publico del participante seleccionado.
        if (!membershipId || !token || !eventId) {
            return;
        }

        let cancelled = false;

        const loadProfile = async () => {
            try {
                const data = await getPublicProfile(membershipId, { token, eventId });

                if (!cancelled) {
                    setProfile(data);
                    setFirstName(data.profile.firstName ?? "");
                    setLastName(data.profile.lastName ?? "");
                    setDisplayName(data.profile.displayName ?? "");
                    setBio(data.profile.bio ?? "");
                    setDelegationName(data.delegationName ?? "");
                    setInstitutionName(data.institutionName ?? "");
                    setCommitteeId(data.committee?.id ?? "");
                    setError(null);
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

    useEffect(() => {
        // Solo admins cargan comites para editar membership de terceros.
        if (!canEditProfile || !token || !eventId) {
            return;
        }

        let cancelled = false;

        const loadCommittees = async () => {
            try {
                const data = await getEventCommittees({ token, eventId });

                if (!cancelled) {
                    setCommittees(data);
                }
            } catch {
                if (!cancelled) {
                    setCommittees([]);
                }
            }
        };

        void loadCommittees();

        return () => {
            cancelled = true;
        };
    }, [canEditProfile, eventId, token]);

    const resetEditForm = () => {
        // Rehidrata formulario admin desde el perfil actualmente cargado.
        if (!profile) {
            return;
        }

        setFirstName(profile.profile.firstName ?? "");
        setLastName(profile.profile.lastName ?? "");
        setDisplayName(profile.profile.displayName ?? "");
        setBio(profile.profile.bio ?? "");
        setDelegationName(profile.delegationName ?? "");
        setInstitutionName(profile.institutionName ?? "");
        setCommitteeId(profile.committee?.id ?? "");
        setEditError(null);
        setAvatarError(null);
        setAvatarFile(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleOpenChat = async () => {
        // Navega al chat por id de conversacion (nunca por membership id).
        if (!token || !eventId || !membershipId || activeMembershipId === membershipId || isOpeningChat) {
            return;
        }

        try {
            setError(null);
            setIsOpeningChat(true);
            const conversation = await createConversation(membershipId, {
                token,
                eventId,
            });
            router.push(`/chat/${conversation.id}`);
        } catch (openChatError) {
            setError(
                openChatError instanceof Error
                    ? openChatError.message
                    : "No se pudo abrir la conversacion.",
            );
        } finally {
            setIsOpeningChat(false);
        }
    };

    const handleAvatarSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
        // Valida formato/peso antes de habilitar subida de avatar.
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

    const handleUploadAvatar = async () => {
        // Sube avatar del tercero desde flujo admin.
        if (!token || !eventId || !membershipId || !avatarFile || !canEditProfile) {
            return;
        }

        try {
            setUploadingAvatar(true);
            setAvatarError(null);
            setEditError(null);

            const updated = await uploadPublicAvatarAsAdmin(membershipId, avatarFile, {
                token,
                eventId,
            });

            setProfile(updated);
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

    const handleSaveProfile = async () => {
        // Persiste edicion administrativa (rol se mantiene read-only).
        if (!token || !eventId || !membershipId || !canEditProfile) {
            return;
        }

        const normalizedFirstName = firstName.trim();
        const normalizedLastName = lastName.trim();

        if (!normalizedFirstName || !normalizedLastName) {
            setEditError("Nombre y apellido son obligatorios.");
            return;
        }

        try {
            setSaving(true);
            setEditError(null);

            const updated = await updatePublicProfileAsAdmin(membershipId, {
                token,
                eventId,
                firstName: normalizedFirstName,
                lastName: normalizedLastName,
                displayName: displayName.trim() ? displayName.trim() : null,
                bio: bio.trim() ? bio.trim() : null,
                delegationName: delegationName.trim() ? delegationName.trim() : null,
                institutionName: institutionName.trim() ? institutionName.trim() : null,
                committeeId: committeeId || null,
            });

            setProfile(updated);
            setIsEditing(false);
        } catch (saveError) {
            setEditError(
                saveError instanceof Error
                    ? saveError.message
                    : "No se pudo guardar el perfil del participante.",
            );
        } finally {
            setSaving(false);
        }
    };

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
                                        |
                                    </span>
                                    {profile.committee?.name ?? "Sin comité"}
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
                                    Biografía
                                </p>
                                <p className="text-sm font-body mt-1 whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
                                    {profile.profile.bio || "Este participante aún no ha agregado una biografía."}
                                </p>
                            </div>

                            <div className="pt-3 flex flex-col sm:flex-row gap-2">
                                {canEditProfile && !isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            resetEditForm();
                                            setIsEditing(true);
                                        }}
                                        className="w-full sm:w-auto rounded-xl px-4 py-2.5 text-sm font-heading font-semibold"
                                        style={{
                                            backgroundColor: "var(--sidebar-active-bg)",
                                            border: "1px solid var(--border-color)",
                                            color: "var(--text-accent)",
                                        }}
                                    >
                                        Editar perfil
                                    </button>
                                )}

                                {activeMembershipId !== membershipId ? (
                                    <button
                                        type="button"
                                        onClick={() => void handleOpenChat()}
                                        disabled={isOpeningChat}
                                        className="w-full sm:w-auto rounded-xl px-4 py-2.5 text-sm font-heading font-semibold"
                                        style={{
                                            backgroundColor: "var(--bubble-me-bg)",
                                            border: "1px solid transparent",
                                            color: "white",
                                            opacity: isOpeningChat ? 0.8 : 1,
                                            cursor: isOpeningChat ? "wait" : "pointer",
                                        }}
                                    >
                                        {isOpeningChat ? "Abriendo..." : "Enviar mensaje"}
                                    </button>
                                ) : (
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
                                        Este es tu perfil
                                    </button>
                                )}
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

                            {canEditProfile && isEditing && (
                                <div
                                    className="mt-4 rounded-2xl p-4 sm:p-5 space-y-4"
                                    style={{
                                        backgroundColor: "var(--bg-surface-secondary)",
                                        border: "1px solid var(--border-color)",
                                    }}
                                >
                                    <h2
                                        className="text-sm font-heading font-bold uppercase tracking-wide"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        Edicion administrativa
                                    </h2>

                                    <div className="space-y-2">
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
                                                        backgroundColor: "var(--bg-surface)",
                                                        border: "1px solid var(--border-color)",
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    Seleccionar archivo
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleUploadAvatar()}
                                                    disabled={!avatarFile || uploadingAvatar}
                                                    className="px-4 py-2.5 font-heading font-bold text-sm rounded-xl transition-all"
                                                    style={{
                                                        backgroundColor:
                                                            !avatarFile || uploadingAvatar
                                                                ? "var(--bg-surface)"
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
                                                            !avatarFile || uploadingAvatar
                                                                ? "not-allowed"
                                                                : "pointer",
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
                                                backgroundColor: "var(--bg-surface)",
                                                border: "1px solid var(--input-border)",
                                            }}
                                        >
                                            <p className="text-sm font-body" style={{ color: "var(--text-primary)" }}>
                                                {avatarFile ? avatarFile.name : "Ningun archivo seleccionado"}
                                            </p>
                                            <p className="text-xs font-body mt-0.5" style={{ color: "var(--text-muted)" }}>
                                                {avatarFile
                                                    ? `${(avatarFile.size / (1024 * 1024)).toFixed(2)} MB`
                                                    : "Formatos: JPG, PNG o WEBP | Maximo 5MB"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                                Nombre
                                            </label>
                                            <input
                                                type="text"
                                                value={firstName}
                                                onChange={(event) => setFirstName(event.target.value)}
                                                className="w-full p-3 rounded-xl font-body text-sm outline-none"
                                                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                                Apellido
                                            </label>
                                            <input
                                                type="text"
                                                value={lastName}
                                                onChange={(event) => setLastName(event.target.value)}
                                                className="w-full p-3 rounded-xl font-body text-sm outline-none"
                                                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                                Nombre mostrado
                                            </label>
                                            <input
                                                type="text"
                                                value={displayName}
                                                onChange={(event) => setDisplayName(event.target.value)}
                                                className="w-full p-3 rounded-xl font-body text-sm outline-none"
                                                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                                Comité
                                            </label>
                                            <select
                                                value={committeeId}
                                                onChange={(event) => setCommitteeId(event.target.value)}
                                                className="w-full p-3 rounded-xl font-body text-sm outline-none"
                                                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                                            >
                                                <option value="">Sin comité</option>
                                                {committees.map((committee) => (
                                                    <option key={committee.id} value={committee.id}>
                                                        {committee.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                                Delegacion
                                            </label>
                                            <input
                                                type="text"
                                                value={delegationName}
                                                onChange={(event) => setDelegationName(event.target.value)}
                                                className="w-full p-3 rounded-xl font-body text-sm outline-none"
                                                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                                Institucion
                                            </label>
                                            <input
                                                type="text"
                                                value={institutionName}
                                                onChange={(event) => setInstitutionName(event.target.value)}
                                                className="w-full p-3 rounded-xl font-body text-sm outline-none"
                                                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                                            />
                                        </div>

                                        <div className="space-y-2 sm:col-span-2">
                                            <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                                Rol
                                            </label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={profile.role}
                                                className="w-full p-3 rounded-xl font-body text-sm outline-none cursor-not-allowed"
                                                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold font-heading uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                                            Biografía
                                        </label>
                                        <textarea
                                            value={bio}
                                            onChange={(event) => setBio(event.target.value)}
                                            className="w-full min-h-25 p-3 rounded-xl font-body text-sm outline-none resize-none"
                                            style={{
                                                backgroundColor: "var(--bg-input)",
                                                border: "1px solid var(--input-border)",
                                                color: "var(--text-primary)",
                                            }}
                                        />
                                    </div>

                                    {editError && (
                                        <p className="text-sm font-body" style={{ color: "#b91c1c" }}>
                                            {editError}
                                        </p>
                                    )}

                                    <div className="pt-1 flex flex-col sm:flex-row gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void handleSaveProfile()}
                                            disabled={saving}
                                            className="w-full sm:w-auto rounded-xl px-4 py-2.5 text-sm font-heading font-semibold"
                                            style={{
                                                backgroundColor: "var(--bubble-me-bg)",
                                                border: "1px solid transparent",
                                                color: "white",
                                                opacity: saving ? 0.8 : 1,
                                                cursor: saving ? "wait" : "pointer",
                                            }}
                                        >
                                            {saving ? "Guardando..." : "Guardar cambios"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                resetEditForm();
                                                setIsEditing(false);
                                            }}
                                            className="w-full sm:w-auto rounded-xl px-4 py-2.5 text-sm font-heading font-semibold"
                                            style={{
                                                backgroundColor: "var(--bg-surface)",
                                                border: "1px solid var(--border-color)",
                                                color: "var(--text-secondary)",
                                            }}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicProfilePage;
