import assert from "node:assert/strict";
import test from "node:test";
import { PRACTICE_COMMITTEES } from "./catalog.ts";
import { PRACTICE_STATE_VERSION } from "./constants.ts";
import { avatarFor, createInitialState, personaFor } from "./state.ts";

const DELEGATIONS = [
    "Brasil", "Japón", "Francia", "Kenia", "Canadá", "India",
    "Egipto", "México", "Alemania", "Chile", "Australia", "Nigeria",
];
const COMMITTEE_IDS = PRACTICE_COMMITTEES.map((committee) => committee.id);
const SAMPLE = Array.from({ length: 20 }, (_, index) => `user-${index}`);

test("personaFor es determinista por userId", () => {
    assert.deepEqual(personaFor("a"), personaFor("a"));
});

test("personaFor cambia entre usuarios distintos", () => {
    assert.notDeepEqual(personaFor("a"), personaFor("b"));
    const displayNames = new Set(SAMPLE.map((userId) => personaFor(userId).displayName));
    assert.ok(displayNames.size > 3, `solo ${displayNames.size} personas distintas`);
});

test("la persona sigue las reglas de nombre, número y código", () => {
    for (const userId of SAMPLE) {
        const persona = personaFor(userId);
        assert.ok(DELEGATIONS.includes(persona.delegation), persona.delegation);
        assert.ok(Number.isInteger(persona.number));
        assert.ok(persona.number >= 1 && persona.number <= 99, String(persona.number));
        assert.match(persona.delegationCode, /^#\d{3}$/);
        assert.equal(persona.delegationCode, `#${String(persona.number).padStart(3, "0")}`);
        assert.equal(persona.firstName, persona.delegation);
        assert.equal(persona.lastName, `#${persona.number}`);
        assert.equal(persona.displayName, `${persona.delegation} #${persona.number}`);
        assert.ok(COMMITTEE_IDS.includes(persona.committeeId), persona.committeeId);
    }
});

test("el comité de la persona se reparte entre los cuatro comités", () => {
    const used = new Set();
    for (let index = 0; index < 200; index += 1) {
        used.add(personaFor(`user-${index}`).committeeId);
    }
    assert.deepEqual([...used].sort(), [...COMMITTEE_IDS].sort());
});

test("createInitialState crea el estado versionado con la persona derivada", () => {
    const state = createInitialState("u1", new Date("2026-11-21T00:00:00Z"));
    assert.equal(state.version, PRACTICE_STATE_VERSION);
    assert.equal(state.userId, "u1");
    assert.equal(state.createdAt, "2026-11-21T00:00:00.000Z");
    assert.deepEqual(state.persona, personaFor("u1"));
});

test("createInitialState completa el estado v2: cohorte, contenido sembrado y perfil vacío", () => {
    const state = createInitialState("u1", new Date("2026-11-21T00:00:00Z"));
    assert.equal(state.version, 2);
    assert.ok(Number.isInteger(state.seq) && state.seq > 0);
    for (const key of ["people", "posts", "comments", "conversations", "messages", "uploads"]) {
        assert.ok(Array.isArray(state[key]), key);
    }
    assert.ok(state.people.some((person) => person.role === "ADMIN_MUN"));
    assert.ok(state.posts.length > 0);
    assert.deepEqual(state.profile, { displayName: null, alias: null, bio: "", avatar: null });
    assert.deepEqual(state.replyCounts, {});
});

test("avatarFor devuelve un SVG en data URI sin URLs externas", () => {
    const avatar = avatarFor("B1");
    assert.ok(avatar.startsWith("data:image/svg+xml"));
    assert.equal(avatar.includes("http"), false);
});

test("avatarFor no deja marcado HTML de las iniciales en el SVG", () => {
    assert.equal(avatarFor("<b>").includes("<"), false);
});
