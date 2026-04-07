import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth.routes';
import postsRoutes from './routes/posts.routes';
import adminRoutes from './routes/admin.routes';
import eventsRoutes from './routes/events.routes';
import profilesRoutes from './routes/profiles.routes';
import dmRoutes from './routes/dm.routes';
import { normalizeAllowedOrigin } from './lib/cors';

// Punto de entrada principal de la API REST.
// - Carga variables de entorno.
// - Configura CORS básico.
// - Registra middleware JSON y rutas por módulo.
// - Inicia el servidor HTTP.
const app = express();
const PORT = Number(process.env.PORT ?? 3002);
const allowedOrigin = normalizeAllowedOrigin(process.env.WEB_APP_URL);

// Middleware CORS simple para permitir llamadas desde el frontend.
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-event-id');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    
    next();
});

// Parser JSON global con límite para payloads de imágenes en base64.
app.use(express.json({ limit: '10mb' }));
// Registro de rutas por dominio funcional.
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/events', eventsRoutes);
app.use('/profiles', profilesRoutes);
app.use('/posts', postsRoutes);
app.use('/dm', dmRoutes);

// Boot final del servidor.
app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});
