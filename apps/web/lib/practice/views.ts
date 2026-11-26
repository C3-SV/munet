import type { ParticipantDirectoryEntry } from "../api/directory.ts";
import type { ChatParticipant, ConversationSummary, DirectMessage } from "../../types/chat.ts";
import type {
    EventWall,
    MyProfile,
    Post,
    PostAttachment,
    PostComment,
    PollData,
    PublicProfile,
    User,
} from "../../types/common.ts";
import { buildPracticeWalls, PRACTICE_COMMITTEES } from "./catalog.ts";
import { PRACTICE_EVENT_ID, PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import type {
    PracticeAttachment,
    PracticeComment,
    PracticeConversation,
    PracticeMessage,
    PracticePerson,
    PracticePoll,
    PracticePost,
} from "./model.ts";
import { avatarFor, type PracticeState } from "./state.ts";

// Constructores puros: convierten el estado de la práctica en los tipos reales que consume la web.
// Ningún constructor lee el reloj, la red ni el azar.

// Publicación con los campos de fijado que la API devuelve y `Post` no declara.
export type PracticePostView = Post & { isPinned: boolean; pinnedAt: string | null };

const DELETED_POST_TEXT = "Esta publicacion fue eliminada por el autor.";
const DELETED_COMMENT_TEXT = "Este comentario fue eliminado por el autor.";
// Mismo texto que la API de DM (mapDmParticipant), sin acento.
const NO_COMMITTEE_TEXT = "Sin comite";
const LAST_ACTIVE_TEXT = "Activo";
const PARTICIPANT_CODE = "PRACTICA";

const isOwn = (membershipId: string): boolean => membershipId === PRACTICE_MEMBERSHIP_ID;

const timeOf = (iso: string): number => Date.parse(iso);

// Texto sin espacios sobrantes; vacío o solo espacios cuenta como ausente.
const textOrNull = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim() ?? "";
    return trimmed === "" ? null : trimmed;
};

// Comité por id. El personal (committeeId vacío) no tiene comité: se responde antes de buscar.
const committeeOf = (committeeId: string): { id: string; name: string; code: string } | null => {
    if (committeeId === "") {
        return null;
    }
    const committee = PRACTICE_COMMITTEES.find((item) => item.id === committeeId);
    return committee ? { id: committee.id, name: committee.name, code: committee.code } : null;
};

// Persona de la propia cuenta: se arma desde la identidad fija y el perfil editado.
const ownPerson = (state: PracticeState): PracticePerson => ({
    membershipId: PRACTICE_MEMBERSHIP_ID,
    firstName: state.persona.firstName,
    lastName: state.persona.lastName,
    alias: textOrNull(state.profile.alias),
    committeeId: state.persona.committeeId,
    delegation: state.persona.delegation,
    delegationCode: state.persona.delegationCode,
    role: "PARTICIPANT",
});

export const findPerson = (state: PracticeState, membershipId: string): PracticePerson | null => {
    if (isOwn(membershipId)) {
        return ownPerson(state);
    }
    return state.people.find((person) => person.membershipId === membershipId) ?? null;
};

// Un id ajeno a la práctica es un error de programación: las vistas solo reciben ids del estado.
const personOrThrow = (state: PracticeState, membershipId: string): PracticePerson => {
    const person = findPerson(state, membershipId);
    if (person === null) {
        throw new Error(`Persona de práctica desconocida: ${membershipId}`);
    }
    return person;
};

// Nombre mostrado: el editado de la propia persona, o "nombre apellido" para el resto.
const displayNameOf = (state: PracticeState, person: PracticePerson): string => {
    if (isOwn(person.membershipId)) {
        return textOrNull(state.profile.displayName) ?? state.persona.displayName;
    }
    return textOrNull(`${person.firstName} ${person.lastName}`) ?? "Participante";
};

// Primera letra de cada una de las dos primeras palabras del nombre; avatarFor sanea el resultado.
const initialsOf = (name: string): string =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => Array.from(word)[0] ?? "")
        .join("");

// Foto propia si está editada; si no, avatar generado con las iniciales del nombre mostrado.
const avatarOf = (state: PracticeState, person: PracticePerson, name: string): string => {
    const edited = state.profile.avatar;
    if (isOwn(person.membershipId) && edited !== null && edited.startsWith("data:image/")) {
        return edited;
    }
    return avatarFor(initialsOf(name));
};

export const toUser = (state: PracticeState, membershipId: string): User => {
    const person = personOrThrow(state, membershipId);
    const name = displayNameOf(state, person);
    return {
        id: person.membershipId,
        name,
        alias: person.alias,
        committeeName: committeeOf(person.committeeId)?.name ?? null,
        avatar: avatarOf(state, person, name),
        role: person.role,
    };
};

const countVisibleComments = (state: PracticeState, postId: string): number =>
    state.comments.filter((comment) => comment.postId === postId && !comment.deleted).length;

const votesFor = (poll: PracticePoll, optionId: string): number =>
    Object.values(poll.votes).filter((votedOptionId) => votedOptionId === optionId).length;

// Votos solo cuentan para opciones que existen en la encuesta. Una publicación borrada no admite acciones.
const buildPoll = (post: PracticePost, poll: PracticePoll): PollData => {
    const open = poll.status === "OPEN";
    const totalVotes = poll.options.reduce((sum, option) => sum + votesFor(poll, option.id), 0);
    return {
        id: post.id,
        status: poll.status,
        isClosed: !open,
        totalVotes,
        canVote: open && !post.deleted,
        canClose: open && !post.deleted && isOwn(post.authorId),
        options: poll.options.map((option) => {
            const votes = votesFor(poll, option.id);
            return {
                id: option.id,
                text: option.text,
                votes,
                percentage: totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100),
                isSelectedByMe: poll.votes[PRACTICE_MEMBERSHIP_ID] === option.id,
            };
        }),
    };
};

const attachmentOf = (attachment: PracticeAttachment, own: boolean): PostAttachment => ({
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    canRemove: own,
});

// Publicación visible. Para una borrada use toPostDeleted: el constructor no la maquilla.
export const toPost = (state: PracticeState, post: PracticePost): PracticePostView => {
    const own = isOwn(post.authorId);
    return {
        id: post.id,
        postType: post.postType,
        user: toUser(state, post.authorId),
        title: null,
        content: post.content,
        createdAt: post.createdAt,
        updatedAt: post.createdAt,
        committeeTags: [],
        isDeleted: false,
        deletedByActorType: null,
        canDelete: own,
        poll: post.poll ? buildPoll(post, post.poll) : null,
        attachment: post.attachment ? attachmentOf(post.attachment, own) : null,
        commentCount: countVisibleComments(state, post.id),
        timestamp: timeOf(post.createdAt),
        isPinned: post.pinned,
        pinnedAt: post.pinned ? post.createdAt : null,
    };
};

// Respuesta del borrado: la misma publicación con el marcador de borrado. Marcar `deleted` cierra las
// acciones de encuesta; el resto de campos se sustituye.
export const toPostDeleted = (state: PracticeState, post: PracticePost): PracticePostView => {
    const view = toPost(state, { ...post, deleted: true });
    return {
        ...view,
        isDeleted: true,
        deletedByActorType: "AUTHOR",
        content: DELETED_POST_TEXT,
        canDelete: false,
        attachment: null,
    };
};

export const toComment = (state: PracticeState, comment: PracticeComment): PostComment => {
    const own = isOwn(comment.authorId);
    return {
        id: comment.id,
        postId: comment.postId,
        parentCommentId: comment.parentCommentId,
        user: toUser(state, comment.authorId),
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.createdAt,
        isDeleted: false,
        deletedByActorType: null,
        canDelete: own,
        timestamp: timeOf(comment.createdAt),
    };
};

export const toCommentDeleted = (state: PracticeState, comment: PracticeComment): PostComment => ({
    ...toComment(state, comment),
    isDeleted: true,
    deletedByActorType: "AUTHOR",
    content: DELETED_COMMENT_TEXT,
    canDelete: false,
});

// Muro por slug o por nombre, sin tildes ni mayúsculas (como findWallBySlug en la API).
export const toWallView = (state: PracticeState, slug: string): EventWall | null => {
    const wanted = normalizeSearch(slug).trim();
    const wall = buildPracticeWalls(state.persona.committeeId).find(
        (item) => normalizeSearch(item.slug) === wanted || normalizeSearch(item.name) === wanted,
    );
    return wall ?? null;
};

// Último mensaje visible de la conversación; ante empate de hora gana el que va después en el estado.
const lastVisibleMessage = (state: PracticeState, conversationId: string): PracticeMessage | null => {
    let last: PracticeMessage | null = null;
    for (const message of state.messages) {
        if (message.conversationId !== conversationId || message.deleted) {
            continue;
        }
        if (last === null || timeOf(message.createdAt) >= timeOf(last.createdAt)) {
            last = message;
        }
    }
    return last;
};

// Participante de chat (mapDmParticipant en la API): base de la conversación y del buscador de DM.
export const chatParticipantOf = (state: PracticeState, person: PracticePerson): ChatParticipant => {
    const name = displayNameOf(state, person);
    return {
        id: person.membershipId,
        name,
        alias: person.alias,
        avatar: avatarOf(state, person, name),
        role: person.role,
        committee: committeeOf(person.committeeId)?.name ?? NO_COMMITTEE_TEXT,
        lastActive: LAST_ACTIVE_TEXT,
        delegationName: person.delegation,
        institutionName: null,
    };
};

export const toConversationSummary = (
    state: PracticeState,
    conversation: PracticeConversation,
): ConversationSummary => {
    const other = personOrThrow(state, conversation.otherId);
    const last = lastVisibleMessage(state, conversation.id);
    return {
        id: conversation.id,
        eventId: PRACTICE_EVENT_ID,
        status: "ACTIVE",
        createdAt: conversation.createdAt,
        lastMessageAt: last ? last.createdAt : null,
        otherParticipant: chatParticipantOf(state, other),
        lastMessage: last ? last.content : null,
        lastMessageAuthorId: last ? last.senderId : null,
    };
};

// Mensaje directo con los campos que la web tipa (la hora local que devuelve la API no se usa).
export const toDirectMessage = (message: PracticeMessage): DirectMessage => ({
    id: message.id,
    conversationId: message.conversationId,
    text: message.content,
    senderId: message.senderId,
    createdAt: message.createdAt,
});

export const toDirectoryEntry = (state: PracticeState, person: PracticePerson): ParticipantDirectoryEntry => {
    const committee = committeeOf(person.committeeId);
    return {
        membershipId: person.membershipId,
        firstName: person.firstName,
        lastName: person.lastName,
        alias: person.alias,
        avatar: avatarOf(state, person, displayNameOf(state, person)),
        committee: committee ? { id: committee.id, name: committee.name } : null,
        delegationCode: person.delegationCode,
    };
};

const publicProfileOf = (state: PracticeState, person: PracticePerson): PublicProfile => {
    const own = isOwn(person.membershipId);
    const name = displayNameOf(state, person);
    return {
        membershipId: person.membershipId,
        eventId: PRACTICE_EVENT_ID,
        role: person.role,
        delegationName: person.delegation,
        delegationCode: person.delegationCode,
        institutionName: null,
        committee: committeeOf(person.committeeId),
        profile: {
            id: null,
            firstName: person.firstName,
            lastName: person.lastName,
            displayName: name,
            alias: person.alias,
            bio: own ? state.profile.bio : "",
            avatar: avatarOf(state, person, name),
        },
    };
};

export const toMyProfile = (state: PracticeState): MyProfile => ({
    ...publicProfileOf(state, ownPerson(state)),
    accountStatus: "ACTIVE",
    participantCode: PARTICIPANT_CODE,
    email: null,
});

export const toPublicProfile = (state: PracticeState, membershipId: string): PublicProfile | null => {
    const person = findPerson(state, membershipId);
    return person === null ? null : publicProfileOf(state, person);
};

// Fijados primero; dentro de cada grupo, la más reciente primero. No modifica la entrada.
export const sortPostsForWall = (posts: readonly PracticePost[]): PracticePost[] =>
    [...posts].sort((left, right) => {
        if (left.pinned !== right.pinned) {
            return left.pinned ? -1 : 1;
        }
        return timeOf(right.createdAt) - timeOf(left.createdAt);
    });

// Texto para comparar búsquedas: sin tildes ni mayúsculas.
export const normalizeSearch = (text: string): string =>
    text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
