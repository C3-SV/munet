import assert from "node:assert/strict";
import test from "node:test";
import {
    buildPracticeMembership,
    isPracticeMembership,
    shouldPersistActive,
    withPracticeMembership,
    withoutPracticeMembership,
} from "./membership.ts";
import { PRACTICE_EVENT_ID, PRACTICE_MEMBERSHIP_ID } from "./constants.ts";

const realMembership = (id, eventId = "11111111-1111-1111-1111-111111111111") => ({
    id,
    eventId,
    eventName: `Evento ${id}`,
    eventSlug: `evento-${id}`,
    eventStatus: "ACTIVE",
    role: "PARTICIPANT",
    committeeId: null,
    committeeName: null,
    committeeCode: null,
    participantCode: `CODIGO-${id}`,
    accountStatus: "ACTIVE",
});

test("la membresía de práctica tiene los valores fijos", () => {
    assert.deepEqual(buildPracticeMembership(), {
        id: PRACTICE_MEMBERSHIP_ID,
        eventId: PRACTICE_EVENT_ID,
        eventName: "Práctica",
        eventSlug: "practica",
        eventStatus: "ACTIVE",
        role: "PARTICIPANT",
        committeeId: null,
        committeeName: null,
        committeeCode: null,
        participantCode: "PRACTICA",
        accountStatus: "ACTIVE",
    });
});

test("withPracticeMembership agrega una sola membresía de práctica al final", () => {
    const real = realMembership("a");

    const fromEmpty = withPracticeMembership([]);
    assert.equal(fromEmpty.length, 1);
    assert.equal(fromEmpty[0].id, PRACTICE_MEMBERSHIP_ID);

    const once = withPracticeMembership([real]);
    assert.deepEqual(once, [real, buildPracticeMembership()]);
});

test("withPracticeMembership llamada dos veces no duplica la práctica", () => {
    const real = realMembership("a");

    const twice = withPracticeMembership(withPracticeMembership([real]));
    assert.equal(twice.length, 2);
    assert.equal(twice.filter((item) => isPracticeMembership(item)).length, 1);
    assert.equal(twice[1].id, PRACTICE_MEMBERSHIP_ID);
});

test("withoutPracticeMembership quita solo la práctica y conserva el orden", () => {
    const first = realMembership("a");
    const second = realMembership("b", "22222222-2222-2222-2222-222222222222");
    const third = realMembership("c");

    const result = withoutPracticeMembership([first, buildPracticeMembership(), second, third]);
    assert.deepEqual(result, [first, second, third]);

    assert.deepEqual(withoutPracticeMembership([first, second]), [first, second]);
    assert.deepEqual(withoutPracticeMembership([]), []);
});

test("withPracticeMembership seguido de withoutPracticeMembership devuelve las reales", () => {
    const real = [realMembership("a"), realMembership("b")];

    assert.deepEqual(withoutPracticeMembership(withPracticeMembership(real)), real);
});

test("isPracticeMembership es verdadero para la práctica y falso para una real", () => {
    assert.equal(isPracticeMembership(buildPracticeMembership()), true);
    assert.equal(isPracticeMembership(realMembership("a")), false);
});

test("isPracticeMembership también reconoce el evento reservado con otro id", () => {
    assert.equal(isPracticeMembership({ id: "otro", eventId: PRACTICE_EVENT_ID }), true);
    assert.equal(isPracticeMembership({ id: PRACTICE_MEMBERSHIP_ID, eventId: "otro" }), true);
});

test("shouldPersistActive es falso para la práctica y verdadero para una real", () => {
    assert.equal(shouldPersistActive(buildPracticeMembership()), false);
    assert.equal(shouldPersistActive(realMembership("a")), true);
});
