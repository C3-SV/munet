export type AuthMembership = {
  id: string;
  userId: string;
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
  // Alta de la membresía (timestamptz). Solo sirve para desempatar el orden de selección en la web.
  createdAt: string | null;
};

export type AuthContext = {
  token: string;
  supabaseAuthUserId: string;
  userId: string;
  memberships: AuthMembership[];
  currentMembership?: AuthMembership;
};
