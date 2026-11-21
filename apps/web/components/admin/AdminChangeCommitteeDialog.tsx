"use client";

import { useState } from "react";
import type { AdminCommittee } from "../../lib/api/admin";
import { AdminButton } from "./AdminButton";
import { AdminFormSelect } from "./AdminFormSelect";
import { AdminFormTextarea } from "./AdminFormTextarea";
import { AdminModal } from "./AdminModal";
import { IconBuilding } from "../ui/icons";

// Diálogo para cambiar el comité de un participante (S2-08).

type AdminChangeCommitteeDialogProps = {
    participantName: string;
    currentCommitteeId: string | null;
    committees: AdminCommittee[];
    loading: boolean;
    error?: string | null;
    onCancel: () => void;
    onConfirm: (committeeId: string | null, reason: string) => void;
};

export const AdminChangeCommitteeDialog = ({
    participantName,
    currentCommitteeId,
    committees,
    loading,
    error,
    onCancel,
    onConfirm,
}: AdminChangeCommitteeDialogProps) => {
    const [committeeId, setCommitteeId] = useState(currentCommitteeId ?? "");
    const [reason, setReason] = useState("");

    const options = [
        { value: "", label: "Sin comité" },
        ...committees.map((committee) => ({
            value: committee.id,
            label:
                committee.status === "ARCHIVED"
                    ? `${committee.code} — ${committee.name} (archivado)`
                    : `${committee.code} — ${committee.name}`,
            disabled: committee.status === "ARCHIVED",
        })),
    ];

    const unchanged = committeeId === (currentCommitteeId ?? "");

    const handleConfirm = () => {
        if (unchanged) {
            return;
        }

        onConfirm(committeeId || null, reason.trim());
    };

    return (
        <AdminModal
            title="Cambiar comité"
            description={`Cambia el comité de ${participantName}. El cambio queda registrado en la auditoría del evento.`}
            onClose={onCancel}
            dismissible={!loading}
            maxWidthClassName="max-w-md"
            footer={
                <>
                    <AdminButton
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancelar
                    </AdminButton>
                    <AdminButton
                        type="button"
                        loading={loading}
                        onClick={handleConfirm}
                        disabled={unchanged}
                        icon={<IconBuilding size={16} />}
                    >
                        Cambiar comité
                    </AdminButton>
                </>
            }
        >
            <div className="space-y-4">
                <AdminFormSelect
                    id="participant-change-committee"
                    label="Nuevo comité"
                    value={committeeId}
                    onChange={(event) => setCommitteeId(event.target.value)}
                    options={options}
                    disabled={loading}
                    hint="Puedes dejar al participante sin comité seleccionando esa opción."
                />

                <AdminFormTextarea
                    id="participant-change-committee-reason"
                    label="Motivo (opcional)"
                    placeholder="Ej: Reasignación solicitada por la coordinación."
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    disabled={loading}
                />

                {unchanged && (
                    <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                    >
                        Selecciona un comité diferente para continuar.
                    </p>
                )}

                {error && (
                    <p
                        className="text-sm font-medium"
                        style={{ color: "#ef4444" }}
                        role="alert"
                    >
                        {error}
                    </p>
                )}
            </div>
        </AdminModal>
    );
};
