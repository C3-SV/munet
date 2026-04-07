import type { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { loadWallsByEvent, mapWallForMembership } from '../services/walls.service';
import { isAdminRole } from '../utils/rbac.utils';

// Resuelve la membership del usuario para el evento solicitado.
const resolveMembershipForEvent = (req: Request, eventId: string) =>
  req.auth?.memberships.find((membership) => membership.eventId === eventId) ?? null;

// Lista muros del evento y agrega flags de acceso/publicación según RBAC.
export const listEventWalls = async (req: Request, res: Response) => {
  try {
    const eventId = String(req.params.eventId);
    const membership = resolveMembershipForEvent(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, name, slug')
      .eq('id', eventId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const walls = await loadWallsByEvent(eventId);
    const wallViews = walls.map((wall) => mapWallForMembership(wall, membership));

    return res.json({
      event,
      membership: {
        id: membership.id,
        role: membership.role,
        committeeId: membership.committeeId,
      },
      walls: wallViews,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron cargar los muros' });
  }
};

// Lista comités del evento con marcador canAccess para UI.
export const listEventCommittees = async (req: Request, res: Response) => {
  try {
    const eventId = String(req.params.eventId);
    const membership = resolveMembershipForEvent(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const { data: committees, error } = await supabaseAdmin
      .from('committees')
      .select('id, event_id, name, code, description, status, sort_order')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return res.json({
      committees: (committees ?? []).map((committee) => ({
        ...committee,
        canAccess:
          isAdminRole(membership.role) || committee.id === membership.committeeId,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron cargar los comites' });
  }
};
