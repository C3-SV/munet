import type { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../utils/audit.logger';
import { isAdminRole } from '../utils/rbac.utils';

type MembershipProfileRow = {
  id: string;
  event_id: string;
  role: string;
  committee_id: string | null;
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
        deleted_at?: string | null;
      }
    | {
        id: string;
        name: string;
        code: string;
        deleted_at?: string | null;
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

const PROFILE_IMAGES_BUCKET =
  process.env.SUPABASE_PROFILE_IMAGES_BUCKET?.trim() || 'profile-images';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const extractStorageObjectPath = (publicUrl: string | null | undefined, bucket: string) => {
  if (!publicUrl) {
    return null;
  }

  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  return publicUrl.slice(markerIndex + marker.length);
};

const extensionFromMimeType = (mimeType: string) => {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
};

const loadMembershipProfile = async (membershipId: string, eventId: string) => {
  const { data, error } = await supabaseAdmin
    .from('event_memberships')
    .select(
      `
        id,
        event_id,
        role,
        committee_id,
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
          code,
          deleted_at
        ),
        users (
          email
        )
      `
    )
    .eq('id', membershipId)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MembershipProfileRow | null) ?? null;
};

const formatProfileResponse = (row: MembershipProfileRow) => {
  const profile = firstItem(row.profiles);
  const committee = firstItem(row.committees);
  const visibleCommittee = committee?.deleted_at ? null : committee;
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
    committee: visibleCommittee
      ? {
          id: visibleCommittee.id,
          name: visibleCommittee.name,
          code: visibleCommittee.code,
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

const hasOwn = (payload: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(payload, key);

const normalizeNullableText = (value: unknown) => {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const requireAdminMembership = (req: Request) => {
  const activeMembership = getActiveMembership(req);

  if (!activeMembership) {
    return { error: 'x-event-id es requerido' } as const;
  }

  if (!isAdminRole(activeMembership.role)) {
    return { error: 'No tienes permisos para editar perfiles de terceros' } as const;
  }

  return { membership: activeMembership } as const;
};

const validateCommitteeForEvent = async (eventId: string, committeeId: string) => {
  const { data: committee, error } = await supabaseAdmin
    .from('committees')
    .select('id')
    .eq('id', committeeId)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(committee);
};

const uploadAvatarForMembership = async (params: {
  eventId: string;
  membershipId: string;
  actorMembershipId?: string;
  fileName?: string;
  mimeType?: string;
  base64Data?: string;
}) => {
  const mimeType = params.mimeType?.trim().toLowerCase();

  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      status: 400,
      body: { error: 'Formato de imagen no permitido' },
    } as const;
  }

  if (!params.base64Data?.trim()) {
    return {
      status: 400,
      body: { error: 'No se recibio el archivo a subir' },
    } as const;
  }

  const decoded = Buffer.from(params.base64Data, 'base64');

  if (!decoded.length || decoded.length > MAX_AVATAR_BYTES) {
    return {
      status: 400,
      body: { error: 'La imagen debe tener un tamano maximo de 5MB' },
    } as const;
  }

  const existing = await loadMembershipProfile(params.membershipId, params.eventId);

  if (!existing) {
    return {
      status: 404,
      body: { error: 'Perfil no encontrado' },
    } as const;
  }

  const profile = firstItem(existing.profiles);

  if (!profile?.id) {
    return {
      status: 404,
      body: { error: 'No hay registro de perfil para editar' },
    } as const;
  }

  const extension = extensionFromMimeType(mimeType);
  const safeNameToken =
    (params.fileName ?? 'avatar')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 32) || 'avatar';
  const objectPath = `${params.eventId}/${params.membershipId}/${Date.now()}-${safeNameToken}.${extension}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(PROFILE_IMAGES_BUCKET)
    .upload(objectPath, decoded, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(PROFILE_IMAGES_BUCKET)
    .getPublicUrl(objectPath);
  const publicUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      profile_image_path: publicUrl,
      updated_at: new Date().toISOString(),
      updated_by_membership_id: params.actorMembershipId ?? null,
    })
    .eq('id', profile.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const previousObjectPath = extractStorageObjectPath(
    profile.profile_image_path,
    PROFILE_IMAGES_BUCKET
  );

  if (previousObjectPath && previousObjectPath !== objectPath) {
    await supabaseAdmin.storage.from(PROFILE_IMAGES_BUCKET).remove([previousObjectPath]);
  }

  const updated = await loadMembershipProfile(params.membershipId, params.eventId);

  if (!updated) {
    return {
      status: 404,
      body: { error: 'Perfil no encontrado' },
    } as const;
  }

  return {
    status: 200,
    body: {
      profile: formatProfileResponse(updated),
    },
  } as const;
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
        updated_by_membership_id: activeMembership.id,
      })
      .eq('id', profile.id);

    if (error) {
      throw new Error(error.message);
    }

    const updated = await loadMembershipProfile(activeMembership.id, activeMembership.eventId);

    if (!updated) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    await logAudit({
      eventId: activeMembership.eventId,
      membership: activeMembership,
      actionType: 'UPDATE_PROFILE',
      entityType: 'PROFILE',
      entityId: activeMembership.id,
      outcome: 'SUCCESS',
      reason: 'Perfil propio actualizado',
    });

    return res.json({ profile: formatProfileResponse(updated) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo actualizar tu perfil' });
  }
};

export const updatePublicProfileAsAdmin = async (req: Request, res: Response) => {
  try {
    const adminContext = requireAdminMembership(req);

    if ('error' in adminContext) {
      const status = adminContext.error === 'x-event-id es requerido' ? 400 : 403;
      return res.status(status).json({ error: adminContext.error });
    }

    const targetMembershipId = String(req.params.membershipId ?? '').trim();

    if (!targetMembershipId) {
      return res.status(400).json({ error: 'membershipId es requerido' });
    }

    const payload = (req.body ?? {}) as Record<string, unknown>;

    if (hasOwn(payload, 'role')) {
      return res.status(400).json({ error: 'El rol no se puede editar desde este endpoint' });
    }

    const existing = await loadMembershipProfile(
      targetMembershipId,
      adminContext.membership.eventId
    );

    if (!existing) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const profile = firstItem(existing.profiles);

    if (!profile?.id) {
      return res.status(404).json({ error: 'No hay registro de perfil para editar' });
    }

    const firstNameCandidate = hasOwn(payload, 'first_name')
      ? normalizeNullableText(payload.first_name)
      : profile.first_name;
    const lastNameCandidate = hasOwn(payload, 'last_name')
      ? normalizeNullableText(payload.last_name)
      : profile.last_name;

    if (!firstNameCandidate) {
      return res.status(400).json({ error: 'first_name no puede estar vacio' });
    }

    if (!lastNameCandidate) {
      return res.status(400).json({ error: 'last_name no puede estar vacio' });
    }

    let committeeIdToSave = existing.committee_id;
    if (hasOwn(payload, 'committee_id')) {
      const rawCommittee = payload.committee_id;
      committeeIdToSave =
        typeof rawCommittee === 'string' && rawCommittee.trim().length > 0
          ? rawCommittee.trim()
          : null;

      if (committeeIdToSave) {
        const committeeExists = await validateCommitteeForEvent(
          adminContext.membership.eventId,
          committeeIdToSave
        );

        if (!committeeExists) {
          return res
            .status(400)
            .json({ error: 'El comite seleccionado no pertenece al evento actual' });
        }
      }
    }

    const profileUpdate = {
      first_name: firstNameCandidate,
      last_name: lastNameCandidate,
      display_name: hasOwn(payload, 'display_name')
        ? normalizeNullableText(payload.display_name)
        : profile.display_name,
      bio: hasOwn(payload, 'bio') ? normalizeNullableText(payload.bio) : profile.bio,
      updated_at: new Date().toISOString(),
      updated_by_membership_id: adminContext.membership.id,
    };

    const membershipUpdate = {
      delegation_name: hasOwn(payload, 'delegation_name')
        ? normalizeNullableText(payload.delegation_name)
        : existing.delegation_name,
      institution_name: hasOwn(payload, 'institution_name')
        ? normalizeNullableText(payload.institution_name)
        : existing.institution_name,
      committee_id: committeeIdToSave,
      updated_at: new Date().toISOString(),
      updated_by_user_id: adminContext.membership.userId,
    };

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', profile.id);

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: membershipError } = await supabaseAdmin
      .from('event_memberships')
      .update(membershipUpdate)
      .eq('id', targetMembershipId)
      .eq('event_id', adminContext.membership.eventId)
      .is('deleted_at', null);

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    const updated = await loadMembershipProfile(
      targetMembershipId,
      adminContext.membership.eventId
    );

    if (!updated) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    await logAudit({
      eventId: adminContext.membership.eventId,
      membership: adminContext.membership,
      actionType: 'ADMIN_UPDATE_PROFILE',
      entityType: 'PROFILE',
      entityId: targetMembershipId,
      outcome: 'SUCCESS',
      reason: `Admin actualizo perfil de participante ${targetMembershipId}`,
    });

    return res.json({ profile: formatProfileResponse(updated) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo actualizar el perfil del participante' });
  }
};

export const uploadMyAvatar = async (req: Request, res: Response) => {
  try {
    const activeMembership = getActiveMembership(req);

    if (!activeMembership) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const { file_name, mime_type, base64_data } = req.body as {
      file_name?: string;
      mime_type?: string;
      base64_data?: string;
    };

    const result = await uploadAvatarForMembership({
      eventId: activeMembership.eventId,
      membershipId: activeMembership.id,
      actorMembershipId: activeMembership.id,
      fileName: file_name,
      mimeType: mime_type,
      base64Data: base64_data,
    });

    if (result.status === 200) {
      await logAudit({
        eventId: activeMembership.eventId,
        membership: activeMembership,
        actionType: 'UPLOAD_AVATAR',
        entityType: 'AVATAR',
        entityId: activeMembership.id,
        outcome: 'SUCCESS',
        reason: 'Avatar propio actualizado',
      });
    }

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo subir la foto de perfil' });
  }
};

export const uploadPublicAvatarAsAdmin = async (req: Request, res: Response) => {
  try {
    const adminContext = requireAdminMembership(req);

    if ('error' in adminContext) {
      const status = adminContext.error === 'x-event-id es requerido' ? 400 : 403;
      return res.status(status).json({ error: adminContext.error });
    }

    const targetMembershipId = String(req.params.membershipId ?? '').trim();

    if (!targetMembershipId) {
      return res.status(400).json({ error: 'membershipId es requerido' });
    }

    const { file_name, mime_type, base64_data } = req.body as {
      file_name?: string;
      mime_type?: string;
      base64_data?: string;
    };

    const result = await uploadAvatarForMembership({
      eventId: adminContext.membership.eventId,
      membershipId: targetMembershipId,
      actorMembershipId: adminContext.membership.id,
      fileName: file_name,
      mimeType: mime_type,
      base64Data: base64_data,
    });

    if (result.status === 200) {
      await logAudit({
        eventId: adminContext.membership.eventId,
        membership: adminContext.membership,
        actionType: 'ADMIN_UPLOAD_AVATAR',
        entityType: 'AVATAR',
        entityId: targetMembershipId,
        outcome: 'SUCCESS',
        reason: `Admin actualizo avatar de participante ${targetMembershipId}`,
      });
    }

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo subir la foto de perfil del participante' });
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
