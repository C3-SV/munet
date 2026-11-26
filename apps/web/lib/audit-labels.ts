// Textos en español para el registro de auditoría. Los códigos desconocidos se
// muestran tal cual: una acción nueva de la API aparece en crudo, nunca se oculta.

const ACTION_LABELS: ReadonlyMap<string, string> = new Map([
    ["CREATE_POST", "Publicación creada"],
    ["DELETE_POST", "Publicación eliminada"],
    ["POLL_CREATED", "Encuesta creada"],
    ["POLL_CLOSED", "Encuesta cerrada"],
    ["POLL_VOTE", "Voto en encuesta"],
    ["CREATE_COMMENT", "Comentario creado"],
    ["DELETE_COMMENT", "Comentario eliminado"],
    ["CREATE_CONVERSATION", "Conversación creada"],
    ["SEND_DM_MESSAGE", "Mensaje directo enviado"],
    ["DELETE_DM_MESSAGE", "Mensaje directo eliminado"],
    ["UPDATE_PROFILE", "Perfil actualizado"],
    ["UPLOAD_AVATAR", "Avatar subido"],
    ["ADMIN_UPDATE_PROFILE", "Perfil actualizado por administración"],
    ["ADMIN_UPLOAD_AVATAR", "Avatar subido por administración"],
    ["CREATE_EVENT", "Evento creado"],
    ["UPDATE_EVENT", "Evento actualizado"],
    ["CREATE_COMMITTEE", "Comité creado"],
    ["UPDATE_COMMITTEE", "Comité actualizado"],
    ["DELETE_COMMITTEE", "Comité eliminado"],
    ["CREATE_MEMBERSHIP", "Membresía creada"],
    ["CREATE_ACCOUNT", "Cuenta creada"],
    ["UPDATE_PARTICIPANT", "Participante actualizado"],
    ["SUSPEND_ACCOUNT", "Cuenta suspendida"],
    ["REACTIVATE_ACCOUNT", "Cuenta reactivada"],
    ["RESET_PASSWORD", "Contraseña restablecida"],
    ["CHANGE_COMMITTEE", "Comité cambiado"],
    ["CHANGE_ROLE", "Rol cambiado"],
    ["PIN_POST", "Publicación fijada"],
    ["UNPIN_POST", "Publicación desfijada"],
    ["HIDE_POST", "Publicación ocultada"],
    ["UNHIDE_POST", "Publicación restaurada"],
    ["HIDE_COMMENT", "Comentario ocultado"],
    ["UNHIDE_COMMENT", "Comentario restaurado"],
    ["MODERATE_DELETE_POST", "Publicación eliminada por moderación"],
    ["MODERATE_DELETE_COMMENT", "Comentario eliminado por moderación"],
    ["IMPORT_PARTICIPANTS", "Participantes importados"],
    ["UPLOAD_ATTACHMENT", "Adjunto subido"],
    ["DELETE_ATTACHMENT", "Adjunto eliminado"],
    ["MODERATE_DELETE_ATTACHMENT", "Adjunto retirado por moderación"],
    ["ACCESS_DENIED", "Acceso denegado"],
]);

const ENTITY_LABELS: ReadonlyMap<string, string> = new Map([
    ["POST", "Publicación"],
    ["POLL", "Encuesta"],
    ["POLL_VOTE", "Voto"],
    ["COMMENT", "Comentario"],
    ["DM_CONVERSATION", "Conversación"],
    ["DM_MESSAGE", "Mensaje directo"],
    ["PROFILE", "Perfil"],
    ["AVATAR", "Avatar"],
    ["EVENT", "Evento"],
    ["COMMITTEE", "Comité"],
    ["MEMBERSHIP", "Membresía"],
    ["ACCOUNT", "Cuenta"],
    ["ATTACHMENT", "Adjunto"],
]);

const OUTCOME_LABELS: ReadonlyMap<string, string> = new Map([
    ["SUCCESS", "Correcto"],
    ["FAILURE", "Fallido"],
    ["DENIED", "Denegado"],
]);

// Un valor vacío se muestra como raya; uno desconocido, sin cambios.
const translate = (labels: ReadonlyMap<string, string>, code: string | null | undefined): string => {
    const value = (code ?? "").trim();

    if (!value) {
        return "—";
    }

    return labels.get(value) ?? value;
};

export const formatAuditAction = (actionType: string | null | undefined): string =>
    translate(ACTION_LABELS, actionType);

export const formatAuditEntity = (entityType: string | null | undefined): string =>
    translate(ENTITY_LABELS, entityType);

export const formatAuditOutcome = (outcome: string | null | undefined): string =>
    translate(OUTCOME_LABELS, outcome);
