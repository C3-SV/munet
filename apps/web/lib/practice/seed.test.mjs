import assert from "node:assert/strict";
import test from "node:test";
import { PRACTICE_COMMITTEES, buildPracticeWalls } from "./catalog.ts";
import { PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { PRACTICE_LIMITS } from "./limits.ts";
import {
    PRACTICE_DM_REPLIES,
    PRACTICE_PEOPLE_BASE,
    buildPracticePeople,
    buildPracticeRoster,
} from "./people.ts";
import { buildSeed } from "./seed.ts";
import { createInitialState, personaFor } from "./state.ts";

const NOW = new Date("2026-11-21T12:00:00.000Z");
const PERSONA = personaFor("u1");
const COMMITTEE_IDS = PRACTICE_COMMITTEES.map((committee) => committee.id);
const DELEGATIONS = [
    "Brasil", "Japón", "Francia", "Kenia", "Canadá", "India",
    "Egipto", "México", "Alemania", "Chile", "Australia", "Nigeria",
];
const ROSTER_IDS = new Set(buildPracticeRoster(PERSONA).map((person) => person.membershipId));
const seeded = () => buildSeed(PERSONA, NOW);

test("buildPracticePeople devuelve 7 u 8 personas, sin la delegación de la cuenta, con ids únicos", () => {
    for (const delegation of DELEGATIONS) {
        const persona = { ...PERSONA, delegation };
        const people = buildPracticePeople(persona);
        const inBase = PRACTICE_PEOPLE_BASE.some((person) => person.delegation === delegation);
        assert.equal(people.length, inBase ? 7 : 8, delegation);
        assert.equal(new Set(people.map((person) => person.membershipId)).size, people.length, delegation);
        assert.equal(people.some((person) => person.delegation === delegation), false, delegation);
    }
});

test("buildPracticePeople deja al menos una persona de ejemplo en cada comité", () => {
    for (const delegation of DELEGATIONS) {
        const people = buildPracticePeople({ ...PERSONA, delegation });
        for (const committeeId of COMMITTEE_IDS) {
            assert.ok(
                people.some((person) => person.committeeId === committeeId),
                `${delegation} sin ${committeeId}`,
            );
        }
    }
});

test("las personas de ejemplo son participantes; el personal es el único ADMIN_MUN", () => {
    const roster = buildPracticeRoster(PERSONA);
    assert.equal(new Set(roster.map((person) => person.membershipId)).size, roster.length);
    assert.deepEqual(
        roster.filter((person) => person.role === "ADMIN_MUN").map((person) => person.membershipId),
        ["practice-person-staff"],
    );
    for (const person of roster) {
        assert.ok(person.role === "PARTICIPANT" || person.role === "ADMIN_MUN", person.membershipId);
        assert.notEqual(person.membershipId, PRACTICE_MEMBERSHIP_ID);
    }
    assert.ok(roster.some((person) => person.membershipId === "practice-person-staff"));
});

test("cada persona de ejemplo tiene tres respuestas cortas no vacías", () => {
    for (const person of PRACTICE_PEOPLE_BASE) {
        const replies = PRACTICE_DM_REPLIES[person.membershipId];
        assert.ok(Array.isArray(replies), person.membershipId);
        assert.equal(replies.length, 3, person.membershipId);
        for (const reply of replies) {
            assert.ok(reply.trim().length > 0, person.membershipId);
            assert.ok(reply.length <= 200, person.membershipId);
        }
    }
});

test("los avisos son al menos dos fijados y los publica el personal", () => {
    const pinned = seeded().posts.filter((post) => post.wallSlug === "avisos" && post.pinned);
    assert.ok(pinned.length >= 2, `solo ${pinned.length} avisos fijados`);
    for (const post of pinned) {
        assert.equal(post.authorId, "practice-person-staff", post.id);
        assert.equal(post.postType, "TEXT", post.id);
    }
});

test("la encuesta de general tiene tres opciones y votos de personas de ejemplo", () => {
    const polls = seeded().posts.filter((post) => post.postType === "POLL");
    assert.equal(polls.length, 1);
    const [poll] = polls;
    assert.equal(poll.wallSlug, "general");
    assert.equal(poll.poll.status, "OPEN");
    assert.equal(poll.poll.options.length, 3);
    const optionIds = new Set(poll.poll.options.map((option) => option.id));
    const voters = Object.keys(poll.poll.votes);
    assert.ok(voters.length >= 2, `solo ${voters.length} votos`);
    for (const voter of voters) {
        assert.ok(ROSTER_IDS.has(voter), `votante desconocido ${voter}`);
        assert.notEqual(voter, PRACTICE_MEMBERSHIP_ID);
        assert.ok(optionIds.has(poll.poll.votes[voter]), `voto a opción inexistente de ${voter}`);
    }
});

test("cada muro de comité tiene una o dos publicaciones de personas de ese comité", () => {
    const roster = buildPracticeRoster(PERSONA);
    for (const committee of PRACTICE_COMMITTEES) {
        const slug = `comite-${committee.code.toLowerCase()}`;
        const posts = seeded().posts.filter((post) => post.wallSlug === slug);
        assert.ok(posts.length >= 1 && posts.length <= 2, `${slug}: ${posts.length}`);
        for (const post of posts) {
            const author = roster.find((person) => person.membershipId === post.authorId);
            assert.equal(author?.committeeId, committee.id, post.id);
        }
    }
});

test("todos los muros de la semilla existen en el catálogo", () => {
    const slugs = new Set(buildPracticeWalls(COMMITTEE_IDS[0]).map((wall) => wall.slug));
    for (const post of seeded().posts) {
        assert.ok(slugs.has(post.wallSlug), `${post.id}: ${post.wallSlug}`);
    }
});

test("todo autor, interlocutor y remitente pertenece a la cohorte o es la cuenta propia", () => {
    const { comments, conversations, messages, posts } = seeded();
    const known = (id) => ROSTER_IDS.has(id) || id === PRACTICE_MEMBERSHIP_ID;
    for (const post of posts) assert.ok(known(post.authorId), post.id);
    for (const comment of comments) assert.ok(known(comment.authorId), comment.id);
    for (const conversation of conversations) {
        assert.ok(ROSTER_IDS.has(conversation.otherId), conversation.id);
        assert.notEqual(conversation.otherId, PRACTICE_MEMBERSHIP_ID, conversation.id);
    }
    for (const message of messages) assert.ok(known(message.senderId), message.id);
});

test("hay dos conversaciones sembradas con dos a tres mensajes cada una", () => {
    const { conversations, messages } = seeded();
    assert.equal(conversations.length, 2);
    for (const conversation of conversations) {
        const own = messages.filter((message) => message.conversationId === conversation.id);
        assert.ok(own.length >= 2 && own.length <= 3, `${conversation.id}: ${own.length}`);
        for (const message of own) {
            assert.ok(
                message.senderId === conversation.otherId || message.senderId === PRACTICE_MEMBERSHIP_ID,
                message.id,
            );
        }
    }
    for (const message of messages) {
        assert.ok(conversations.some((conversation) => conversation.id === message.conversationId), message.id);
    }
});

test("los comentarios apuntan a publicaciones existentes y ninguno responde a una respuesta", () => {
    const { comments, posts } = seeded();
    const postIds = new Set(posts.map((post) => post.id));
    const byId = new Map(comments.map((comment) => [comment.id, comment]));
    assert.ok(comments.length >= 4 && comments.length <= 6, `comentarios: ${comments.length}`);
    assert.ok(comments.some((comment) => comment.parentCommentId !== null), "falta una respuesta");
    for (const comment of comments) {
        assert.ok(postIds.has(comment.postId), comment.id);
        if (comment.parentCommentId !== null) {
            const parent = byId.get(comment.parentCommentId);
            assert.ok(parent, `padre inexistente de ${comment.id}`);
            assert.equal(parent.parentCommentId, null, `${comment.id} responde a una respuesta`);
            assert.equal(parent.postId, comment.postId, comment.id);
        }
    }
});

test("exactamente dos publicaciones con adjunto, con los dos ids sembrados y dentro de los límites", () => {
    const withAttachment = seeded().posts.filter((post) => post.attachment !== null);
    assert.equal(withAttachment.length, 2);
    const attachments = withAttachment.map((post) => post.attachment);
    assert.deepEqual(
        attachments.map((attachment) => attachment.id).sort(),
        ["practice-seed-att-image", "practice-seed-att-pdf"],
    );
    const image = attachments.find((attachment) => attachment.mimeType === "image/png");
    const pdf = attachments.find((attachment) => attachment.mimeType === "application/pdf");
    assert.equal(image?.name, "ejemplo-imagen.png");
    assert.equal(pdf?.name, "procedimiento-de-debate.pdf");
    assert.ok(image.size > 0 && image.size <= PRACTICE_LIMITS.maxImageBytes, String(image.size));
    assert.ok(pdf.size > 0 && pdf.size <= PRACTICE_LIMITS.maxPdfBytes, String(pdf.size));
});

test("ids únicos con prefijo practica y seq mayor que cualquier número usado en un id", () => {
    const { comments, conversations, messages, posts, seq } = seeded();
    const optionIds = posts.flatMap((post) => (post.poll ? post.poll.options.map((option) => option.id) : []));
    const ids = [
        ...posts.map((post) => post.id),
        ...comments.map((comment) => comment.id),
        ...conversations.map((conversation) => conversation.id),
        ...messages.map((message) => message.id),
        ...optionIds,
    ];
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(Number.isInteger(seq));
    for (const id of ids) {
        assert.ok(id.startsWith("practice-"), id);
        const match = /-(\d+)$/.exec(id);
        if (match) {
            assert.ok(Number(match[1]) < seq, `${id} usa un número igual o mayor que seq ${seq}`);
        }
    }
});

test("las fechas son ISO, no futuras y ordenan comentarios y mensajes después de su origen", () => {
    const { comments, conversations, messages, posts } = seeded();
    const times = [...posts, ...comments, ...conversations, ...messages].map((item) => Date.parse(item.createdAt));
    for (const time of times) {
        assert.ok(Number.isFinite(time), "fecha inválida");
        assert.ok(time <= NOW.getTime(), "fecha futura");
    }
    for (const comment of comments) {
        const post = posts.find((item) => item.id === comment.postId);
        assert.ok(Date.parse(comment.createdAt) > Date.parse(post.createdAt), comment.id);
    }
});

test("createInitialState es serializable y la misma cuenta y hora dan el mismo estado", () => {
    const state = createInitialState("u1", NOW);
    assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
    assert.deepEqual(createInitialState("u1", NOW), state);
    assert.deepEqual(buildSeed(PERSONA, NOW), buildSeed(PERSONA, NOW));
});
