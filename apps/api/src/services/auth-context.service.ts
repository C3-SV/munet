import { supabaseAdmin } from '../lib/supabase';
import type { AuthMembership } from '../types/auth-context';

type MembershipRow = {
  id: string;
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
      }
    | {
        id: string;
        name: string;
        slug: string;
        status: string;
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
        event_id,
        role,
        committee_id,
        participant_code,
        account_status,
        events (
          id,
          name,
          slug,
          status
        ),
        committees (
          id,
          name,
          code
        )
      `
    )
    .eq('user_id', userId)
    .eq('account_status', 'ACTIVE');

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as MembershipRow[]).map((row): AuthMembership => {
    const event = firstItem(row.events);
    const committee = firstItem(row.committees);

    return {
      id: row.id,
      eventId: row.event_id,
      eventName: event?.name ?? 'Evento',
      eventSlug: event?.slug ?? '',
      eventStatus: event?.status ?? 'UNKNOWN',
      role: row.role,
      committeeId: row.committee_id,
      committeeName: committee?.name ?? null,
      committeeCode: committee?.code ?? null,
      participantCode: row.participant_code,
      accountStatus: row.account_status,
    };
  });
};
