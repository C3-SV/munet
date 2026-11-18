import test from "node:test";
import assert from "node:assert/strict";

import {
  canAccessCommitteeWall,
  canPublishInAnnouncements,
  isAdminRole,
} from "./rbac.utils.ts";

const COMMITTEE_A = "committee-a";
const COMMITTEE_B = "committee-b";

test("un delegado accede a su propio comité", () => {
  assert.equal(
    canAccessCommitteeWall({
      role: "PARTICIPANT",
      membershipCommitteeId: COMMITTEE_A,
      wallCommitteeId: COMMITTEE_A,
    }),
    true,
  );
});

test("un delegado no accede al muro de otro comité", () => {
  assert.equal(
    canAccessCommitteeWall({
      role: "PARTICIPANT",
      membershipCommitteeId: COMMITTEE_A,
      wallCommitteeId: COMMITTEE_B,
    }),
    false,
  );
});

test("un delegado sin comité no accede a ningún muro de comité", () => {
  assert.equal(
    canAccessCommitteeWall({
      role: "PARTICIPANT",
      membershipCommitteeId: null,
      wallCommitteeId: COMMITTEE_A,
    }),
    false,
  );
});

test("los muros sin comité (general y avisos) son accesibles para cualquier rol", () => {
  for (const role of ["PARTICIPANT", "MODERATOR", "ADMIN_MUN"]) {
    assert.equal(
      canAccessCommitteeWall({
        role,
        membershipCommitteeId: null,
        wallCommitteeId: null,
      }),
      true,
      role,
    );
  }
});

test("un admin accede a todos los muros de comité", () => {
  for (const role of ["ADMIN_MUN", "ADMIN_TECH"]) {
    assert.equal(
      canAccessCommitteeWall({
        role,
        membershipCommitteeId: null,
        wallCommitteeId: COMMITTEE_B,
      }),
      true,
      role,
    );
  }
});

test("un moderador no accede a comités ajenos solo por su rol", () => {
  assert.equal(
    canAccessCommitteeWall({
      role: "MODERATOR",
      membershipCommitteeId: COMMITTEE_A,
      wallCommitteeId: COMMITTEE_B,
    }),
    false,
  );
});

test("solo los admins publican en avisos", () => {
  assert.equal(canPublishInAnnouncements("PARTICIPANT"), false);
  assert.equal(canPublishInAnnouncements("MODERATOR"), false);
  assert.equal(canPublishInAnnouncements("ADMIN_MUN"), true);
  assert.equal(canPublishInAnnouncements("ADMIN_TECH"), true);
});

test("isAdminRole ignora mayúsculas y espacios y rechaza roles vacíos", () => {
  assert.equal(isAdminRole(" admin_mun "), true);
  assert.equal(isAdminRole("PARTICIPANT"), false);
  assert.equal(isAdminRole(null), false);
  assert.equal(isAdminRole(undefined), false);
});
