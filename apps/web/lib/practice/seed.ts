import { PRACTICE_COMMITTEES } from "./catalog.ts";
import { PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import type {
    PracticeAttachment,
    PracticeComment,
    PracticeConversation,
    PracticeMessage,
    PracticePerson,
    PracticePersona,
    PracticePoll,
    PracticePost,
} from "./model.ts";
import { PRACTICE_STAFF_ID, buildPracticeRoster } from "./people.ts";

// Contenido de ejemplo del modo práctica. Las fechas son relativas a `now` (minutos antes),
// y todos los ids salen de un contador: el `seq` devuelto es el próximo número libre.
export type PracticeSeed = {
    posts: PracticePost[];
    comments: PracticeComment[];
    conversations: PracticeConversation[];
    messages: PracticeMessage[];
    seq: number;
};

const MINUTE_MS = 60000;

const must = <T>(value: T | undefined): T => {
    if (value === undefined) {
        throw new Error("Falta un elemento del contenido de ejemplo de la práctica.");
    }
    return value;
};

// Textos de los dos muros de cada comité, en el orden de PRACTICE_COMMITTEES.
const COMMITTEE_TEXTS: readonly (readonly [string, string])[] = [
    [
        "Propongo que la asamblea revise el informe de la secretaría antes de abrir la lista de oradores.",
        "¿Alguien quiere co-patrocinar una enmienda sobre el calendario de sesiones?",
    ],
    [
        "Borrador de resolución listo para revisar: los puntos operativos están en el primer párrafo.",
        "Recuerden que las mociones de procedimiento no admiten debate.",
    ],
    [
        "Traigo datos de educación infantil para el bloque temático. ¿Alguien quiere sumarse al texto?",
        "Cuando citen una cifra, incluyan el año y la fuente: la presidencia lo valora mucho.",
    ],
    [
        "¿Cómo presentamos una enmienda en el panel económico? Yo la redacto en tres párrafos y la comparto mañana.",
        "Sugerencia: marquen en su hoja el tiempo de cada turno para no pasarse de los 90 segundos.",
    ],
];

export const buildSeed = (persona: PracticePersona, now: Date): PracticeSeed => {
    const roster = buildPracticeRoster(persona);
    const participants = roster.filter((person) => person.role === "PARTICIPANT");

    // Participante número `index` (cíclico) de la cohorte.
    const participantAt = (index: number): PracticePerson => must(participants[index % participants.length]);

    // Participante de un comité; siempre existe al menos uno por comité (ver people.ts).
    const memberOf = (committeeId: string, index: number): PracticePerson => {
        const members = participants.filter((person) => person.committeeId === committeeId);
        return must(members[index % members.length]);
    };

    const ago = (minutes: number): string => new Date(now.getTime() - minutes * MINUTE_MS).toISOString();

    let seq = 1;
    const nextId = (kind: string): string => {
        const id = `practice-${kind}-${seq}`;
        seq += 1;
        return id;
    };

    const posts: PracticePost[] = [];
    const addPost = (input: {
        authorId: string;
        wallSlug: string;
        content: string;
        minutes: number;
        pinned?: boolean;
        poll?: PracticePoll | null;
        attachment?: PracticeAttachment | null;
    }): PracticePost => {
        const post: PracticePost = {
            id: nextId("post"),
            authorId: input.authorId,
            wallSlug: input.wallSlug,
            postType: input.poll ? "POLL" : "TEXT",
            content: input.content,
            createdAt: ago(input.minutes),
            pinned: input.pinned ?? false,
            deleted: false,
            poll: input.poll ?? null,
            attachment: input.attachment ?? null,
        };
        posts.push(post);
        return post;
    };

    // Avisos fijados, publicados por el personal.
    addPost({
        authorId: PRACTICE_STAFF_ID,
        wallSlug: "avisos",
        pinned: true,
        minutes: 5760,
        content:
            "Bienvenida a la práctica de MUNET. Aquí puedes probar el muro, las encuestas, los adjuntos y los mensajes directos. Nada de lo que hagas aquí sale de tu navegador.",
    });
    addPost({
        authorId: PRACTICE_STAFF_ID,
        wallSlug: "avisos",
        pinned: true,
        minutes: 2880,
        content:
            "Reglas de debate para la práctica: cada intervención dura 90 segundos y cada réplica, 30. Para pedir la palabra, levanta la tarjeta de tu delegación y espera el turno de la presidencia.",
    });

    // Publicaciones de General.
    const general1 = addPost({
        authorId: participantAt(0).membershipId,
        wallSlug: "general",
        minutes: 1560,
        content:
            "Hola a todas las delegaciones. ¿Alguien sabe si la moción de procedimiento se vota antes o después de la lista de oradores?",
    });
    const general2 = addPost({
        authorId: participantAt(1).membershipId,
        wallSlug: "general",
        minutes: 600,
        content:
            "Comparto un resumen de la sesión de apertura: se aprobó el orden del día y se abrió la lista de oradores para el primer tema.",
    });
    const general3 = addPost({
        authorId: participantAt(2).membershipId,
        wallSlug: "general",
        minutes: 300,
        content:
            "Consejo práctico: preparen dos cifras y una fuente para cada intervención. Se nota mucho la diferencia cuando el dato respalda el argumento.",
    });

    // Encuesta de General con tres opciones y votos de participantes de ejemplo.
    const pollOptions = [
        { id: nextId("option"), text: "Mesa redonda" },
        { id: nextId("option"), text: "Votación de resoluciones" },
        { id: nextId("option"), text: "Ronda libre de cierre" },
    ];
    const optionA = must(pollOptions[0]);
    const optionB = must(pollOptions[1]);
    addPost({
        authorId: participantAt(3).membershipId,
        wallSlug: "general",
        minutes: 1440,
        content: "Formato de la ronda final de la práctica: ¿cuál prefieren?",
        poll: {
            status: "OPEN",
            options: pollOptions,
            votes: {
                [participantAt(0).membershipId]: optionA.id,
                [participantAt(1).membershipId]: optionB.id,
                [participantAt(2).membershipId]: optionA.id,
            },
        },
    });

    // Dos publicaciones con adjunto (solo metadatos; los binarios se generan al usar la práctica).
    const image = addPost({
        authorId: participantAt(4).membershipId,
        wallSlug: "general",
        minutes: 1200,
        content: "Mapa de la sala para la práctica: ubicación de cada delegación y de la presidencia.",
        attachment: {
            id: "practice-seed-att-image",
            name: "ejemplo-imagen.png",
            mimeType: "image/png",
            size: 184320,
        },
    });
    const pdf = addPost({
        authorId: participantAt(5).membershipId,
        wallSlug: "general",
        minutes: 720,
        content: "Procedimiento de debate en versión de práctica. Revísenlo antes de la primera sesión.",
        attachment: {
            id: "practice-seed-att-pdf",
            name: "procedimiento-de-debate.pdf",
            mimeType: "application/pdf",
            size: 262144,
        },
    });

    // Dos publicaciones por muro de comité, escritas por personas de ese comité.
    PRACTICE_COMMITTEES.forEach((committee, index) => {
        const wallSlug = `comite-${committee.code.toLowerCase()}`;
        const texts = must(COMMITTEE_TEXTS[index]);
        addPost({
            authorId: memberOf(committee.id, 0).membershipId,
            wallSlug,
            minutes: 2160 + index * 60,
            content: texts[0],
        });
        addPost({
            authorId: memberOf(committee.id, 1).membershipId,
            wallSlug,
            minutes: 1080 + index * 60,
            content: texts[1],
        });
    });

    // Comentarios en publicaciones de General; uno responde a otro comentario de primer nivel.
    const comments: PracticeComment[] = [];
    const addComment = (input: {
        post: PracticePost;
        authorId: string;
        content: string;
        minutes: number;
        parent?: PracticeComment;
    }): PracticeComment => {
        const comment: PracticeComment = {
            id: nextId("comment"),
            postId: input.post.id,
            parentCommentId: input.parent?.id ?? null,
            authorId: input.authorId,
            content: input.content,
            createdAt: ago(input.minutes),
            deleted: false,
        };
        comments.push(comment);
        return comment;
    };

    const firstComment = addComment({
        post: general1,
        authorId: participantAt(1).membershipId,
        minutes: 1500,
        content: "Según el procedimiento de práctica, la moción se vota antes de la lista de oradores.",
    });
    addComment({
        post: general1,
        parent: firstComment,
        authorId: participantAt(2).membershipId,
        minutes: 1440,
        content: "Confirmo. Está en el punto dos del documento de procedimiento.",
    });
    addComment({
        post: general2,
        authorId: participantAt(3).membershipId,
        minutes: 540,
        content: "Gracias por el resumen. ¿El orden del día ya quedó publicado en Avisos?",
    });
    addComment({
        post: general3,
        authorId: participantAt(4).membershipId,
        minutes: 240,
        content: "Yo usaría el informe anual: es lo más fácil de citar.",
    });
    addComment({
        post: image,
        authorId: participantAt(0).membershipId,
        minutes: 1100,
        content: "El mapa ayuda a ubicar la mesa de la presidencia desde el fondo de la sala.",
    });
    addComment({
        post: pdf,
        authorId: participantAt(5).membershipId,
        minutes: 600,
        content: "Ya lo leí. El punto 3 aclara cómo se cierra un turno.",
    });

    // Dos conversaciones con personas de ejemplo, con mensajes de ambas partes.
    const conversations: PracticeConversation[] = [];
    const messages: PracticeMessage[] = [];
    const addConversation = (otherId: string, minutes: number): PracticeConversation => {
        const conversation: PracticeConversation = {
            id: nextId("conversation"),
            otherId,
            createdAt: ago(minutes),
        };
        conversations.push(conversation);
        return conversation;
    };
    const addMessage = (input: {
        conversation: PracticeConversation;
        senderId: string;
        content: string;
        minutes: number;
    }): void => {
        messages.push({
            id: nextId("message"),
            conversationId: input.conversation.id,
            senderId: input.senderId,
            content: input.content,
            createdAt: ago(input.minutes),
            deleted: false,
        });
    };

    const firstConversation = addConversation(participantAt(0).membershipId, 2880);
    addMessage({
        conversation: firstConversation,
        senderId: participantAt(0).membershipId,
        minutes: 2700,
        content: "Hola, ¿ya leíste el procedimiento de debate? Creo que hay que releer el punto de réplicas.",
    });
    addMessage({
        conversation: firstConversation,
        senderId: PRACTICE_MEMBERSHIP_ID,
        minutes: 1800,
        content: "Sí, lo leí esta mañana. ¿Te parece que la réplica dure 30 segundos?",
    });
    addMessage({
        conversation: firstConversation,
        senderId: participantAt(0).membershipId,
        minutes: 600,
        content: "Sí, es lo que dice el aviso. Nos vemos en la sesión de mañana.",
    });

    const secondConversation = addConversation(participantAt(1).membershipId, 1440);
    addMessage({
        conversation: secondConversation,
        senderId: participantAt(1).membershipId,
        minutes: 1300,
        content: "Hola de nuevo. Mi delegación quiere co-patrocinar el borrador de CS. ¿La tuya también?",
    });
    addMessage({
        conversation: secondConversation,
        senderId: PRACTICE_MEMBERSHIP_ID,
        minutes: 900,
        content: "Todavía lo estoy revisando. Te aviso antes del cierre de la sesión.",
    });

    return { posts, comments, conversations, messages, seq };
};
