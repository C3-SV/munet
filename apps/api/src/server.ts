import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { supabase } from './lib/supabase';
import authRoutes from './routes/auth.routes';
import postsRoutes from './routes/posts.routes';

const app = express();
const PORT = Number(process.env.PORT ?? 3002);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.WEB_APP_URL ?? 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());
app.use('/auth', authRoutes);
app.use('/posts', postsRoutes);

app.get('/test-supabase', async (req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .limit(1);

  res.json({ data, error });
});

app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});
