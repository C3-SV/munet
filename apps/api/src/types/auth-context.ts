export type AuthMembership = {
  id: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  eventStatus: string;
  role: string;
  committeeId: string | null;
  committeeName: string | null;
  committeeCode: string | null;
  participantCode: string;
  accountStatus: string;
};

export type AuthContext = {
  token: string;
  supabaseAuthUserId: string;
  userId: string;
  memberships: AuthMembership[];
};
