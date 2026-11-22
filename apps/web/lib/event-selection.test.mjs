import assert from "node:assert/strict";
import test from "node:test";
import {
    LAST_MEMBERSHIP_KEY,
    orderMembershipsForSelection,
    pickDefaultMembership,
    readLastUsedMembershipId,
    selectableMemberships,
    writeLastUsedMembershipId,
} from "./event-selection.ts";
import { buildPracticeMembership } from "./practice/membership.ts";

const membership = (id, eventName, overrides = {}) => ({
    id,
    eventId: `event-${id}`,
    eventName,
    eventSlug: `slug-${id}`,
    eventStatus: "ACTIVE",
    role: "PARTICIPANT",
    committeeId: null,
    committeeName: null,
    committeeCode: null,
    participantCode: `CODIGO-${id}`,
    accountStatus: "ACTIVE",
    ...overrides,
});

const ids = (list) => list.map((item) => item.id);

test("sin membresías no hay evento por defecto", () => {
    assert.equal(pickDefaultMembership([], null), null);
    assert.deepEqual(orderMembershipsForSelection([], null), []);
});

test("una sola membresía activa es el evento por defecto", () => {
    const only = membership("a", "Evento A");

    assert.equal(pickDefaultMembership([only], null), only);
    assert.equal(pickDefaultMembership([only], "otro-id"), only);
});

test("el último evento usado va primero aunque su nombre sea posterior", () => {
    const alpha = membership("a", "Alfa");
    const zeta = membership("z", "Zeta");

    assert.deepEqual(ids(orderMembershipsForSelection([alpha, zeta], "z")), ["z", "a"]);
    assert.equal(pickDefaultMembership([alpha, zeta], "z"), zeta);
});

test("sin último usado, el orden es por nombre del evento y luego por id", () => {
    const beta = membership("b", "Beta");
    const alpha = membership("a", "Alfa");
    const sameNameLater = membership("d", "Alfa");
    const sameNameEarlier = membership("c", "Alfa");

    assert.deepEqual(
        ids(orderMembershipsForSelection([beta, sameNameLater, alpha, sameNameEarlier], null)),
        ["a", "c", "d", "b"],
    );
});

test("sin último usado, la membresía más reciente va primero y el nombre solo desempata", () => {
    const antigua = membership("antigua", "Alfa", { createdAt: "2026-08-01T10:00:00+00:00" });
    const reciente = membership("reciente", "Zeta", { createdAt: "2026-11-02T10:00:00+00:00" });
    const mismaFecha = membership("mismaFecha", "Beta", { createdAt: "2026-08-01T10:00:00+00:00" });

    assert.deepEqual(ids(orderMembershipsForSelection([antigua, reciente, mismaFecha], null)), [
        "reciente",
        "antigua",
        "mismaFecha",
    ]);
});

test("el último usado sigue primero aunque su alta sea más antigua", () => {
    const antigua = membership("antigua", "Zeta", { createdAt: "2026-08-01T10:00:00+00:00" });
    const reciente = membership("reciente", "Alfa", { createdAt: "2026-11-02T10:00:00+00:00" });

    assert.deepEqual(ids(orderMembershipsForSelection([antigua, reciente], "antigua")), [
        "antigua",
        "reciente",
    ]);
});

test("las fechas se comparan como instantes, no como texto", () => {
    // 10:00 en +02:00 es 08:00 UTC; 09:00 en UTC es posterior aunque su texto sea menor.
    const enOffset = membership("offset", "Alfa", { createdAt: "2026-08-21T10:00:00+02:00" });
    const enUtc = membership("utc", "Beta", { createdAt: "2026-08-21T09:00:00+00:00" });

    assert.deepEqual(ids(orderMembershipsForSelection([enOffset, enUtc], null)), ["utc", "offset"]);
});

test("fechas con microsegundos (formato de la base) se ordenan bien", () => {
    const anterior = membership("anterior", "Alfa", { createdAt: "2026-08-21T10:00:00.123456+00:00" });
    const posterior = membership("posterior", "Beta", { createdAt: "2026-08-21T10:00:00.654321+00:00" });

    assert.deepEqual(ids(orderMembershipsForSelection([anterior, posterior], null)), [
        "posterior",
        "anterior",
    ]);
});

test("sin fecha válida la membresía va detrás de las que la tienen, ordenadas entre ellas por nombre", () => {
    const sinFecha = membership("sin", "Alfa", { createdAt: null });
    const fechaInvalida = membership("invalida", "Beta", { createdAt: "no es una fecha" });
    const conFecha = membership("con", "Zeta", { createdAt: "2026-08-01T10:00:00+00:00" });

    assert.deepEqual(ids(orderMembershipsForSelection([sinFecha, fechaInvalida, conFecha], null)), [
        "con",
        "sin",
        "invalida",
    ]);
});

test("el orden no depende del orden en que llega la lista", () => {
    const list = [
        membership("m1", "Evento Uno"),
        membership("m2", "Evento Dos"),
        membership("m3", "Evento Tres"),
    ];
    const reversed = [...list].reverse();

    assert.deepEqual(
        ids(orderMembershipsForSelection(list, "m3")),
        ids(orderMembershipsForSelection(reversed, "m3")),
    );
    assert.deepEqual(
        ids(orderMembershipsForSelection(list, null)),
        ids(orderMembershipsForSelection(reversed, null)),
    );
});

test("un último usado que ya no pertenece a la persona se ignora", () => {
    const alpha = membership("a", "Alfa");
    const beta = membership("b", "Beta");

    assert.deepEqual(ids(orderMembershipsForSelection([beta, alpha], "ya-no-existe")), ["a", "b"]);
    assert.deepEqual(ids(orderMembershipsForSelection([beta, alpha], undefined)), ["a", "b"]);
});

test("la membresía de práctica y las no activas no se pueden elegir", () => {
    const real = membership("a", "Alfa");
    const suspended = membership("s", "Suspendida", { accountStatus: "SUSPENDED" });
    const practice = buildPracticeMembership();

    assert.deepEqual(ids(selectableMemberships([practice, real, suspended])), ["a"]);
    assert.equal(pickDefaultMembership([practice, suspended], practice.id), null);
    assert.equal(pickDefaultMembership([practice, real], practice.id), real);
});

test("ordenar no muta la lista recibida", () => {
    const list = [membership("b", "Beta"), membership("a", "Alfa")];
    const before = ids(list);

    orderMembershipsForSelection(list, "b");

    assert.deepEqual(ids(list), before);
});

test("sin localStorage (entorno de pruebas) el último usado es null y escribir no falla", () => {
    assert.equal(typeof globalThis.localStorage, "undefined");
    assert.equal(readLastUsedMembershipId(), null);
    assert.doesNotThrow(() => writeLastUsedMembershipId("a"));
});

test("con almacenamiento que lanza excepciones la lectura cae a null y la escritura no propaga", () => {
    const throwing = () => {
        throw new Error("storage blocked");
    };

    globalThis.localStorage = { getItem: throwing, setItem: throwing };

    try {
        assert.equal(readLastUsedMembershipId(), null);
        assert.doesNotThrow(() => writeLastUsedMembershipId("a"));
    } finally {
        delete globalThis.localStorage;
    }
});

test("el último usado se lee y escribe con la clave propia", () => {
    const store = new Map();

    globalThis.localStorage = {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
    };

    try {
        writeLastUsedMembershipId("membresia-7");

        assert.equal(store.get(LAST_MEMBERSHIP_KEY), "membresia-7");
        assert.equal(readLastUsedMembershipId(), "membresia-7");
    } finally {
        delete globalThis.localStorage;
    }
});
