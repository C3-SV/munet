export type PersonLabelInput = {
    name?: string | null;
    alias?: string | null;
    committeeName?: string | null;
    roleName?: string | null;
};

export type PersonLabelParts = {
    primary: string;
    alias: string | null;
    secondary: string | null;
    initials: string;
};

const FALLBACK_NAME = "Participante";

const clean = (value: string | null | undefined): string => (value ?? "").trim();

// Construye las partes de la etiqueta de persona: nombre, alias, línea secundaria e iniciales.
// El truncado de textos largos es responsabilidad del CSS, no de esta función.
export const buildPersonLabel = (person: PersonLabelInput): PersonLabelParts => {
    const name = clean(person.name);
    const alias = clean(person.alias);
    const committee = clean(person.committeeName);
    const role = clean(person.roleName);
    const primary = name || FALLBACK_NAME;

    const initials = primary
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");

    return {
        primary,
        alias: alias && alias.toLowerCase() !== name.toLowerCase() ? alias : null,
        secondary: committee || role || null,
        initials,
    };
};
