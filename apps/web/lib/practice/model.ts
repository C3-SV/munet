// Tipos del estado local del modo práctica. Solo definiciones: todo es serializable (JSON) y no
// importa nada, para que state.ts, people.ts y seed.ts lo usen sin crear ciclos.

// Persona de la cuenta: delegación, número y comité fijos por userId (ver personaFor en state.ts).
export type PracticePersona = {
    delegation: string;
    number: number;
    committeeId: string;
    firstName: string;
    lastName: string;
    displayName: string;
    delegationCode: string;
};

export type PracticePerson = {
    membershipId: string;
    firstName: string;
    lastName: string;
    alias: string | null;
    committeeId: string;
    delegation: string;
    delegationCode: string;
    // El personal ficticio (ADMIN_MUN) solo publica avisos; el resto son participantes.
    role: "PARTICIPANT" | "ADMIN_MUN";
};

export type PracticeAttachment = {
    id: string;
    name: string;
    mimeType: string;
    size: number;
};

// votes: clave = membershipId de quien vota, valor = id de la opción elegida.
export type PracticePoll = {
    status: "OPEN" | "CLOSED";
    options: { id: string; text: string }[];
    votes: Record<string, string>;
};

export type PracticePost = {
    id: string;
    authorId: string;
    wallSlug: string;
    postType: "TEXT" | "POLL";
    content: string;
    createdAt: string;
    pinned: boolean;
    deleted: boolean;
    poll: PracticePoll | null;
    attachment: PracticeAttachment | null;
};

export type PracticeComment = {
    id: string;
    postId: string;
    parentCommentId: string | null;
    authorId: string;
    content: string;
    createdAt: string;
    deleted: boolean;
};

export type PracticeConversation = {
    id: string;
    otherId: string;
    createdAt: string;
};

export type PracticeMessage = {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    createdAt: string;
    deleted: boolean;
};

export type PracticeProfileEdit = {
    displayName: string | null;
    alias: string | null;
    bio: string;
    avatar: string | null;
};

// Metadatos de un adjunto subido por la persona; los binarios viven en el almacén de blobs.
// postId: publicación que consumió el ticket (permite repetir la confirmación); null mientras está pendiente.
export type PracticeUpload = {
    id: string;
    wallSlug: string;
    fileName: string;
    mimeType: string;
    size: number;
    postId: string | null;
};

// Estado completo de la práctica (versión 2). Todos los ids nuevos salen de `seq`.
export type PracticeStateV2 = {
    version: number;
    userId: string;
    createdAt: string;
    persona: PracticePersona;
    // Próximo número libre para ids: mayor que cualquier número ya usado en un id.
    seq: number;
    people: PracticePerson[];
    posts: PracticePost[];
    comments: PracticeComment[];
    conversations: PracticeConversation[];
    messages: PracticeMessage[];
    profile: PracticeProfileEdit;
    uploads: PracticeUpload[];
    // Respuestas simuladas dadas por conversación (clave = id de la conversación).
    replyCounts: Record<string, number>;
};
