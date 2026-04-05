import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { supabase } from './lib/supabase';
const app = express();

app.use(express.json());

app.get('/test-supabase', async (req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .limit(1);

  res.json({ data, error });
});

app.listen(3001, () => {
  console.log('API corriendo en http://localhost:3001');
});
