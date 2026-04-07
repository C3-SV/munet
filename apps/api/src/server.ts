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


const app = express();
const PORT = Number(process.env.PORT ?? 3002);
const allowedOrigin = normalizeAllowedOrigin(process.env.WEB_APP_URL);

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-event-id');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/events', eventsRoutes);
app.use('/profiles', profilesRoutes);
app.use('/posts', postsRoutes);
app.use('/dm', dmRoutes);

app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});
