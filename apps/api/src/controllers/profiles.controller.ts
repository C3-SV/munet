import type { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';

type MembershipProfileRow = {
  id: string;
  event_id: string;
  role: string;
  delegation_name: string | null;
  institution_name: string | null;
  account_status: string;
  participant_code: string;
  profiles:
    | {
        id: string;
        first_name: string;
        last_name: string;
        display_name: string | null;
        bio: string | null;
        profile_image_path: string | null;
      }
    | {
        id: string;
        first_name: string;
        last_name: string;
        display_name: string | null;
        bio: string | null;
        profile_image_path: string | null;
      }[]
    | null;
  committees:
    | {
        id: string;
        name: string;
        code: string;
      }
    | {
        id: string;
        name: string;
        code: string;
      }[]
    | null;
  users:
    | {
        email: string | null;
      }
    | {
        email: string | null;
      }[]
    | null;
};

const firstItem = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const getActiveEventId = (req: Request) => req.header('x-event-id')?.trim();

const getActiveMembership = (req: Request) => {
  const eventId = getActiveEventId(req);

  if (!eventId) {
    return null;
  }

  return req.auth?.memberships.find((membership) => membership.eventId === eventId) ?? null;
};

const loadMembershipProfile = async (membershipId: string, eventId: string) => {
  const { data, error } = await supabaseAdmin
    .from('event_memberships')
    .select(
      `
        id,
        event_id,
        role,
        delegation_name,
        institution_name,
        account_status,
        participant_code,
        profiles (
          id,
          first_name,
          last_name,
          display_name,
          bio,
          profile_image_path
        ),
        committees (
          id,
          name,
          code
        ),
        users (
          email
        )
      `
    )
    .eq('id', membershipId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MembershipProfileRow | null) ?? null;
};

const formatProfileResponse = (row: MembershipProfileRow) => {
  const profile = firstItem(row.profiles);
  const committee = firstItem(row.committees);
  const user = firstItem(row.users);

  const firstName = profile?.first_name ?? '';
  const lastName = profile?.last_name ?? '';
  const fallbackName = `${firstName} ${lastName}`.trim() || 'Participante';
  const displayName = profile?.display_name?.trim() || fallbackName;

  return {
    membershipId: row.id,
    eventId: row.event_id,
    role: row.role,
    accountStatus: row.account_status,
    participantCode: row.participant_code,
    delegationName: row.delegation_name,
    institutionName: row.institution_name,
    committee: committee
      ? {
          id: committee.id,
          name: committee.name,
          code: committee.code,
        }
      : null,
    profile: {
      id: profile?.id ?? null,
      firstName,
      lastName,
      displayName,
      bio: profile?.bio ?? '',
      avatar:
        profile?.profile_image_path ??
        'https://ui-avatars.com/api/?name=Participante&background=E5E7EB&color=111827',
    },
    email: user?.email ?? null,
  };
};

export const getMyProfile = async (req: Request, res: Response) => {
  try {
    const activeMembership = getActiveMembership(req);

    if (!activeMembership) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const row = await loadMembershipProfile(activeMembership.id, activeMembership.eventId);

    if (!row) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    return res.json({ profile: formatProfileResponse(row) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo cargar tu perfil' });
  }
};

export const updateMyProfile = async (req: Request, res: Response) => {
  try {
    const activeMembership = getActiveMembership(req);

    if (!activeMembership) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const { display_name, bio, profile_image_path } = req.body as {
      display_name?: string;
      bio?: string;
      profile_image_path?: string;
    };

    const existing = await loadMembershipProfile(activeMembership.id, activeMembership.eventId);

    if (!existing) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const profile = firstItem(existing.profiles);

    if (!profile?.id) {
      return res.status(404).json({ error: 'No hay registro de perfil para editar' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        display_name: display_name ?? profile.display_name,
        bio: bio ?? profile.bio,
        profile_image_path: profile_image_path ?? profile.profile_image_path,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (error) {
      throw new Error(error.message);
    }

    const updated = await loadMembershipProfile(activeMembership.id, activeMembership.eventId);

    if (!updated) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    return res.json({ profile: formatProfileResponse(updated) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo actualizar tu perfil' });
  }
};

export const getPublicProfile = async (req: Request, res: Response) => {
  try {
    const activeMembership = getActiveMembership(req);

    if (!activeMembership) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const targetMembershipId = String(req.params.membershipId);
    const row = await loadMembershipProfile(targetMembershipId, activeMembership.eventId);

    if (!row) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const profile = formatProfileResponse(row);

    return res.json({
      profile: {
        membershipId: profile.membershipId,
        eventId: profile.eventId,
        role: profile.role,
        delegationName: profile.delegationName,
        institutionName: profile.institutionName,
        committee: profile.committee,
        profile: profile.profile,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo cargar el perfil publico' });
  }
};
