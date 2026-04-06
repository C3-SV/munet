import { supabaseAdmin } from '../lib/supabase';
import { POST_SELECT, type PostRow, type WallRecord } from '../types/posts.types';
import { findWallBySlug, isDemoPostsEnabled, mapPost } from '../utils/posts.utils';

/**
 * Carga los muros activos.
 * Si se proporciona eventId, filtra únicamente los muros de ese evento.
 */
export const loadWalls = async (eventId?: string) => {
  let query = supabaseAdmin
    .from('walls')
    .select(
      `
        id,
        event_id,
        name,
        wall_type,
        committee_id,
        committees (
          name,
          code
        )
      `
    )
    .eq('status', 'ACTIVE');

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  return query;
};

/**
 * Obtiene los posts de un muro específico.
 * Aquí vive la lógica de negocio para listar publicaciones.
 */
export const getPostsByWall = async (params: {
  muro?: string;
  eventId?: string;
}) => {
  const muro = params.muro ?? 'general';

  // 1. Buscar muros disponibles
  const { data: walls, error: wallsError } = await loadWalls(params.eventId);

  if (wallsError) {
    throw new Error(wallsError.message);
  }

  // 2. Encontrar el muro correspondiente al slug recibido
  const matchedWall = findWallBySlug((walls ?? []) as WallRecord[], muro);

  if (!matchedWall) {
    return {
      status: 404,
      body: { error: 'Muro no encontrado' },
    };
  }

  // 3. Traer posts visibles de ese muro
  const { data: posts, error: postsError } = await supabaseAdmin
    .from('posts')
    .select(POST_SELECT)
    .eq('wall_id', matchedWall.id)
    .eq('status', 'VISIBLE')
    .order('created_at', { ascending: false });

  if (postsError) {
    throw new Error(postsError.message);
  }

  // 4. Devolver respuesta formateada para frontend
  return {
    status: 200,
    body: {
      wall: {
        id: matchedWall.id,
        eventId: matchedWall.event_id,
        name: matchedWall.name,
      },
      posts: ((posts ?? []) as PostRow[]).map(mapPost),
    },
  };
};

/**
 * Crea una nueva publicación en un muro.
 * Resuelve autor, membership, evento y muro antes de insertar.
 */
export const createPostService = async (payload: {
  muro?: string;
  content?: string;
  authorMembershipId?: string;
}) => {
  const { muro = 'general', content, authorMembershipId } = payload;

  const explicitAuthorMembershipId = authorMembershipId?.trim();
  const demoAuthorMembershipId =
    process.env.DEFAULT_POST_AUTHOR_MEMBERSHIP_ID?.trim();

  const effectiveAuthorMembershipId =
    explicitAuthorMembershipId ??
    (isDemoPostsEnabled() ? demoAuthorMembershipId : undefined);

  // 1. Validar contenido
  if (!content?.trim()) {
    return {
      status: 400,
      body: { error: 'El contenido es obligatorio' },
    };
  }

  // 2. Validar autor efectivo
  if (!effectiveAuthorMembershipId) {
    return {
      status: 400,
      body: {
        error:
          'No hay autor autenticado para crear publicaciones. Si estas en modo demo, configura ALLOW_DEMO_POSTS=true y DEFAULT_POST_AUTHOR_MEMBERSHIP_ID.',
      },
    };
  }

  // 3. Buscar membership del autor
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('event_memberships')
    .select('id, event_id')
    .eq('id', effectiveAuthorMembershipId)
    .single();

  if (membershipError || !membership) {
    return {
      status: 404,
      body: { error: 'Membership no encontrado' },
    };
  }

  // 4. Cargar muros del evento del autor
  const { data: walls, error: wallsError } = await loadWalls(membership.event_id);

  if (wallsError) {
    throw new Error(wallsError.message);
  }

  // 5. Buscar el muro destino
  const matchedWall = findWallBySlug((walls ?? []) as WallRecord[], String(muro));

  if (!matchedWall) {
    return {
      status: 404,
      body: { error: 'Muro no encontrado' },
    };
  }

  // 6. Insertar el post
  const { data: insertedPost, error: insertError } = await supabaseAdmin
    .from('posts')
    .insert({
      event_id: membership.event_id,
      wall_id: matchedWall.id,
      author_membership_id: membership.id,
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

  return {
    status: 201,
    body: {
      post: mapPost(insertedPost as PostRow),
    },
  };
};