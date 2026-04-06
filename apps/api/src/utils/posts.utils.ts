import type { PostRow, WallRecord } from '../types/posts.types';
import { buildWallSlug } from './walls.utils';

export const normalize = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const firstItem = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export const getCommitteeLabel = (
  committee:
    | {
        name: string | null;
        code: string | null;
      }
    | null
) => {
  if (!committee) {
    return null;
  }

  return committee.name ?? committee.code ?? null;
};

export const getProfileName = (
  profile:
    | {
        first_name: string;
        last_name: string;
        display_name: string | null;
      }
    | null
) => {
  if (!profile) {
    return 'Participante';
  }

  return profile.display_name ?? (`${profile.first_name} ${profile.last_name}`.trim() || 'Participante');
};

const buildDeletedMessage = (deletedByActorType: 'AUTHOR' | 'ADMIN' | null) => {
  if (deletedByActorType === 'ADMIN') {
    return 'Esta publicacion fue eliminada por un administrador.';
  }

  return 'Esta publicacion fue eliminada por el autor.';
};

export const mapPost = (post: PostRow) => {
  const membership = firstItem(post.event_memberships);
  const profile = firstItem(membership?.profiles);
  const authorCommittee = getCommitteeLabel(firstItem(membership?.committees));

  const committeeTags =
    post.post_committee_tags
      ?.map((tag) => getCommitteeLabel(firstItem(tag.committees)))
      .filter((tag): tag is string => Boolean(tag)) ?? [];

  const isDeleted = post.status === 'DELETED';

  return {
    id: post.id,
    content: isDeleted ? buildDeletedMessage(post.deleted_by_actor_type) : post.content,
    title: post.title,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    timestamp: new Date(post.created_at).getTime(),
    committeeTags,
    isDeleted,
    deletedByActorType: post.deleted_by_actor_type,
    user: {
      id: membership?.id ?? 'unknown',
      name: getProfileName(profile),
      committeeName: authorCommittee,
      avatar:
        profile?.profile_image_path ??
        'https://ui-avatars.com/api/?name=Participante&background=E5E7EB&color=111827',
      role: membership?.role ?? 'DELEGADO',
    },
  };
};

export const findWallBySlug = (walls: WallRecord[], slug: string) => {
  const normalizedSlug = normalize(slug);

  return (
    walls.find((wall) => normalize(buildWallSlug(wall)) === normalizedSlug) ??
    walls.find((wall) => normalize(wall.name) === normalizedSlug) ??
    null
  );
};
