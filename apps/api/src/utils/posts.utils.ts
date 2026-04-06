import type { PostRow, WallRecord } from '../types/posts.types';

/**
 * Determina si está habilitado el modo demo para crear posts
 * sin un usuario autenticado real.
 */
export const isDemoPostsEnabled = () =>
  ['true', '1', 'yes', 'on'].includes(
    (process.env.ALLOW_DEMO_POSTS ?? '').trim().toLowerCase()
  );

/**
 * Normaliza texto:
 * - evita problemas con mayúsculas/minúsculas
 * - elimina acentos
 * - elimina espacios sobrantes
 *
 * Esto sirve para comparar slugs como "general", "avisos", "comite-..."
 * contra nombres reales de muros.
 */
export const normalize = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * Algunas relaciones de Supabase pueden venir como objeto,
 * arreglo o null. Esta función toma el primer elemento útil.
 */
export const firstItem = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

/**
 * Obtiene una etiqueta legible para un comité.
 * Prioriza el nombre y si no existe usa el código.
 */
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

/**
 * Obtiene el nombre visible del perfil.
 * Si existe display_name lo usa; si no, arma nombre + apellido.
 */
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

  return (
    profile.display_name ??
    `${profile.first_name} ${profile.last_name}`.trim() ??
    'Participante'
  );
};

/**
 * Convierte un post crudo de base de datos a un objeto
 * más limpio y amigable para el frontend.
 */
export const mapPost = (post: PostRow) => {
  const membership = firstItem(post.event_memberships);
  const profile = firstItem(membership?.profiles);

  const committeeTags =
    post.post_committee_tags
      ?.map((tag) => getCommitteeLabel(firstItem(tag.committees)))
      .filter((tag): tag is string => Boolean(tag)) ?? [];

  return {
    id: post.id,
    content: post.content,
    title: post.title,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    timestamp: new Date(post.created_at).getTime(),
    committeeTags,
    user: {
      id: membership?.id ?? 'unknown',
      name: getProfileName(profile),
      avatar:
        profile?.profile_image_path ??
        'https://ui-avatars.com/api/?name=Participante&background=E5E7EB&color=111827',
      role: membership?.role ?? 'DELEGADO',
    },
  };
};

/**
 * Busca el muro correcto a partir de un slug:
 * - general
 * - avisos
 * - comite-xxx
 * - o coincidencia exacta por nombre normalizado
 */
export const findWallBySlug = (walls: WallRecord[], slug: string) => {
  const normalizedSlug = normalize(slug);

  if (normalizedSlug === 'general') {
    return (
      walls.find((wall) => normalize(wall.wall_type).includes('general')) ??
      walls.find((wall) => normalize(wall.name).includes('general')) ??
      walls.find(
        (wall) =>
          wall.committee_id === null &&
          !normalize(wall.name).includes('aviso') &&
          !normalize(wall.wall_type).includes('announce')
      ) ??
      null
    );
  }

  if (normalizedSlug === 'avisos') {
    return (
      walls.find((wall) => normalize(wall.name).includes('aviso')) ??
      walls.find(
        (wall) =>
          normalize(wall.wall_type).includes('announce') ||
          normalize(wall.wall_type).includes('official')
      ) ??
      null
    );
  }

  if (normalizedSlug.startsWith('comite-')) {
    const committeeToken = normalizedSlug.replace('comite-', '');

    return (
      walls.find((wall) =>
        normalize(wall.name).includes(`comite ${committeeToken}`)
      ) ??
      walls.find((wall) =>
        normalize(firstItem(wall.committees)?.name).includes(
          `comite ${committeeToken}`
        )
      ) ??
      walls.find((wall) =>
        normalize(firstItem(wall.committees)?.code).includes(committeeToken)
      ) ??
      null
    );
  }

  return walls.find((wall) => normalize(wall.name) === normalizedSlug) ?? null;
};