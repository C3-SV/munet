"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminAlertBanner } from "../../../../../../../components/admin/AdminAlertBanner";
import { AdminButton } from "../../../../../../../components/admin/AdminButton";
import { AdminConfirmDialog } from "../../../../../../../components/admin/AdminConfirmDialog";
import { AdminCredentialBanner } from "../../../../../../../components/admin/AdminCredentialBanner";
import { AdminEmptyState } from "../../../../../../../components/admin/AdminEmptyState";
import { AdminFormInput } from "../../../../../../../components/admin/AdminFormInput";
import { AdminFormSelect } from "../../../../../../../components/admin/AdminFormSelect";
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
    getParticipant,
    reactivateParticipant,
    resetParticipantPassword,
    suspendParticipant,
    updateParticipant,
    type AdminParticipant,
    type UpdateParticipantBody,
} from "../../../../../../../lib/api/participants";
import { useAuthStore } from "../../../../../../../stores/auth.store";

const ROLE_SUGGESTIONS = [
    "DELEGADO",
    "MODERADOR",
    "ORGANIZADOR",
    "COORDINADOR",
    "ADMIN",
];

type FormState = {
    role: string;
    committee_id: string;
    delegation_name: string;
    institution_name: string;
    first_name: string;
    last_name: string;
    display_name: string;
    bio: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

type LifecycleAction = "suspend" | "reactivate" | "reset-password";

const EMPTY_FORM: FormState = {
    role: "",
    committee_id: "",
    delegation_name: "",
    institution_name: "",
    first_name: "",
    last_name: "",
    display_name: "",
    bio: "",
};

const toFormState = (participant: AdminParticipant): FormState => ({
    role: participant.role,
    committee_id: participant.committee_id ?? "",
    delegation_name: participant.delegation_name ?? "",
    institution_name: participant.institution_name ?? "",
    first_name: participant.profile?.first_name ?? "",
    last_name: participant.profile?.last_name ?? "",
    display_name: participant.profile?.display_name ?? "",
    bio: participant.profile?.bio ?? "",
});

const getParticipantName = (participant: AdminParticipant) => {
    const profile = participant.profile;

    if (profile?.display_name?.trim()) {
        return profile.display_name.trim();
    }

    const fullName = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || "Sin perfil";
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
            className="animate-spin rounded-full border-2 border-t-transparent"
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

        listCommittees(token, eventId)
            .then((data) => {
                if (!cancelled) {
                    setCommittees(data);
                }
            })
            .catch(() => {
                // El comité es opcional; el formulario sigue disponible.
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
                            ? loadFailure.message
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

    const committeeOptions = [
        { value: "", label: "Sin comité" },
        ...committees.map((committee) => ({
            value: committee.id,
            label: `${committee.code} — ${committee.name}`,
        })),
    ];

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

        if (!form.role.trim()) {
            validationErrors.role = "El rol es requerido.";
        }

        if (!form.first_name.trim()) {
            validationErrors.first_name = "El nombre es requerido.";
        }

        if (!form.last_name.trim()) {
            validationErrors.last_name = "El apellido es requerido.";
        }

        return validationErrors;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setApiError(null);
        setSuccess(null);

        const validationErrors = validate();

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        if (!token || !participant) {
            setApiError("Sesión o participante no válido. Recarga la página.");
            return;
        }

        setSaving(true);

        try {
            const body: UpdateParticipantBody = {
                role: form.role.trim().toUpperCase(),
                committee_id: form.committee_id || null,
                delegation_name: form.delegation_name.trim() || null,
                institution_name: form.institution_name.trim() || null,
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                display_name: form.display_name.trim() || null,
                bio: form.bio.trim() || null,
            };

            await updateParticipant(token, membershipId, body);

            setParticipant((previous) => {
                if (!previous) {
                    return previous;
                }

                return {
                    ...previous,
                    role: body.role ?? previous.role,
                    committee_id: body.committee_id ?? null,
                    delegation_name: body.delegation_name ?? null,
                    institution_name: body.institution_name ?? null,
                    profile: {
                        first_name: form.first_name.trim(),
                        last_name: form.last_name.trim(),
                        display_name: form.display_name.trim() || null,
                        bio: form.bio.trim() || null,
                        profile_image_path:
                            previous.profile?.profile_image_path ?? null,
                    },
                };
            });

            setSuccess("Cambios guardados correctamente.");
        } catch (saveError) {
            setApiError(
                saveError instanceof ApiError
                    ? saveError.message
                    : "No se pudo actualizar el participante. Intenta de nuevo.",
            );
        } finally {
            setSaving(false);
        }
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
            setActionError(
                actionFailure instanceof ApiError
                    ? actionFailure.message
                    : "No se pudo completar la acción. Intenta de nuevo.",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const participantName = participant
        ? getParticipantName(participant)
        : "este participante";
    const isSuspended = participant?.account_status === "SUSPENDED";

    const lifecycleDialog = lifecycleAction ? (
        <AdminConfirmDialog
            key={lifecycleAction}
            title={
                lifecycleAction === "suspend"
                    ? "Suspender cuenta"
                    : lifecycleAction === "reactivate"
                      ? "Reactivar cuenta"
                      : "Restablecer contraseña"
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
            variant={lifecycleAction === "suspend" ? "danger" : "primary"}
            requireReason={lifecycleAction !== "reset-password"}
            reasonLabel={
                lifecycleAction === "suspend"
                    ? "Motivo de la suspensión"
                    : "Motivo de la reactivación"
            }
            loading={actionLoading}
            error={actionError}
            onCancel={closeLifecycleAction}
            onConfirm={handleConfirmLifecycleAction}
        />
    ) : null;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <AdminPageHeader
                title={participant ? participantName : "Participante"}
                description={
                    participant
                        ? `Código ${participant.participant_code} en ${eventName}.`
                        : "Detalle del participante."
                }
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
                    <Link href={`/admin/events/${eventId}/participants`}>
                        <AdminButton variant="secondary">
                            Volver a participantes
                        </AdminButton>
                    </Link>
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
                <AdminCredentialBanner
                    title="Contraseña temporal generada"
                    participantCode={participant?.participant_code}
                    password={temporaryPassword}
                    note="Compártela con el participante. No se volverá a mostrar."
                    onDismiss={() => setTemporaryPassword(null)}
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
                        icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/alert-triangle.svg"
                        title="No se pudo cargar el participante"
                        description={loadError}
                        action={
                            <AdminButton
                                variant="secondary"
                                onClick={() =>
                                    setReloadKey((value) => value + 1)
                                }
                                icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/refresh.svg"
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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <p
                                    className="text-[10px] font-extrabold uppercase tracking-widest font-heading"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Código
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
                                    className="text-[10px] font-extrabold uppercase tracking-widest font-heading"
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
                        <p
                            className="mt-4 text-xs"
                            style={{ color: "var(--text-muted)" }}
                        >
                            El código, el evento y el usuario no se pueden
                            modificar.
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <AdminFormInput
                                id="participant-role"
                                label="Rol"
                                placeholder="Ej: DELEGADO"
                                required
                                list="participant-role-options"
                                value={form.role}
                                onChange={(event) =>
                                    handleChange(
                                        "role",
                                        event.target.value.toUpperCase(),
                                    )
                                }
                                error={errors.role}
                                hint="Los roles administrativos se detectan por ADMIN, COORDINADOR u ORGANIZADOR."
                                disabled={saving}
                            />

                            <AdminFormSelect
                                id="participant-committee"
                                label="Comité"
                                value={form.committee_id}
                                onChange={(event) =>
                                    handleChange(
                                        "committee_id",
                                        event.target.value,
                                    )
                                }
                                options={committeeOptions}
                                disabled={saving}
                            />
                        </div>

                        <datalist id="participant-role-options">
                            {ROLE_SUGGESTIONS.map((role) => (
                                <option key={role} value={role} />
                            ))}
                        </datalist>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <AdminFormInput
                                id="participant-delegation"
                                label="Delegación"
                                placeholder="Ej: Francia"
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
                                icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/check.svg"
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
                                icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/key.svg"
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
                                    icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/user-check.svg"
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
                                    icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/user-off.svg"
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

            {lifecycleDialog}
        </div>
    );
}
