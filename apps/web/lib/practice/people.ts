import { PRACTICE_COMMITTEES } from "./catalog.ts";
import type { PracticePerson, PracticePersona } from "./model.ts";

// Cohorte de la práctica: 8 participantes de ejemplo y un miembro del personal que publica avisos.
export type PracticePersonBase = Omit<PracticePerson, "committeeId">;

export const PRACTICE_STAFF_ID = "practice-person-staff";

// Participantes de ejemplo. Su comité se reparte por posición (2 por comité); una delegación
// que coincida con la de la cuenta se excluye al construir la cohorte.
export const PRACTICE_PEOPLE_BASE: PracticePersonBase[] = [
    { membershipId: "practice-person-1", firstName: "Japón", lastName: "#12", alias: null, delegation: "Japón", delegationCode: "#012", role: "PARTICIPANT" },
    { membershipId: "practice-person-2", firstName: "Kenia", lastName: "#27", alias: null, delegation: "Kenia", delegationCode: "#027", role: "PARTICIPANT" },
    { membershipId: "practice-person-3", firstName: "Egipto", lastName: "#33", alias: null, delegation: "Egipto", delegationCode: "#033", role: "PARTICIPANT" },
    { membershipId: "practice-person-4", firstName: "Canadá", lastName: "#41", alias: null, delegation: "Canadá", delegationCode: "#041", role: "PARTICIPANT" },
    { membershipId: "practice-person-5", firstName: "Alemania", lastName: "#58", alias: null, delegation: "Alemania", delegationCode: "#058", role: "PARTICIPANT" },
    { membershipId: "practice-person-6", firstName: "Chile", lastName: "#64", alias: null, delegation: "Chile", delegationCode: "#064", role: "PARTICIPANT" },
    { membershipId: "practice-person-7", firstName: "Australia", lastName: "#75", alias: null, delegation: "Australia", delegationCode: "#075", role: "PARTICIPANT" },
    { membershipId: "practice-person-8", firstName: "Nigeria", lastName: "#89", alias: null, delegation: "Nigeria", delegationCode: "#089", role: "PARTICIPANT" },
];

// Miembro ficticio del personal: publica los avisos. No pertenece a ningún comité, por eso su
// committeeId es vacío; la vista lo muestra como personal (ADMIN_MUN).
export const PRACTICE_STAFF: PracticePerson = {
    membershipId: PRACTICE_STAFF_ID,
    firstName: "Secretaría",
    lastName: "General",
    alias: null,
    committeeId: "",
    delegation: "Secretaría General",
    delegationCode: "#000",
    role: "ADMIN_MUN",
};

// Respuestas de cada persona de ejemplo a los mensajes directos, en orden. Sin lógica por palabras clave.
export const PRACTICE_DM_REPLIES: Record<string, string[]> = {
    "practice-person-1": [
        "Buena idea. Lo reviso antes de la siguiente sesión.",
        "Gracias por escribir. Te cuento lo que decida mi delegación mañana.",
        "Estoy de acuerdo con el punto que mencionas. Hablamos en la sesión.",
    ],
    "practice-person-2": [
        "Me sirve tu propuesta. ¿Preparas una versión corta para el muro?",
        "Todavía no tengo una postura clara sobre eso. Te aviso cuando la tenga.",
        "Perfecto, lo anoto en mi hoja de intervenciones.",
    ],
    "practice-person-3": [
        "¿Cuánto tiempo tenemos para la réplica? Yo pensaba en treinta segundos.",
        "Coincido. Lo llevo al bloque de la mañana.",
        "Buen punto. Lo voy a revisar con mi comité.",
    ],
    "practice-person-4": [
        "Gracias. Mi delegación prefiere esperar al informe de la secretaría.",
        "Claro, cuenta conmigo para la votación.",
        "Hablemos después de la sesión, así lo preparo con calma.",
    ],
    "practice-person-5": [
        "Muy útil. ¿Tienes la fuente de esa cifra?",
        "No lo había pensado así. Lo considero para mi intervención.",
        "De acuerdo. Te paso mis notas más tarde.",
    ],
    "practice-person-6": [
        "Entendido. Mi delegación se abstiene por ahora.",
        "Lo pienso y te digo antes del cierre.",
        "Gracias por el aviso. Nos vemos en la comisión.",
    ],
    "practice-person-7": [
        "¡Qué buena pregunta! Yo creo que se vota antes de la lista.",
        "Mañana lo comentamos en el pasillo.",
        "Estoy revisando el borrador. Te respondo en cuanto termine.",
    ],
    "practice-person-8": [
        "Sí, cuenta conmigo para co-patrocinar.",
        "Todavía no decido. Te escribo cuando revise el texto completo.",
        "Gracias. Lo comparto con mi equipo de trabajo.",
    ],
};

// Comité de una persona de ejemplo según su posición en la lista base.
const committeeIdAt = (index: number): string => {
    const committee = PRACTICE_COMMITTEES[index % PRACTICE_COMMITTEES.length];
    if (committee === undefined) {
        throw new Error("La lista de comités de práctica no puede estar vacía.");
    }
    return committee.id;
};

// Participantes de ejemplo sin la delegación de la cuenta: 7 u 8 personas, con al menos una por comité.
export const buildPracticePeople = (persona: PracticePersona): PracticePerson[] =>
    PRACTICE_PEOPLE_BASE.map((person, index) => ({ ...person, committeeId: committeeIdAt(index) }))
        .filter((person) => person.delegation !== persona.delegation);

// Cohorte completa del estado: los participantes de ejemplo y el personal que publica los avisos.
export const buildPracticeRoster = (persona: PracticePersona): PracticePerson[] => [
    ...buildPracticePeople(persona),
    { ...PRACTICE_STAFF },
];
