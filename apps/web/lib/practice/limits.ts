// Límites locales del modo práctica. Solo protegen el navegador: nunca permiten más que la API real (RN-11).
const MEGABYTE = 1024 * 1024;

export const PRACTICE_LIMITS = {
    maxAttachments: 2,
    maxImageBytes: 2 * MEGABYTE,
    maxPdfBytes: 5 * MEGABYTE,
    maxTotalBytes: 25 * MEGABYTE,
    maxOwnPosts: 30,
    maxOwnComments: 100,
    maxPollOptions: 10,
    minPollOptions: 2,
    maxDmReplies: 3,
} as const;

// Mensajes que la persona lee cuando la práctica alcanza un límite local.
export const PRACTICE_LIMIT_MESSAGES = {
    attachments: `En la práctica solo puedes guardar ${PRACTICE_LIMITS.maxAttachments} adjuntos. Reinicia la práctica para empezar de cero.`,
    imageSize: `Las imágenes de la práctica pueden pesar hasta ${PRACTICE_LIMITS.maxImageBytes / MEGABYTE} MB.`,
    pdfSize: `Los PDF de la práctica pueden pesar hasta ${PRACTICE_LIMITS.maxPdfBytes / MEGABYTE} MB.`,
    totalBytes: `La práctica alcanzó su límite de ${PRACTICE_LIMITS.maxTotalBytes / MEGABYTE} MB de datos. Reinicia la práctica para liberar espacio.`,
    ownPosts: `En la práctica puedes crear hasta ${PRACTICE_LIMITS.maxOwnPosts} publicaciones. Reinicia la práctica para empezar de cero.`,
    ownComments: `En la práctica puedes crear hasta ${PRACTICE_LIMITS.maxOwnComments} comentarios. Reinicia la práctica para empezar de cero.`,
} as const;
