export type AuthUser = {
  id: string;
  email?: string;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
};

export type LoginPayload = {
  participant_code: string;
  event_id: string;
  password: string;
};

export type LoginResponse = {
  session: AuthSession;
  user: AuthUser;
};