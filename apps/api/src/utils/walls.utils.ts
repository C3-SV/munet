import type { WallRecord } from '../types/posts.types';

const normalize = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const slugify = (value: string | null | undefined) =>
  normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export type WallKind = 'general' | 'announcements' | 'committee' | 'other';

export const getWallKind = (wall: Pick<WallRecord, 'committee_id' | 'name' | 'wall_type'>): WallKind => {
  if (wall.committee_id) {
    return 'committee';
  }

  const wallType = normalize(wall.wall_type);
  const wallName = normalize(wall.name);

  if (
    wallName.includes('aviso') ||
    wallType.includes('announce') ||
    wallType.includes('official') ||
    wallType.includes('aviso')
  ) {
    return 'announcements';
  }

  if (wallType.includes('general') || wallName.includes('general')) {
    return 'general';
  }

  return 'other';
};

export const buildWallSlug = (wall: WallRecord) => {
  const kind = getWallKind(wall);

  if (kind === 'general') {
    return 'general';
  }

  if (kind === 'announcements') {
    return 'avisos';
  }

  if (kind === 'committee') {
    const committee = Array.isArray(wall.committees)
      ? wall.committees[0]
      : wall.committees;
    const committeeToken = slugify(committee?.code ?? committee?.name) || wall.id.slice(0, 8);

    return `comite-${committeeToken}`;
  }

  return `muro-${wall.id.slice(0, 8)}`;
};
