import { supabaseAdmin } from '../lib/supabase';
import type { AuthMembership } from '../types/auth-context';
import type { WallRecord } from '../types/posts.types';
import { canAccessCommitteeWall, canPublishInAnnouncements } from '../utils/rbac.utils';
import { buildWallSlug, getWallKind } from '../utils/walls.utils';

export type WallView = {
  id: string;
  eventId: string;
  name: string;
  wallType: string;
  kind: 'general' | 'announcements' | 'committee' | 'other';
  slug: string;
  committeeId: string | null;
  committeeName: string | null;
  committeeCode: string | null;
  canAccess: boolean;
  canPublish: boolean;
};

const firstItem = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export const loadWallsByEvent = async (eventId: string) => {
  const { data: walls, error } = await supabaseAdmin
    .from('walls')
    .select(
      `
        id,
        event_id,
        name,
        wall_type,
        committee_id,
        committees (
          name,
          code
        )
      `
    )
    .eq('status', 'ACTIVE')
    .eq('event_id', eventId);

  if (error) {
    throw new Error(error.message);
  }

  return (walls ?? []) as WallRecord[];
};

export const mapWallForMembership = (
  wall: WallRecord,
  membership: AuthMembership
): WallView => {
  const committee = firstItem(wall.committees);
  const kind = getWallKind(wall);
  const canAccess = canAccessCommitteeWall({
    role: membership.role,
    membershipCommitteeId: membership.committeeId,
    wallCommitteeId: wall.committee_id,
  });
  const canPublish =
    kind === 'announcements' ? canPublishInAnnouncements(membership.role) : canAccess;

  return {
    id: wall.id,
    eventId: wall.event_id,
    name: wall.name,
    wallType: wall.wall_type,
    kind,
    slug: buildWallSlug(wall),
    committeeId: wall.committee_id,
    committeeName: committee?.name ?? null,
    committeeCode: committee?.code ?? null,
    canAccess,
    canPublish,
  };
};
