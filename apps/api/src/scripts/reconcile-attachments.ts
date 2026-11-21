import dotenv from 'dotenv';
dotenv.config();

import { runAttachmentMaintenance } from '../services/attachments.maintenance';

// Purga adjuntos de posts eliminados hace más de 30 días (salvo retention_hold) y borra
// objetos huérfanos. Simula por defecto; con --apply ejecuta los borrados.
//
//   npx ts-node --files src/scripts/reconcile-attachments.ts          (simulación)
//   npx ts-node --files src/scripts/reconcile-attachments.ts --apply  (borra)
const apply = process.argv.includes('--apply');

runAttachmentMaintenance({ apply, now: new Date() })
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failures > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Fallo el mantenimiento de adjuntos:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
