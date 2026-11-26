"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminReasonDialog } from "../../../../../../../components/admin/AdminReasonDialog";
import { AdminAlertBanner } from "../../../../../../../components/admin/AdminAlertBanner";
import { AdminButton } from "../../../../../../../components/admin/AdminButton";
import { AdminChangeCommitteeDialog } from "../../../../../../../components/admin/AdminChangeCommitteeDialog";
import { AdminCredentialsDialog } from "../../../../../../../components/admin/AdminCredentialsDialog";
import { AdminEmptyState } from "../../../../../../../components/admin/AdminEmptyState";
import { AdminFormInput } from "../../../../../../../components/admin/AdminFormInput";
import { AdminFormTextarea } from "../../../../../../../components/admin/AdminFormTextarea";
import { AdminPageHeader } from "../../../../../../../components/admin/AdminPageHeader";
import { AdminStatusBadge } from "../../../../../../../components/admin/AdminStatusBadge";
import {
    getEvent,
    listCommittees,
    type AdminCommittee,
} from "../../../../../../../lib/api/admin";
import { ApiError } from "../../../../../../../lib/api/client";
import {
    changeParticipantCommittee,
    changeParticipantRole,
    getParticipant,
    reactivateParticipant,
    resetParticipantPassword,
    suspendParticipant,
    updateParticipant,
    type AdminParticipant,
    type UpdateParticipantBody,
} from "../../../../../../../lib/api/participants";
import { formatRoleLabel } from "../../../../../../../lib/role-label";
import { isAdminRole, useAuthStore } from "../../../../../../../stores/auth.store";
import { ConfirmDialog } from "../../../../../../../components/ui/ConfirmDialog";
import { IconAlertTriangle, IconBuilding, IconCheck, IconKey, IconRefresh, IconUserCheck, IconUserOff } from "../../../../../../../components/ui/icons";

type FormState = {
    delegation_name: string;
    institution_name: string;
    first_name: string;
    last_name: string;
    display_name: string;
    alias: string;
    bio: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

type LifecycleAction = "suspend" | "reactivate" | "reset-password";

const EMPTY_FORM: FormState = {
    delegation_name: "",
    institution_name: "",
    first_name: "",
    last_name: "",
    display_name: "",
    alias: "",
    bio: "",
};

const toFormState = (participant: AdminParticipant): FormState => ({
    delegation_name: participant.delegation_name ?? "",
    institution_name: participant.institution_name ?? "",
    first_name: participant.profile?.first_name ?? "",
    last_name: participant.profile?.last_name ?? "",
    display_name: participant.profile?.display_name ?? "",
    alias: participant.profile?.alias ?? "",
    bio: participant.profile?.bio ?? "",
});

const getParticipantName = (participant: AdminParticipant) => {
    const profile = participant.profile;
    const fullName = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || profile?.display_name?.trim() || "Sin perfil";
};

const getActionErrorMessage = (failure: unknown) => {
    if (failure instanceof ApiError) {
        return failure.status === 403
            ? "No tienes permisos para administrar este evento."
            : failure.message;
    }

    return "No se pudo completar la acción. Intenta de nuevo.";
};

const formatDate = (value?: string | null) => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("es", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
};

const LoadingState = () => (
    <div className="flex items-center justify-center py-20">
        <span
            className="animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
            style={{
                width: 32,
                height: 32,
                borderColor: "var(--text-accent)",
                borderTopColor: "transparent",
            }}
        />
    </div>
);

export default function ParticipantDetailPage() {
    const params = useParams<{ eventId: string; membershipId: string }>();
    const router = useRouter();
    const eventId = params?.eventId ?? "";
    const membershipId = params?.membershipId ?? "";

    const token = useAuthStore((state) => state.token);
    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const membershipEventName =
        memberships.find((membership) => membership.eventId === eventId)?.eventName ??
        memberships.find((membership) => membership.id === activeMembershipId)?.eventName;

    const [eventName, setEventName] = useState(membershipEventName ?? "Evento");
    const [committees, setCommittees] = useState<AdminCommittee[]>([]);
    const [committeesLoading, setCommitteesLoading] = useState(true);
    const [participant, setParticipant] = useState<AdminParticipant | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const [lifecycleAction, setLifecycleAction] =
        useState<LifecycleAction | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
        null,
    );

    const [committeeDialogOpen, setCommitteeDialogOpen] = useState(false);
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [roleLoading, setRoleLoading] = useState(false);
    const [roleError, setRoleError] = useState<string | null>(null);
    const [roleBlocked, setRoleBlocked] = useState(false);
    const [committeeLoading, setCommitteeLoading] = useState(false);
    const [committeeError, setCommitteeError] = useState<string | null>(null);

    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        getEvent(token, eventId)
            .then((data) => {
                if (!cancelled) {
                    setEventName(data.event.name);
                }
            })
            .catch(() => {
                // Si falla, se mantiene el nombre de la membresía o "Evento".
            });

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        setCommitteesLoading(true);

        listCommittees(token, eventId)
            .then((data) => {
                if (!cancelled) {
                    setCommittees(data);
                }
            })
            .catch(() => {
                // El comité es opcional; el formulario sigue disponible.
            })
            .finally(() => {
                if (!cancelled) {
                    setCommitteesLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

    useEffect(() => {
        if (!token || !membershipId) {
            return;
        }

        let cancelled = false;

        setLoading(true);
        setLoadError(null);

        getParticipant(token, membershipId)
            .then((data) => {
                if (cancelled) {
                    return;
                }

                if (data.participant.event_id !== eventId) {
                    setLoadError(
                        "El participante no pertenece al evento indicado.",
                    );
                    return;
                }

                setParticipant(data.participant);
                setForm(toFormState(data.participant));
            })
            .catch((loadFailure) => {
                if (!cancelled) {
                    setLoadError(
                        loadFailure instanceof ApiError
                            ? getActionErrorMessage(loadFailure)
                            : "No se pudo cargar el participante.",
                    );
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [eventId, membershipId, reloadKey, token]);

    const isModerator = participant?.role.trim().toUpperCase() === "MODERATOR";
    const canChangeModerator = Boolean(participant) && !isAdminRole(participant?.role);

    const handleChangeRole = async (reason: string) => {
        if (!token || !participant) {
            return;
        }

        setRoleLoading(true);
        setRoleError(null);

        try {
            const response = await changeParticipantRole(
                token,
                participant.id,
                isModerator ? "PARTICIPANT" : "MODERATOR",
                reason || undefined,
            );

            setParticipant((previous) =>
                previous
                    ? { ...previous, role: response.membership.role }
                    : previous,
            );
            setRoleDialogOpen(false);
            setSuccess(response.message);
        } catch (roleFailure) {
            setRoleError(getActionErrorMessage(roleFailure));

            // Ante un 429 se bloquea el botón unos segundos; no se reintenta solo.
            if (roleFailure instanceof ApiError && roleFailure.status === 429) {
                setRoleBlocked(true);
                window.setTimeout(() => setRoleBlocked(false), 5000);
            }
        } finally {
            setRoleLoading(false);
        }
    };

    const handleChange = (field: keyof FormState, value: string) => {
        setForm((previous) => ({ ...previous, [field]: value }));

        if (errors[field]) {
            setErrors((previous) => ({ ...previous, [field]: undefined }));
        }

        if (apiError) {
            setApiError(null);
        }

        if (success) {
            setSuccess(null);
        }
    };

    const validate = (): FormErrors => {
        const validationErrors: FormErrors = {};

        if (!form.first_name.trim()) {
            validationErrors.first_name = "El nombre es requerido.";
        }

        if (!form.last_name.trim()) {
            validationErrors.last_name = "El apellido es requerido.";
        }

        return validationErrors;
    };

    const saveParticipant = async () => {
        if (!token || !participant) {
            setApiError("Sesión o participante no válido. Recarga la página.");
            return;
        }

        setSaving(true);

        try {
            const body: UpdateParticipantBody = {
                delegation_name: form.delegation_name.trim() || null,
                institution_name: form.institution_name.trim() || null,
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                display_name: form.display_name.trim() || null,
                alias: form.alias.trim() || null,
                bio: form.bio.trim() || null,
            };

            await updateParticipant(token, membershipId, body);

            setParticipant((previous) => {
                if (!previous) {
                    return previous;
                }

                return {
                    ...previous,
                    delegation_name: body.delegation_name ?? null,
                    institution_name: body.institution_name ?? null,
                    profile: {
                        first_name: form.first_name.trim(),
                        last_name: form.last_name.trim(),
                        display_name: form.display_name.trim() || null,
                        alias: form.alias.trim() || null,
                        bio: form.bio.trim() || null,
                        profile_image_path:
                            previous.profile?.profile_image_path ?? null,
                    },
                };
            });

            setSuccess("Cambios guardados correctamente.");
        } catch (saveError) {
            setApiError(getActionErrorMessage(saveError));
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setApiError(null);
        setSuccess(null);

        const validationErrors = validate();

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        void saveParticipant();
    };

    const openLifecycleAction = (action: LifecycleAction) => {
        setActionError(null);
        setActionSuccess(null);
        setLifecycleAction(action);
    };

    const closeLifecycleAction = () => {
        if (actionLoading) {
            return;
        }

        setLifecycleAction(null);
        setActionError(null);
    };

    const handleConfirmLifecycleAction = async (reason: string) => {
        if (!token || !participant || !lifecycleAction) {
            return;
        }

        setActionLoading(true);
        setActionError(null);

        try {
            if (lifecycleAction === "suspend") {
                const response = await suspendParticipant(
                    token,
                    participant.id,
                    reason,
                );

                setParticipant((previous) =>
                    previous
                        ? {
                              ...previous,
                              account_status:
                                  response.membership.account_status,
                              status_changed_at:
                                  response.membership.status_changed_at ??
                                  previous.status_changed_at,
                          }
                        : previous,
                );
                setActionSuccess(response.message);
            } else if (lifecycleAction === "reactivate") {
                const response = await reactivateParticipant(
                    token,
                    participant.id,
                    reason,
                );

                setParticipant((previous) =>
                    previous
                        ? {
                              ...previous,
                              account_status:
                                  response.membership.account_status,
                              status_changed_at:
                                  response.membership.status_changed_at ??
                                  previous.status_changed_at,
                          }
                        : previous,
                );
                setActionSuccess(response.message);
            } else {
                const response = await resetParticipantPassword(
                    token,
                    participant.id,
                );

                setTemporaryPassword(response.temporary_password);
                setActionSuccess(response.message);
            }

            setLifecycleAction(null);
            setActionError(null);
        } catch (actionFailure) {
            setActionError(getActionErrorMessage(actionFailure));
        } finally {
            setActionLoading(false);
        }
    };

    const openCommitteeDialog = () => {
        setCommitteeError(null);
        setApiError(null);
        setCommitteeDialogOpen(true);
    };

    const closeCommitteeDialog = () => {
        if (committeeLoading) {
            return;
        }

        setCommitteeDialogOpen(false);
        setCommitteeError(null);
    };

    const handleChangeCommittee = async (
        committeeId: string | null,
        reason: string,
    ) => {
        if (!token || !participant) {
            return;
        }

        setCommitteeLoading(true);
        setCommitteeError(null);

        try {
            const response = await changeParticipantCommittee(
                token,
                participant.id,
                committeeId,
                reason || undefined,
            );

            setParticipant((previous) =>
                previous
                    ? {
                          ...previous,
                          committee_id: response.membership.committee_id,
                      }
                    : previous,
            );
            setCommitteeDialogOpen(false);
            setSuccess(response.message);
        } catch (actionFailure) {
            setCommitteeError(getActionErrorMessage(actionFailure));
        } finally {
            setCommitteeLoading(false);
        }
    };

    const participantName = participant
        ? getParticipantName(participant)
        : "este participante";
    const isSuspended = participant?.account_status === "SUSPENDED";
    const currentCommittee = participant?.committee_id
        ? committees.find((committee) => committee.id === participant.committee_id)
        : undefined;

    const lifecycleDialog = lifecycleAction ? (
        <ConfirmDialog
            open
            key={lifecycleAction}
            title={
                lifecycleAction === "suspend"
                    ? "¿Suspender esta cuenta?"
                    : lifecycleAction === "reactivate"
                      ? "¿Reactivar esta cuenta?"
                      : "¿Restablecer la contraseña?"
            }
            description={
                lifecycleAction === "suspend"
                    ? `La cuenta de ${participantName} dejará de operar hasta que se reactive. Indica el motivo.`
                    : lifecycleAction === "reactivate"
                      ? `La cuenta de ${participantName} volverá a estar activa. Indica el motivo.`
                      : `Se generará una contraseña temporal para ${participantName}. La contraseña actual dejará de funcionar.`
            }
            confirmLabel={
                lifecycleAction === "suspend"
                    ? "Suspender cuenta"
                    : lifecycleAction === "reactivate"
                      ? "Reactivar cuenta"
                      : "Restablecer contraseña"
            }
            tone={lifecycleAction === "reactivate" ? "default" : "danger"}
            requireReason={lifecycleAction !== "reset-password"}
            reasonLabel={
                lifecycleAction === "suspend"
                    ? "Motivo de la suspensión"
                    : "Motivo de la reactivación"
            }
            loading={actionLoading}
            error={actionError}
            onCancel={closeLifecycleAction}
            onConfirm={(reason) => handleConfirmLifecycleAction(reason ?? "")}
        />
    ) : null;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <AdminPageHeader
                title={participant ? participantName : "Participante"}
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    { label: eventName, href: `/admin/events/${eventId}` },
                    {
                        label: "Participantes",
                        href: `/admin/events/${eventId}/participants`,
                    },
                    { label: participant ? participantName : "Participante" },
                ]}
                action={
                    <AdminButton
                        href={`/admin/events/${eventId}/participants`}
                        variant="secondary"
                    >
                        Volver a participantes
                    </AdminButton>
                }
            />

            {success && (
                <AdminAlertBanner
                    type="success"
                    message={success}
                    onDismiss={() => setSuccess(null)}
                />
            )}

            {actionSuccess && (
                <AdminAlertBanner
                    type="success"
                    message={actionSuccess}
                    onDismiss={() => setActionSuccess(null)}
                />
            )}

            {temporaryPassword && (
                <AdminCredentialsDialog
                    title="Contraseña temporal generada"
                    description={`Comparte esta contraseña con ${participantName}.`}
                    fields={[
                        {
                            key: "password",
                            label: "Contraseña temporal",
                            value: temporaryPassword,
                        },
                    ]}
                    note="Guárdala ahora. No se volverá a mostrar."
                    onClose={() => setTemporaryPassword(null)}
                />
            )}

            {loading && (
                <div
                    className="rounded-2xl"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <LoadingState />
                </div>
            )}

            {!loading && loadError && (
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <AdminEmptyState
                        icon={<IconAlertTriangle size={32} />}
                        title="No se pudo cargar el participante"
                        description={loadError}
                        action={
                            <AdminButton
                                variant="secondary"
                                onClick={() =>
                                    setReloadKey((value) => value + 1)
                                }
                                icon={<IconRefresh size={16} />}
                            >
                                Reintentar
                            </AdminButton>
                        }
                    />
                </div>
            )}

            {!loading && !loadError && participant && (
                <>
                    <div
                        className="rounded-2xl p-6"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                        }}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p
                                    className="text-xs font-bold font-heading"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Código de login
                                </p>
                                <p
                                    className="mt-1 text-sm font-semibold font-heading"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {participant.participant_code}
                                </p>
                            </div>
                            <div>
                                <p
                                    className="text-xs font-bold font-heading"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Código #
                                </p>
                                <p
                                    className="mt-1 text-sm font-semibold font-heading"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {participant.delegation_code ?? "Sin código"}
                                </p>
                            </div>
                            <div>
                                <p
                                    className="text-[10px] font-extrabold uppercase tracking-widest font-heading"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Estado
                                </p>
                                <div className="mt-1">
                                    <AdminStatusBadge
                                        status={participant.account_status}
                                    />
                                </div>
                            </div>
                            <div>
                                <p
                                    className="text-xs font-bold font-heading"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Creado
                                </p>
                                <p
                                    className="mt-1 text-sm"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    {formatDate(participant.created_at)}
                                </p>
                            </div>
                        </div>

                        <div
                            className="mt-4 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                            style={{
                                borderTop: "1px solid var(--border-light)",
                            }}
                        >
                            <div>
                                <p
                                    className="text-[10px] font-extrabold uppercase tracking-widest font-heading"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Comité actual
                                </p>
                                <p
                                    className="mt-1 text-sm font-semibold font-heading"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {currentCommittee
                                        ? `${currentCommittee.code} — ${currentCommittee.name}`
                                        : participant.committee_id
                                          ? "Comité no disponible"
                                          : "Sin comité"}
                                </p>
                            </div>
                            <AdminButton
                                type="button"
                                variant="secondary"
                                icon={<IconBuilding size={16} />}
                                onClick={openCommitteeDialog}
                                disabled={committeesLoading || committeeLoading}
                            >
                                Cambiar comité
                            </AdminButton>
                        </div>

                        <p
                            className="mt-4 text-xs"
                            style={{ color: "var(--text-muted)" }}
                        >
                            El código de login, el código #, el evento y el
                            usuario no se pueden modificar.
                        </p>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="rounded-2xl p-6 sm:p-8 space-y-6"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                        }}
                        noValidate
                    >
                        {apiError && (
                            <AdminAlertBanner
                                type="error"
                                message={apiError}
                                onDismiss={() => setApiError(null)}
                            />
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p
                                    className="text-xs font-bold font-heading"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Rol
                                </p>
                                <p
                                    className="mt-1 text-sm font-semibold font-heading"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {formatRoleLabel(participant.role)}
                                </p>
                            </div>
                            {canChangeModerator && (
                                <AdminButton
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        setRoleError(null);
                                        setRoleDialogOpen(true);
                                    }}
                                    disabled={saving}
                                >
                                    {isModerator
                                        ? "Quitar moderador"
                                        : "Hacer moderador"}
                                </AdminButton>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <AdminFormInput
                                id="participant-delegation"
                                label="Delegación"
                                placeholder="Ej: Francia"
                                maxLength={120}
                                value={form.delegation_name}
                                onChange={(event) =>
                                    handleChange(
                                        "delegation_name",
                                        event.target.value,
                                    )
                                }
                                disabled={saving}
                            />
                            <AdminFormInput
                                id="participant-institution"
                                label="Institución"
                                placeholder="Ej: Universidad ESEN"
                                maxLength={120}
                                value={form.institution_name}
                                onChange={(event) =>
                                    handleChange(
                                        "institution_name",
                                        event.target.value,
                                    )
                                }
                                disabled={saving}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <AdminFormInput
                                id="participant-first-name"
                                label="Nombre"
                                placeholder="Ej: María"
                                required
                                maxLength={100}
                                value={form.first_name}
                                onChange={(event) =>
                                    handleChange(
                                        "first_name",
                                        event.target.value,
                                    )
                                }
                                error={errors.first_name}
                                disabled={saving}
                            />
                            <AdminFormInput
                                id="participant-last-name"
                                label="Apellido"
                                placeholder="Ej: López"
                                required
                                maxLength={100}
                                value={form.last_name}
                                onChange={(event) =>
                                    handleChange(
                                        "last_name",
                                        event.target.value,
                                    )
                                }
                                error={errors.last_name}
                                disabled={saving}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <AdminFormInput
                                id="participant-display-name"
                                label="Nombre para mostrar"
                                placeholder="Ej: María López (opcional)"
                                value={form.display_name}
                                onChange={(event) =>
                                    handleChange(
                                        "display_name",
                                        event.target.value,
                                    )
                                }
                                hint="Si lo dejas vacío, se mostrará el nombre y apellido."
                                disabled={saving}
                            />
                            <AdminFormInput
                                id="participant-alias"
                                label="Alias"
                                placeholder="Ej: Anita (opcional)"
                                maxLength={60}
                                value={form.alias}
                                onChange={(event) =>
                                    handleChange("alias", event.target.value)
                                }
                                hint="Máximo 60 caracteres."
                                disabled={saving}
                            />
                        </div>

                        <AdminFormTextarea
                            id="participant-bio"
                            label="Biografía"
                            placeholder="Breve biografía del participante (opcional)"
                            value={form.bio}
                            onChange={(event) =>
                                handleChange("bio", event.target.value)
                            }
                            disabled={saving}
                        />

                        <div
                            className="flex flex-col sm:flex-row justify-end gap-3"
                            style={{
                                borderTop: "1px solid var(--border-color)",
                                paddingTop: "1.25rem",
                                marginTop: "0.25rem",
                            }}
                        >
                            <AdminButton
                                type="button"
                                variant="secondary"
                                onClick={() =>
                                    router.push(
                                        `/admin/events/${eventId}/participants`,
                                    )
                                }
                                disabled={saving}
                            >
                                Cancelar
                            </AdminButton>
                            <AdminButton
                                type="submit"
                                loading={saving}
                                icon={<IconCheck size={16} />}
                            >
                                {saving
                                    ? "Guardando..."
                                    : "Guardar cambios"}
                            </AdminButton>
                        </div>
                    </form>

                    <div
                        className="rounded-2xl p-6 sm:p-8 space-y-4"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                        }}
                    >
                        <div>
                            <h2
                                className="text-lg font-bold font-heading"
                                style={{ color: "var(--text-primary)" }}
                            >
                                Ciclo de vida de la cuenta
                            </h2>
                            <p
                                className="mt-1 text-sm"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                Las acciones sensibles piden confirmación y
                                quedan registradas en la auditoría del evento.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <AdminButton
                                type="button"
                                variant="secondary"
                                icon={<IconKey size={16} />}
                                onClick={() =>
                                    openLifecycleAction("reset-password")
                                }
                                disabled={isSuspended || actionLoading}
                            >
                                Restablecer contraseña
                            </AdminButton>

                            {isSuspended ? (
                                <AdminButton
                                    type="button"
                                    icon={<IconUserCheck size={16} />}
                                    onClick={() =>
                                        openLifecycleAction("reactivate")
                                    }
                                    disabled={actionLoading}
                                >
                                    Reactivar cuenta
                                </AdminButton>
                            ) : (
                                <AdminButton
                                    type="button"
                                    variant="danger"
                                    icon={<IconUserOff size={16} />}
                                    onClick={() =>
                                        openLifecycleAction("suspend")
                                    }
                                    disabled={actionLoading}
                                >
                                    Suspender cuenta
                                </AdminButton>
                            )}
                        </div>

                        {isSuspended && (
                            <p
                                className="text-xs"
                                style={{ color: "var(--text-muted)" }}
                            >
                                No se puede restablecer la contraseña de una
                                cuenta suspendida. Reactívala primero.
                            </p>
                        )}
                    </div>
                </>
            )}

            {committeeDialogOpen && participant && (
                <AdminChangeCommitteeDialog
                    participantName={participantName}
                    currentCommitteeId={participant.committee_id}
                    committees={committees}
                    loading={committeeLoading}
                    error={committeeError}
                    onCancel={closeCommitteeDialog}
                    onConfirm={handleChangeCommittee}
                />
            )}

            {roleDialogOpen && participant && (
                <AdminReasonDialog
                    title={
                        isModerator
                            ? "¿Quitar el rol de moderador?"
                            : "¿Hacer moderador a este participante?"
                    }
                    description={
                        isModerator
                            ? `${participantName} volverá a ser participante y perderá el acceso a Moderación.`
                            : `${participantName} podrá ver y moderar todos los muros del evento, eliminar y fijar publicaciones. No podrá crear cuentas ni editar el evento.`
                    }
                    confirmLabel={isModerator ? "Quitar moderador" : "Hacer moderador"}
                    required={false}
                    reasonLabel="Motivo (opcional)"
                    loading={roleLoading}
                    error={roleError}
                    confirmDisabled={roleBlocked}
                    onCancel={() => setRoleDialogOpen(false)}
                    onConfirm={handleChangeRole}
                />
            )}

            {lifecycleDialog}
        </div>
    );
}
