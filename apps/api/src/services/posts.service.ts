import type { AuthMembership } from '../types/auth-context';
import { supabaseAdmin } from '../lib/supabase';
import { POST_SELECT, type PostRow } from '../types/posts.types';
import { logAudit } from '../utils/audit.logger';
import { findWallBySlug, mapPost } from '../utils/posts.utils';
import { isAdminRole } from '../utils/rbac.utils';
import { loadWallsByEvent, mapWallForMembership } from './walls.service';

type PollStatus = 'OPEN' | 'CLOSED';
type PostType = 'TEXT' | 'POLL';

type PollRow = {
  id: string;
  post_id: string;
  event_id: string;
  wall_id: string;
  author_membership_id: string;
  question: string;
  status: PollStatus;
  closed_at: string | null;
  closed_by_membership_id: string | null;
};

type PollOptionRow = {
  id: string;
  poll_id: string;
  option_text: string;
  sort_order: number;
};

type PollVoteRow = {
  id: string;
  poll_id: string;
  option_id: string;
  voter_membership_id: string;
};

type PollView = {
  id: string;
  status: PollStatus;
  isClosed: boolean;
  totalVotes: number;
  canVote: boolean;
  canClose: boolean;
  options: {
    id: string;
    text: string;
    votes: number;
    percentage: number;
    isSelectedByMe: boolean;
  }[];
};

type NormalizedPost = ReturnType<typeof mapPost> & {
  canDelete: boolean;
  postType: PostType;
  poll: PollView | null;
};

const normalizePostType = (value: string | null | undefined): PostType => {
  const normalized = (value ?? '').trim().toUpperCase();
  return normalized === 'POLL' ? 'POLL' : 'TEXT';
};

const normalizePollOptions = (rawOptions: string[] | undefined) => {
  const options = (rawOptions ?? [])
    .map((option) => option.trim())
    .filter((option) => option.length > 0);

  const seen = new Set<string>();
  const unique: string[] = [];

  options.forEach((option) => {
    const key = option.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(option);
    }
  });

  return unique;
};

const normalizePost = (post: PostRow, membership: AuthMembership): NormalizedPost => {
  const isAdmin = isAdminRole(membership.role);
  const mapped = mapPost(post);

  return {
    ...mapped,
    postType: normalizePostType(post.post_type),
    poll: null,
    canDelete: isAdmin || post.author_membership_id === membership.id,
  };
};

const logPollAudit = async (params: {
  eventId: string;
  membership: AuthMembership;
  pollId: string;
  actionType: 'POLL_CREATED' | 'POLL_CLOSED';
  outcome: 'SUCCESS' | 'FAILURE';
  reason: string;
}) => {
  await logAudit({
    eventId: params.eventId,
    membership: params.membership,
    actionType: params.actionType,
    entityType: 'POLL',
    entityId: params.pollId,
    outcome: params.outcome,
    reason: params.reason,
  });
};

const attachPollDataToPosts = async (params: {
  posts: NormalizedPost[];
  sourcePosts: PostRow[];
  eventId: string;
  membership: AuthMembership;
}) => {
  const pollPostIds = params.sourcePosts
    .filter((post) => normalizePostType(post.post_type) === 'POLL')
    .map((post) => post.id);

  if (pollPostIds.length === 0) {
    return params.posts;
  }

  const { data: pollsData, error: pollsError } = await supabaseAdmin
    .from('polls')
    .select(
      'id, post_id, event_id, wall_id, author_membership_id, question, status, closed_at, closed_by_membership_id'
    )
    .eq('event_id', params.eventId)
    .in('post_id', pollPostIds);

  if (pollsError) {
    throw new Error(pollsError.message);
  }

  const polls = (pollsData ?? []) as PollRow[];

  if (polls.length === 0) {
    return params.posts;
  }

  const pollIds = polls.map((poll) => poll.id);

  const { data: optionsData, error: optionsError } = await supabaseAdmin
    .from('poll_options')
    .select('id, poll_id, option_text, sort_order')
    .in('poll_id', pollIds)
    .order('sort_order', { ascending: true });

  if (optionsError) {
    throw new Error(optionsError.message);
  }

  const { data: votesData, error: votesError } = await supabaseAdmin
    .from('poll_votes')
    .select('id, poll_id, option_id, voter_membership_id')
    .in('poll_id', pollIds);

  if (votesError) {
    throw new Error(votesError.message);
  }

  const options = (optionsData ?? []) as PollOptionRow[];
  const votes = (votesData ?? []) as PollVoteRow[];

  const pollByPostId = new Map<string, PollRow>();
  polls.forEach((poll) => {
    pollByPostId.set(poll.post_id, poll);
  });

  const optionsByPollId = new Map<string, PollOptionRow[]>();
  options.forEach((option) => {
    const list = optionsByPollId.get(option.poll_id) ?? [];
    list.push(option);
    optionsByPollId.set(option.poll_id, list);
  });

  const votesByPollId = new Map<string, PollVoteRow[]>();
  votes.forEach((vote) => {
    const list = votesByPollId.get(vote.poll_id) ?? [];
    list.push(vote);
    votesByPollId.set(vote.poll_id, list);
  });

  return params.posts.map((post) => {
    if (post.postType !== 'POLL') {
      return post;
    }

    const poll = pollByPostId.get(post.id);

    if (!poll) {
      return post;
    }

    const pollOptions = optionsByPollId.get(poll.id) ?? [];
    const pollVotes = votesByPollId.get(poll.id) ?? [];
    const totalVotes = pollVotes.length;
    const selectedVote = pollVotes.find(
      (vote) => vote.voter_membership_id === params.membership.id
    );

    const votesByOption = new Map<string, number>();
    pollVotes.forEach((vote) => {
      votesByOption.set(vote.option_id, (votesByOption.get(vote.option_id) ?? 0) + 1);
    });

    const pollView: PollView = {
      id: poll.id,
      status: poll.status,
      isClosed: poll.status === 'CLOSED',
      totalVotes,
      canVote: poll.status === 'OPEN' && !post.isDeleted,
      canClose:
        poll.status === 'OPEN' &&
        poll.author_membership_id === params.membership.id &&
        !post.isDeleted,
      options: pollOptions.map((option) => {
        const votesCount = votesByOption.get(option.id) ?? 0;
        const percentage = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;

        return {
          id: option.id,
          text: option.option_text,
          votes: votesCount,
          percentage,
          isSelectedByMe: selectedVote?.option_id === option.id,
        };
      }),
    };

    return {
      ...post,
      poll: pollView,
    };
  });
};

const buildPostResponseById = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
}) => {
  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .select(POST_SELECT)
    .eq('id', params.postId)
    .eq('event_id', params.eventId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!post) {
    return null;
  }

  const mapped = normalizePost(post as PostRow, params.membership);
  const [enriched] = await attachPollDataToPosts({
    posts: [mapped],
    sourcePosts: [post as PostRow],
    eventId: params.eventId,
    membership: params.membership,
  });

  return enriched;
};

const resolvePostContext = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
}) => {
  const { data: post, error: postError } = await supabaseAdmin
    .from('posts')
    .select('id, event_id, wall_id, status, author_membership_id, post_type')
    .eq('id', params.postId)
    .is('deleted_at', null)
    .maybeSingle();

  if (postError) {
    throw new Error(postError.message);
  }

  if (!post || post.event_id !== params.eventId) {
    return {
      allowed: false as const,
      status: 404,
      body: { error: 'Post no encontrado en este evento' },
    };
  }

  const walls = await loadWallsByEvent(params.eventId);
  const matchedWall = walls.find((wall) => wall.id === post.wall_id);

  if (!matchedWall) {
    return {
      allowed: false as const,
      status: 404,
      body: { error: 'Muro no encontrado' },
    };
  }

  const wallView = mapWallForMembership(matchedWall, params.membership);

  if (!wallView.canAccess) {
    return {
      allowed: false as const,
      status: 403,
      body: { error: 'No tienes acceso a este post' },
    };
  }

  return {
    allowed: true as const,
    post: {
      id: post.id as string,
      eventId: post.event_id as string,
      wallId: post.wall_id as string,
      status: post.status as string,
      authorMembershipId: post.author_membership_id as string,
      postType: normalizePostType(post.post_type as string),
    },
  };
};

const loadPollByPost = async (params: { postId: string; eventId: string }) => {
  const { data: poll, error } = await supabaseAdmin
    .from('polls')
    .select(
      'id, post_id, event_id, wall_id, author_membership_id, question, status, closed_at, closed_by_membership_id'
    )
    .eq('post_id', params.postId)
    .eq('event_id', params.eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (poll as PollRow | null) ?? null;
};

export const getPostsByWall = async (params: {
  muro?: string;
  eventId: string;
  membership: AuthMembership;
}) => {
  const muro = params.muro ?? 'general';

  const walls = await loadWallsByEvent(params.eventId);
  const matchedWall = findWallBySlug(walls, muro);

  if (!matchedWall) {
    return {
      status: 404,
      body: { error: 'Muro no encontrado' },
    };
  }

  const wallView = mapWallForMembership(matchedWall, params.membership);

  if (!wallView.canAccess) {
    return {
      status: 403,
      body: { error: 'No tienes acceso a este muro', wall: wallView },
    };
  }

  const { data: posts, error: postsError } = await supabaseAdmin
    .from('posts')
    .select(POST_SELECT)
    .eq('event_id', params.eventId)
    .eq('wall_id', matchedWall.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (postsError) {
    throw new Error(postsError.message);
  }

  const sourcePosts = ((posts ?? []) as PostRow[]).filter((post) => post.status === 'VISIBLE');

  const normalizedPosts = sourcePosts.map((post) => normalizePost(post, params.membership));

  const postsWithPolls = await attachPollDataToPosts({
    posts: normalizedPosts,
    sourcePosts,
    eventId: params.eventId,
    membership: params.membership,
  });

  return {
    status: 200,
    body: {
      wall: wallView,
      posts: postsWithPolls,
    },
  };
};

export const createPostService = async (payload: {
  muro?: string;
  content?: string;
  postType?: string;
  pollOptions?: string[];
  eventId: string;
  membership: AuthMembership;
}) => {
  const { muro = 'general', content, membership, eventId } = payload;
  const postType = normalizePostType(payload.postType);

  if (!content?.trim()) {
    return {
      status: 400,
      body: { error: 'El contenido es obligatorio' },
    };
  }

  const pollOptions = normalizePollOptions(payload.pollOptions);

  if (postType === 'POLL') {
    if (pollOptions.length < 2) {
      return {
        status: 400,
        body: { error: 'Una encuesta debe tener al menos 2 opciones validas' },
      };
    }

    if (pollOptions.length > 10) {
      return {
        status: 400,
        body: { error: 'Una encuesta puede tener maximo 10 opciones' },
      };
    }
  }

  const walls = await loadWallsByEvent(eventId);
  const matchedWall = findWallBySlug(walls, String(muro));

  if (!matchedWall) {
    return {
      status: 404,
      body: { error: 'Muro no encontrado' },
    };
  }

  const wallView = mapWallForMembership(matchedWall, membership);

  if (!wallView.canAccess) {
    return {
      status: 403,
      body: { error: 'No tienes acceso a este muro' },
    };
  }

  if (!wallView.canPublish) {
    return {
      status: 403,
      body: { error: 'No tienes permisos para publicar en este muro' },
    };
  }

  const { data: insertedPost, error: insertError } = await supabaseAdmin
    .from('posts')
    .insert({
      event_id: eventId,
      wall_id: matchedWall.id,
      author_membership_id: membership.id,
      created_by_membership_id: membership.id,
      updated_by_membership_id: membership.id,
      post_type: postType,
      content: content.trim(),
    })
    .select(POST_SELECT)
    .single();

  if (insertError || !insertedPost) {
    return {
      status: 400,
      body: { error: insertError?.message ?? 'No se pudo crear el post' },
    };
  }

  if (postType === 'TEXT') {
    await logAudit({
      eventId,
      membership,
      actionType: 'CREATE_POST',
      entityType: 'POST',
      entityId: insertedPost.id,
      outcome: 'SUCCESS',
      reason: `Post de texto creado en muro ${matchedWall.id}`,
    });
  }

  if (postType === 'POLL') {
    const { data: pollData, error: pollError } = await supabaseAdmin
      .from('polls')
      .insert({
        event_id: eventId,
        wall_id: matchedWall.id,
        post_id: insertedPost.id,
        author_membership_id: membership.id,
        question: content.trim(),
        status: 'OPEN',
      })
      .select('id, post_id')
      .single();

    if (pollError || !pollData) {
      await supabaseAdmin.from('posts').delete().eq('id', insertedPost.id);
      return {
        status: 400,
        body: { error: pollError?.message ?? 'No se pudo crear la encuesta' },
      };
    }

    const optionsPayload = pollOptions.map((optionText, index) => ({
      poll_id: pollData.id,
      option_text: optionText,
      sort_order: index,
    }));

    const { error: optionsError } = await supabaseAdmin
      .from('poll_options')
      .insert(optionsPayload);

    if (optionsError) {
      await supabaseAdmin.from('polls').delete().eq('id', pollData.id);
      await supabaseAdmin.from('posts').delete().eq('id', insertedPost.id);
      return {
        status: 400,
        body: { error: optionsError.message ?? 'No se pudieron crear las opciones de la encuesta' },
      };
    }

    await logPollAudit({
      eventId,
      membership,
      pollId: pollData.id,
      actionType: 'POLL_CREATED',
      outcome: 'SUCCESS',
      reason: `Encuesta creada en muro ${matchedWall.id} para post ${insertedPost.id}`,
    });
  }

  const post = await buildPostResponseById({
    postId: insertedPost.id,
    eventId,
    membership,
  });

  if (!post) {
    return {
      status: 404,
      body: { error: 'Post no encontrado' },
    };
  }

  return {
    status: 201,
    body: {
      post,
    },
  };
};

export const voteOnPollService = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
  optionId?: string;
}) => {
  const optionId = params.optionId?.trim();

  if (!optionId) {
    return {
      status: 400,
      body: { error: 'option_id es requerido' },
    };
  }

  const access = await resolvePostContext(params);

  if (!access.allowed) {
    return access;
  }

  if (access.post.status === 'DELETED') {
    return {
      status: 400,
      body: { error: 'No puedes votar en una publicacion eliminada' },
    };
  }

  if (access.post.postType !== 'POLL') {
    return {
      status: 400,
      body: { error: 'Este post no es una encuesta' },
    };
  }

  const poll = await loadPollByPost({
    postId: params.postId,
    eventId: params.eventId,
  });

  if (!poll) {
    return {
      status: 404,
      body: { error: 'Encuesta no encontrada' },
    };
  }

  if (poll.status !== 'OPEN') {
    return {
      status: 400,
      body: { error: 'La encuesta esta cerrada' },
    };
  }

  const { data: option, error: optionError } = await supabaseAdmin
    .from('poll_options')
    .select('id')
    .eq('id', optionId)
    .eq('poll_id', poll.id)
    .maybeSingle();

  if (optionError) {
    throw new Error(optionError.message);
  }

  if (!option) {
    return {
      status: 404,
      body: { error: 'Opcion de encuesta no encontrada' },
    };
  }

  const { data: existingVotes, error: existingVotesError } = await supabaseAdmin
    .from('poll_votes')
    .select('id')
    .eq('poll_id', poll.id)
    .eq('voter_membership_id', params.membership.id)
    .order('voted_at', { ascending: false });

  if (existingVotesError) {
    throw new Error(existingVotesError.message);
  }

  const latestVoteId = existingVotes?.[0]?.id ?? null;
  const staleVoteIds = (existingVotes ?? []).slice(1).map((vote) => vote.id);

  if (latestVoteId) {
    const { error: updateVoteError } = await supabaseAdmin
      .from('poll_votes')
      .update({
        option_id: optionId,
        voted_at: new Date().toISOString(),
      })
      .eq('id', latestVoteId);

    if (updateVoteError) {
      return {
        status: 400,
        body: { error: updateVoteError.message ?? 'No se pudo registrar el voto' },
      };
    }

    if (staleVoteIds.length > 0) {
      const { error: cleanupError } = await supabaseAdmin
        .from('poll_votes')
        .delete()
        .in('id', staleVoteIds);

      if (cleanupError) {
        throw new Error(cleanupError.message);
      }
    }
  } else {
    const { error: insertVoteError } = await supabaseAdmin.from('poll_votes').insert({
      poll_id: poll.id,
      option_id: optionId,
      voter_membership_id: params.membership.id,
      voted_at: new Date().toISOString(),
    });

    if (insertVoteError) {
      return {
        status: 400,
        body: { error: insertVoteError.message ?? 'No se pudo registrar el voto' },
      };
    }
  }

  await logAudit({
    eventId: params.eventId,
    membership: params.membership,
    actionType: 'POLL_VOTE',
    entityType: 'POLL_VOTE',
    entityId: poll.id,
    outcome: 'SUCCESS',
    reason: `Voto registrado en encuesta ${poll.id} opcion ${optionId}`,
  });

  const post = await buildPostResponseById({
    postId: params.postId,
    eventId: params.eventId,
    membership: params.membership,
  });

  if (!post) {
    return {
      status: 404,
      body: { error: 'Post no encontrado' },
    };
  }

  return {
    status: 200,
    body: { post },
  };
};

export const closePollService = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
}) => {
  const access = await resolvePostContext(params);

  if (!access.allowed) {
    return access;
  }

  if (access.post.postType !== 'POLL') {
    return {
      status: 400,
      body: { error: 'Este post no es una encuesta' },
    };
  }

  const poll = await loadPollByPost({
    postId: params.postId,
    eventId: params.eventId,
  });

  if (!poll) {
    return {
      status: 404,
      body: { error: 'Encuesta no encontrada' },
    };
  }

  if (poll.author_membership_id !== params.membership.id) {
    await logPollAudit({
      eventId: params.eventId,
      membership: params.membership,
      pollId: poll.id,
      actionType: 'POLL_CLOSED',
      outcome: 'FAILURE',
      reason: 'Intento de cierre sin ser autor de la encuesta',
    });

    return {
      status: 403,
      body: { error: 'Solo el creador puede cerrar esta encuesta' },
    };
  }

  if (poll.status === 'CLOSED') {
    const post = await buildPostResponseById({
      postId: params.postId,
      eventId: params.eventId,
      membership: params.membership,
    });

    if (!post) {
      return {
        status: 404,
        body: { error: 'Post no encontrado' },
      };
    }

    return {
      status: 200,
      body: { post },
    };
  }

  const { error: updateError } = await supabaseAdmin
    .from('polls')
    .update({
      status: 'CLOSED',
      closed_at: new Date().toISOString(),
      closed_by_membership_id: params.membership.id,
    })
    .eq('id', poll.id);

  if (updateError) {
    await logPollAudit({
      eventId: params.eventId,
      membership: params.membership,
      pollId: poll.id,
      actionType: 'POLL_CLOSED',
      outcome: 'FAILURE',
      reason: updateError.message,
    });

    return {
      status: 400,
      body: { error: updateError.message ?? 'No se pudo cerrar la encuesta' },
    };
  }

  await logPollAudit({
    eventId: params.eventId,
    membership: params.membership,
    pollId: poll.id,
    actionType: 'POLL_CLOSED',
    outcome: 'SUCCESS',
    reason: `Encuesta cerrada para post ${params.postId}`,
  });

  const post = await buildPostResponseById({
    postId: params.postId,
    eventId: params.eventId,
    membership: params.membership,
  });

  if (!post) {
    return {
      status: 404,
      body: { error: 'Post no encontrado' },
    };
  }

  return {
    status: 200,
    body: { post },
  };
};

export const deletePostService = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
}) => {
  const { data: post, error: postError } = await supabaseAdmin
    .from('posts')
    .select('id, event_id, wall_id, author_membership_id, status')
    .eq('id', params.postId)
    .is('deleted_at', null)
    .maybeSingle();

  if (postError) {
    throw new Error(postError.message);
  }

  if (!post || post.event_id !== params.eventId) {
    return {
      status: 404,
      body: { error: 'Post no encontrado en este evento' },
    };
  }

  const walls = await loadWallsByEvent(params.eventId);
  const matchedWall = walls.find((wall) => wall.id === post.wall_id);

  if (!matchedWall) {
    return {
      status: 404,
      body: { error: 'Muro no encontrado' },
    };
  }

  const wallView = mapWallForMembership(matchedWall, params.membership);

  if (!wallView.canAccess) {
    return {
      status: 403,
      body: { error: 'No tienes acceso a este post' },
    };
  }

  const isAdmin = isAdminRole(params.membership.role);
  const isAuthor = post.author_membership_id === params.membership.id;

  if (!isAdmin && !isAuthor) {
    return {
      status: 403,
      body: { error: 'No tienes permisos para eliminar esta publicacion' },
    };
  }

  const deletedByActorType = isAuthor ? 'AUTHOR' : 'ADMIN';

  const { data: updatedPost, error: updateError } = await supabaseAdmin
    .from('posts')
    .update({
      status: 'DELETED',
      deleted_by_membership_id: deletedByActorType,
      deleted_at: new Date().toISOString(),
      updated_by_membership_id: params.membership.id,
    })
    .eq('id', post.id)
    .select(POST_SELECT)
    .single();

  if (updateError || !updatedPost) {
    return {
      status: 400,
      body: { error: updateError?.message ?? 'No se pudo eliminar el post' },
    };
  }

  await logAudit({
    eventId: params.eventId,
    membership: params.membership,
    actionType: 'DELETE_POST',
    entityType: 'POST',
    entityId: post.id,
    outcome: 'SUCCESS',
    reason: `Post eliminado por ${deletedByActorType} en muro ${post.wall_id}`,
  });

  const [postWithPoll] = await attachPollDataToPosts({
    posts: [normalizePost(updatedPost as PostRow, params.membership)],
    sourcePosts: [updatedPost as PostRow],
    eventId: params.eventId,
    membership: params.membership,
  });

  return {
    status: 200,
    body: {
      post: postWithPoll,
    },
  };
};
