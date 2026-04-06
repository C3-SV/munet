import type {
  DmConversationLatestMessage,
  DmConversationRow,
  DmMembershipRecord,
  DmMessageRow,
} from '../types/dm.types';
import { firstItem, getProfileName } from './posts.utils';

const avatarForName = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=E5E7EB&color=111827`;

export const DM_MEMBERSHIP_SELECT = `
  id,
  event_id,
  role,
  delegation_name,
  institution_name,
  account_status,
  profiles (
    first_name,
    last_name,
    display_name,
    profile_image_path
  ),
  committees (
    id,
    name,
    code
  )
`;

export const DM_CONVERSATION_SELECT = `
  id,
  event_id,
  participant_a_membership_id,
  participant_b_membership_id,
  created_by_membership_id,
  created_at,
  last_message_at,
  status,
  participant_a:event_memberships!dm_conversations_participant_a_membership_id_fkey (
    ${DM_MEMBERSHIP_SELECT}
  ),
  participant_b:event_memberships!dm_conversations_participant_b_membership_id_fkey (
    ${DM_MEMBERSHIP_SELECT}
  )
`;

export const mapDmParticipant = (membership: DmMembershipRecord | null) => {
  const profile = firstItem(membership?.profiles);
  const committee = firstItem(membership?.committees);
  const name = getProfileName(profile);

  return {
    id: membership?.id ?? 'unknown',
    name,
    avatar: profile?.profile_image_path ?? avatarForName(name),
    role: membership?.role ?? 'DELEGADO',
    committee: committee?.name ?? committee?.code ?? 'Sin comite',
    lastActive: 'Activo',
    delegationName: membership?.delegation_name ?? null,
    institutionName: membership?.institution_name ?? null,
  };
};

export const mapDmMessage = (message: DmMessageRow) => ({
  id: message.id,
  conversationId: message.conversation_id,
  text: message.content,
  senderId: message.author_membership_id,
  createdAt: message.created_at,
  timestamp: new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  }),
});

export const mapDmConversation = (
  conversation: DmConversationRow,
  currentMembershipId: string,
  latestMessage?: DmConversationLatestMessage
) => {
  const participantA = firstItem(conversation.participant_a);
  const participantB = firstItem(conversation.participant_b);
  const otherParticipant =
    conversation.participant_a_membership_id === currentMembershipId
      ? participantB
      : participantA;

  return {
    id: conversation.id,
    eventId: conversation.event_id,
    status: conversation.status,
    createdAt: conversation.created_at,
    lastMessageAt: latestMessage?.created_at ?? conversation.last_message_at,
    otherParticipant: mapDmParticipant(otherParticipant),
    lastMessage: latestMessage?.content ?? null,
    lastMessageAuthorId: latestMessage?.author_membership_id ?? null,
  };
};
