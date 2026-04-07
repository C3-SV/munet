import { supabaseAdmin } from '../lib/supabase';
import type { AuthMembership } from '../types/auth-context';

type MembershipRow = {
  id: string;
  user_id: string;
  event_id: string;
  role: string;
  committee_id: string | null;
  participant_code: string;
  account_status: string;
  events:
    | {
        id: string;
        name: string;
        slug: string;
        status: string;
        deleted_at: string | null;
      }
    | {
        id: string;
        name: string;
        slug: string;
        status: string;
        deleted_at: string | null;
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
};

const firstItem = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export const getUserBySupabaseAuthId = async (supabaseAuthUserId: string) => {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, supabase_auth_user_id, email')
    .eq('supabase_auth_user_id', supabaseAuthUserId)
    .single();

  if (error || !user) {
    return null;
  }

  return user;
};

export const getMembershipsByUserId = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('event_memberships')
    .select(
      `
        id,
        user_id,
        event_id,
        role,
        committee_id,
        participant_code,
        account_status,
        events (
          id,
          name,
          slug,
          status,
          deleted_at
        ),
        committees (
          id,
          name,
          code,
          deleted_at
        )
      `
    )
    .eq('user_id', userId)
    .eq('account_status', 'ACTIVE')
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as MembershipRow[])
    .map((row) => {
      const event = firstItem(row.events);
      const committee = firstItem(row.committees);
      const visibleCommittee = committee?.deleted_at ? null : committee;

      if (!event || event.deleted_at) {
        return null;
      }

      return {
        id: row.id,
        userId: row.user_id,
        eventId: row.event_id,
        eventName: event.name ?? 'Evento',
        eventSlug: event.slug ?? '',
        eventStatus: event.status ?? 'UNKNOWN',
        role: row.role,
        committeeId: row.committee_id,
        committeeName: visibleCommittee?.name ?? null,
        committeeCode: visibleCommittee?.code ?? null,
        participantCode: row.participant_code,
        accountStatus: row.account_status,
      } satisfies AuthMembership;
    })
    .filter((membership): membership is AuthMembership => Boolean(membership));
};
