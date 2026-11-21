import type { ConversationSummary, DirectMessage } from "../../types/chat.ts";
import { PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { PRACTICE_LIMITS } from "./limits.ts";
import type { PracticeConversation, PracticeMessage } from "./model.ts";
import { PRACTICE_DM_REPLIES } from "./people.ts";
import {
    bodyOf,
    nextId,
    PracticeRequestError,
    requireParam,
    textOf,
    type PracticeRouteContext,
} from "./router-shared.ts";
import type { PracticeState } from "./state.ts";
import { toConversationSummary, toDirectMessage } from "./views.ts";

// Escrituras de mensajes directos. Cada manejador valida todo antes de mutar el estado; los ids salen de
// state.seq y la fecha de context.now. Cada envío propio puede provocar una respuesta simulada de la otra
// persona, en la misma escritura y con la fecha un segundo después.

const TARGET_REQUIRED_MESSAGE = "targetMembershipId es requerido";
const SELF_MESSAGE = "No puedes iniciar una conversacion contigo mismo";
const PARTICIPANT_MESSAGE = "Participante no encontrado en este evento";
const EMPTY_MESSAGE = "El mensaje no puede estar vacio";
const CONVERSATION_MESSAGE = "Conversacion no encontrada";
const MESSAGE_MESSAGE = "Mensaje no encontrado";
const DELETE_MESSAGE = "Solo puedes eliminar tus propios mensajes";

// Retraso de la respuesta simulada respecto al mensaje que la provoca.
const REPLY_DELAY_MS = 1000;

const conversationOrThrow = (state: PracticeState, conversationId: string): PracticeConversation => {
    const conversation = state.conversations.find((item) => item.id === conversationId);
    if (conversation === undefined) {
        throw new PracticeRequestError(404, CONVERSATION_MESSAGE);
    }
    return conversation;
};

// Destinatarias válidas: cualquier persona de la cohorte, incluida la Secretaría General (el propio usuario se rechaza antes).
const isDmRecipient = (state: PracticeState, membershipId: string): boolean =>
    state.people.some((item) => item.membershipId === membershipId);

// La conversación que devuelven creación y reutilización no lleva último mensaje, como en la API.
const withoutLastMessage = (summary: ConversationSummary): ConversationSummary => ({
    ...summary,
    lastMessage: null,
    lastMessageAuthorId: null,
});

// Respuesta simulada: la siguiente frase de la lista de la otra persona, mientras queden turnos en la conversación.
const addSimulatedReply = (state: PracticeState, now: Date, conversation: PracticeConversation): void => {
    const replied = state.replyCounts[conversation.id] ?? 0;
    if (replied >= PRACTICE_LIMITS.maxDmReplies) {
        return;
    }
    const text = PRACTICE_DM_REPLIES[conversation.otherId]?.[replied];
    if (text === undefined) {
        return;
    }
    const reply: PracticeMessage = {
        id: nextId(state, "msg"),
        conversationId: conversation.id,
        senderId: conversation.otherId,
        content: text,
        createdAt: new Date(now.getTime() + REPLY_DELAY_MS).toISOString(),
        deleted: false,
    };
    state.messages.push(reply);
    state.replyCounts[conversation.id] = replied + 1;
};

// POST /dm/conversations: crea la conversación con una persona (201) o devuelve la que ya existe (200).
export const handleConversationCreate = (
    context: PracticeRouteContext,
): { conversation: ConversationSummary } => {
    const { state, now } = context;
    const input = bodyOf(context.body);
    const targetId = textOf(input.targetMembershipId).trim();
    if (targetId === "") {
        throw new PracticeRequestError(400, TARGET_REQUIRED_MESSAGE);
    }
    if (targetId === PRACTICE_MEMBERSHIP_ID) {
        throw new PracticeRequestError(400, SELF_MESSAGE);
    }
    if (!isDmRecipient(state, targetId)) {
        throw new PracticeRequestError(404, PARTICIPANT_MESSAGE);
    }

    const existing = state.conversations.find((item) => item.otherId === targetId);
    if (existing !== undefined) {
        context.status = 200;
        return { conversation: withoutLastMessage(toConversationSummary(state, existing)) };
    }

    // Todo validado: a partir de aquí solo se escribe.
    const conversation: PracticeConversation = {
        id: nextId(state, "conv"),
        otherId: targetId,
        createdAt: now.toISOString(),
    };
    state.conversations.push(conversation);
    context.wrote = true;
    context.status = 201;
    return { conversation: withoutLastMessage(toConversationSummary(state, conversation)) };
};

// POST /dm/conversations/:conversationId/messages: guarda el mensaje propio y, si quedan turnos, la respuesta simulada.
// La respuesta HTTP trae solo el mensaje propio.
export const handleMessageCreate = (context: PracticeRouteContext): { message: DirectMessage } => {
    const { state, now } = context;
    const input = bodyOf(context.body);
    const content = textOf(input.content).trim();
    if (content === "") {
        throw new PracticeRequestError(400, EMPTY_MESSAGE);
    }
    const conversation = conversationOrThrow(state, requireParam(context.params, "conversationId"));

    // Todo validado: a partir de aquí solo se escribe.
    const message: PracticeMessage = {
        id: nextId(state, "msg"),
        conversationId: conversation.id,
        senderId: PRACTICE_MEMBERSHIP_ID,
        content,
        createdAt: now.toISOString(),
        deleted: false,
    };
    state.messages.push(message);
    addSimulatedReply(state, now, conversation);
    context.wrote = true;
    context.status = 201;
    return { message: toDirectMessage(message) };
};

// DELETE /dm/conversations/:conversationId/messages/:messageId: solo se borra el mensaje propio.
export const handleMessageDelete = (context: PracticeRouteContext): { success: true } => {
    const { state } = context;
    const conversation = conversationOrThrow(state, requireParam(context.params, "conversationId"));
    const messageId = requireParam(context.params, "messageId");
    const message = state.messages.find(
        (item) => item.id === messageId && item.conversationId === conversation.id && !item.deleted,
    );
    if (message === undefined) {
        throw new PracticeRequestError(404, MESSAGE_MESSAGE);
    }
    if (message.senderId !== PRACTICE_MEMBERSHIP_ID) {
        throw new PracticeRequestError(403, DELETE_MESSAGE);
    }
    message.deleted = true;
    context.wrote = true;
    return { success: true };
};
