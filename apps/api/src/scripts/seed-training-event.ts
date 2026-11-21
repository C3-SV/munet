import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getFileStorage } from '../lib/storage';
import { supabaseAdmin } from '../lib/supabase';
import { runTrainingSeed, type SeedDeps, type SeedStorage } from '../seed/training-event.seed';
import { createParticipantAccount } from '../services/participant-account.service';

// Siembra o reinicia el evento de entrenamiento «Conoce MUNET». Simula por defecto.
//
//   npx ts-node --files src/scripts/seed-training-event.ts                 (simulación, solo lee)
//   npx ts-node --files src/scripts/seed-training-event.ts --apply         (siembra lo que falte)
//   npx ts-node --files src/scripts/seed-training-event.ts --apply --reset (reinicia el evento)
//
// Opciones: --owner <código> (cuenta real de administración que se vincula al evento; por defecto
// adminMUN) y --out <ruta> (listado de credenciales; por defecto .local/usuarios-entrenamiento.json
// en la raíz del repositorio, que git ignora).

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const apply = flag('--apply');
const reset = flag('--reset');
const ownerCode = option('--owner', 'adminMUN');
const out = resolve(option('--out', resolve(__dirname, '../../../../.local/usuarios-entrenamiento.json')));

// Secreto del que salen las contraseñas: variable de entorno o archivo local ignorado por git.
// Si no existe, se crea. Con otro secreto, `--reset` fija contraseñas nuevas para todas las cuentas.
const resolveSecret = (): string => {
  const fromEnv = process.env.TRAINING_SEED_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const file = resolve(__dirname, '../../../../.local/training-seed-secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();

  mkdirSync(dirname(file), { recursive: true });
  const created = randomBytes(24).toString('hex');
  writeFileSync(file, `${created}
`);
  console.log(`Secreto del seed creado en ${file}`);
  return created;
};

const loadStorage = (): SeedStorage | null => {
  try {
    return getFileStorage();
  } catch (error) {
    console.warn('Almacenamiento no configurado; no habrá adjuntos de ejemplo:', error instanceof Error ? error.message : error);
    return null;
  }
};

const deps: SeedDeps = {
  db: supabaseAdmin as unknown as SeedDeps['db'],
  createAccount: createParticipantAccount,
  hash: (plain) => bcrypt.hash(plain, 10),
  storage: loadStorage(),
  upload: async (url, headers, body) => {
    const response = await fetch(url, { method: 'PUT', headers, body: Buffer.from(body) });
    return response.ok;
  },
  now: () => new Date(),
  log: (message) => console.log(message),
  secret: resolveSecret(),
};

runTrainingSeed(deps, { apply, reset, ownerCode })
  .then((report) => {
    // El resumen no incluye contraseñas: van solo al archivo local.
    const { roster, ...summary } = report;
    console.log(JSON.stringify({ ...summary, cuentasEnElListado: roster.length }, null, 2));

    if (apply) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify({ evento: 'Conoce MUNET', generado: new Date().toISOString(), cuentas: roster }, null, 2));
      console.log(`Listado de credenciales escrito en ${out}`);
    } else {
      console.log('Simulación: no se escribió nada. Usa --apply para sembrar.');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('Falló el seed del evento de entrenamiento:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
