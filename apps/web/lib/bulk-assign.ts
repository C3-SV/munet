// Lógica pura de las asignaciones en lote del panel admin. No importa la API ni el DOM:
// la página pasa la operación que cambia el comité de un participante (`apply`).
// Los cambios se aplican uno por uno, en serie, para usar la asignación existente.

export const BULK_BATCH_LIMIT = 50;

export type BulkFailure = { id: string; reason: string };

export type BulkOutcome = {
    ok: string[];
    failed: BulkFailure[];
};

export type BulkProgress = {
    done: number; // participantes ya procesados, correctos o fallidos
    total: number;
    batch: number; // lote en curso, desde 1
    batchCount: number;
};

export type BulkMember = { id: string; committeeId: string | null };

export type RunInBatchesOptions = {
    ids: readonly string[];
    apply: (id: string) => Promise<unknown>;
    describeError: (error: unknown) => string;
    limit?: number;
    onProgress?: (progress: BulkProgress) => void;
};

const assertValidLimit = (limit: number) => {
    if (!Number.isInteger(limit) || limit < 1) {
        throw new RangeError("El tope de lote debe ser un entero mayor que cero.");
    }
};

// Parte una lista en lotes de como máximo `limit` elementos, conservando el orden.
export const splitIntoBatches = <T>(
    items: readonly T[],
    limit: number = BULK_BATCH_LIMIT,
): T[][] => {
    assertValidLimit(limit);

    const batches: T[][] = [];

    for (let index = 0; index < items.length; index += limit) {
        batches.push(items.slice(index, index + limit));
    }

    return batches;
};

// Número de lotes que necesita un total de elementos.
export const countBatches = (total: number, limit: number = BULK_BATCH_LIMIT): number => {
    assertValidLimit(limit);

    return Math.ceil(total / limit);
};

// Separa a quien ya está en el destino (no se toca) de quien hay que cambiar.
// Con destino null, quien ya no tiene comité cuenta como sin cambios.
export const planCommitteeChange = (
    members: readonly BulkMember[],
    targetCommitteeId: string | null,
): { pending: string[]; unchanged: string[] } => {
    const seen = new Set<string>();
    const pending: string[] = [];
    const unchanged: string[] = [];

    for (const member of members) {
        if (seen.has(member.id)) {
            continue;
        }

        seen.add(member.id);

        if ((member.committeeId ?? null) === targetCommitteeId) {
            unchanged.push(member.id);
        } else {
            pending.push(member.id);
        }
    }

    return { pending, unchanged };
};

// Aplica `apply` a cada id, lote a lote y uno por uno. Un fallo no detiene la lista:
// se registra con su motivo y se sigue con el siguiente participante.
export const runInBatches = async ({
    ids,
    apply,
    describeError,
    limit = BULK_BATCH_LIMIT,
    onProgress,
}: RunInBatchesOptions): Promise<BulkOutcome> => {
    const uniqueIds = [...new Set(ids)];
    const batches = splitIntoBatches(uniqueIds, limit);
    const outcome: BulkOutcome = { ok: [], failed: [] };
    let done = 0;

    for (const [batchIndex, batch] of batches.entries()) {
        for (const id of batch) {
            try {
                await apply(id);
                outcome.ok.push(id);
            } catch (error) {
                outcome.failed.push({ id, reason: describeError(error) });
            }

            done += 1;
            onProgress?.({
                done,
                total: uniqueIds.length,
                batch: batchIndex + 1,
                batchCount: batches.length,
            });
        }
    }

    return outcome;
};

// Ids que conviene reintentar: los que fallaron, en su orden original.
export const failedIds = (outcome: BulkOutcome): string[] =>
    outcome.failed.map((failure) => failure.id);

// Une el resultado de reintentar los fallidos con el resultado previo. Los reintentados
// sustituyen su fallo anterior; los fallos no reintentados se conservan.
export const mergeRetry = (previous: BulkOutcome, retry: BulkOutcome): BulkOutcome => {
    const retried = new Set([...retry.ok, ...retry.failed.map((failure) => failure.id)]);
    const ok = [...new Set([...previous.ok, ...retry.ok])];
    const failed = [
        ...previous.failed.filter((failure) => !retried.has(failure.id)),
        ...retry.failed,
    ];

    return { ok, failed };
};
