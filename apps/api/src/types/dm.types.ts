export type DmProfileRecord =
  | {
      first_name: string;
      last_name: string;
      display_name: string | null;
      profile_image_path: string | null;
    }
  | {
      first_name: string;
      last_name: string;
      display_name: string | null;
      profile_image_path: string | null;
    }[]
  | null;

export type DmCommitteeRecord =
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

export type DmMembershipRecord = {
  id: string;
  event_id: string;
  role: string;
  delegation_name: string | null;
  institution_name: string | null;
  account_status: string;
  profiles: DmProfileRecord;
  committees: DmCommitteeRecord;
};

export type DmConversationRow = {
  id: string;
  event_id: string;
  participant_a_membership_id: string;
  participant_b_membership_id: string;
  created_by_membership_id: string;
  created_at: string;
  last_message_at: string | null;
  status: string;
  participant_a: DmMembershipRecord | DmMembershipRecord[] | null;
  participant_b: DmMembershipRecord | DmMembershipRecord[] | null;
};

export type DmMessageRow = {
  id: string;
  event_id: string;
  conversation_id: string;
  author_membership_id: string;
  content: string;
  status: string;
  created_at: string;
};

export type DmConversationLatestMessage = {
  id: string;
  conversation_id: string;
  author_membership_id: string;
  content: string;
  created_at: string;
};
