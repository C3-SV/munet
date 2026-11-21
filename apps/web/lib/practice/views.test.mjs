import assert from "node:assert/strict";
import test from "node:test";
import { PRACTICE_COMMITTEES, buildPracticeWalls } from "./catalog.ts";
import { PRACTICE_EVENT_ID, PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { PRACTICE_STAFF_ID } from "./people.ts";
import { avatarFor, createInitialState } from "./state.ts";
import {
    findPerson,
    normalizeSearch,
    sortPostsForWall,
    toComment,
    toCommentDeleted,
    toConversationSummary,
    toDirectoryEntry,
    toMyProfile,
    toPost,
    toPostDeleted,
    toPublicProfile,
    toUser,
    toWallView,
} from "./views.ts";

const NOW = new Date("2026-11-21T10:00:00.000Z");

const baseState = () => createInitialState("usuario-prueba", NOW);

// Instante a `minutes` minutos antes de NOW (determinista).
const at = (minutes) => new Date(NOW.getTime() - minutes * 60000).toISOString();

const participantOf = (state) => state.people.find((person) => person.role === "PARTICIPANT");
const staffOf = (state) => state.people.find((person) => person.membershipId === PRACTICE_STAFF_ID);
const committeeById = (committeeId) => PRACTICE_COMMITTEES.find((committee) => committee.id === committeeId);

const POLL_OPTIONS = [
    { id: "practice-option-1", text: "Mesa redonda" },
    { id: "practice-option-2", text: "Votación" },
    { id: "practice-option-3", text: "Ronda libre" },
];

const ATTACHMENT = { id: "practice-att-1", name: "mapa.png", mimeType: "image/png", size: 1024 };

const makePost = (overrides = {}) => ({
    id: "practice-post-900",
    authorId: PRACTICE_MEMBERSHIP_ID,
    wallSlug: "general",
    postType: "TEXT",
    content: "Texto de prueba",
    createdAt: at(30),
    pinned: false,
    deleted: false,
    poll: null,
    attachment: null,
    ...overrides,
});

const makeComment = (overrides = {}) => ({
    id: "practice-comment-900",
    postId: "practice-post-900",
    parentCommentId: null,
    authorId: PRACTICE_MEMBERSHIP_ID,
    content: "Comentario de prueba",
    createdAt: at(20),
    deleted: false,
    ...overrides,
});

const makeMessage = (overrides = {}) => ({
    id: "practice-message-900",
    conversationId: "practice-conversation-1",
    senderId: PRACTICE_MEMBERSHIP_ID,
    content: "Mensaje de prueba",
    createdAt: at(10),
    deleted: false,
    ...overrides,
});

// ─── Personas ────────────────────────────────────────────────────────────────

test("findPerson devuelve a la propia persona desde el estado y null para ids desconocidos", () => {
    const state = baseState();
    assert.deepEqual(findPerson(state, PRACTICE_MEMBERSHIP_ID), {
        membershipId: PRACTICE_MEMBERSHIP_ID,
        firstName: state.persona.firstName,
        lastName: state.persona.lastName,
        alias: null,
        committeeId: state.persona.committeeId,
        delegation: state.persona.delegation,
        delegationCode: state.persona.delegationCode,
        role: "PARTICIPANT",
    });
    assert.equal(findPerson(state, "no-existe"), null);
});

test("findPerson encuentra a la cohorte y al personal con su rol", () => {
    const state = baseState();
    const other = participantOf(state);
    assert.deepEqual(findPerson(state, other.membershipId), other);
    const staff = findPerson(state, PRACTICE_STAFF_ID);
    assert.equal(staff.role, "ADMIN_MUN");
    assert.equal(staff.committeeId, "");
});

test("findPerson toma el alias editado de la propia persona sin espacios sobrantes", () => {
    const state = { ...baseState(), profile: { displayName: null, alias: "  Ana  ", bio: "", avatar: null } };
    assert.equal(findPerson(state, PRACTICE_MEMBERSHIP_ID).alias, "Ana");
});

// ─── Usuarios ────────────────────────────────────────────────────────────────

test("toUser usa el nombre editado y las iniciales de ese nombre para la propia persona", () => {
    const state = { ...baseState(), profile: { displayName: "Ana Delegada", alias: null, bio: "", avatar: null } };
    assert.deepEqual(toUser(state, PRACTICE_MEMBERSHIP_ID), {
        id: PRACTICE_MEMBERSHIP_ID,
        name: "Ana Delegada",
        alias: null,
        committeeName: committeeById(state.persona.committeeId).name,
        avatar: avatarFor("AD"),
        role: "PARTICIPANT",
    });
});

test("toUser conserva el nombre de la persona cuando no hay edición", () => {
    const state = baseState();
    const me = toUser(state, PRACTICE_MEMBERSHIP_ID);
    assert.equal(me.name, state.persona.displayName);
    assert.equal(me.avatar, avatarFor(state.persona.delegation.charAt(0)));
});

test("toUser usa el avatar editado de la propia persona si existe", () => {
    const avatar = "data:image/png;base64,AAAA";
    const state = { ...baseState(), profile: { displayName: null, alias: null, bio: "", avatar } };
    assert.equal(toUser(state, PRACTICE_MEMBERSHIP_ID).avatar, avatar);
});

test("toUser da nombre, comité y rol de la cohorte, y el personal no tiene comité", () => {
    const state = baseState();
    const other = participantOf(state);
    const user = toUser(state, other.membershipId);
    assert.equal(user.name, `${other.firstName} ${other.lastName}`);
    assert.equal(user.committeeName, committeeById(other.committeeId).name);
    assert.equal(user.role, "PARTICIPANT");
    assert.deepEqual(toUser(state, PRACTICE_STAFF_ID), {
        id: PRACTICE_STAFF_ID,
        name: "Secretaría General",
        alias: null,
        committeeName: null,
        avatar: avatarFor("SG"),
        role: "ADMIN_MUN",
    });
});

test("todos los avatares de usuario son data URI", () => {
    const state = baseState();
    const ids = [...state.people.map((person) => person.membershipId), PRACTICE_MEMBERSHIP_ID];
    for (const id of ids) {
        assert.ok(toUser(state, id).avatar.startsWith("data:"), id);
    }
});

test("toUser falla si el id no pertenece a la práctica", () => {
    assert.throws(() => toUser(baseState(), "no-existe"), /no-existe/);
});

// ─── Publicaciones ───────────────────────────────────────────────────────────

const POST_KEYS = [
    "attachment", "canDelete", "commentCount", "committeeTags", "content", "createdAt",
    "deletedByActorType", "id", "isDeleted", "isPinned", "pinnedAt", "poll", "postType",
    "timestamp", "title", "updatedAt", "user",
];

test("toPost tiene las claves de Post, el fijado y las fechas derivadas", () => {
    const state = { ...baseState(), comments: [], posts: [makePost({ createdAt: "2026-11-21T09:00:00.000Z", pinned: true })] };
    const view = toPost(state, state.posts[0]);
    assert.deepEqual(Object.keys(view).sort(), POST_KEYS);
    assert.deepEqual(view, {
        id: "practice-post-900",
        postType: "TEXT",
        user: toUser(state, PRACTICE_MEMBERSHIP_ID),
        title: null,
        content: "Texto de prueba",
        createdAt: "2026-11-21T09:00:00.000Z",
        updatedAt: "2026-11-21T09:00:00.000Z",
        committeeTags: [],
        isDeleted: false,
        deletedByActorType: null,
        canDelete: true,
        poll: null,
        attachment: null,
        commentCount: 0,
        timestamp: Date.parse("2026-11-21T09:00:00.000Z"),
        isPinned: true,
        pinnedAt: "2026-11-21T09:00:00.000Z",
    });
});

test("publicación propia permite borrarla y retirar su adjunto; la ajena no", () => {
    const state = baseState();
    const other = participantOf(state).membershipId;
    const withState = {
        ...state,
        comments: [],
        posts: [
            makePost({ attachment: ATTACHMENT }),
            makePost({ id: "practice-post-901", authorId: other, attachment: ATTACHMENT }),
        ],
    };
    const [own, theirs] = withState.posts.map((post) => toPost(withState, post));
    assert.equal(own.canDelete, true);
    assert.deepEqual(own.attachment, { ...ATTACHMENT, canRemove: true });
    assert.equal(theirs.canDelete, false);
    assert.deepEqual(theirs.attachment, { ...ATTACHMENT, canRemove: false });
});

test("commentCount cuenta solo los comentarios no borrados de esa publicación", () => {
    const state = baseState();
    const other = participantOf(state).membershipId;
    const withState = {
        ...state,
        posts: [makePost()],
        comments: [
            makeComment({ id: "practice-comment-1" }),
            makeComment({ id: "practice-comment-2", parentCommentId: "practice-comment-1", authorId: other }),
            makeComment({ id: "practice-comment-3", deleted: true }),
            makeComment({ id: "practice-comment-4", postId: "practice-post-otra" }),
        ],
    };
    assert.equal(toPost(withState, withState.posts[0]).commentCount, 2);
});

// ─── Encuestas ───────────────────────────────────────────────────────────────

const pollPost = (poll, overrides = {}) => {
    const state = { ...baseState(), comments: [], posts: [makePost({ postType: "POLL", poll, ...overrides })] };
    return { state, view: toPost(state, state.posts[0]) };
};

test("encuesta sin votos da total 0 y porcentajes 0", () => {
    const { view } = pollPost({ status: "OPEN", options: POLL_OPTIONS, votes: {} });
    assert.deepEqual(view.poll, {
        id: "practice-post-900",
        status: "OPEN",
        isClosed: false,
        totalVotes: 0,
        canVote: true,
        canClose: true,
        options: POLL_OPTIONS.map((option) => ({ id: option.id, text: option.text, votes: 0, percentage: 0, isSelectedByMe: false })),
    });
});

test("encuesta con votos redondea los porcentajes y marca solo mi voto", () => {
    const state = baseState();
    const [first, second] = state.people.filter((person) => person.role === "PARTICIPANT");
    const votes = {
        [PRACTICE_MEMBERSHIP_ID]: "practice-option-2",
        [first.membershipId]: "practice-option-2",
        [second.membershipId]: "practice-option-1",
    };
    const { view } = pollPost({ status: "OPEN", options: POLL_OPTIONS, votes });
    assert.equal(view.poll.totalVotes, 3);
    assert.deepEqual(
        view.poll.options.map((option) => [option.votes, option.percentage, option.isSelectedByMe]),
        [
            [1, 33, false],
            [2, 67, true],
            [0, 0, false],
        ],
    );
});

test("encuesta cerrada no admite votar ni cerrar", () => {
    const { view } = pollPost({ status: "CLOSED", options: POLL_OPTIONS, votes: {} });
    assert.equal(view.poll.status, "CLOSED");
    assert.equal(view.poll.isClosed, true);
    assert.equal(view.poll.canVote, false);
    assert.equal(view.poll.canClose, false);
});

test("encuesta abierta de otra persona se puede votar pero no cerrar", () => {
    const state = baseState();
    const other = participantOf(state).membershipId;
    const withState = {
        ...state,
        comments: [],
        posts: [makePost({ authorId: other, postType: "POLL", poll: { status: "OPEN", options: POLL_OPTIONS, votes: {} } })],
    };
    const view = toPost(withState, withState.posts[0]);
    assert.equal(view.poll.canVote, true);
    assert.equal(view.poll.canClose, false);
});

// ─── Borradas ────────────────────────────────────────────────────────────────

test("toPostDeleted sustituye el contenido, quita el adjunto y cierra las acciones de encuesta", () => {
    const { state } = pollPost(
        { status: "OPEN", options: POLL_OPTIONS, votes: { [PRACTICE_MEMBERSHIP_ID]: "practice-option-1" } },
        { attachment: ATTACHMENT },
    );
    const view = toPostDeleted(state, state.posts[0]);
    assert.equal(view.id, "practice-post-900");
    assert.equal(view.isDeleted, true);
    assert.equal(view.deletedByActorType, "AUTHOR");
    assert.equal(view.content, "Esta publicacion fue eliminada por el autor.");
    assert.equal(view.attachment, null);
    assert.equal(view.canDelete, false);
    assert.equal(view.poll.canVote, false);
    assert.equal(view.poll.canClose, false);
    assert.equal(view.poll.totalVotes, 1);
    assert.equal(view.poll.options[0].isSelectedByMe, true);
});

// ─── Comentarios ─────────────────────────────────────────────────────────────

const COMMENT_KEYS = [
    "canDelete", "content", "createdAt", "deletedByActorType", "id", "isDeleted",
    "parentCommentId", "postId", "timestamp", "updatedAt", "user",
];

test("toComment tiene la forma de PostComment y da permisos solo al autor", () => {
    const state = { ...baseState(), comments: [] };
    const other = participantOf(state).membershipId;
    const reply = toComment(state, makeComment({ parentCommentId: "practice-comment-1" }));
    assert.deepEqual(Object.keys(reply).sort(), COMMENT_KEYS);
    assert.equal(reply.parentCommentId, "practice-comment-1");
    assert.equal(reply.postId, "practice-post-900");
    assert.equal(reply.user.id, PRACTICE_MEMBERSHIP_ID);
    assert.equal(reply.canDelete, true);
    assert.equal(reply.isDeleted, false);
    assert.equal(reply.timestamp, Date.parse(reply.createdAt));
    assert.equal(toComment(state, makeComment({ authorId: other })).canDelete, false);
});

test("toCommentDeleted sustituye el contenido y quita los permisos", () => {
    const state = { ...baseState(), comments: [] };
    const view = toCommentDeleted(state, makeComment());
    assert.equal(view.content, "Este comentario fue eliminado por el autor.");
    assert.equal(view.isDeleted, true);
    assert.equal(view.deletedByActorType, "AUTHOR");
    assert.equal(view.canDelete, false);
});

// ─── Muros ───────────────────────────────────────────────────────────────────

test("toWallView devuelve el muro con los permisos del comité de la persona", () => {
    const state = baseState();
    const own = committeeById(state.persona.committeeId);
    const foreign = PRACTICE_COMMITTEES.find((committee) => committee.id !== own.id);

    const ownWall = toWallView(state, `comite-${own.code.toLowerCase()}`);
    assert.equal(ownWall.committeeId, own.id);
    assert.deepEqual([ownWall.canAccess, ownWall.canPublish], [true, true]);

    const foreignWall = toWallView(state, `comite-${foreign.code.toLowerCase()}`);
    assert.deepEqual([foreignWall.canAccess, foreignWall.canPublish], [false, false]);

    const avisos = toWallView(state, "avisos");
    assert.deepEqual([avisos.canAccess, avisos.canPublish], [true, false]);

    assert.deepEqual(toWallView(state, "general"), buildPracticeWalls(state.persona.committeeId)[1]);
    assert.equal(toWallView(state, "no-existe"), null);
});

// ─── Conversaciones ──────────────────────────────────────────────────────────

test("toConversationSummary sin mensajes no tiene último mensaje y expone al otro participante", () => {
    const state = { ...baseState(), messages: [] };
    const other = participantOf(state);
    const summary = toConversationSummary(state, { id: "practice-conversation-1", otherId: other.membershipId, createdAt: at(120) });
    assert.deepEqual(summary, {
        id: "practice-conversation-1",
        eventId: PRACTICE_EVENT_ID,
        status: "ACTIVE",
        createdAt: at(120),
        lastMessageAt: null,
        otherParticipant: {
            id: other.membershipId,
            name: `${other.firstName} ${other.lastName}`,
            alias: null,
            avatar: toUser(state, other.membershipId).avatar,
            role: "PARTICIPANT",
            committee: committeeById(other.committeeId).name,
            lastActive: "Activo",
            delegationName: other.delegation,
            institutionName: null,
        },
        lastMessage: null,
        lastMessageAuthorId: null,
    });
});

test("toConversationSummary toma el último mensaje visible de su conversación", () => {
    const state = baseState();
    const other = participantOf(state).membershipId;
    const withState = {
        ...state,
        messages: [
            makeMessage({ id: "practice-message-1", senderId: PRACTICE_MEMBERSHIP_ID, content: "Hola", createdAt: at(50) }),
            makeMessage({ id: "practice-message-2", senderId: other, content: "Buenas", createdAt: at(40) }),
            makeMessage({ id: "practice-message-3", senderId: PRACTICE_MEMBERSHIP_ID, content: "Borrado", createdAt: at(30), deleted: true }),
            makeMessage({ id: "practice-message-4", conversationId: "practice-conversation-2", senderId: other, content: "Otra", createdAt: at(10) }),
        ],
    };
    const summary = toConversationSummary(withState, { id: "practice-conversation-1", otherId: other, createdAt: at(60) });
    assert.equal(summary.lastMessage, "Buenas");
    assert.equal(summary.lastMessageAuthorId, other);
    assert.equal(summary.lastMessageAt, at(40));
});

test("toConversationSummary muestra Sin comité para el personal", () => {
    const state = { ...baseState(), messages: [] };
    const summary = toConversationSummary(state, { id: "practice-conversation-staff", otherId: PRACTICE_STAFF_ID, createdAt: at(5) });
    assert.equal(summary.otherParticipant.committee, "Sin comité");
    assert.equal(summary.otherParticipant.role, "ADMIN_MUN");
});

// ─── Directorio y perfiles ───────────────────────────────────────────────────

test("toDirectoryEntry expone solo campos públicos y el comité de la cohorte", () => {
    const state = baseState();
    const other = participantOf(state);
    assert.deepEqual(toDirectoryEntry(state, other), {
        membershipId: other.membershipId,
        firstName: other.firstName,
        lastName: other.lastName,
        alias: null,
        committee: { id: other.committeeId, name: committeeById(other.committeeId).name },
        delegationCode: other.delegationCode,
    });
});

test("toDirectoryEntry deja el comité en null para el personal y usa el alias de la propia persona", () => {
    const state = { ...baseState(), profile: { displayName: null, alias: "Ana", bio: "", avatar: null } };
    assert.equal(toDirectoryEntry(state, staffOf(state)).committee, null);
    const me = toDirectoryEntry(state, findPerson(state, PRACTICE_MEMBERSHIP_ID));
    assert.equal(me.membershipId, PRACTICE_MEMBERSHIP_ID);
    assert.equal(me.alias, "Ana");
});

test("toMyProfile refleja la edición de perfil y los datos de la cuenta", () => {
    const state = { ...baseState(), profile: { displayName: "Ana Delegada", alias: "AD", bio: "Hola", avatar: null } };
    const own = committeeById(state.persona.committeeId);
    assert.deepEqual(toMyProfile(state), {
        membershipId: PRACTICE_MEMBERSHIP_ID,
        eventId: PRACTICE_EVENT_ID,
        role: "PARTICIPANT",
        delegationName: state.persona.delegation,
        delegationCode: state.persona.delegationCode,
        institutionName: null,
        committee: { id: own.id, name: own.name, code: own.code },
        profile: {
            id: null,
            firstName: state.persona.firstName,
            lastName: state.persona.lastName,
            displayName: "Ana Delegada",
            alias: "AD",
            bio: "Hola",
            avatar: avatarFor("AD"),
        },
        accountStatus: "ACTIVE",
        participantCode: "PRACTICA",
        email: null,
    });
});

test("toPublicProfile omite los datos de cuenta y devuelve null si no existe", () => {
    const state = baseState();
    const other = participantOf(state);
    const profile = toPublicProfile(state, other.membershipId);
    assert.deepEqual(Object.keys(profile).sort(), [
        "committee", "delegationCode", "delegationName", "eventId", "institutionName", "membershipId", "profile", "role",
    ]);
    assert.deepEqual(Object.keys(profile.profile).sort(), ["alias", "avatar", "bio", "displayName", "firstName", "id", "lastName"]);
    assert.equal(profile.profile.bio, "");
    assert.equal(toPublicProfile(state, "no-existe"), null);
});

test("toPublicProfile de la propia persona usa la biografía y el nombre editados", () => {
    const state = { ...baseState(), profile: { displayName: "Ana Delegada", alias: null, bio: "Hola", avatar: null } };
    const profile = toPublicProfile(state, PRACTICE_MEMBERSHIP_ID);
    assert.equal(profile.profile.displayName, "Ana Delegada");
    assert.equal(profile.profile.bio, "Hola");
    assert.equal(profile.accountStatus, undefined);
});

// ─── Utilidades ──────────────────────────────────────────────────────────────

test("normalizeSearch quita tildes y mayúsculas", () => {
    assert.equal(normalizeSearch("ÁrBol"), "arbol");
    assert.equal(normalizeSearch("Él Ñandú"), "el nandu");
});

test("sortPostsForWall pone los fijados primero, luego por fecha descendente, sin mutar la entrada", () => {
    const a = makePost({ id: "a", createdAt: "2026-11-21T09:00:00.000Z" });
    const b = makePost({ id: "b", createdAt: "2026-11-21T08:00:00.000Z", pinned: true });
    const c = makePost({ id: "c", createdAt: "2026-11-21T10:00:00.000Z" });
    const d = makePost({ id: "d", createdAt: "2026-11-21T09:30:00.000Z", pinned: true });
    const input = [a, b, c, d];
    const sorted = sortPostsForWall(input);
    assert.deepEqual(sorted.map((post) => post.id), ["d", "b", "c", "a"]);
    assert.deepEqual(input.map((post) => post.id), ["a", "b", "c", "d"]);
});
