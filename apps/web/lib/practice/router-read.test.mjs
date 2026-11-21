import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { PRACTICE_COMMITTEES } from "./catalog.ts";
import { PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { PRACTICE_STAFF_ID } from "./people.ts";
import {
    PRACTICE_UNAVAILABLE_MESSAGE,
    PracticeRequestError,
    routePracticeRequest,
} from "./router.ts";
import { createInitialState } from "./state.ts";

const NOW = new Date("2026-11-21T12:00:00Z");
const STATE = createInitialState("u1", NOW);
const OWN_COMMITTEE_ID = STATE.persona.committeeId;
const OWN = PRACTICE_COMMITTEES.find((committee) => committee.id === OWN_COMMITTEE_ID);
const FOREIGN = PRACTICE_COMMITTEES.find((committee) => committee.id !== OWN_COMMITTEE_ID);
const FOREIGN_SLUG = `comite-${FOREIGN.code.toLowerCase()}`;

// Persona de la cohorte con tilde en el nombre (Japón o Canadá, según la cuenta).
const ACCENTED = STATE.people.find((person) => /[^\p{ASCII}]/u.test(person.firstName));

let fetchCalls = 0;

const get = (path, state = STATE) => routePracticeRequest({ method: "GET", path }, state);
const directory = (query = "", state = STATE) => get(`/events/practice-local/participants${query}`, state);
const cloneState = (state) => structuredClone(state);
const isRequestError = (status, message) => (error) =>
    error instanceof PracticeRequestError && error.status === status && error.message === message;
const timeOf = (iso) => Date.parse(iso);
const sortedByTime = (items) => [...items].sort((left, right) => timeOf(left.createdAt) - timeOf(right.createdAt));

// Recorre todas las páginas del directorio con el tamaño dado.
const allDirectory = (limit, state = STATE) => {
    const everyone = [];
    for (let page = 1; page <= 100; page += 1) {
        const response = directory(`?page=${page}&limit=${limit}`, state);
        everyone.push(...response.participants);
        if (!response.hasMore) {
            return everyone;
        }
    }
    throw new Error("El directorio no termina de paginar.");
};

beforeEach(() => {
    // Ningún camino de práctica puede llegar a la red.
    fetchCalls = 0;
    globalThis.fetch = () => {
        fetchCalls += 1;
        throw new Error("fetch prohibido");
    };
});

test("walls: no incluye los muros de comités ajenos", () => {
    const { walls } = get("/events/practice-local/walls");
    assert.ok(walls.every((wall) => wall.canAccess));
    assert.equal(walls.some((wall) => wall.slug === FOREIGN_SLUG), false);
});

test("posts: ?muro=general y sin muro devuelven lo mismo, con el muro general", () => {
    const explicit = get("/posts?muro=general");
    assert.deepEqual(get("/posts"), explicit);
    assert.equal(explicit.wall.slug, "general");
    assert.equal(explicit.wall.canPublish, true);
});

test("posts: el muro acepta slug en mayúsculas y nombre del muro sin tildes", () => {
    assert.equal(get("/posts?muro=GENERAL").wall.slug, "general");
    const nameOfOwn = encodeURIComponent(OWN.name.toUpperCase());
    assert.equal(get(`/posts?muro=${nameOfOwn}`).wall.slug, `comite-${OWN.code.toLowerCase()}`);
});

test("posts: los fijados van primero y el resto por fecha descendente", () => {
    const avisos = get("/posts?muro=avisos").posts;
    assert.ok(avisos.length >= 2);
    const pinned = avisos.filter((post) => post.isPinned);
    assert.equal(pinned.length, 2);
    assert.deepEqual(avisos.slice(0, pinned.length).map((post) => post.isPinned), [true, true]);

    const general = get("/posts?muro=general").posts;
    assert.ok(general.length > 1);
    assert.ok(general.every((post) => !post.isPinned));
    for (let index = 1; index < general.length; index += 1) {
        assert.ok(general[index - 1].timestamp >= general[index].timestamp);
    }
});

test("posts: una publicación borrada no aparece en el muro", () => {
    const state = cloneState(STATE);
    const target = state.posts.find((post) => post.wallSlug === "general");
    target.deleted = true;
    const { posts } = get("/posts?muro=general", state);
    assert.equal(posts.some((post) => post.id === target.id), false);
    assert.equal(posts.length, get("/posts?muro=general").posts.length - 1);
});

test("posts: muro de otro comité 403, muro inexistente 404 y muro vacío 404", () => {
    assert.throws(
        () => get(`/posts?muro=${FOREIGN_SLUG}`),
        isRequestError(403, "No tienes acceso a este muro"),
    );
    assert.throws(() => get("/posts?muro=no-existe"), isRequestError(404, "Muro no encontrado"));
    assert.throws(() => get("/posts?muro="), isRequestError(404, "Muro no encontrado"));
});

test("posts: las publicaciones de la semilla traen la forma Post con su usuario", () => {
    const [first] = get("/posts?muro=general").posts;
    assert.deepEqual(Object.keys(first.user).sort(), ["alias", "avatar", "committeeName", "id", "name", "role"]);
    assert.equal(first.isDeleted, false);
    assert.equal(first.deletedByActorType, null);
    assert.equal(typeof first.commentCount, "number");
    assert.ok(Number.isFinite(first.timestamp));
});

test("comentarios: orden ascendente y la respuesta apunta a su padre", () => {
    const reply = STATE.comments.find((comment) => comment.parentCommentId !== null);
    const parent = STATE.comments.find((comment) => comment.id === reply.parentCommentId);
    const { comments } = get(`/posts/${reply.postId}/comments`);
    const expected = sortedByTime(STATE.comments.filter((comment) => comment.postId === reply.postId));
    assert.deepEqual(comments.map((comment) => comment.id), expected.map((comment) => comment.id));
    assert.equal(comments[0].id, parent.id);
    assert.equal(comments[1].parentCommentId, parent.id);
    for (let index = 1; index < comments.length; index += 1) {
        assert.ok(timeOf(comments[index - 1].createdAt) <= timeOf(comments[index].createdAt));
    }
});

test("comentarios: un comentario borrado no aparece", () => {
    const state = cloneState(STATE);
    const reply = state.comments.find((comment) => comment.parentCommentId !== null);
    reply.deleted = true;
    const { comments } = get(`/posts/${reply.postId}/comments`, state);
    assert.equal(comments.some((comment) => comment.id === reply.id), false);
    assert.equal(comments.length, 1);
});

test("comentarios: post inexistente 404, post de muro ajeno 403 y post borrado 404", () => {
    assert.throws(
        () => get("/posts/no-existe/comments"),
        isRequestError(404, "Post no encontrado en este evento"),
    );

    const foreignPost = STATE.posts.find((post) => post.wallSlug === FOREIGN_SLUG);
    assert.throws(
        () => get(`/posts/${foreignPost.id}/comments`),
        isRequestError(403, "No tienes acceso a los comentarios de este post"),
    );

    const state = cloneState(STATE);
    const generalPost = state.posts.find((post) => post.wallSlug === "general");
    generalPost.deleted = true;
    assert.throws(
        () => get(`/posts/${generalPost.id}/comments`, state),
        isRequestError(404, "Post no encontrado en este evento"),
    );
});

test("directorio: incluye a la propia persona y al personal, sin duplicados", () => {
    const everyone = allDirectory(100);
    assert.equal(everyone.length, STATE.people.length + 1);
    assert.equal(new Set(everyone.map((entry) => entry.membershipId)).size, everyone.length);
    assert.ok(everyone.some((entry) => entry.membershipId === PRACTICE_MEMBERSHIP_ID));
    assert.ok(everyone.some((entry) => entry.membershipId === PRACTICE_STAFF_ID));
});

test("directorio: forma de la entrada y comité de la propia persona", () => {
    const { participants } = directory("?limit=100");
    const own = participants.find((entry) => entry.membershipId === PRACTICE_MEMBERSHIP_ID);
    assert.deepEqual(Object.keys(own).sort(), [
        "alias",
        "committee",
        "delegationCode",
        "firstName",
        "lastName",
        "membershipId",
    ]);
    assert.deepEqual(own.committee, { id: OWN.id, name: OWN.name });
    assert.equal(own.delegationCode, STATE.persona.delegationCode);

    const staff = participants.find((entry) => entry.membershipId === PRACTICE_STAFF_ID);
    assert.equal(staff.committee, null);
    assert.equal(staff.delegationCode, "#000");
});

test("directorio: orden por apellido, nombre e id", () => {
    const everyone = allDirectory(100);
    for (let index = 1; index < everyone.length; index += 1) {
        const left = everyone[index - 1];
        const right = everyone[index];
        const byLast = left.lastName.localeCompare(right.lastName, "es");
        assert.ok(byLast < 0 || (byLast === 0 && left.firstName.localeCompare(right.firstName, "es") <= 0));
    }
});

test("directorio: limit=3 marca hasMore y la página 2 continúa el orden", () => {
    const first = directory("?limit=3");
    assert.equal(first.page, 1);
    assert.equal(first.limit, 3);
    assert.equal(first.participants.length, 3);
    assert.equal(first.hasMore, true);

    const second = directory("?page=2&limit=3");
    const full = directory("?limit=100").participants;
    assert.deepEqual(first.participants, full.slice(0, 3));
    assert.deepEqual(second.participants, full.slice(3, 6));
});

test("directorio: la última página no marca hasMore y una página vacía responde lista vacía", () => {
    const total = STATE.people.length + 1;
    const lastPage = Math.ceil(total / 3);
    const last = directory(`?page=${lastPage}&limit=3`);
    assert.equal(last.hasMore, false);
    assert.ok(last.participants.length > 0);

    const beyond = directory(`?page=${lastPage + 1}&limit=3`);
    assert.deepEqual(beyond.participants, []);
    assert.equal(beyond.hasMore, false);
});

test("directorio: q sin tildes ni mayúsculas encuentra nombres con acento", () => {
    assert.ok(ACCENTED, "la cohorte tiene un nombre con tilde");
    const upper = encodeURIComponent(ACCENTED.firstName.toUpperCase());
    const plain = encodeURIComponent(
        ACCENTED.firstName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    );
    for (const query of [upper, plain]) {
        const found = directory(`?q=${query}&limit=100`).participants;
        assert.ok(found.some((entry) => entry.membershipId === ACCENTED.membershipId), query);
    }
});

test("directorio: q con # y código de delegación encuentra a la persona", () => {
    const target = STATE.people.find((person) => person.role === "PARTICIPANT");
    const found = directory(`?q=${encodeURIComponent(target.delegationCode)}&limit=100`).participants;
    assert.ok(found.some((entry) => entry.membershipId === target.membershipId));
});

test("directorio: q encuentra el alias editado", () => {
    const state = cloneState(STATE);
    const target = state.people.find((person) => person.role === "PARTICIPANT");
    target.alias = "Relatora";
    const { participants } = directory("?q=relator&limit=100", state);
    assert.deepEqual(participants.map((entry) => entry.membershipId), [target.membershipId]);
    assert.equal(participants[0].alias, "Relatora");
});

test("directorio: q encuentra nombre completo y no coincidencias devuelven lista vacía", () => {
    const target = STATE.people.find((person) => person.role === "PARTICIPANT");
    const fullName = encodeURIComponent(`${target.firstName} ${target.lastName}`);
    const found = directory(`?q=${fullName}&limit=100`).participants;
    assert.ok(found.some((entry) => entry.membershipId === target.membershipId));

    const none = directory("?q=zzz-sin-coincidencias");
    assert.deepEqual(none.participants, []);
    assert.equal(none.hasMore, false);
});

test("directorio: committee_id filtra por comité y excluye al personal", () => {
    const { participants } = directory(`?committee_id=${OWN_COMMITTEE_ID}&limit=100`);
    assert.ok(participants.length > 0);
    for (const entry of participants) {
        assert.equal(entry.committee?.id, OWN_COMMITTEE_ID);
    }
    assert.ok(participants.some((entry) => entry.membershipId === PRACTICE_MEMBERSHIP_ID));
    assert.equal(participants.some((entry) => entry.membershipId === PRACTICE_STAFF_ID), false);
});

test("directorio: validaciones de page, limit y committee_id", () => {
    const pageError = isRequestError(400, "page debe ser un entero mayor o igual a 1");
    const limitError = isRequestError(400, "limit debe ser un entero entre 1 y 100");
    const committeeError = isRequestError(400, "committee_id no pertenece a este evento");

    assert.throws(() => directory("?page=0"), pageError);
    assert.throws(() => directory("?page=abc"), pageError);
    assert.throws(() => directory("?page="), pageError);
    assert.throws(() => directory("?limit=101"), limitError);
    assert.throws(() => directory("?limit=0"), limitError);
    assert.throws(() => directory("?committee_id=otro"), committeeError);
    assert.throws(() => directory("?committee_id=practice-committee-zz"), committeeError);
});

test("perfil público: forma sin datos privados de la persona", () => {
    const target = STATE.people.find((person) => person.role === "PARTICIPANT");
    const { profile } = get(`/profiles/${target.membershipId}`);
    assert.equal(profile.membershipId, target.membershipId);
    assert.equal(profile.eventId, "practice-local");
    assert.equal(profile.delegationName, target.delegation);
    assert.equal(profile.delegationCode, target.delegationCode);
    assert.equal(profile.profile.displayName, `${target.firstName} ${target.lastName}`);
    assert.equal(profile.profile.bio, "");
    assert.ok(profile.profile.avatar.startsWith("data:"));
    assert.equal("participantCode" in profile, false);
    assert.equal("accountStatus" in profile, false);
    assert.equal("email" in profile, false);
});

test("perfil público: la propia persona y un id inexistente", () => {
    assert.equal(get(`/profiles/${PRACTICE_MEMBERSHIP_ID}`).profile.membershipId, PRACTICE_MEMBERSHIP_ID);
    assert.throws(() => get("/profiles/no-existe"), isRequestError(404, "Perfil no encontrado"));
});

test("perfil público: el identificador se decodifica después de separar la ruta", () => {
    const target = STATE.people[0];
    const encoded = target.membershipId.replace(/-/g, "%2D");
    assert.equal(get(`/profiles/${encoded}`).profile.membershipId, target.membershipId);
    // Un %2F dentro del identificador no crea un segmento nuevo: es un id desconocido.
    assert.throws(
        () => get("/profiles/practice-person-1%2Fx"),
        isRequestError(404, "Perfil no encontrado"),
    );
});

test("conversaciones: las dos de la semilla, por último mensaje descendente", () => {
    const { conversations } = get("/dm/conversations");
    assert.equal(conversations.length, 2);
    const lastOf = (conversationId) =>
        STATE.messages.filter((message) => message.conversationId === conversationId).at(-1);
    const expectedOrder = [...STATE.conversations]
        .sort((left, right) => timeOf(lastOf(right.id).createdAt) - timeOf(lastOf(left.id).createdAt))
        .map((conversation) => conversation.id);
    assert.deepEqual(conversations.map((conversation) => conversation.id), expectedOrder);

    for (const summary of conversations) {
        const last = lastOf(summary.id);
        assert.equal(summary.lastMessage, last.content);
        assert.equal(summary.lastMessageAuthorId, last.senderId);
        assert.equal(summary.lastMessageAt, last.createdAt);
        assert.equal(summary.status, "ACTIVE");
        assert.equal(summary.eventId, "practice-local");
    }
});

test("conversaciones: sin mensajes van al final aunque sean las más recientes", () => {
    const state = cloneState(STATE);
    const newest = {
        id: "practice-conversation-nueva",
        otherId: STATE.people[0].membershipId,
        createdAt: new Date(NOW.getTime() + 60000).toISOString(),
    };
    state.conversations.push(newest);
    const { conversations } = get("/dm/conversations", state);
    assert.equal(conversations.at(-1).id, newest.id);
    assert.equal(conversations.at(-1).lastMessage, null);
    assert.equal(conversations.at(-1).lastMessageAt, null);
});

test("conversaciones: si se borra el último mensaje, la vista previa pasa al anterior", () => {
    const state = cloneState(STATE);
    const conversation = STATE.conversations[0];
    const visible = state.messages.filter((message) => message.conversationId === conversation.id);
    const last = visible.at(-1);
    const previous = visible.at(-2);
    last.deleted = true;
    const summary = get("/dm/conversations", state).conversations.find((item) => item.id === conversation.id);
    assert.equal(summary.lastMessage, previous.content);
    assert.equal(summary.lastMessageAt, previous.createdAt);
});

test("mensajes: orden ascendente y forma DirectMessage", () => {
    const conversation = STATE.conversations[0];
    const { messages } = get(`/dm/conversations/${conversation.id}/messages`);
    const expected = sortedByTime(STATE.messages.filter((message) => message.conversationId === conversation.id));
    assert.deepEqual(messages.map((message) => message.id), expected.map((message) => message.id));
    assert.deepEqual(Object.keys(messages[0]).sort(), ["conversationId", "createdAt", "id", "senderId", "text"]);
    assert.equal(messages[0].text, expected[0].content);
    assert.equal(messages[0].conversationId, conversation.id);
});

test("mensajes: los borrados no aparecen y una conversación inexistente da 404", () => {
    const state = cloneState(STATE);
    const conversation = STATE.conversations[0];
    const target = state.messages.find((message) => message.conversationId === conversation.id);
    target.deleted = true;
    const { messages } = get(`/dm/conversations/${conversation.id}/messages`, state);
    assert.equal(messages.some((message) => message.id === target.id), false);

    assert.throws(
        () => get("/dm/conversations/no-existe/messages"),
        isRequestError(404, "Conversacion no encontrada"),
    );
});

test("buscador de DM: excluye a la propia persona y busca sin tildes ni mayúsculas", () => {
    const term = encodeURIComponent(ACCENTED.firstName.toUpperCase());
    const { participants } = get(`/dm/participants?search=${term}`);
    assert.ok(participants.some((entry) => entry.id === ACCENTED.membershipId));
    assert.equal(participants.some((entry) => entry.id === PRACTICE_MEMBERSHIP_ID), false);
});

test("buscador de DM: forma ChatParticipant y búsqueda por comité y rol", () => {
    const { participants } = get("/dm/participants?search=unicef");
    assert.ok(participants.length > 0);
    for (const entry of participants) {
        assert.equal(entry.committee, "UNICEF");
        assert.deepEqual(Object.keys(entry).sort(), [
            "alias",
            "avatar",
            "committee",
            "delegationName",
            "id",
            "institutionName",
            "lastActive",
            "name",
            "role",
        ]);
        assert.equal(entry.lastActive, "Activo");
        assert.equal(entry.institutionName, null);
    }

    const staff = get("/dm/participants?search=admin_mun").participants;
    assert.deepEqual(staff.map((entry) => entry.id), [PRACTICE_STAFF_ID]);
});

test("buscador de DM: no busca por alias", () => {
    const state = cloneState(STATE);
    state.people[0].alias = "Chispa";
    const { participants } = get("/dm/participants?search=chispa", state);
    assert.deepEqual(participants, []);
});

test("buscador de DM: como mucho 20 resultados", () => {
    const state = cloneState(STATE);
    for (let index = 0; index < 30; index += 1) {
        state.people.push({
            ...STATE.people[0],
            membershipId: `practice-person-extra-${index}`,
            firstName: "Zeta",
            lastName: `#${index}`,
            alias: null,
        });
    }
    const { participants } = get("/dm/participants?search=zeta", state);
    assert.equal(participants.length, 20);
});

test("rutas con parámetros: segmento vacío, %2F y ruta sin escritura dan 501", () => {
    assert.throws(() => get("/posts//comments"), isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE));
    assert.throws(
        () => get("/posts/practice-post-1%2Fcomments"),
        isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE),
    );
    assert.throws(
        () => get("/posts/practice-post-1/comments/extra"),
        isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE),
    );
    assert.throws(
        () => routePracticeRequest({ method: "POST", path: "/posts/practice-post-1/comments/extra", body: { content: "hola" } }, STATE),
        isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE),
    );
});

test("el enrutador acepta now opcional sin cambiar las lecturas", () => {
    assert.deepEqual(
        routePracticeRequest({ method: "GET", path: "/posts?muro=general" }, STATE, { now: NOW }),
        get("/posts?muro=general"),
    );
});

test("ninguna lectura de la práctica llama a fetch", () => {
    get("/events/practice-local/walls");
    get("/posts?muro=general");
    get(`/posts/${STATE.comments[0].postId}/comments`);
    directory("?limit=3");
    get(`/profiles/${PRACTICE_MEMBERSHIP_ID}`);
    get("/dm/conversations");
    get(`/dm/conversations/${STATE.conversations[0].id}/messages`);
    get("/dm/participants?search=a");
    assert.equal(fetchCalls, 0);
});
