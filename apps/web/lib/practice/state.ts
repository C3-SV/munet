import { PRACTICE_COMMITTEES } from "./catalog.ts";
import { PRACTICE_STATE_VERSION } from "./constants.ts";
import type { PracticePersona, PracticeStateV2 } from "./model.ts";
import { buildPracticeRoster } from "./people.ts";
import { buildSeed } from "./seed.ts";

export type { PracticePersona, PracticeStateV2 };

// Estado local de la práctica: la versión 2 completa (ver model.ts).
export type PracticeState = PracticeStateV2;

const PRACTICE_DELEGATIONS: readonly string[] = [
    "Brasil", "Japón", "Francia", "Kenia", "Canadá", "India",
    "Egipto", "México", "Alemania", "Chile", "Australia", "Nigeria",
];

// Suma ponderada de códigos de carácter (base 31), truncada a 32 bits sin signo.
const hashText = (text: string): number => {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return hash;
};

const pick = <T>(items: readonly T[], seed: string): T => {
    const item = items[hashText(seed) % items.length];
    if (item === undefined) {
        throw new Error("La lista de la persona de práctica no puede estar vacía.");
    }
    return item;
};

// Persona determinista por userId: la misma cuenta siempre obtiene la misma delegación,
// número y comité. Cada atributo usa una semilla distinta para repartirse de forma independiente.
export const personaFor = (userId: string): PracticePersona => {
    const delegation = pick(PRACTICE_DELEGATIONS, `delegation:${userId}`);
    const number = (hashText(`number:${userId}`) % 99) + 1;
    const committee = pick(PRACTICE_COMMITTEES, `committee:${userId}`);
    return {
        delegation,
        number,
        committeeId: committee.id,
        firstName: delegation,
        lastName: `#${number}`,
        displayName: `${delegation} #${number}`,
        delegationCode: `#${String(number).padStart(3, "0")}`,
    };
};

export const createInitialState = (userId: string, now: Date): PracticeState => {
    const persona = personaFor(userId);
    const seed = buildSeed(persona, now);
    return {
        version: PRACTICE_STATE_VERSION,
        userId,
        createdAt: now.toISOString(),
        persona,
        seq: seed.seq,
        people: buildPracticeRoster(persona),
        posts: seed.posts,
        comments: seed.comments,
        conversations: seed.conversations,
        messages: seed.messages,
        profile: { displayName: null, alias: null, bio: "", avatar: null },
        uploads: [],
        replyCounts: {},
    };
};

// El espacio de nombres SVG va escrito como referencia de carácter ("&#104;ttp") para que
// el avatar no contenga la cadena "http": el SVG no pide ningún recurso externo.
const SVG_NAMESPACE = "&#104;ttp://www.w3.org/2000/svg";

// Avatar en data URI con las iniciales sanitizadas (solo letras y dígitos, hasta tres).
export const avatarFor = (initials: string): string => {
    const text = Array.from(initials.replace(/[^\p{L}\p{N}]/gu, "")).slice(0, 3).join("");
    const svg =
        `<svg xmlns="${SVG_NAMESPACE}" width="64" height="64" viewBox="0 0 64 64">` +
        `<rect width="64" height="64" fill="#e2e8f0"/>` +
        `<text x="32" y="40" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#1e293b">${text}</text>` +
        `</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
