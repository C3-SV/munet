// Foto de perfil: una sola regla para directorio, publicaciones, comentarios, mensajes y perfiles.

const DEFAULT_AVATAR_STYLE = 'background=E5E7EB&color=111827';

// Devuelve la URL de la foto si es válida (http o https); si no hay foto o el valor no es una
// URL, devuelve null.
export const resolveAvatarUrl = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  // Solo URLs web: así un valor guardado por error (ruta, data:, javascript:) nunca llega a una imagen.
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
};

// Avatar predeterminado con las iniciales de la persona.
export const defaultAvatarUrl = (name: string | null | undefined): string =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name?.trim() || 'Participante')}&${DEFAULT_AVATAR_STYLE}`;

// La foto de la persona o, si no tiene, el avatar predeterminado con su nombre.
export const avatarFor = (value: string | null | undefined, name: string | null | undefined): string =>
  resolveAvatarUrl(value) ?? defaultAvatarUrl(name);
