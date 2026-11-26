import type { Request } from 'express';
import { rateLimit } from 'express-rate-limit';

// En serverless cada instancia cuenta por separado: el limite es aproximado.
// Un store compartido (Redis) queda como deuda para coordinar todas las instancias.
const limiter = (limit: number, keyGenerator?: (req: Request) => string) => rateLimit({
  windowMs: 60_000,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  // RATE_LIMIT_DISABLED=true permite pruebas locales y de carga sin consumir cupos.
  skip: () => process.env.RATE_LIMIT_DISABLED === 'true',
  handler: (_req, res) => {
    res.status(429).json({ error: 'Demasiados intentos. Espera un momento e intenta de nuevo.' });
  },
});

// Ambas rutas comparten presupuesto para impedir alternar login y activacion.
export const authIpLimiter = limiter(30);
export const authParticipantLimiter = limiter(10, (req) => {
  const code = typeof req.body?.participant_code === 'string' ? req.body.participant_code.trim().toUpperCase() : '';
  return JSON.stringify([req.ip, code]);
});

// requireAuth debe ejecutarse primero para usar la identidad interna, no una IP compartida.
const userKey = (req: Request) => req.auth!.userId;
export const createPostLimiter = limiter(10, userKey);
export const createCommentLimiter = limiter(20, userKey);
// Una publicación puede llevar hasta 12 archivos y cada uno inicia su propia subida.
export const attachmentInitLimiter = limiter(30, userKey);
export const sendDmLimiter = limiter(30, userKey);
export const moderationWriteLimiter = limiter(60, userKey);
// Estado de lectura y resumen de pendientes: la pantalla los consulta con frecuencia moderada.
export const editDmLimiter = limiter(30, userKey);
export const readStateLimiter = limiter(120, userKey);
export const reactionLimiter = limiter(60, userKey);
