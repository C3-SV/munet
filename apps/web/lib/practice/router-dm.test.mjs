import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { PRACTICE_LIMITS } from "./limits.ts";
import { PRACTICE_DM_REPLIES } from "./people.ts";
import { PracticeRequestError, routePracticeRequest, routePracticeRequestDetailed } from "./router.ts";
import { createInitialState } from "./state.ts";

const NOW = new Date("2026-11-21T12:00:00Z");
const REPLY_DELAY_MS = 1000;
const PARTICIPANT_MISSING = "Participante no encontrado en este evento";
const SELF = "No puedes iniciar una conversacion contigo mismo";
const TARGET_REQUIRED = "targetMembershipId es requerido";
const EMPTY = "El mensaje no puede estar vacio";
const CONVERSATION_MISSING = "Conversacion no encontrada";
const MESSAGE_MISSING = "Mensaje no encontrado";
const DELETE_FORBIDDEN = "Solo puedes eliminar tus propios mensajes";
const STAFF_ID = "practice-person-staff";
// Persona sin conversación sembrada, con respuestas simuladas.
const OTHER = "practice-person-3";

// Datos sembrados: el estado inicial es determinista para "u1" y NOW.
const BASE = createInitialState("u1", NOW);
const SEEDED = BASE.conversations[0];
const seededOther = SEEDED.otherId;
const seededOtherMessage = BASE.messages.find(
    (message) => message.conversationId === SEEDED.id && message.senderId !== PRACTICE_MEMBERSHIP_ID,
);

const at = (ms) => new Date(NOW.getTime() + ms);

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
let state;

beforeEach(() => {
    // Ninguna escritura de mensajes directos puede llegar a la red.
    fetchCalls = 0;
    globalThis.fetch = () => {
        fetchCalls += 1;
        throw new Error("fetch prohibido");
    };
    state = createInitialState("u1", NOW);
});

afterEach(() => {
    globalThis.fetch = originalFetch;
});

const call = (method, path, body, now = NOW) => routePracticeRequest({ method, path, body }, state, { now });
const outcome = (method, path, body, now = NOW) => routePracticeRequestDetailed({ method, path, body }, state, { now });
const isRequestError = (status, message) => (error) =>
    error instanceof PracticeRequestError && error.status === status && error.message === message;
const assertFails = (fn, status, message) => assert.throws(fn, isRequestError(status, message));
// Un intento fallido no cambia el estado: ni conversaciones, ni mensajes, ni contadores, ni ids.
const unchangedAfter = (fn) => {
    const before = JSON.stringify(state);
    assert.throws(fn, PracticeRequestError);
    assert.equal(JSON.stringify(state), before);
};

const createConversation = (targetMembershipId, now = NOW) =>
    call("POST", "/dm/conversations", { targetMembershipId }, now).conversation;
const sendMessage = (conversationId, content, now = NOW) =>
    call("POST", `/dm/conversations/${conversationId}/messages`, { content }, now).message;
const listMessages = (conversationId) => call("GET", `/dm/conversations/${conversationId}/messages`).messages;
const listConversations = () => call("GET", "/dm/conversations").conversations;
const summaryOf = (conversationId) => listConversations().find((conversation) => conversation.id === conversationId);
const textsFrom = (conversationId, senderId) =>
    listMessages(conversationId)
        .filter((message) => message.senderId === senderId)
        .map((message) => message.text);

test("datos de partida: la persona de prueba no tiene conversación y el personal no es destinataria", () => {
    assert.ok(BASE.people.some((person) => person.membershipId === OTHER && person.role === "PARTICIPANT"));
    assert.equal(BASE.conversations.some((conversation) => conversation.otherId === OTHER), false);
    assert.ok(seededOtherMessage);
    assert.deepEqual(BASE.replyCounts, {});
    assert.equal(BASE.people.find((person) => person.membershipId === STAFF_ID).role, "ADMIN_MUN");
});

test("crear una conversación nueva responde 201 con id practice-conv-<n> y sin último mensaje", () => {
    const seqBefore = state.seq;
    const result = outcome("POST", "/dm/conversations", { targetMembershipId: OTHER });
    const { conversation } = result.result;
    assert.equal(result.status, 201);
    assert.equal(conversation.id, `practice-conv-${seqBefore}`);
    assert.equal(state.seq, seqBefore + 1);
    assert.equal(conversation.otherParticipant.id, OTHER);
    assert.equal(conversation.status, "ACTIVE");
    assert.equal(conversation.createdAt, NOW.toISOString());
    assert.equal(conversation.lastMessage, null);
    assert.equal(conversation.lastMessageAuthorId, null);
    assert.equal(conversation.lastMessageAt, null);
    assert.equal(result.wrote, true);
    assert.equal(fetchCalls, 0);
    assert.ok(listConversations().some((item) => item.id === conversation.id));
});

test("repetir la creación con la misma persona responde 200 con el mismo id y no escribe", () => {
    const first = outcome("POST", "/dm/conversations", { targetMembershipId: OTHER });
    const second = outcome("POST", "/dm/conversations", { targetMembershipId: OTHER });
    assert.equal(second.status, 200);
    assert.equal(second.result.conversation.id, first.result.conversation.id);
    assert.equal(second.wrote, false);
    assert.equal(state.conversations.filter((conversation) => conversation.otherId === OTHER).length, 1);
});

test("crear con una persona que ya tiene conversación sembrada responde 200, sin último mensaje y sin duplicar", () => {
    const result = outcome("POST", "/dm/conversations", { targetMembershipId: seededOther });
    assert.equal(result.status, 200);
    assert.equal(result.result.conversation.id, SEEDED.id);
    assert.equal(result.result.conversation.lastMessage, null);
    assert.equal(result.result.conversation.lastMessageAuthorId, null);
    assert.equal(result.wrote, false);
    assert.equal(state.conversations.length, BASE.conversations.length);
});

test("crear una conversación consigo misma da 400, también con espacios alrededor del id", () => {
    assertFails(
        () => call("POST", "/dm/conversations", { targetMembershipId: PRACTICE_MEMBERSHIP_ID }),
        400,
        SELF,
    );
    assertFails(
        () => call("POST", "/dm/conversations", { targetMembershipId: `  ${PRACTICE_MEMBERSHIP_ID}  ` }),
        400,
        SELF,
    );
    unchangedAfter(() => call("POST", "/dm/conversations", { targetMembershipId: PRACTICE_MEMBERSHIP_ID }));
});

test("destinatario desconocido o personal da 404 sin escribir", () => {
    assertFails(
        () => call("POST", "/dm/conversations", { targetMembershipId: "practice-person-999" }),
        404,
        PARTICIPANT_MISSING,
    );
    assertFails(
        () => call("POST", "/dm/conversations", { targetMembershipId: STAFF_ID }),
        404,
        PARTICIPANT_MISSING,
    );
    unchangedAfter(() => call("POST", "/dm/conversations", { targetMembershipId: STAFF_ID }));
});

test("cada participante de la cohorte puede recibir mensajes: 201 si es nueva, 200 si ya existe", () => {
    for (const person of BASE.people.filter((item) => item.role === "PARTICIPANT")) {
        const result = outcome("POST", "/dm/conversations", { targetMembershipId: person.membershipId });
        const seeded = BASE.conversations.some((conversation) => conversation.otherId === person.membershipId);
        assert.equal(result.status, seeded ? 200 : 201, person.membershipId);
    }
});

test("el destinatario vacío, ausente o no textual da 400 antes de buscar", () => {
    assertFails(() => call("POST", "/dm/conversations", {}), 400, TARGET_REQUIRED);
    assertFails(() => call("POST", "/dm/conversations", { targetMembershipId: "" }), 400, TARGET_REQUIRED);
    assertFails(() => call("POST", "/dm/conversations", { targetMembershipId: "   " }), 400, TARGET_REQUIRED);
    assertFails(() => call("POST", "/dm/conversations", { targetMembershipId: 42 }), 400, TARGET_REQUIRED);
    assertFails(() => call("POST", "/dm/conversations", undefined), 400, TARGET_REQUIRED);
    unchangedAfter(() => call("POST", "/dm/conversations", {}));
});

test("enviar en una conversación sembrada: 201 con el mensaje propio y una respuesta de la otra persona al releer", () => {
    const seqBefore = state.seq;
    const countBefore = listMessages(SEEDED.id).length;
    const result = outcome("POST", `/dm/conversations/${SEEDED.id}/messages`, { content: "  Propuesta de réplica  " });
    assert.equal(result.status, 201);
    assert.deepEqual(Object.keys(result.result), ["message"]);
    const { message } = result.result;
    assert.equal(message.id, `practice-msg-${seqBefore}`);
    assert.equal(message.conversationId, SEEDED.id);
    assert.equal(message.text, "Propuesta de réplica");
    assert.equal(message.senderId, PRACTICE_MEMBERSHIP_ID);
    assert.equal(message.createdAt, NOW.toISOString());
    assert.equal(result.wrote, true);
    assert.equal(state.seq, seqBefore + 2);
    assert.equal(fetchCalls, 0);

    const listed = listMessages(SEEDED.id);
    assert.equal(listed.length, countBefore + 2);
    assert.ok(listed.some((item) => item.id === message.id));
    const reply = listed.at(-1);
    assert.equal(reply.id, `practice-msg-${seqBefore + 1}`);
    assert.equal(reply.senderId, seededOther);
    assert.equal(reply.text, PRACTICE_DM_REPLIES[seededOther][0]);
    assert.equal(reply.createdAt, at(REPLY_DELAY_MS).toISOString());
    assert.equal(state.replyCounts[SEEDED.id], 1);
});

test("la respuesta simulada actualiza la vista previa de la conversación", () => {
    sendMessage(SEEDED.id, "Hola");
    assert.equal(summaryOf(SEEDED.id).lastMessage, PRACTICE_DM_REPLIES[seededOther][0]);
    assert.equal(summaryOf(SEEDED.id).lastMessageAuthorId, seededOther);
});

test("las respuestas salen en orden de la lista de la persona, sin repetirse, y el tope corta el resto", () => {
    const conversation = createConversation(OTHER);
    const replies = PRACTICE_DM_REPLIES[OTHER];
    const limit = PRACTICE_LIMITS.maxDmReplies;
    for (let index = 0; index < limit; index += 1) {
        sendMessage(conversation.id, `Envío ${index + 1}`, at(index * 10_000));
    }
    assert.deepEqual(textsFrom(conversation.id, OTHER), replies.slice(0, limit));
    assert.equal(state.replyCounts[conversation.id], limit);

    // Los envíos posteriores al tope no reciben respuesta.
    const before = listMessages(conversation.id).length;
    const extra = sendMessage(conversation.id, "Uno más", at(limit * 10_000));
    assert.equal(listMessages(conversation.id).length, before + 1);
    assert.equal(listMessages(conversation.id).at(-1).id, extra.id);
    assert.deepEqual(textsFrom(conversation.id, OTHER), replies.slice(0, limit));
    assert.equal(state.replyCounts[conversation.id], limit);
});

test("cada conversación lleva su propio contador de respuestas", () => {
    const fresh = createConversation(OTHER);
    sendMessage(SEEDED.id, "En la sembrada");
    sendMessage(fresh.id, "En la nueva");
    assert.equal(state.replyCounts[SEEDED.id], 1);
    assert.equal(state.replyCounts[fresh.id], 1);
    assert.equal(textsFrom(fresh.id, OTHER)[0], PRACTICE_DM_REPLIES[OTHER][0]);
    assert.equal(textsFrom(SEEDED.id, seededOther).at(-1), PRACTICE_DM_REPLIES[seededOther][0]);
});

test("los mensajes se listan por fecha de creación; ante igualdad, el orden de inserción", () => {
    const first = sendMessage(SEEDED.id, "Primero", at(0));
    const second = sendMessage(SEEDED.id, "Segundo", at(500));
    const tail = listMessages(SEEDED.id).slice(-4);
    assert.deepEqual(
        tail.map((message) => message.text),
        ["Primero", "Segundo", PRACTICE_DM_REPLIES[seededOther][0], PRACTICE_DM_REPLIES[seededOther][1]],
    );
    assert.equal(tail[0].id, first.id);
    assert.equal(tail[1].id, second.id);

    // Dos envíos con la misma fecha conservan el orden en que se guardaron.
    const conversation = createConversation(OTHER);
    const a = sendMessage(conversation.id, "A", at(0));
    const b = sendMessage(conversation.id, "B", at(0));
    const ids = listMessages(conversation.id).map((message) => message.id);
    assert.deepEqual(ids.slice(0, 2), [a.id, b.id]);
});

test("un mensaje vacío da 400 sin escribir ni provocar respuesta", () => {
    unchangedAfter(() => call("POST", `/dm/conversations/${SEEDED.id}/messages`, { content: "   " }));
    assertFails(() => call("POST", `/dm/conversations/${SEEDED.id}/messages`, { content: "" }), 400, EMPTY);
    assertFails(() => call("POST", `/dm/conversations/${SEEDED.id}/messages`, {}), 400, EMPTY);
    assert.equal(state.replyCounts[SEEDED.id], undefined);
});

test("un mensaje vacío en una conversación inexistente da 400, no 404 (orden de la API)", () => {
    assertFails(
        () => call("POST", "/dm/conversations/practice-conv-999/messages", { content: "   " }),
        400,
        EMPTY,
    );
    assertFails(() => call("POST", "/dm/conversations/practice-conv-999/messages", {}), 400, EMPTY);
});

test("un mensaje con contenido en una conversación inexistente da 404 sin escribir", () => {
    assertFails(
        () => call("POST", "/dm/conversations/practice-conv-999/messages", { content: "Hola" }),
        404,
        CONVERSATION_MISSING,
    );
    unchangedAfter(() => call("POST", "/dm/conversations/practice-conv-999/messages", { content: "Hola" }));
});

test("borrar el mensaje propio responde 200, lo quita del listado y de la vista previa", () => {
    const conversation = createConversation(OTHER);
    for (let index = 0; index < PRACTICE_LIMITS.maxDmReplies; index += 1) {
        sendMessage(conversation.id, `Envío ${index + 1}`, at(index * 10_000));
    }
    // El siguiente envío no tiene respuesta: es el último mensaje visible.
    const last = sendMessage(conversation.id, "Lo borro", at(40_000));
    assert.equal(summaryOf(conversation.id).lastMessage, "Lo borro");

    const result = outcome("DELETE", `/dm/conversations/${conversation.id}/messages/${last.id}`);
    assert.deepEqual(result.result, { success: true });
    assert.equal(result.wrote, true);
    assert.equal(listMessages(conversation.id).some((message) => message.id === last.id), false);
    assert.equal(summaryOf(conversation.id).lastMessage, PRACTICE_DM_REPLIES[OTHER][2]);
});

test("borrar el mensaje de la otra persona da 403 sin cambios", () => {
    const path = `/dm/conversations/${SEEDED.id}/messages/${seededOtherMessage.id}`;
    unchangedAfter(() => call("DELETE", path));
    assertFails(() => call("DELETE", path), 403, DELETE_FORBIDDEN);
});

test("borrar con conversación o mensaje inexistente da 404, y repetir un borrado también", () => {
    const own = sendMessage(SEEDED.id, "Una vez");
    assertFails(
        () => call("DELETE", `/dm/conversations/practice-conv-999/messages/${own.id}`),
        404,
        CONVERSATION_MISSING,
    );
    assertFails(
        () => call("DELETE", `/dm/conversations/${SEEDED.id}/messages/practice-msg-999`),
        404,
        MESSAGE_MISSING,
    );

    const other = createConversation(OTHER);
    const elsewhere = sendMessage(other.id, "En otra");
    assertFails(
        () => call("DELETE", `/dm/conversations/${SEEDED.id}/messages/${elsewhere.id}`),
        404,
        MESSAGE_MISSING,
    );

    call("DELETE", `/dm/conversations/${SEEDED.id}/messages/${own.id}`);
    assertFails(
        () => call("DELETE", `/dm/conversations/${SEEDED.id}/messages/${own.id}`),
        404,
        MESSAGE_MISSING,
    );
});

test("el estado sigue siendo serializable y las escrituras no usan la red", () => {
    sendMessage(SEEDED.id, "Serializable", at(0));
    const conversation = createConversation(OTHER, at(5_000));
    sendMessage(conversation.id, "Sin red", at(6_000));
    assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
    assert.equal(fetchCalls, 0);
});
