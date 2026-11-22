export type AuthUser = {
  id: string;
  email?: string;
};

export type MembershipSummary = {
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
  // Alta de la membresía (ISO). Solo desempata el orden de selección; falta en datos guardados antes de este campo.
  createdAt?: string | null;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
};

export type LoginPayload = {
  participant_code: string;
  password: string;
};

export type LoginResponse = {
  session: AuthSession;
  user: AuthUser;
  memberships: MembershipSummary[];
};
