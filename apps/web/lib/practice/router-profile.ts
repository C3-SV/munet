import type { MyProfile } from "../../types/common.ts";
import { PRACTICE_LIMIT_MESSAGES, PRACTICE_LIMITS } from "./limits.ts";
import { bodyOf, PracticeRequestError, textOf, type PracticeRouteContext } from "./router-shared.ts";
import { toMyProfile } from "./views.ts";

// Edición del perfil propio y de su foto. Todo se valida antes de tocar `state.profile`.

// Campos que la persona no puede cambiar desde su perfil; el orden es el de la lista del mensaje.
const PROTECTED_FIELDS = ["role", "participant_code", "delegation_code", "committee_id"] as const;
const ALIAS_MAX_LENGTH = 60;
const AVATAR_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

const PROTECTED_PREFIX = "No puedes modificar estos campos: ";
const ALIAS_TEXT_MESSAGE = "alias debe ser texto";
const ALIAS_LENGTH_MESSAGE = `alias admite hasta ${ALIAS_MAX_LENGTH} caracteres`;
const AVATAR_FORMAT_MESSAGE = "Formato de imagen no permitido";
// Datos ausentes, vacíos o que no son base64 válido: no llegó un archivo utilizable.
const NO_FILE_MESSAGE = "No se recibio el archivo a subir";

// Cambios a aplicar. Un campo ausente (undefined) no cambia el perfil.
type ProfilePatch = {
    displayName?: string | null;
    alias?: string | null;
    bio?: string;
};

const hasOwn = (object: Record<string, unknown>, key: string): boolean =>
    Object.prototype.hasOwnProperty.call(object, key);

// Alias: null, undefined o solo espacios quitan el alias; de más de 60 caracteres (sin espacios de los
// extremos) o no texto, 400.
const aliasOf = (raw: unknown): string | null => {
    if (raw === null || raw === undefined) {
        return null;
    }
    if (typeof raw !== "string") {
        throw new PracticeRequestError(400, ALIAS_TEXT_MESSAGE);
    }
    const trimmed = raw.trim();
    if (trimmed.length > ALIAS_MAX_LENGTH) {
        throw new PracticeRequestError(400, ALIAS_LENGTH_MESSAGE);
    }
    return trimmed === "" ? null : trimmed;
};

// Cambios del cuerpo. Solo se leen campos con el tipo que les toca: un nombre que no es texto se ignora.
// display_name vacío vuelve al nombre de la persona (null); bio se guarda tal cual; profile_image_path no existe en la práctica.
const patchOf = (input: Record<string, unknown>): ProfilePatch => {
    const patch: ProfilePatch = {};
    if (hasOwn(input, "alias")) {
        patch.alias = aliasOf(input.alias);
    }
    if (typeof input.display_name === "string") {
        const name = input.display_name.trim();
        patch.displayName = name === "" ? null : name;
    }
    if (typeof input.bio === "string") {
        patch.bio = input.bio;
    }
    return patch;
};

// PATCH /profiles/me: aplica los cambios permitidos y devuelve el perfil completo.
export const handleProfileUpdate = (context: PracticeRouteContext): { profile: MyProfile } => {
    const { state } = context;
    const input = bodyOf(context.body);
    const protectedFields = PROTECTED_FIELDS.filter((field) => hasOwn(input, field));
    if (protectedFields.length > 0) {
        throw new PracticeRequestError(400, `${PROTECTED_PREFIX}${protectedFields.join(", ")}`);
    }
    // Validación completa antes de escribir: si algo falla, el perfil queda como estaba.
    const patch = patchOf(input);
    if (patch.displayName !== undefined) {
        state.profile.displayName = patch.displayName;
    }
    if (patch.alias !== undefined) {
        state.profile.alias = patch.alias;
    }
    if (patch.bio !== undefined) {
        state.profile.bio = patch.bio;
    }
    context.wrote = true;
    return { profile: toMyProfile(state) };
};

// Bytes que ocupa un base64 ya comprobado, sin decodificarlo; null si no es base64 válido.
const decodedBase64Bytes = (data: string): number | null => {
    if (data.length % 4 !== 0 || !BASE64_PATTERN.test(data)) {
        return null;
    }
    const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
    return (data.length / 4) * 3 - padding;
};

// POST /profiles/me/avatar: guarda la foto como data URI en el perfil propio.
export const handleAvatarUpload = (context: PracticeRouteContext): { profile: MyProfile } => {
    const { state } = context;
    const input = bodyOf(context.body);
    const mimeType = textOf(input.mime_type).trim().toLowerCase();
    if (!AVATAR_TYPES.includes(mimeType)) {
        throw new PracticeRequestError(400, AVATAR_FORMAT_MESSAGE);
    }
    const data = textOf(input.base64_data).trim();
    if (data === "") {
        throw new PracticeRequestError(400, NO_FILE_MESSAGE);
    }
    const bytes = decodedBase64Bytes(data);
    if (bytes === null) {
        throw new PracticeRequestError(400, NO_FILE_MESSAGE);
    }
    if (bytes > PRACTICE_LIMITS.maxAvatarBytes) {
        throw new PracticeRequestError(400, PRACTICE_LIMIT_MESSAGES.avatarSize);
    }

    state.profile.avatar = `data:${mimeType};base64,${data}`;
    context.wrote = true;
    return { profile: toMyProfile(state) };
};
