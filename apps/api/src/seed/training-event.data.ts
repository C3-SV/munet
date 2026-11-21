// Datos del evento de entrenamiento «Conoce MUNET»: un evento ficticio donde la gente aprende a
// usar la plataforma. Todo es determinista (mismos códigos, contraseñas y contenido en cada
// corrida), así que el seed es repetible y el reinicio devuelve el evento a su estado inicial.
// Módulo puro: sin base de datos ni red, para poder probarlo y revisarlo antes de sembrar.
//
// Las contraseñas NO se pueden deducir del repositorio: se derivan con HMAC de un secreto local
// (variable TRAINING_SEED_SECRET o el archivo .local/training-seed-secret, que git ignora). Con el
// mismo secreto salen las mismas contraseñas, así que el reinicio las recalcula sin guardarlas.

import { createHmac } from 'node:crypto';

export const TRAINING_EVENT = {
  name: 'Conoce MUNET',
  slug: 'conoce-munet',
  description:
    'Evento de entrenamiento para conocer MUNET: publica, comenta, vota, escribe mensajes y explora el directorio sin afectar a ningún evento oficial.',
  codePrefix: 'CON',
} as const;

export type SeedRole = 'ADMIN_MUN' | 'MODERATOR' | 'PARTICIPANT';
// ACTIVE: ya activada, con contraseña conocida. PENDING: nace pendiente, con contraseña inicial
// individual, para practicar la activación. SUSPENDED: activada y suspendida, para practicar la reactivación.
export type SeedState = 'ACTIVE' | 'PENDING' | 'SUSPENDED';

export type SeedCommittee = { code: string; name: string; description: string; sortOrder: number };

export const TRAINING_COMMITTEES: readonly SeedCommittee[] = [
  { code: 'AG', name: 'Asamblea General', description: 'Todos los Estados miembro debaten temas de alcance global.', sortOrder: 1 },
  { code: 'CS', name: 'Consejo de Seguridad', description: 'Paz y seguridad internacionales, con cinco miembros permanentes.', sortOrder: 2 },
  { code: 'UNICEF', name: 'UNICEF', description: 'Derechos y bienestar de la niñez y la adolescencia.', sortOrder: 3 },
  { code: 'ECOSOC', name: 'ECOSOC', description: 'Cooperación económica, social y ambiental.', sortOrder: 4 },
];

export type SeedAccount = {
  code: string;
  role: SeedRole;
  state: SeedState;
  firstName: string;
  lastName: string;
  alias: string | null;
  committeeCode: string | null;
  delegation: string | null;
  institution: string;
};

const FIRST_NAMES = [
  'Ana', 'Luis', 'María', 'Carlos', 'Sofía', 'Diego', 'Valeria', 'Andrés', 'Camila', 'Mateo',
  'Lucía', 'Javier', 'Daniela', 'Sebastián', 'Paola', 'Gabriel', 'Fernanda', 'Ricardo', 'Mónica', 'Héctor',
  'Natalia', 'Rodrigo', 'Isabela', 'Tomás', 'Alejandra', 'Emilio', 'Renata', 'Óscar', 'Julia', 'Pablo',
  'Elena', 'Samuel', 'Carolina', 'Iván', 'Beatriz', 'Marcos', 'Silvia', 'Adrián', 'Teresa', 'Nicolás',
];
const LAST_NAMES = [
  'Hernández', 'Martínez', 'López', 'García', 'Rodríguez', 'Pérez', 'Ramírez', 'Flores', 'Gómez', 'Cruz',
  'Morales', 'Reyes', 'Castillo', 'Ortiz', 'Mejía', 'Vásquez', 'Alvarado', 'Portillo', 'Rivas', 'Campos',
];
const DELEGATIONS = [
  'Brasil', 'Japón', 'Francia', 'Kenia', 'Canadá', 'India', 'Egipto', 'México', 'Alemania', 'Chile',
  'Australia', 'Nigeria', 'Corea del Sur', 'Argentina', 'Suecia', 'Marruecos', 'Colombia', 'Noruega', 'Indonesia', 'Perú',
  'Italia', 'Ghana', 'Tailandia', 'Costa Rica', 'Polonia', 'Vietnam', 'Uruguay', 'Turquía', 'España', 'Filipinas',
  'Portugal', 'Etiopía', 'Panamá', 'Irlanda', 'Jordania', 'Ecuador', 'Países Bajos',
];

export const PARTICIPANT_COUNT = 37;
export const ACTIVE_PARTICIPANTS = 22; // 1..22
export const PENDING_PARTICIPANTS = 10; // 23..32
export const SUSPENDED_PARTICIPANTS = 5; // 33..37
export const INSTITUTION = 'Entrenamiento MUNET';

const pad = (n: number) => String(n).padStart(3, '0');

export const MIN_SECRET_LENGTH = 16;
// Sin 0, O, 1 ni I para que se puedan copiar del Excel sin confundirlas.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const suffix = (secret: string, label: string) => {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`El secreto del seed debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
  }
  const digest = createHmac('sha256', secret).update(label).digest();
  let out = '';
  for (let i = 0; i < 8; i += 1) out += ALPHABET[digest[i] % ALPHABET.length];
  return out;
};
const shortCode = (code: string) => code.replace(`${TRAINING_EVENT.codePrefix}-`, '');

// Contraseña de las cuentas con acceso (activas y suspendidas) y contraseña inicial de las pendientes.
export const knownPassword = (code: string, secret: string) => `Munet-${shortCode(code)}-${suffix(secret, `activa:${code}`)}`;
export const initialPassword = (code: string, secret: string) => `Inicial-${shortCode(code)}-${suffix(secret, `inicial:${code}`)}`;

export const passwordFor = (account: Pick<SeedAccount, 'code' | 'state'>, secret: string) =>
  account.state === 'PENDING' ? initialPassword(account.code, secret) : knownPassword(account.code, secret);

export const stateOfParticipant = (n: number): SeedState =>
  n <= ACTIVE_PARTICIPANTS ? 'ACTIVE' : n <= ACTIVE_PARTICIPANTS + PENDING_PARTICIPANTS ? 'PENDING' : 'SUSPENDED';

export const buildRoster = (): SeedAccount[] => {
  const prefix = TRAINING_EVENT.codePrefix;
  const roster: SeedAccount[] = [
    { code: `${prefix}-ADM`, role: 'ADMIN_MUN', state: 'ACTIVE', firstName: 'Instructor', lastName: 'MUNET', alias: 'Instructor', committeeCode: null, delegation: null, institution: INSTITUTION },
    { code: `${prefix}-MOD1`, role: 'MODERATOR', state: 'ACTIVE', firstName: 'Moderadora', lastName: 'Uno', alias: 'Mesa 1', committeeCode: null, delegation: null, institution: INSTITUTION },
    { code: `${prefix}-MOD2`, role: 'MODERATOR', state: 'ACTIVE', firstName: 'Moderador', lastName: 'Dos', alias: 'Mesa 2', committeeCode: null, delegation: null, institution: INSTITUTION },
  ];

  for (let n = 1; n <= PARTICIPANT_COUNT; n += 1) {
    const committee = TRAINING_COMMITTEES[(n - 1) % TRAINING_COMMITTEES.length];
    roster.push({
      code: `${prefix}-${pad(n)}`,
      role: 'PARTICIPANT',
      state: stateOfParticipant(n),
      firstName: FIRST_NAMES[(n - 1) % FIRST_NAMES.length],
      lastName: LAST_NAMES[(n * 7) % LAST_NAMES.length],
      alias: null,
      committeeCode: committee.code,
      delegation: DELEGATIONS[(n - 1) % DELEGATIONS.length],
      institution: INSTITUTION,
    });
  }

  return roster;
};

// ---------------------------------------------------------------------------------------------
// Contenido: lo que se ve al entrar. Los autores se indican por código de cuenta.

export type SeedPost = {
  key: string;
  wall: 'ANNOUNCEMENTS' | 'GENERAL' | { committee: string };
  author: string;
  content: string;
  pinned?: boolean;
  hoursAgo: number;
};

export type SeedComment = { post: string; author: string; content: string; hoursAgo: number; replyTo?: number };

export type SeedPoll = {
  postKey: string;
  wall: 'GENERAL';
  author: string;
  question: string;
  options: string[];
  votes: { voter: string; option: number }[];
  hoursAgo: number;
};

export type SeedDm = { a: string; b: string; messages: { from: 'a' | 'b'; content: string; minutesAfterStart: number }[] };

export type SeedAttachment = {
  post: string;
  kind: 'png' | 'pdf';
  fileName: string;
};

const P = (n: number) => `${TRAINING_EVENT.codePrefix}-${pad(n)}`;
const ADM = `${TRAINING_EVENT.codePrefix}-ADM`;
const MOD1 = `${TRAINING_EVENT.codePrefix}-MOD1`;

export const TRAINING_POSTS: readonly SeedPost[] = [
  {
    key: 'bienvenida', wall: 'ANNOUNCEMENTS', author: ADM, pinned: true, hoursAgo: 72,
    content: '¡Bienvenidas y bienvenidos a MUNET! Este es un evento de entrenamiento: todo lo que hagas aquí es de práctica y no afecta a ningún evento oficial. Explora el muro, comenta, vota en la encuesta y escribe mensajes directos.',
  },
  {
    key: 'guia', wall: 'ANNOUNCEMENTS', author: ADM, pinned: true, hoursAgo: 70,
    content: 'Guía rápida: 1) Los avisos oficiales aparecen en este muro. 2) El muro General es abierto a todo el evento. 3) Cada comité tiene su propio muro. 4) En Directorio puedes buscar a otros delegados y escribirles. Los avisos solo los publica la organización.',
  },
  {
    key: 'presentate', wall: 'GENERAL', author: ADM, hoursAgo: 60,
    content: 'Preséntate en un comentario: tu nombre, tu delegación y qué esperas aprender hoy. Es el primer ejercicio del entrenamiento.',
  },
  {
    key: 'tema-agua', wall: 'GENERAL', author: P(1), hoursAgo: 40,
    content: '¿Alguien tiene ideas para el debate sobre acceso al agua potable? Estoy preparando la posición de mi delegación y me gustaría comparar enfoques.',
  },
  {
    key: 'consejo-discurso', wall: 'GENERAL', author: P(5), hoursAgo: 30,
    content: 'Consejo para el discurso de apertura: dos minutos bastan. Una cifra concreta, una propuesta y una pregunta para el resto de las delegaciones.',
  },
  {
    key: 'recursos', wall: 'GENERAL', author: MOD1, hoursAgo: 26,
    content: 'Adjunto un resumen en PDF con el procedimiento de debate. Haz clic para abrirlo. Cada publicación admite un solo archivo: JPG o PNG hasta 5 MB, o PDF hasta 20 MB.',
  },
  {
    key: 'esquema', wall: 'GENERAL', author: MOD1, hoursAgo: 25,
    content: 'Y aquí el esquema de la sala. Las imágenes se ven directamente en el muro.',
  },
  {
    key: 'ag-agenda', wall: { committee: 'AG' }, author: P(5), hoursAgo: 20,
    content: 'Asamblea General: propongo que la primera sesión trate el tema de seguridad alimentaria y dejemos el desarme para la segunda.',
  },
  {
    key: 'cs-reglas', wall: { committee: 'CS' }, author: P(2), hoursAgo: 18,
    content: 'Consejo de Seguridad: recordatorio de que las resoluciones necesitan nueve votos a favor y ningún veto de los miembros permanentes.',
  },
  {
    key: 'unicef-lectura', wall: { committee: 'UNICEF' }, author: P(3), hoursAgo: 16,
    content: 'UNICEF: dejo el enlace de lectura recomendada sobre educación en emergencias para preparar el documento de posición.',
  },
  {
    key: 'ecosoc-pregunta', wall: { committee: 'ECOSOC' }, author: P(4), hoursAgo: 14,
    content: 'ECOSOC: ¿cómo creen que deberíamos medir el impacto de la cooperación financiera en los países de ingreso medio?',
  },
  {
    key: 'encuesta', wall: 'GENERAL', author: ADM, hoursAgo: 10,
    content: '¿Qué función de MUNET te pareció más útil hasta ahora?',
  },
];

export const TRAINING_POLL: SeedPoll = {
  postKey: 'encuesta',
  wall: 'GENERAL',
  author: ADM,
  question: '¿Qué función de MUNET te pareció más útil hasta ahora?',
  options: ['Los muros de comité', 'Los mensajes directos', 'La encuesta y los votos', 'El directorio de delegados'],
  votes: [
    { voter: P(1), option: 0 }, { voter: P(2), option: 0 }, { voter: P(3), option: 1 },
    { voter: P(4), option: 1 }, { voter: P(5), option: 0 }, { voter: P(6), option: 2 },
    { voter: P(7), option: 3 }, { voter: P(8), option: 1 }, { voter: P(9), option: 0 },
  ],
  hoursAgo: 10,
};

export const TRAINING_COMMENTS: readonly SeedComment[] = [
  { post: 'bienvenida', author: P(1), content: '¡Gracias por la bienvenida! Ya probé el muro General.', hoursAgo: 68 },
  { post: 'bienvenida', author: P(2), content: 'Me encantó poder ver mi comité desde el menú.', hoursAgo: 66 },
  { post: 'presentate', author: P(1), content: 'Hola, soy Ana de Brasil. Quiero aprender a redactar resoluciones.', hoursAgo: 58 },
  { post: 'presentate', author: P(2), content: 'Soy Luis, represento a Japón en el Consejo de Seguridad. Quiero practicar los discursos.', hoursAgo: 57 },
  { post: 'presentate', author: P(3), content: 'María, de Francia. Vengo a conocer cómo funcionan los comités.', hoursAgo: 55 },
  { post: 'presentate', author: ADM, content: '¡Excelente! Sigan presentándose; en la siguiente actividad usaremos la encuesta.', hoursAgo: 54, replyTo: 0 },
  { post: 'tema-agua', author: P(4), content: 'Yo propondría enfocarnos en infraestructura y financiamiento, que suelen ser los puntos de acuerdo.', hoursAgo: 38 },
  { post: 'tema-agua', author: P(6), content: 'Coincido. También conviene citar datos recientes de la ONU sobre acceso al agua.', hoursAgo: 36 },
  { post: 'consejo-discurso', author: P(7), content: 'Muy útil. ¿Y si nos queda tiempo, qué recomiendas cerrar con una pregunta o con la propuesta?', hoursAgo: 28 },
  { post: 'consejo-discurso', author: P(5), content: 'Cierra con la propuesta; la pregunta va al inicio para captar la atención.', hoursAgo: 27, replyTo: 0 },
  { post: 'recursos', author: P(8), content: 'Gracias por el PDF, ahora el procedimiento me queda mucho más claro.', hoursAgo: 24 },
  { post: 'ag-agenda', author: P(9), content: 'De acuerdo con ese orden: seguridad alimentaria primero.', hoursAgo: 19 },
  { post: 'cs-reglas', author: P(6), content: 'Gracias por el recordatorio. ¿Las abstenciones cuentan como votos en contra?', hoursAgo: 17 },
];

export const TRAINING_DMS: readonly SeedDm[] = [
  {
    a: P(1), b: P(2),
    messages: [
      { from: 'a', content: 'Hola Luis, ¿practicamos el discurso de apertura antes de la sesión?', minutesAfterStart: 0 },
      { from: 'b', content: '¡Claro! ¿Te parece en media hora?', minutesAfterStart: 6 },
      { from: 'a', content: 'Perfecto, nos vemos en el muro del comité.', minutesAfterStart: 9 },
    ],
  },
  {
    a: P(3), b: MOD1,
    messages: [
      { from: 'a', content: 'Buenas, ¿puedo subir un documento de posición a mi muro?', minutesAfterStart: 0 },
      { from: 'b', content: 'Sí: usa el botón Adjuntar al publicar. Se admiten PDF e imágenes JPG o PNG.', minutesAfterStart: 4 },
    ],
  },
];

export const TRAINING_ATTACHMENTS: readonly SeedAttachment[] = [
  { post: 'recursos', kind: 'pdf', fileName: 'Procedimiento de debate.pdf' },
  { post: 'esquema', kind: 'png', fileName: 'Esquema de la sala.png' },
];
