import { supabaseAdmin } from '../lib/supabase';
import { committeeCodeFromName, foldText, ImportCommittee } from '../utils/participant-import.utils';

export type ImportCommitteeRecord = ImportCommittee & { event_id: string };
export type ResolvedImportCommittee =
  | { ok: true; created: boolean; committee: ImportCommitteeRecord }
  | { ok: false; error: string };

// Devuelve el comité activo con ese nombre o lo crea con su muro (mismo criterio
// que createCommittee). Si el muro falla, revierte el comité para no dejarlo sin muro.
// `committees` se actualiza para que las filas siguientes reutilicen el comité creado.
export async function resolveOrCreateImportCommittee(params: {
  eventId: string;
  name: string;
  committees: ImportCommitteeRecord[];
  actorUserId: string | null;
  eventStatus: string | null;
}): Promise<ResolvedImportCommittee> {
  const { eventId, name, committees, actorUserId, eventStatus } = params;
  const key = foldText(name);

  const active = committees.find((c) => c.status !== 'ARCHIVED' && foldText(c.name) === key);
  if (active) return { ok: true, created: false, committee: active };
  if (committees.some((c) => c.status === 'ARCHIVED' && foldText(c.name) === key)) {
    return { ok: false, error: `Comite ${name} esta archivado` };
  }
  if (eventStatus === 'CLOSED' || eventStatus === 'ARCHIVED') {
    return { ok: false, error: 'No se pueden crear comites en un evento cerrado o archivado' };
  }

  const code = committeeCodeFromName(name);
  if (committees.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
    return { ok: false, error: `El codigo ${code} ya lo usa otro comite del evento` };
  }

  const { data: committee, error } = await supabaseAdmin
    .from('committees')
    .insert({
      event_id: eventId,
      name,
      code,
      sort_order: 0,
      status: 'ACTIVE',
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId,
    })
    .select('id, event_id, code, name, status')
    .single();
  if (error || !committee) {
    // Otra importación pudo crearlo entre la lectura y el insert: si está activo, se reutiliza.
    const { data: raced } = await supabaseAdmin
      .from('committees')
      .select('id, event_id, code, name, status')
      .eq('event_id', eventId)
      .eq('name', name)
      .is('deleted_at', null)
      .maybeSingle();
    if (raced && raced.status !== 'ARCHIVED') {
      const record = raced as ImportCommitteeRecord;
      committees.push(record);
      return { ok: true, created: false, committee: record };
    }
    // Un comité eliminado (borrado lógico) sigue reservando nombre y código por las
    // restricciones UNIQUE. Se informa la causa real en vez de un error genérico.
    const { data: deletedByName } = await supabaseAdmin
      .from('committees')
      .select('id')
      .eq('event_id', eventId)
      .eq('name', name)
      .not('deleted_at', 'is', null)
      .limit(1);
    if (deletedByName && deletedByName.length > 0) {
      return { ok: false, error: `Ya existe un comite eliminado con el nombre ${name}; restauralo o cambia el nombre en el CSV` };
    }
    const { data: deletedByCode } = await supabaseAdmin
      .from('committees')
      .select('id')
      .eq('event_id', eventId)
      .eq('code', code)
      .not('deleted_at', 'is', null)
      .limit(1);
    if (deletedByCode && deletedByCode.length > 0) {
      return { ok: false, error: `Ya existe un comite eliminado con el codigo ${code}; restauralo o cambia el nombre en el CSV` };
    }
    console.error('Importacion CSV: no se pudo crear el comite', name, error);
    return { ok: false, error: `No se pudo crear el comite ${name}` };
  }

  const { data: wall, error: wallError } = await supabaseAdmin
    .from('walls')
    .insert({ event_id: eventId, name, wall_type: 'COMMITTEE', committee_id: committee.id, status: 'ACTIVE' })
    .select('id')
    .single();
  if (wallError || !wall) {
    // Borrado físico: el comité acaba de crearse y no tiene hijos. Un borrado lógico
    // dejaría nombre y código reservados por las restricciones UNIQUE.
    const { error: rollbackError } = await supabaseAdmin
      .from('committees')
      .delete()
      .eq('id', committee.id);
    if (rollbackError) console.error('Importacion CSV: no se pudo revertir el comite sin muro', committee.id, rollbackError);
    return { ok: false, error: `No se pudo crear el muro del comite ${name}` };
  }

  const record = committee as ImportCommitteeRecord;
  committees.push(record);
  return { ok: true, created: true, committee: record };
}
