import { buildCsv } from "./csv.ts";

// Encabezados del CSV de credenciales. El nombre de cada columna dice para qué sirve:
// el código para iniciar sesión y la contraseña temporal son lo único que la persona necesita.
// El número de delegación (#) es un identificador público y NO sirve para entrar.
export const CREDENTIAL_HEADERS = [
    "Nombre",
    "Apellido",
    "Alias",
    "Comité",
    "Código para iniciar sesión (escríbelo igual)",
    "Contraseña temporal (un solo uso)",
    "Número de delegación # (solo identificador, no sirve para entrar)",
];

// Columnas que contienen credenciales: se escriben tal cual, sin apóstrofe antepuesto.
const CREDENTIAL_LITERAL_COLUMNS = [4, 5];

export type CreatedCredentialRow = {
    first_name: string;
    last_name: string;
    alias?: string | null;
    committee_label?: string | null;
    participant_code: string;
    delegation_code?: string | null;
    initial_password: string;
};

export const buildCredentialsCsv = (rows: CreatedCredentialRow[]): string =>
    buildCsv(
        CREDENTIAL_HEADERS,
        rows.map((row) => [
            row.first_name,
            row.last_name,
            row.alias ?? "",
            row.committee_label ?? "",
            row.participant_code,
            row.initial_password,
            row.delegation_code ?? "Sin asignar",
        ]),
        { literalColumns: CREDENTIAL_LITERAL_COLUMNS },
    );
