import test from "node:test";
import assert from "node:assert/strict";

import { avatarFor, defaultAvatarUrl, resolveAvatarUrl } from "./avatar.utils.ts";

const PHOTO = "https://proyecto.supabase.co/storage/v1/object/public/profile-images/e/m/1-foto.webp";

test("resolveAvatarUrl acepta URLs http y https", () => {
  assert.equal(resolveAvatarUrl(PHOTO), PHOTO);
  assert.equal(resolveAvatarUrl(`  ${PHOTO}  `), PHOTO);
  assert.equal(resolveAvatarUrl("http://localhost:3000/a.png"), "http://localhost:3000/a.png");
});

test("resolveAvatarUrl devuelve null si no hay foto o no es una URL web", () => {
  for (const value of [null, undefined, "", "   ", "ruta/relativa.png", "javascript:alert(1)", "data:image/png;base64,AAAA", "ftp://x/y.png"]) {
    assert.equal(resolveAvatarUrl(value), null, String(value));
  }
});

test("defaultAvatarUrl usa el nombre codificado o 'Participante'", () => {
  assert.match(defaultAvatarUrl("Ana Pérez"), /name=Ana%20P%C3%A9rez/);
  assert.match(defaultAvatarUrl(""), /name=Participante/);
  assert.match(defaultAvatarUrl(null), /name=Participante/);
});

test("avatarFor prefiere la foto y cae al predeterminado con el nombre de la persona", () => {
  assert.equal(avatarFor(PHOTO, "Ana"), PHOTO);
  assert.match(avatarFor(null, "Ana Pérez"), /ui-avatars\.com.*name=Ana%20P%C3%A9rez/);
  assert.match(avatarFor("no-url", "Beto"), /name=Beto/);
});
