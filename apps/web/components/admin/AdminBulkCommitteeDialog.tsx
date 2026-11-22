"use client";

import { useState } from "react";
import {
    BULK_BATCH_LIMIT,
    countBatches,
    failedIds,
    mergeRetry,
    type BulkOutcome,
    type BulkProgress,
} from "../../lib/bulk-assign";
import { IconBuilding, IconRefresh } from "../ui/icons";
import { AdminButton } from "./AdminButton";
import { AdminFormTextarea } from "./AdminFormTextarea";
import { AdminModal } from "./AdminModal";

// Diálogo de un lote de asignaciones: confirma, muestra el progreso y el resumen
// con reintento de los fallidos. La página aporta la operación (`onRun`).

export type BulkDialogItem = { id: string; name: string };

type AdminBulkCommitteeDialogProps = {
    mode: "assign" | "remove";
    targetLabel: string | null;
    items: BulkDialogItem[]; // participantes que sí cambian
    unchangedCount: number; // ya estaban en el destino y se omiten
    onRun: (
        ids: string[],
        reason: string,
        onProgress: (progress: BulkProgress) => void,
    ) => Promise<BulkOutcome>;
    onFinished: (outcome: BulkOutcome) => void;
    onClose: () => void;
};

type Phase = "confirm" | "running" | "done";

const plural = (count: number, one: string, many: string) =>
    count === 1 ? one : many;

export const AdminBulkCommitteeDialog = ({
    mode,
    targetLabel,
    items,
    unchangedCount,
    onRun,
    onFinished,
    onClose,
}: AdminBulkCommitteeDialogProps) => {
    const [phase, setPhase] = useState<Phase>("confirm");
    const [reason, setReason] = useState("");
    const [progress, setProgress] = useState<BulkProgress | null>(null);
    const [outcome, setOutcome] = useState<BulkOutcome | null>(null);

    const assigning = mode === "assign";
    const total = items.length;
    const batchCount = countBatches(total);
    const names = new Map(items.map((item) => [item.id, item.name]));
    const title = assigning ? "Asignar a comité" : "Quitar de comité";

    const execute = async (ids: string[], previous: BulkOutcome | null) => {
        setPhase("running");
        setProgress(null);

        const result = await onRun(ids, reason.trim(), setProgress);
        const merged = previous ? mergeRetry(previous, result) : result;

        setOutcome(merged);
        setPhase("done");
        onFinished(merged);
    };

    if (phase === "running") {
        const percent =
            progress && progress.total > 0
                ? Math.round((progress.done / progress.total) * 100)
                : 0;

        return (
            <AdminModal
                title="Aplicando cambios"
                description="Los cambios se aplican uno por uno. No cierres esta ventana hasta que termine."
                onClose={onClose}
                dismissible={false}
                maxWidthClassName="max-w-md"
            >
                <div className="space-y-3">
                    <div
                        role="progressbar"
                        aria-label="Progreso de la asignación"
                        aria-valuemin={0}
                        aria-valuemax={progress?.total ?? total}
                        aria-valuenow={progress?.done ?? 0}
                        aria-valuetext={
                            progress
                                ? `Lote ${progress.batch} de ${progress.batchCount}, ${progress.done} de ${progress.total}`
                                : "Preparando"
                        }
                        className="h-2 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: "var(--bg-surface-secondary)" }}
                    >
                        <div
                            className="h-full rounded-full transition-[width] duration-150 motion-reduce:transition-none"
                            style={{
                                width: `${percent}%`,
                                backgroundColor: "var(--text-accent)",
                            }}
                        />
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {progress
                            ? `Lote ${progress.batch} de ${progress.batchCount} · ${progress.done} de ${progress.total}`
                            : "Preparando los cambios…"}
                    </p>
                </div>
            </AdminModal>
        );
    }

    if (phase === "done" && outcome) {
        const okCount = outcome.ok.length;
        const failedCount = outcome.failed.length;

        return (
            <AdminModal
                title="Resumen del cambio"
                onClose={onClose}
                maxWidthClassName="max-w-md"
                footer={
                    <>
                        {failedCount > 0 && (
                            <AdminButton
                                type="button"
                                variant="secondary"
                                onClick={() => execute(failedIds(outcome), outcome)}
                                icon={<IconRefresh size={16} />}
                            >
                                Reintentar fallidos
                            </AdminButton>
                        )}
                        <AdminButton type="button" onClick={onClose}>
                            Cerrar
                        </AdminButton>
                    </>
                }
            >
                <div className="space-y-4">
                    <p role="status" className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        <span style={{ color: "var(--success)" }}>
                            {okCount} {plural(okCount, "correcto", "correctos")}
                        </span>
                        {" · "}
                        <span style={{ color: failedCount > 0 ? "var(--danger)" : "var(--text-muted)" }}>
                            {failedCount} {plural(failedCount, "fallido", "fallidos")}
                        </span>
                    </p>

                    {unchangedCount > 0 && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Omitidos por no necesitar cambios: {unchangedCount}.
                        </p>
                    )}

                    {failedCount > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold font-heading" style={{ color: "var(--text-primary)" }}>
                                Participantes que no cambiaron
                            </h3>
                            <ul
                                className="max-h-56 overflow-y-auto rounded-xl divide-y"
                                style={{ border: "1px solid var(--border-light)" }}
                            >
                                {outcome.failed.map((failure) => (
                                    <li key={failure.id} className="px-3 py-2 text-sm">
                                        <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                                            {names.get(failure.id) ?? "Participante"}
                                        </p>
                                        <p className="text-xs" style={{ color: "var(--danger)" }}>
                                            {failure.reason}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </AdminModal>
        );
    }

    return (
        <AdminModal
            title={title}
            description={
                assigning
                    ? `Se cambiará el comité de ${total} ${plural(total, "participante", "participantes")} a ${targetLabel ?? "el comité elegido"}.`
                    : `Se quitará del comité a ${total} ${plural(total, "participante", "participantes")}.`
            }
            onClose={onClose}
            maxWidthClassName="max-w-md"
            footer={
                <>
                    <AdminButton type="button" variant="secondary" onClick={onClose}>
                        Cancelar
                    </AdminButton>
                    <AdminButton
                        type="button"
                        onClick={() => execute(items.map((item) => item.id), null)}
                        disabled={total === 0}
                        icon={<IconBuilding size={16} />}
                    >
                        {assigning ? `Asignar a ${total}` : `Quitar a ${total}`}
                    </AdminButton>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Se aplicará en {batchCount} {plural(batchCount, "lote", "lotes")} de hasta{" "}
                    {BULK_BATCH_LIMIT} participantes, uno por uno.
                    {unchangedCount > 0 &&
                        ` Omitidos por no necesitar cambios: ${unchangedCount}.`}
                </p>

                {total > 0 && (
                    <ul
                        className="max-h-40 overflow-y-auto rounded-xl divide-y"
                        style={{ border: "1px solid var(--border-light)" }}
                        aria-label="Participantes que cambian"
                    >
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="px-3 py-2 text-sm font-medium"
                                style={{ color: "var(--text-primary)" }}
                            >
                                {item.name}
                            </li>
                        ))}
                    </ul>
                )}

                <AdminFormTextarea
                    id="bulk-committee-reason"
                    label="Motivo (opcional)"
                    placeholder="Ej: Reasignación solicitada por la coordinación."
                    rows={2}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    hint="Queda registrado en la auditoría de cada cambio."
                />
            </div>
        </AdminModal>
    );
};
