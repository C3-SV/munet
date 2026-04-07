import { supabaseAdmin } from '../lib/supabase';
import type { AuthMembership } from '../types/auth-context';
import type {
  DmConversationLatestMessage,
  DmConversationRow,
  DmMembershipRecord,
  DmMessageRow,
} from '../types/dm.types';
import { logAudit } from '../utils/audit.logger';
import {
  DM_CONVERSATION_SELECT,
  DM_MEMBERSHIP_SELECT,
  mapDmConversation,
  mapDmMessage,
  mapDmParticipant,
} from '../utils/dm.utils';
import { normalize } from '../utils/posts.utils';

const DELETED_DM_MESSAGE_STATUSES = [
  process.env.DM_DELETED_MESSAGE_STATUS?.trim(),
  'DELETED_BY_AUTHOR',
  'ELIMINADO_AUTOR',
  'DELETED',
  'ELIMINADO',
].filter((status): status is string => Boolean(status));

const logDmMessageDeletionAudit = async (params: {
  eventId: string;
  membership: AuthMembership;
  messageId: string;
  outcome: 'SUCCESS' | 'FAILURE';
  reason: string;
}) => {
  await logAudit({
    eventId: params.eventId,
    membership: params.membership,
    actionType: 'DELETE_DM_MESSAGE',
    entityType: 'DM_MESSAGE',
    entityId: params.messageId,
    outcome: params.outcome,
    reason: params.reason,
  });
};

const findConversationForMembership = async (params: {
  conversationId: string;
  eventId: string;
  membershipId: string;
}) => {
  const { data: conversation, error } = await supabaseAdmin
    .from('dm_conversations')
    .select('id, event_id, participant_a_membership_id, participant_b_membership_id, status')
    .eq('id', params.conversationId)
    .eq('event_id', params.eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!conversation) {
    return {
      allowed: false as const,
      status: 404,
      error: 'Conversacion no encontrada',
    };
  }

  const isParticipant =
    conversation.participant_a_membership_id === params.membershipId ||
    conversation.participant_b_membership_id === params.membershipId;

  if (!isParticipant) {
    return {
      allowed: false as const,
      status: 403,
      error: 'No perteneces a esta conversacion',
    };
  }

  if (conversation.status !== 'ACTIVE') {
    return {
      allowed: false as const,
      status: 403,
      error: 'La conversacion no esta activa',
    };
  }

  return {
    allowed: true as const,
    conversation,
  };
};

const loadLatestMessagesByConversation = async (conversationIds: string[]) => {
  if (conversationIds.length === 0) {
    return new Map<string, DmConversationLatestMessage>();
  }

  const { data, error } = await supabaseAdmin
    .from('dm_messages')
    .select('id, conversation_id, author_membership_id, content, created_at')
    .in('conversation_id', conversationIds)
    .eq('status', 'VISIBLE')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const latestByConversation = new Map<string, DmConversationLatestMessage>();

  ((data ?? []) as DmConversationLatestMessage[]).forEach((message) => {
    if (!latestByConversation.has(message.conversation_id)) {
      latestByConversation.set(message.conversation_id, message);
    }
  });

  return latestByConversation;
};

export const listDmConversations = async (params: {
  eventId: string;
  membership: AuthMembership;
}) => {
  const { data, error } = await supabaseAdmin
    .from('dm_conversations')
    .select(DM_CONVERSATION_SELECT)
    .eq('event_id', params.eventId)
    .eq('status', 'ACTIVE')
    .or(
      `participant_a_membership_id.eq.${params.membership.id},participant_b_membership_id.eq.${params.membership.id}`
    )
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const conversations = (data ?? []) as DmConversationRow[];
  const latestMessages = await loadLatestMessagesByConversation(
    conversations.map((conversation) => conversation.id)
  );

  return {
    status: 200,
    body: {
      conversations: conversations.map((conversation) =>
        mapDmConversation(
          conversation,
          params.membership.id,
          latestMessages.get(conversation.id)
        )
      ),
    },
  };
};

export const searchDmParticipants = async (params: {
  eventId: string;
  membership: AuthMembership;
  query?: string;
}) => {
  const normalizedQuery = normalize(params.query);

  const { data, error } = await supabaseAdmin
    .from('event_memberships')
    .select(DM_MEMBERSHIP_SELECT)
    .eq('event_id', params.eventId)
    .eq('account_status', 'ACTIVE')
    .is('deleted_at', null)
    .neq('id', params.membership.id)
    .limit(80);

  if (error) {
    throw new Error(error.message);
  }

  const participants = ((data ?? []) as DmMembershipRecord[])
    .map(mapDmParticipant)
    .filter((participant) => {
      if (!normalizedQuery) {
        return true;
      }

      const searchable = normalize(
        `${participant.name} ${participant.committee} ${participant.role} ${participant.delegationName ?? ''} ${participant.institutionName ?? ''}`
      );

      return searchable.includes(normalizedQuery);
    })
    .slice(0, 20);

  return {
    status: 200,
    body: {
      participants,
    },
  };
};

export const createOrReuseDmConversation = async (params: {
  eventId: string;
  membership: AuthMembership;
  targetMembershipId?: string;
}) => {
  const targetMembershipId = params.targetMembershipId?.trim();

  if (!targetMembershipId) {
    return {
      status: 400,
      body: { error: 'targetMembershipId es requerido' },
    };
  }

  if (targetMembershipId === params.membership.id) {
    return {
      status: 400,
      body: { error: 'No puedes iniciar una conversacion contigo mismo' },
    };
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from('event_memberships')
    .select('id, event_id, account_status')
    .eq('id', targetMembershipId)
    .eq('event_id', params.eventId)
    .is('deleted_at', null)
    .maybeSingle();

  if (targetError) {
    throw new Error(targetError.message);
  }

  if (!target || target.account_status !== 'ACTIVE') {
    return {
      status: 404,
      body: { error: 'Participante no encontrado en este evento' },
    };
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('dm_conversations')
    .select(DM_CONVERSATION_SELECT)
    .eq('event_id', params.eventId)
    .eq('status', 'ACTIVE')
    .or(
      `participant_a_membership_id.eq.${params.membership.id},participant_b_membership_id.eq.${params.membership.id}`
    )
    .order('created_at', { ascending: true });

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingConversation = ((existing ?? []) as DmConversationRow[]).find(
    (conversation) =>
      (conversation.participant_a_membership_id === params.membership.id &&
        conversation.participant_b_membership_id === targetMembershipId) ||
      (conversation.participant_a_membership_id === targetMembershipId &&
        conversation.participant_b_membership_id === params.membership.id)
  );

  if (existingConversation) {
    return {
      status: 200,
      body: {
        conversation: mapDmConversation(existingConversation, params.membership.id),
      },
    };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('dm_conversations')
    .insert({
      event_id: params.eventId,
      participant_a_membership_id: params.membership.id,
      participant_b_membership_id: targetMembershipId,
      created_by_membership_id: params.membership.id,
      status: 'ACTIVE',
    })
    .select(DM_CONVERSATION_SELECT)
    .single();

  if (insertError || !inserted) {
    return {
      status: 400,
      body: { error: insertError?.message ?? 'No se pudo crear la conversacion' },
    };
  }

  await logAudit({
    eventId: params.eventId,
    membership: params.membership,
    actionType: 'CREATE_CONVERSATION',
    entityType: 'DM_CONVERSATION',
    entityId: inserted.id,
    outcome: 'SUCCESS',
    reason: `Conversacion creada con participante ${targetMembershipId}`,
  });

  return {
    status: 201,
    body: {
      conversation: mapDmConversation(inserted as DmConversationRow, params.membership.id),
    },
  };
};

export const listDmMessages = async (params: {
  eventId: string;
  membership: AuthMembership;
  conversationId: string;
}) => {
  const access = await findConversationForMembership({
    conversationId: params.conversationId,
    eventId: params.eventId,
    membershipId: params.membership.id,
  });

  if (!access.allowed) {
    return {
      status: access.status,
      body: { error: access.error },
    };
  }

  const { data, error } = await supabaseAdmin
    .from('dm_messages')
    .select('id, event_id, conversation_id, author_membership_id, content, status, created_at')
    .eq('conversation_id', params.conversationId)
    .eq('event_id', params.eventId)
    .eq('status', 'VISIBLE')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return {
    status: 200,
    body: {
      messages: ((data ?? []) as DmMessageRow[]).map(mapDmMessage),
    },
  };
};

export const createDmMessage = async (params: {
  eventId: string;
  membership: AuthMembership;
  conversationId: string;
  content?: string;
}) => {
  const content = params.content?.trim();

  if (!content) {
    return {
      status: 400,
      body: { error: 'El mensaje no puede estar vacio' },
    };
  }

  const access = await findConversationForMembership({
    conversationId: params.conversationId,
    eventId: params.eventId,
    membershipId: params.membership.id,
  });

  if (!access.allowed) {
    return {
      status: access.status,
      body: { error: access.error },
    };
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('dm_messages')
    .insert({
      event_id: params.eventId,
      conversation_id: params.conversationId,
      author_membership_id: params.membership.id,
      content,
      status: 'VISIBLE',
      updated_at: new Date().toISOString(),
      updated_by_membership_id: params.membership.id,
    })
    .select('id, event_id, conversation_id, author_membership_id, content, status, created_at')
    .single();

  if (error || !inserted) {
    return {
      status: 400,
      body: { error: error?.message ?? 'No se pudo enviar el mensaje' },
    };
  }

  await supabaseAdmin
    .from('dm_conversations')
    .update({ last_message_at: inserted.created_at })
    .eq('id', params.conversationId);

  await logAudit({
    eventId: params.eventId,
    membership: params.membership,
    actionType: 'SEND_DM_MESSAGE',
    entityType: 'DM_MESSAGE',
    entityId: inserted.id,
    outcome: 'SUCCESS',
    reason: `Mensaje enviado en conversacion ${params.conversationId}`,
  });

  return {
    status: 201,
    body: {
      message: mapDmMessage(inserted as DmMessageRow),
    },
  };
};

export const deleteDmMessage = async (params: {
  eventId: string;
  membership: AuthMembership;
  conversationId: string;
  messageId: string;
}) => {
  const access = await findConversationForMembership({
    conversationId: params.conversationId,
    eventId: params.eventId,
    membershipId: params.membership.id,
  });

  if (!access.allowed) {
    return {
      status: access.status,
      body: { error: access.error },
    };
  }

  const { data: message, error: messageError } = await supabaseAdmin
    .from('dm_messages')
    .select('id, event_id, conversation_id, author_membership_id, status')
    .eq('id', params.messageId)
    .eq('conversation_id', params.conversationId)
    .eq('event_id', params.eventId)
    .is('deleted_at', null)
    .maybeSingle();

  if (messageError) {
    throw new Error(messageError.message);
  }

  if (!message) {
    return {
      status: 404,
      body: { error: 'Mensaje no encontrado' },
    };
  }

  if (message.author_membership_id !== params.membership.id) {
    await logDmMessageDeletionAudit({
      eventId: params.eventId,
      membership: params.membership,
      messageId: params.messageId,
      outcome: 'FAILURE',
      reason: 'Intento de eliminar un mensaje ajeno',
    });

    return {
      status: 403,
      body: { error: 'Solo puedes eliminar tus propios mensajes' },
    };
  }

  if (message.status !== 'VISIBLE') {
    return {
      status: 200,
      body: { success: true },
    };
  }

  let updateErrorMessage: string | null = null;
  let appliedStatus: string | null = null;

  for (const status of DELETED_DM_MESSAGE_STATUSES) {
    const { error: updateError } = await supabaseAdmin
      .from('dm_messages')
      .update({
        status,
        updated_at: new Date().toISOString(),
        updated_by_membership_id: params.membership.id,
        deleted_at: new Date().toISOString(),
        deleted_by_membership_id: params.membership.id,
      })
      .eq('id', params.messageId);

    if (!updateError) {
      appliedStatus = status;
      updateErrorMessage = null;
      break;
    }

    updateErrorMessage = updateError.message;
  }

  if (!appliedStatus) {
    await logDmMessageDeletionAudit({
      eventId: params.eventId,
      membership: params.membership,
      messageId: params.messageId,
      outcome: 'FAILURE',
      reason: updateErrorMessage ?? 'No se encontro un estado de eliminacion valido',
    });

    return {
      status: 400,
      body: {
        error:
          'No se pudo eliminar el mensaje. Configura DM_DELETED_MESSAGE_STATUS con un valor real de dm_message_status_enum.',
      },
    };
  }

  await logDmMessageDeletionAudit({
    eventId: params.eventId,
    membership: params.membership,
    messageId: params.messageId,
    outcome: 'SUCCESS',
    reason: `Mensaje eliminado por su autor con status ${appliedStatus}`,
  });

  return {
    status: 200,
    body: { success: true },
  };
};
