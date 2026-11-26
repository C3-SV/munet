import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { PRACTICE_COMMITTEES, buildPracticeWalls } from "./catalog.ts";
import {
    PRACTICE_UNAVAILABLE_MESSAGE,
    PracticeRequestError,
    practiceRouteOf,
    routePracticeRequest,
    routePracticeRequestDetailed,
} from "./router.ts";
import { createInitialState } from "./state.ts";

const NOW = new Date("2026-11-21T00:00:00Z");
const STATE = createInitialState("u1", NOW);
const COMMITTEE_ID = STATE.persona.committeeId;
const OWN = PRACTICE_COMMITTEES.find((committee) => committee.id === COMMITTEE_ID);
const FOREIGN = PRACTICE_COMMITTEES.find((committee) => committee.id !== COMMITTEE_ID);
const SAMPLE = Array.from({ length: 20 }, (_, index) => `user-${index}`);

const get = (path, state = STATE) => routePracticeRequest({ method: "GET", path }, state);

const isRequestError = (status, message) => (error) =>
    error instanceof PracticeRequestError && error.status === status && error.message === message;

beforeEach(() => {
    // Ningún camino de práctica puede llegar a la red.
    globalThis.fetch = () => {
        throw new Error("fetch prohibido");
    };
});

test("walls: evento, membresía y solo los tres muros accesibles de la persona", () => {
    const response = get("/events/practice-local/walls");
    assert.deepEqual(response.event, { id: "practice-local", name: "Práctica", slug: "practica" });
    assert.deepEqual(response.membership, {
        id: "practice-membership",
        role: "PARTICIPANT",
        committeeId: COMMITTEE_ID,
    });
    // Avisos, General y el comité propio; los muros de comités ajenos no se listan.
    assert.equal(response.walls.length, 3);
    assert.deepEqual(response.walls, buildPracticeWalls(COMMITTEE_ID).filter((wall) => wall.canAccess));
});

test("committees: cuatro comités con la forma EventCommittee", () => {
    const { committees } = get("/events/practice-local/committees");
    assert.deepEqual(
        committees.map(({ id, name, code }) => ({ id, name, code })),
        PRACTICE_COMMITTEES.map(({ id, name, code }) => ({ id, name, code })),
    );
    assert.deepEqual(committees.map((committee) => committee.sort_order), [1, 2, 3, 4]);
    for (const committee of committees) {
        assert.equal(committee.event_id, "practice-local");
        assert.equal(committee.description, null);
        assert.equal(committee.status, "ACTIVE");
    }
});

test("committees: exactamente uno con canAccess, el de la persona, para cada usuario", () => {
    for (const userId of SAMPLE) {
        const state = createInitialState(userId, NOW);
        const { committees } = get("/events/practice-local/committees", state);
        const accessible = committees.filter((committee) => committee.canAccess);
        assert.equal(accessible.length, 1, userId);
        assert.equal(accessible[0].id, state.persona.committeeId, userId);
    }
});

test("profiles/me: forma MyProfile de la persona", () => {
    const { profile } = get("/profiles/me");
    assert.equal(profile.membershipId, "practice-membership");
    assert.equal(profile.eventId, "practice-local");
    assert.equal(profile.role, "PARTICIPANT");
    assert.equal(profile.participantCode, "PRACTICA");
    assert.equal(profile.accountStatus, "ACTIVE");
    assert.equal(profile.email, null);
    assert.equal(profile.institutionName, null);
    assert.equal(profile.delegationName, STATE.persona.delegation);
    assert.equal(profile.delegationCode, STATE.persona.delegationCode);
    assert.deepEqual(profile.committee, { id: OWN.id, name: OWN.name, code: OWN.code });
    assert.equal(profile.profile.firstName, STATE.persona.firstName);
    assert.equal(profile.profile.lastName, STATE.persona.lastName);
    assert.equal(profile.profile.displayName, STATE.persona.displayName);
    assert.equal(profile.profile.bio, "");
    assert.ok(profile.profile.avatar.startsWith("data:"));
});

test("profiles/me: el avatar lleva la inicial de la delegación", () => {
    const { profile } = get("/profiles/me");
    const initial = STATE.persona.delegation.charAt(0);
    assert.ok(decodeURIComponent(profile.profile.avatar).includes(`>${initial}</text>`));
});

test("posts: general y avisos responden su muro con publicaciones de la semilla", () => {
    const general = get("/posts?muro=general");
    assert.ok(general.posts.length > 0);
    assert.equal(general.wall.slug, "general");

    const avisos = get("/posts?muro=avisos");
    assert.ok(avisos.posts.length > 0);
    assert.equal(avisos.wall.slug, "avisos");
});

test("posts: el muro del comité propio es accesible", () => {
    const slug = `comite-${OWN.code.toLowerCase()}`;
    const response = get(`/posts?muro=${slug}`);
    assert.equal(response.wall.slug, slug);
    assert.equal(response.wall.canAccess, true);
    assert.ok(response.posts.length > 0);
});

test("posts: muro de otro comité 403 y muro inexistente 404", () => {
    const foreignSlug = `comite-${FOREIGN.code.toLowerCase()}`;
    assert.throws(
        () => get(`/posts?muro=${foreignSlug}`),
        isRequestError(403, "No tienes acceso a este muro"),
    );
    assert.throws(() => get("/posts?muro=no-existe"), isRequestError(404, "Muro no encontrado"));
});

test("dm: las dos conversaciones de la semilla", () => {
    assert.equal(get("/dm/conversations").conversations.length, 2);
});

test("falla cerrada: caminos no simulados lanzan 501", () => {
    const requests = [
        ["PUT", "/posts/practice-post-1"],
        ["DELETE", "/profiles/me"],
        ["GET", "/admin/participants"],
        ["POST", "/auth/login"],
        ["PATCH", "/profiles/practice-membership"],
        ["GET", ""],
    ];
    for (const [method, path] of requests) {
        assert.throws(
            () => routePracticeRequest({ method, path }, STATE),
            isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE),
            `${method} ${path}`,
        );
    }
});

test("descarga: el enrutador solo valida y devuelve el id del adjunto, sin escribir", () => {
    const imagePost = STATE.posts.find((post) => post.attachment?.id === "practice-seed-att-image");
    const detailed = routePracticeRequestDetailed(
        { method: "GET", path: `/posts/${imagePost.id}/attachment/download` },
        STATE,
    );
    assert.equal(detailed.wrote, false);
    assert.deepEqual(detailed.released, []);
    assert.equal(detailed.result.attachmentId, "practice-seed-att-image");
});

test("practiceRouteOf: nombra la entrada de la tabla que atiende la petición, o null", () => {
    assert.equal(practiceRouteOf({ method: "post", path: "/posts" }), "POST /posts");
    assert.equal(practiceRouteOf({ method: "POST", path: "/posts/" }), "POST /posts");
    assert.equal(
        practiceRouteOf({ method: "GET", path: "/posts/practice-post-1/attachment/download?x=1" }),
        "GET /posts/:postId/attachment/download",
    );
    assert.equal(practiceRouteOf({ method: "PUT", path: "/posts" }), null);
    assert.equal(practiceRouteOf({ method: "GET", path: "sin-barra" }), null);
});

test("descarga: post inexistente o sin adjunto dan sus errores del contrato", () => {
    assert.throws(
        () => get("/posts/abc/attachment/download"),
        isRequestError(404, "Post no encontrado en este evento"),
    );
    const withoutAttachment = STATE.posts.find((post) => post.attachment === null && !post.deleted);
    assert.throws(
        () => get(`/posts/${withoutAttachment.id}/attachment/download`),
        isRequestError(404, "El post no tiene adjunto"),
    );
});

test("falla cerrada: identificadores que no coinciden lanzan 501", () => {
    const requests = [
        "/events/otro-evento/walls",
        "/events/practice-local%2Fwalls",
        "/events/%E0%A4%A/walls",
    ];
    for (const path of requests) {
        assert.throws(
            () => get(path),
            isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE),
            path,
        );
    }
});

test("tolerancia: el identificador del evento puede llegar codificado", () => {
    assert.equal(get("/events/practice%2Dlocal/walls").event.id, "practice-local");
});

test("falla cerrada: barra inicial doble, identificador en otras mayúsculas y ruta raíz lanzan 501", () => {
    for (const path of ["//events/practice-local/walls", "/events/Practice-Local/walls", "/"]) {
        assert.throws(() => get(path), isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE), path);
    }
});

test("tolerancia: barra final, método en minúsculas y consulta en rutas sin parámetros", () => {
    assert.equal(get("/events/practice-local/walls/").event.id, "practice-local");
    assert.equal(
        routePracticeRequest({ method: "get", path: "/events/practice-local/walls" }, STATE).event.id,
        "practice-local",
    );
    assert.equal(get("/posts/?muro=general").wall.slug, "general");
    assert.equal(get("/dm/conversations?limit=5").conversations.length, 2);
    assert.equal(get("/profiles/me?x=1").profile.participantCode, "PRACTICA");
});
