import { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../utils/audit.logger';
import {
  IMPORT_CONFIRM_BATCH_MAX,
  IMPORT_MAX_ROWS,
  IMPORT_TEMPLATE_HEADERS,
  ImportCommittee,
  NormalizedImportRow,
  buildImportPreview,
  validateConfirmRows,
} from '../utils/participant-import.utils';
import { createParticipantAccount } from '../services/participant-account.service';

// Sprint 2 del sitio admin: importacion CSV (S2-05, S2-07) y cambio de
// comite (S2-08). La autorizacion por evento ya la resolvio
// requireEventAdmin en la ruta (ADR-005), que deja req.auth.currentMembership.

const CSV_MAX_CHARS = 2_000_000;
const IMPORT_CONCURRENCY = 5;
const PAGE_SIZE = 1000;

// Las respuestas con contrasenas no se deben guardar en caches ni proxies.
const noStore = (res: Response) => res.setHeader('Cache-Control', 'no-store');

type EventCommittee = ImportCommittee & { event_id: string };

const loadCommittees = async (eventId: string) => {
  const { data, error } = await supabaseAdmin
    .from('committees')
    .select('id, event_id, code, name, status')
    .eq('event_id', eventId)
    .is('deleted_at', null);
  return { committees: (data ?? []) as EventCommittee[], error };
};

// Supabase devuelve como maximo 1000 filas por consulta: se pagina.
const loadExistingCodes = async (eventId: string) => {
  const codes: string[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('event_memberships')
      .select('participant_code')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { codes, error };
    (data ?? []).forEach((row: { participant_code: string | null }) => {
      if (row.participant_code) codes.push(row.participant_code);
    });
    if (!data || data.length < PAGE_SIZE) return { codes, error: null };
  }
};

const loadEvent = async (eventId: string) =>
  supabaseAdmin.from('events').select('id, status').eq('id', eventId).is('deleted_at', null).maybeSingle();

// Carga evento, comites y codigos existentes. Devuelve error HTTP listo si falla.
const loadImportContext = async (eventId: string) => {
  const { data: event, error: eventError } = await loadEvent(eventId);
  if (eventError) return { fail: { status: 500, error: 'No se pudo consultar el evento' } };
  if (!event) return { fail: { status: 404, error: 'Evento no encontrado' } };

  const { committees, error: committeesError } = await loadCommittees(eventId);
  if (committeesError) return { fail: { status: 500, error: 'No se pudieron consultar los comites' } };

  const { codes, error: codesError } = await loadExistingCodes(eventId);
  if (codesError) return { fail: { status: 500, error: 'No se pudieron consultar los participantes' } };

  return { committees, codes };
};

// POST /admin/participants/import/preview  { event_id, csv }
// No escribe nada: valida el archivo y devuelve filas validas, invalidas y
// duplicadas para que el admin revise antes de confirmar.
export const previewParticipantImport = async (req: Request, res: Response) => {
  try {
    const eventId = req.body?.event_id as string;
    const csv = req.body?.csv;

    if (typeof csv !== 'string' || !csv.trim()) {
      return res.status(400).json({ error: 'csv es requerido (texto del archivo)' });
    }
    if (csv.length > CSV_MAX_CHARS) {
      return res.status(413).json({ error: 'El archivo es demasiado grande' });
    }

    const ctx = await loadImportContext(eventId);
    if (ctx.fail) return res.status(ctx.fail.status).json({ error: ctx.fail.error });

    const preview = buildImportPreview(csv, { committees: ctx.committees!, existingParticipantCodes: ctx.codes! });
    if (preview.error) {
      return res.status(400).json({ error: preview.error, template_headers: IMPORT_TEMPLATE_HEADERS });
    }

    return res.json({
      ...preview,
      template_headers: IMPORT_TEMPLATE_HEADERS,
      limits: { max_rows: IMPORT_MAX_ROWS, confirm_batch_max: IMPORT_CONFIRM_BATCH_MAX },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};
type CreatedCredential = {
  row: number;
  membership_id: string;
  participant_code: string;
  delegation_code: string | null;
  first_name: string;
  last_name: string;
  role: string;
  committee_label: string | null;
  alias: string | null;
  initial_password: string;
  warnings: string[];
};

type FailedRow = { row: number; participant_code: string | null; errors: string[] };

// POST /admin/participants/import/confirm  { event_id, rows }
// Crea las filas que vienen del preview, en lotes de hasta 50. El servidor
// vuelve a validar todo: no confia en lo que manda el navegador. Devuelve las
// contrasenas iniciales UNA sola vez (S2-07); no se pueden recuperar despues.
export const confirmParticipantImport = async (req: Request, res: Response) => {
  noStore(res);
  try {
    const actorUserId = req.auth?.userId ?? null;
    const actor = req.auth?.currentMembership;
    const eventId = req.body?.event_id as string;

    const ctx = await loadImportContext(eventId);
    if (ctx.fail) return res.status(ctx.fail.status).json({ error: ctx.fail.error });
    const committees = ctx.committees!;

    const checked = validateConfirmRows(req.body?.rows, { committees, existingParticipantCodes: ctx.codes! });
    if (checked.error) return res.status(400).json({ error: checked.error });

    const committeeById = new Map(committees.map((c) => [c.id, c]));
    const created: CreatedCredential[] = [];
    const failed: FailedRow[] = checked.invalid.map((item) => ({
      row: item.row,
      participant_code: item.participant_code,
      errors: item.errors,
    }));

    const createRow = async (row: NormalizedImportRow) => {
      const result = await createParticipantAccount(
        {
          event_id: eventId,
          participant_code: row.participant_code,
          role: row.role,
          committee_id: row.committee_id,
          delegation_name: row.delegation_name,
          institution_name: row.institution_name,
          first_name: row.first_name,
          last_name: row.last_name,
          alias: row.alias,
        },
        actorUserId,
        {
          committee: row.committee_id ? committeeById.get(row.committee_id) ?? null : null,
          skipCodeCheck: true,
        }
      );

      if (!result.ok) {
        failed.push({ row: row.row, participant_code: row.participant_code, errors: [result.error] });
        return;
      }

      created.push({
        row: row.row,
        membership_id: result.membership.id,
        participant_code: row.participant_code,
        delegation_code: result.delegationCode,
        first_name: row.first_name,
        last_name: row.last_name,
        role: row.role,
        committee_label: row.committee_label,
        alias: row.alias,
        initial_password: result.initialPassword,
        warnings: result.warnings,
      });

      await logAudit({
        eventId,
        membership: actor,
        actorUserId: actorUserId ?? undefined,
        actionType: 'CREATE_ACCOUNT',
        entityType: 'ACCOUNT',
        entityId: result.membership.id,
        outcome: 'SUCCESS',
        reason: `Cuenta creada por importacion CSV (fila ${row.row}) con codigo ${row.participant_code} y rol ${row.role}`,
      });
    };

    // Pocas altas en paralelo: rapido sin saturar la base ni el limite de
    // tiempo de la funcion serverless.
    const queue = [...checked.valid];
    const workers = Array.from({ length: Math.min(IMPORT_CONCURRENCY, queue.length) }, async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        try {
          await createRow(row);
        } catch (error) {
          console.error('Importacion CSV: error inesperado en la fila', row.row, error);
          failed.push({ row: row.row, participant_code: row.participant_code, errors: ['Error interno al crear la cuenta. Revisa si quedo creada antes de reintentar.'] });
        }
      }
    });
    await Promise.all(workers);

    created.sort((a, b) => a.row - b.row);
    failed.sort((a, b) => a.row - b.row);

    await logAudit({
      eventId,
      membership: actor,
      actorUserId: actorUserId ?? undefined,
      actionType: 'IMPORT_PARTICIPANTS',
      entityType: 'EVENT',
      entityId: eventId,
      outcome: failed.length ? 'FAILURE' : 'SUCCESS',
      reason: `Importacion CSV: ${created.length} creadas, ${failed.length} fallidas`,
    });

    return res.json({
      message: 'Importacion procesada',
      summary: { requested: created.length + failed.length, created: created.length, failed: failed.length },
      created,
      failed,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};
type ChangeCommitteeBody = { committee_id?: string | null; reason?: string };

// PATCH /admin/participants/:membershipId/committee  { committee_id, reason? }
// S2-08. El acceso a muros se calcula en cada peticion (requireAuth relee las
// memberships), asi que el delegado ve el muro nuevo en su siguiente peticion.
export const changeParticipantCommittee = async (
  req: Request<{ membershipId: string }, {}, ChangeCommitteeBody>,
  res: Response
) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const { membershipId } = req.params;
    const body = (req.body ?? {}) as ChangeCommitteeBody;

    if (!Object.prototype.hasOwnProperty.call(body, 'committee_id')) {
      return res.status(400).json({ error: 'committee_id es requerido (usa null para quitar el comite)' });
    }
    const committeeId = body.committee_id ?? null;
    if (committeeId !== null && (typeof committeeId !== 'string' || !committeeId.trim())) {
      return res.status(400).json({ error: 'committee_id debe ser un id o null' });
    }
    if (body.reason !== undefined && body.reason !== null && typeof body.reason !== 'string') {
      return res.status(400).json({ error: 'reason debe ser texto' });
    }
    const reason = body.reason?.trim() || null;

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('event_memberships')
      .select('id, event_id, committee_id')
      .eq('id', membershipId)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) return res.status(500).json({ error: 'No se pudo consultar el registro' });
    if (!existing) return res.status(404).json({ error: 'Participante no encontrado' });

    if ((existing.committee_id ?? null) === committeeId) {
      return res.status(400).json({ error: 'El participante ya esta en ese comite' });
    }

    let newCommitteeName: string | null = null;
    if (committeeId) {
      const { data: committee, error: committeeError } = await supabaseAdmin
        .from('committees')
        .select('id, event_id, name, status')
        .eq('id', committeeId)
        .is('deleted_at', null)
        .maybeSingle();

      if (committeeError) return res.status(500).json({ error: 'No se pudo validar el comite' });
      if (!committee) return res.status(404).json({ error: 'Comite no encontrado' });
      if (committee.event_id !== existing.event_id) {
        return res.status(400).json({ error: 'El comite no pertenece al evento de este participante' });
      }
      if (committee.status === 'ARCHIVED') return res.status(400).json({ error: 'El comite esta archivado' });
      newCommitteeName = committee.name;
    }

    const { data: membership, error: updateError } = await supabaseAdmin
      .from('event_memberships')
      .update({ committee_id: committeeId, updated_by_user_id: actorUserId })
      .eq('id', membershipId)
      .select('id, event_id, committee_id')
      .single();

    if (updateError) return res.status(400).json({ error: updateError.message });

    await logAudit({
      eventId: existing.event_id,
      membership: req.auth?.currentMembership,
      actorUserId: actorUserId ?? undefined,
      actionType: 'CHANGE_COMMITTEE',
      entityType: 'MEMBERSHIP',
      entityId: membershipId,
      outcome: 'SUCCESS',
      reason: `Comite ${existing.committee_id ?? 'ninguno'} -> ${committeeId ?? 'ninguno'}${reason ? `. Motivo: ${reason}` : ''}`,
    });

    return res.json({
      message: 'Comite actualizado correctamente',
      membership,
      committee: committeeId ? { id: committeeId, name: newCommitteeName } : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};