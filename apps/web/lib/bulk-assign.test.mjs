import test from "node:test";
import assert from "node:assert/strict";

import {
    BULK_BATCH_LIMIT,
    countBatches,
    failedIds,
    mergeRetry,
    planCommitteeChange,
    runInBatches,
    splitIntoBatches,
} from "./bulk-assign.ts";

const range = (count) => Array.from({ length: count }, (_, index) => `p${index + 1}`);

test("el tope por lote es de 50 participantes", () => {
    assert.equal(BULK_BATCH_LIMIT, 50);
});

test("splitIntoBatches no devuelve lotes para una lista vacía", () => {
    assert.deepEqual(splitIntoBatches([]), []);
});

test("splitIntoBatches deja 50 elementos en un solo lote", () => {
    const batches = splitIntoBatches(range(50));

    assert.equal(batches.length, 1);
    assert.equal(batches[0].length, 50);
});

test("splitIntoBatches parte 120 elementos en lotes de 50, 50 y 20 conservando el orden", () => {
    const items = range(120);
    const batches = splitIntoBatches(items);

    assert.deepEqual(batches.map((batch) => batch.length), [50, 50, 20]);
    assert.deepEqual(batches.flat(), items);
});

test("splitIntoBatches acepta otro tope y rechaza topes no válidos", () => {
    assert.deepEqual(splitIntoBatches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);

    for (const limit of [0, -1, 1.5, Number.NaN]) {
        assert.throws(() => splitIntoBatches([1], limit), RangeError);
    }
});

test("countBatches coincide con el número de lotes de splitIntoBatches", () => {
    for (const total of [0, 1, 49, 50, 51, 120, 500]) {
        assert.equal(countBatches(total), splitIntoBatches(range(total)).length);
    }
});

test("planCommitteeChange separa a quien ya está en el destino y descarta ids repetidos", () => {
    const members = [
        { id: "a", committeeId: "c1" },
        { id: "b", committeeId: null },
        { id: "c", committeeId: "c2" },
        { id: "a", committeeId: "c1" },
    ];

    assert.deepEqual(planCommitteeChange(members, "c1"), {
        pending: ["b", "c"],
        unchanged: ["a"],
    });
});

test("planCommitteeChange al quitar comité deja sin cambios a quien ya no tiene comité", () => {
    const members = [
        { id: "a", committeeId: "c1" },
        { id: "b", committeeId: null },
    ];

    assert.deepEqual(planCommitteeChange(members, null), {
        pending: ["a"],
        unchanged: ["b"],
    });
});

test("runInBatches aplica una operación por participante, en serie y en orden", async () => {
    const ids = range(3);
    const started = [];
    let active = 0;
    let maxActive = 0;

    const outcome = await runInBatches({
        ids,
        apply: async (id) => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            started.push(id);
            await new Promise((resolve) => setTimeout(resolve, 0));
            active -= 1;
        },
        describeError: () => "sin uso",
    });

    assert.deepEqual(started, ids);
    assert.equal(maxActive, 1);
    assert.deepEqual(outcome, { ok: ids, failed: [] });
});

test("runInBatches sigue después de un fallo y registra su motivo", async () => {
    const outcome = await runInBatches({
        ids: ["a", "b", "c"],
        apply: async (id) => {
            if (id === "b") {
                throw new Error("El comité está archivado");
            }
        },
        describeError: (error) => error.message,
    });

    assert.deepEqual(outcome, {
        ok: ["a", "c"],
        failed: [{ id: "b", reason: "El comité está archivado" }],
    });
});

test("runInBatches pasa a describeError cualquier valor lanzado", async () => {
    const outcome = await runInBatches({
        ids: ["a"],
        apply: async () => {
            throw "texto suelto";
        },
        describeError: (error) => `Motivo: ${String(error)}`,
    });

    assert.deepEqual(outcome.failed, [{ id: "a", reason: "Motivo: texto suelto" }]);
});

test("runInBatches informa el progreso por lote tras cada participante", async () => {
    const reports = [];

    await runInBatches({
        ids: range(51),
        limit: 50,
        apply: async () => {},
        describeError: () => "",
        onProgress: (progress) => reports.push(progress),
    });

    assert.equal(reports.length, 51);
    assert.deepEqual(reports[0], { done: 1, total: 51, batch: 1, batchCount: 2 });
    assert.deepEqual(reports[49], { done: 50, total: 51, batch: 1, batchCount: 2 });
    assert.deepEqual(reports[50], { done: 51, total: 51, batch: 2, batchCount: 2 });
});

test("runInBatches no repite ids y no llama a la operación con lista vacía", async () => {
    let calls = 0;
    const apply = async () => {
        calls += 1;
    };

    assert.deepEqual(await runInBatches({ ids: [], apply, describeError: () => "" }), {
        ok: [],
        failed: [],
    });

    await runInBatches({ ids: ["a", "a", "b"], apply, describeError: () => "" });

    assert.equal(calls, 2);
});

test("failedIds devuelve solo los ids que fallaron", () => {
    assert.deepEqual(failedIds({ ok: ["a"], failed: [{ id: "b", reason: "x" }] }), ["b"]);
});

test("mergeRetry acumula los correctos del reintento y sustituye los fallos reintentados", () => {
    const previous = {
        ok: ["a"],
        failed: [
            { id: "b", reason: "red" },
            { id: "c", reason: "red" },
        ],
    };
    const retry = {
        ok: ["b"],
        failed: [{ id: "c", reason: "El comité está archivado" }],
    };

    assert.deepEqual(mergeRetry(previous, retry), {
        ok: ["a", "b"],
        failed: [{ id: "c", reason: "El comité está archivado" }],
    });
});

test("mergeRetry conserva los fallos que no se reintentaron y no duplica ids", () => {
    const previous = {
        ok: ["a"],
        failed: [
            { id: "b", reason: "red" },
            { id: "c", reason: "red" },
        ],
    };

    assert.deepEqual(mergeRetry(previous, { ok: ["b", "a"], failed: [] }), {
        ok: ["a", "b"],
        failed: [{ id: "c", reason: "red" }],
    });
});
