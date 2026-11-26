import test from "node:test";
import assert from "node:assert/strict";

// Las rutas de descarga y retiro dependen de si el evento es la práctica (un solo adjunto, sin id).
// Se comprueba la regla leyendo la fuente, sin red ni navegador.
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./feed.ts", import.meta.url), "utf8");

test("descarga y retiro usan la ruta por id solo fuera de la práctica", () => {
    assert.match(source, /attachmentId && !isPracticeEvent\(context\.eventId\)\s*\?\s*`\/posts\/\$\{postId\}\/attachments\/\$\{attachmentId\}\/download`/);
    assert.match(source, /attachmentId && !isPracticeEvent\(context\.eventId\)\s*\?\s*`\/posts\/\$\{postId\}\/attachments\/\$\{attachmentId\}`/);
    assert.match(source, /: `\/posts\/\$\{postId\}\/attachment\/download`/);
    assert.match(source, /: `\/posts\/\$\{postId\}\/attachment`/);
});

test("al publicar se envían upload_ids y upload_id (el primero) para la práctica y clientes anteriores", () => {
    assert.match(source, /upload_ids: uploadIds, upload_id: uploadIds\[0\]/);
});

test("la práctica solo admite un archivo por publicación", () => {
    assert.match(source, /isPracticeEvent\(eventId\) && files\.length > 1/);
    assert.match(source, /En la práctica solo puedes adjuntar un archivo/);
});
