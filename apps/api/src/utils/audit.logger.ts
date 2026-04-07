import { supabaseAdmin } from '../lib/supabase';
import type { AuthMembership } from '../types/auth-context';

export type AuditActionType =
  | 'CREATE_POST'
  | 'DELETE_POST'
  | 'POLL_CREATED'
  | 'POLL_CLOSED'
  | 'POLL_VOTE'
  | 'CREATE_COMMENT'
  | 'DELETE_COMMENT'
  | 'CREATE_CONVERSATION'
  | 'SEND_DM_MESSAGE'
  | 'DELETE_DM_MESSAGE'
  | 'UPDATE_PROFILE'
  | 'UPLOAD_AVATAR'
  | 'ADMIN_UPDATE_PROFILE'
  | 'ADMIN_UPLOAD_AVATAR'
  | 'CREATE_EVENT'
  | 'CREATE_COMMITTEE'
  | 'CREATE_MEMBERSHIP'
  | 'CREATE_ACCOUNT';

export type AuditEntityType =
  | 'POST'
  | 'POLL'
  | 'POLL_VOTE'
  | 'COMMENT'
  | 'DM_CONVERSATION'
  | 'DM_MESSAGE'
  | 'PROFILE'
  | 'AVATAR'
  | 'EVENT'
  | 'COMMITTEE'
  | 'MEMBERSHIP'
  | 'ACCOUNT';

export type AuditOutcome = 'SUCCESS' | 'FAILURE';

// Inserta un evento en audit_logs con fallback a membership o actor explicito.
export const logAudit = async (params: {
  eventId: string;
  membership?: AuthMembership;
  actorUserId?: string;
  actorMembershipId?: string;
  actorRole?: string;
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  outcome: AuditOutcome;
  reason: string;
}) => {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      event_id: params.eventId,
      actor_user_id: params.membership?.userId ?? params.actorUserId ?? null,
      actor_membership_id: params.membership?.id ?? params.actorMembershipId ?? null,
      actor_role: params.membership?.role ?? params.actorRole ?? null,
      action_type: params.actionType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      outcome: params.outcome,
      reason: params.reason,
    });
  } catch (error) {
    console.error('Error registrando auditoria:', error);
  }
};
